# STATUS.md

Running log of where the build is. Newest entry first.

---
## 2026-09-11 · M11 Export and parity · DONE (Josh delegated sign-off). AT-5 automated half in place; the human half is watching the file.

**What exists now**

- `server/src/renderQueue.ts`: in-process queue, one render at a time, jobs in the `render` table (queued → rendering → done | failed, progress 0..1, output path, error). The render function is injectable; the real one is `renderMedia` on the one composition with the ORIGINAL footage via `buildProjectProps`.
- Routes: `POST /render { projectId }` → 202, `GET /render/:id` (status, progress, `outputUrl` when done), `GET /renders?projectId=`. Output files under `media/renders/project-<p>-<r>.mp4`, served by the static media route.
- `server/src/index.ts` passes the server's own origin into the app so the render worker fetches footage, images and template files over HTTP from itself.
- `server/src/parity.ts`: `compareFrames` (mean absolute difference per channel, max, fraction of differing pixels; different sizes sampled down), `extractFrame` (ffmpeg), `runParity` (export frame vs the same frame rendered from the PREVIEW runner's props, proxy footage included). `npm run parity -- --id N [--frames a,b,c] [--export file]`. Threshold: mean diff ≤ 6/255.
- `buildProjectProps` takes `runner: 'preview' | 'export'` so parity can build the Player's props on the server.
- App: `ExportPanel` in the editor header: Export MP4 button, Queued / Rendering n% / Download MP4 / Export failed.
- Missing-export-bug guard: `server/src/exportRegression.test.ts` exports a project on the real stand-in with a live server, pulls frame 75 out of the MP4 and checks the panel colour AND the logo fetched over HTTP. It caught a real bug: a project keeping the template's default logo (`images/logo.png`) made `applyLottieValues` clear the asset directory, so both runners drew a broken image. Fixed: relative image values keep the directory; unit test added.
- 207 tests across 41 files. Typecheck clean.

**Verified by eye**

- Editor: pressed Export MP4; header went Queued → Rendering → Download MP4 in 9 s; the link serves `video/mp4`, 285 frames of H.264 at 1920x1080.
- `npm run parity -- --id 1 --frames 10,75,142,200`: all within threshold (mean 4.2 to 4.7 out of 255, about 1.8% of pixels differing, which is the proxy's 960-wide footage against the 1280-wide original along the test pattern's hard edges). Frame pairs inspected side by side.
- Rendered a fresh default project earlier in this milestone and looked at frame 75: that is how the broken logo was found.

**Notes**

- Broadcast delivery specs (bitrate targets, LUFS) are out of scope per SPEC 6; H.264 defaults from Remotion are used.
- Preview parity is measured with a server-side still of the preview props, not a screenshot of the Player element. Same composition, same props the Player gets.

**Next:** M12, playback performance.

---

## 2026-09-11 · M10 Transitions · DONE (Josh delegated sign-off)

**What exists now**

- `composition/src/transitions.ts`: presets `cut | fade | wipe | slide`, `TransitionProps` per boundary (`afterElementId`), `effectiveTimeline` (elements in start order; neighbours joined by a non-cut transition form a chain where the next element begins where the previous ends minus the overlap; transitions capped below the shorter neighbour), `compositionDurationWithTransitions`.
- `Main` renders a chain of one as a plain `Sequence`, and a chain of several with `@remotion/transitions` `TransitionSeries` (fade, wipe from left, slide from right, `linearTiming`). `Root` takes its duration from the chains. `transitions.render.test.ts` proves the M10 tests at the pixel level with real `renderStill`: a cut is red then blue, a fade blends both at the boundary, switching to a wipe changes the output (one side blue, the other red), and the composition shrinks by the overlap.
- DB: `project_transition` (project, after_element, preset, duration). `getProjectTransitions`, `setProjectTransition` ('cut' deletes). Server: `GET /projects/:id` includes `transitions`; `PUT /projects/:id/transitions/:afterElementId { preset, durationInFrames }` validates preset and length. Export runner passes transitions with string element ids.
- App: the timeline shows a "then" row under each element that has a following enabled element, with a preset select and a length field. Saved immediately; the Player duration and bars follow the effective timeline.
- Stand-in has a second element (`standin-2`, frames 150 to 300, same Lottie) added directly in the database for verification; ingest still creates one element per export.
- 192 tests across 37 files. Typecheck clean.

**Verified by eye**

- Editor: set the transition after element 1 to fade. Footer went from 300 to 285 frames, the PUT returned 200 and the header showed Saved. Scrubbed to `00:04:22`, the middle of the boundary: the outgoing headline and bar are half-transparent over the incoming element.
- Server render: 285 frames. Frames 130, 142, 160 extracted: before the boundary, mid-fade (both elements visible blended), after (second element only).

**Next:** M11, export and parity.

---

## 2026-09-11 · M9 Timeline · DONE (Josh delegated sign-off)

**What exists now**

- Composition: `MainProps.elements` replaces the single `lottie` prop. Each enabled element renders in a Remotion `<Sequence>` at its in/out points, bottom to top by z. `compositionDurationFor` (latest enabled out point) drives both the Player and `calculateMetadata`. `elements.render.test.ts` proves the two MILESTONES tests at the pixel level with real `renderStill`: moving an in point changes when the element appears; toggling it off removes it.
- DB: `project_element` (per-project start/end/enabled overrides; template defaults untouched). `getProjectElements` merges defaults with overrides; `setProjectElement` patches. This table is an addition to SPEC 3, needed because elements are moved per project.
- Server: `GET /projects/:id` returns the merged elements; `PUT /projects/:id/elements/:elementId { startFrame?, endFrame?, enabled? }` validates (out after in, 404s) and returns the element. `buildProjectProps` carries the overrides into the export runner.
- App: `Timeline` under the monitor. Ruler with second ticks; click or drag to scrub (drives the Player via `seekTo`, playhead follows `frameupdate`). One row per element, top of the stack first: toggle checkbox, name, a draggable bar with in/out timecodes in Plex Mono; dragging keeps the length and clamps at frame 0. Changes save through the PUT, debounced.
- 172 tests across 33 files. Typecheck clean.

**Verified by eye**

- Clicked the ruler at the midpoint: playhead read `00:02:15` and the monitor jumped to that frame. Dragged the bar right: element now `00:01:01 – 00:06:01`, footer shows 181 frames, header shows Saved, a `PUT /projects/1/elements/1` returned 200.
- Server render of the moved project: 181 frames; frame 15 shows only background and footage (element not yet in), frame 60 shows the panel and headline.

**Notes**

- One Bodymovin export is still one element, so every element shares the template's Lottie. Multi-element ingest is the next step for this data model, not in the milestone list.
- Synthetic `PointerEvent` dispatch from a script does not reach React's handlers in this Chromium; real mouse input does. Timeline unit tests use Testing Library's `fireEvent` which does.

**Next:** M10, transitions.

---

## 2026-09-11 · M8 Footage and image params · DONE (Josh delegated sign-off). AT-3 complete.

**What exists now**

- `composition/src/media.ts`: `mediaFillRect` (the cc.mediaFill slot as fractions of the frame, from a solid or a rectangle shape with layer and group transforms; rotation ignored), `mediaSourceFor(asset, 'preview' | 'export')` (THE two-runners decision, one function both runners call), `withBaseUrl` (server-relative image values get the runner's base), `resolveLottieAssets` (a template's own `images/` resolve to the template folder on the server).
- `Main` takes a `media` prop `{ src, rect, fit }` and renders `OffthreadVideo` in the slot rectangle UNDER the Lottie. `applyLottieValues` makes the slot layer transparent when footage is assigned, so the video shows through. No branch on runner anywhere in the composition; `Main.test.tsx` proves the same component renders the proxy or the original purely from props.
- Preview runner (`Editor.tsx` `Monitor`): proxy URL through `/api`. Export runner (`server/src/renderProject.ts` `buildProjectProps`): original at an absolute server URL. `npm run render:project -- --id N` renders a saved project server-side (the dev server must be running: footage and images are fetched over HTTP, which is why CORS matters).
- `POST /images` stores a replacement logo under `/media/images/`; the inspector's image control uploads and previews it. Footage control: a select over uploaded clips plus Cover/Contain. The Footage panel's click also assigns the clip.
- Stand-in fixture now has `cc.logo` (an orange placeholder PNG in `images/`) and a `cc.mediaFill` solid over the right half. Six params after re-ingest.
- 153 tests across 28 files. Typecheck clean.

**Verified by eye**

- Editor: footage select shows the uploaded clip; the Player's video element points at the proxy, sits at left 50% / width 50%, object-fit cover; the Lottie's logo image points at the uploaded blue PNG.
- Server render of the same project (`m8-project-1.mp4`): frames 20 and 75 show the test-pattern footage in the right half, the blue logo bottom right, the headline and bar on the panel. Same layout as the preview.

**Notes**

- Footage shorter than the composition simply ends; looping or trimming is a timeline concern (M9+).
- Lottie image replacement uses lottie-web's default `xMidYMid slice` (cover) inside the authored slot.

**Next:** M9, timeline.

---

## 2026-09-11 · M7 Media upload and proxies · DONE (Josh delegated sign-off)

**What exists now**

- `server/src/media/ffmpeg.ts`: `findBinary` (env `CAMPAIGNCUT_FFMPEG_DIR`, PATH, then the winget install folder on Windows), `probe` (ffprobe JSON: width, height, duration, fps, codec, audio), `makeProxy` (scale to 960 wide, H.264 crf 24, yuv420p, `-movflags +faststart`, AAC), `makePoster` (one JPEG at 480 wide).
- `POST /media` (multipart field `file`): rejects non-video by MIME/extension, saves the original to `media/originals/`, probes, writes `media/proxies/<stem>.mp4` and `media/thumbs/<stem>.jpg`, inserts a `media_asset` row, returns 201 with URLs. Cleans up on failure. `GET /media`, `GET /media/:id`. Static `/media/*`.
- CORS on every route via `@fastify/cors` (`origin: true`). `media.test.ts` has the regression guard for the missing-export bug: the media route and the template files both send `Access-Control-Allow-Origin`.
- `media_asset` table with `insertMediaAsset`, `getMediaAsset`, `listMediaAssets`.
- App: `MediaPanel` in the editor's right column under the inspector: Upload link (file input), list with poster thumbnail, filename, timecode, dimensions, fps. Selecting a clip is wired to `cc.mediaFill` in M8.
- `server/fixtures/clip-1280x720-25fps-2s.mp4`: a 2-second FFmpeg test-pattern clip with a 440 Hz tone, used by the probe/proxy/upload tests (real ffmpeg, not mocked).
- 129 tests across 24 files. Typecheck clean.

**Verified by eye**

- Uploaded the fixture over real HTTP with curl: 201 with 1280x720, 25 fps, 2.0 s; original, proxy and thumb on disk; `GET /media` lists it; the proxy URL answers with `access-control-allow-origin` for the app origin.
- Editor shows the Footage panel with the clip's poster loaded, `00:02:00 · 1280×720 · 25 fps`.

**Notes**

- Proxy and poster generation run inline in the upload request. Fine for one user; a queue would be the fix if uploads ever overlap.

**Next:** M8, footage and image params.

---

## 2026-09-11 · M6 Schema-driven inspector · DONE (Josh delegated sign-off). Most of AT-3.

**What exists now**

- `app/src/components/Inspector.tsx`: controls generated from the schema, one per param, no per-template code. Text: input with `maxLength` from `maxChars`, truncation, a `n/max` counter, and a "position and size locked" note for the disclaimer. Colour: swatch plus hex field; only valid hex is emitted, invalid hex shows a red border and leaves the authored colour alone. Image and media: placeholders until M7/M8.
- `app/src/pages/Editor.tsx`: values flow into `applyLottieValues` and the Player live, debounced 60 ms so typing stays smooth. Changed keys are saved 400 ms after the last edit via `PUT /projects/:id/values`; the header shows Unsaved / Saving… / Saved / Save failed.
- Server: `PUT /projects/:id/values` upserts only the given keys and bumps `updated_at` (`db.setProjectValues`). 400 on a bad body, 404 on a missing project.
- 116 tests across 20 files. Typecheck clean. App tests stub the Player to expose its inputProps.

**Verified by eye**

- In the editor, set the headline to "LIVE FROM M6" and the accent to `#2B54E6`: the Player's SVG text and bar fill changed within a second, the header showed "Saved". Reloaded the page: both fields and the video came back with the edited values.

**Next:** M7, media upload and proxies.

---

## 2026-09-11 · M5 Library UI · DONE (Josh delegated sign-off)

**What exists now**

- Server: `GET /templates` (grouped by ad type in sort order, templates by name, with `thumbUrl`), `GET /templates/:slug` (meta, schema, elements), static `/templates/<slug>/*` for template.json, thumb.png and images, `GET /projects`, `POST /projects { templateSlug, name? }` (copies every schema default into `project_value`, returns 201 with the id), `GET /projects/:id` (project, template, schema, elements, values). `buildApp({ db, templatesDir })` is injectable for tests.
- DB: `template_element`, `project`, `project_value` tables (SPEC 3) with `upsertTemplateElement`, `listTemplateElements`, `getTemplateBySlug`, `createProject`, `getProject`, `listProjects`. Ingest now registers one element per template spanning its duration.
- App: two screens with a tiny history-API router. `Library` shows ad type > ad example with thumbnail, timecode, dimensions, fps; clicking creates a project and opens `/projects/:id`. `Editor` loads the project, applies its saved values through `applyLottieValues`, shows the Player and, in an inspector column, the M2 harness (M6 replaces it). The Console styling: IBM Plex Sans/Mono via @font-face, hairlines, zero radius, no shadows, cobalt only for focus/active.
- `formatTimecode` moved into the composition package (shared by library and, later, the timeline).
- 102 tests across 17 files. Typecheck clean.

**Verified by eye**

- Library at `/`: "Contrast" group, the stand-in card with a loaded thumbnail and `00:05:00 · 1920×1080 · 30 fps`, Plex Sans applied.
- Clicking the card creates a project and lands on `/projects/<id>` with the Player rendering and the inspector pre-filled from the saved values.

**Notes**

- App tests stub `@remotion/lottie` in `src/test-setup.ts` because lottie-web touches a canvas at import time under jsdom.
- DESIGN.md is still missing; styling follows the SPEC section 4 summary.

**Next:** M6, schema-driven inspector.

---

## 2026-09-11 · M4 Ingest CLI · DONE (Josh delegated sign-off). This is AT-1.

**What exists now**

- `npm run ingest -- <handover-folder-or-json> --ad-type "Contrast" --name "..." [--slug ...]`. Validates first (tags via M3, meta fields non-zero, every referenced font has a file), writes nothing on failure, prints every problem naming the layer or font. On success: copies the Lottie and `images/` into `templates/<slug>/`, writes `schema.json` and `meta.json`, renders `thumb.png` from the middle frame through the one composition (`renderStill`), and upserts the `template` row in SQLite.
- `server/src/db/index.ts`: `openDb()` creates `ad_type` and `template` tables (SPEC 3), seeds the five ad types, `upsertTemplate` by slug, `listTemplates`. DB file at `media/campaigncut.db` (gitignored), override with `CAMPAIGNCUT_DB`. The server package now exports `./db`, `./render`, `./paths` for the ingest tool.
- `tools/ingest/src/fonts.ts`: font file lookup by family name. Fonts handed over in the export's `fonts/` folder are copied into `app/public/fonts`.
- `app/public/fonts/`: IBM Plex Sans Regular and Bold, IBM Plex Mono Regular (OFL, from IBM's repo). The stand-in now references IBM Plex Sans instead of Arial so it passes its own font check. Browser `@font-face` loading is still M13, so text currently falls back to the system sans in both preview and export.
- `tools/ingest/fixtures/standin/data.json` is the hand-made "designer handover"; `templates/standin/` is now generated output from ingesting it.
- 86 tests across 13 files. Typecheck clean.

**Verified by eye**

- Real ingest of the stand-in: prints the four tags, fonts, params; `templates/standin/` has template.json, schema.json, meta.json, thumb.png; DB row present with correct fields. thumb.png inspected: headline, bar, panel at the mid frame.
- A copy referencing Arial: rejected with the font named, exit 1, no folder created, no DB row.
- App reloads on the regenerated template with all four fields and the Player rendering.

**Decisions**

- Font check lives in M4 (SPEC 1.4 and the M4 test list both require it); M13 keeps browser font loading.
- Thumbnail rendering is injectable so tests use a stub; the real Remotion render is verified by running the CLI.

**Next:** M5, Library UI.

---

## 2026-09-11 · M3 Tag reader and schema generator · DONE (Josh delegated sign-off)

**What exists now**

- `tools/ingest/src/tags.ts`: `parseTag` for `cc.<role>` and `cc.<role>.<n>`. Case-sensitive, exact.
- `tools/ingest/src/roles.ts`: the role table from SPEC 1.1 (kind, label, repeated, locked). Adding a role is a one-line change here.
- `tools/ingest/src/generateSchema.ts`: walks every layer including pre-comp layers (paths into `/assets/N/layers/M`), resolves each tag to its JSON-pointer target (text layer; first fill else first stroke inside the shape; image asset), reads authored defaults (text, colour as hex, image source), derives `maxChars` from box text size, extracts font families via the Bodymovin fonts list. Returns params, fonts, a report of every tag, and errors naming the layer. Never throws for authoring mistakes.
- `npm run schema -- <lottie.json> [--out file] [--dry-run]`: prints the tag list and fonts, writes `schema.json` next to the input, exits 1 and writes nothing on any error.
- `templates/standin/schema.json` is now generated, not hand-written. The generator caught a rounding mistake in my hand-written accent default (`#F0592A` should be `#F05929`).
- 66 tests across 10 files. Typecheck clean.

**Verified by eye**

- CLI on the stand-in: lists all four tags with paths, fonts `Arial`, four params, writes the file.
- CLI on a deliberately broken copy (wrong-case `cc.Headline`, `cc.accent` with its fill removed, unknown `cc.tagline`): three errors each naming the layer, exit code 1, nothing written.
- App still shows the four harness fields from the generated schema and the Player renders.

**Next:** M4, the ingest CLI. Not started.

---

## 2026-09-11 · M2 The mutation layer · DONE (verified by Josh)

**What exists now**

- `composition/src/applyLottieValues.ts`: the pure function from SPEC.md section 2. Deep-clones the Lottie, applies user values by schema, never touches the source, memoized on the values object (WeakMap). Handles text (`t.d.k[*].s.t`, every keyframe), fill and stroke colour (`c.k` as normalised RGBA; animated colours get every keyframe), and image assets (`p`, `u`, `e`). Unknown keys and invalid colours are ignored.
- `composition/src/schema.ts`: `TemplateParam` and `ParamValues` types. `path` is an RFC 6901 JSON pointer whose target depends on kind (text: the layer; color: the fill/stroke item; image: the asset).
- `composition/src/jsonPointer.ts` and `hexToRgba.ts`: small pure helpers with their own tests.
- `templates/standin/schema.json`: hand-written schema for the stand-in (headline, disclaimer, accent, surface). M3 generates this automatically.
- App: a throwaway harness above the Player with one control per schema param. Typing runs `applyLottieValues` and the Player updates live. M6 replaces it with the generated inspector.
- `npm run render:standin -- --values file.json --out name.mp4` renders with edits applied, through the same function.
- 37 tests across 8 files. Typecheck clean.

**Verified by eye**

- Server MP4 with edited values (`m2-edited.mp4`): frame 75 shows the new headline, new disclaimer, cobalt bar and plum panel. The export carries the edits through the same code path as the preview.
- Browser: set the headline field to "VOTE TUESDAY"; the Player's SVG text changed to match without a reload and the old string was gone.

**Notes**

- The root `render:standin` script now ends in `--` so flags pass through npm to the server workspace.

**Next:** M3, tag reader and schema generator. Not started.

---

## 2026-09-11 · M1 Lottie on screen · DONE (verified by Josh in browser and MP4)

**What exists now**

- `composition/src/LottieLayer.tsx`: the Lottie renderer inside a full-frame absolutely positioned wrapper. This is the fix for the positioning bug and `LottieLayer.test.tsx` guards it.
- `composition/src/Main.tsx` replaces the M0 frame counter: solid background from props, Lottie composited over it. Frame counter files removed.
- `composition/src/lottieDuration.ts`: derives composition frames from the Lottie's in/out points and authored fps. Used by the Player (app) and by `calculateMetadata` in the Remotion root (server), so both runners get the same length.
- `templates/standin/template.json`: a hand-written Bodymovin-format stand-in with `cc.surface`, `cc.accent`, `cc.headline`, `cc.safe.disclaimer` and one untagged `progress-dot`. It is the hardcoded template for M1 and will serve as a fixture for M2 and M3. Replace with a real After Effects export when one exists.
- `npm run render:standin` (was `render:m0`) renders it server-side to `media/renders/m1-standin.mp4`.
- 15 tests across 5 files. Typecheck and app build clean.

**Verified by eye**

- Server MP4: h264, 1920x1080, 30 fps, 150 frames. Frames 0, 10, 40, 75, 149 extracted and inspected: panel wipes in, bar grows, headline fades up, dot crosses the frame reaching centre at 75 and right edge at 149. Layout matches the authored coordinates, so the Lottie is overlaying the frame, not sitting below it.
- Browser Player: same animation plays over the teal background. Measured in the page: the Lottie SVG's bounding box equals the composition's bounding box exactly; wrapper style is absolute, top 0, left 0, 100% by 100%.

**Notes**

- Text uses Arial by family name; lottie-web falls back to the system font. Fonts are handled properly in M13.
- The dev-server preview pane is flaky at taking screenshots; DOM measurement via script was used alongside.

**Next:** M2, the mutation layer. Not started.

---


## 2026-09-11 · M0 Scaffold · DONE (verified by Josh in browser and MP4)

**What exists now**

- npm workspaces monorepo: `app`, `server`, `composition`, `tools/ingest` (placeholder only).
- `composition` exports the one Remotion composition: `main`, 1920x1080, 30 fps, 150 frames. It draws a solid colour and a frame counter with timecode. `FrameCounter.tsx` is the Remotion wrapper, `FrameCounterView.tsx` is the pure view the unit tests exercise.
- `app`: Vite + React 18 + Tailwind 4. Shows the composition in `<Player>` and a `server: ok` indicator that reaches the API through Vite's `/api` proxy.
- `server`: Fastify 5 with `GET /health`. `npm run render:m0` bundles the composition and renders it with `renderMedia` to `media/renders/m0-frame-counter.mp4`.
- `npm run dev` starts both. `npm run test` runs Vitest across all workspaces (11 tests). `npm run typecheck` and `npm run build -w app` pass.

**Verified by eye**

- Player in the browser shows the counter and plays.
- MP4 probed: h264, 1920x1080, 30/1 fps, 150 frames, 5.0 s. Frames 0, 75, 149 extracted and inspected; counter and timecode are correct.

**Bugs caught by browser verification, not by tests**

- The server honoured the generic `PORT` env var, which the dev-server launcher sets to the app's port. The page said `server: down`. Renamed to `CAMPAIGNCUT_SERVER_PORT`.
- Remotion's bundler (esbuild) breaks under Vitest's jsdom environment. The bundling test is marked `@vitest-environment node`.

**Decisions**

- TypeScript pinned to 5.9, not 7.x. React pinned to 18 per CLAUDE.md. All `@remotion/*` at 4.0.523 exactly.
- Remotion downloads Chrome Headless Shell (113 MB) on first render into `node_modules/.remotion`. Gitignored via `node_modules`.

**Next:** M1, Lottie on screen. Not started.
