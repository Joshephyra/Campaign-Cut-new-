# MILESTONES.md

One milestone per working session. Do them in order. Do not skip ahead. Do not start the next one in the same session.

Mark a milestone done only when its **Done when** line is true and a human has verified it in a browser.

Status key: `TODO` · `IN PROGRESS` · `DONE`

---

## M0 · Scaffold · DONE

Get a running skeleton with the module boundary that matters.

**Build**
- Monorepo with npm workspaces: `app`, `server`, `composition`, `tools/ingest`
- Vite + React + TypeScript + Tailwind in `app`
- Fastify + TypeScript in `server`
- `composition` exports one Remotion composition rendering a solid color and a frame counter
- `app` renders it in `<Player>`. `server` can render it with `renderMedia`.
- `npm run dev` starts both. One command.
- `.gitignore` covering `node_modules`, `.env`, `/media`, build output
- Vitest configured and running

**Tests**
- `composition` builds and exports a valid `Composition`
- Server health endpoint returns 200

**Done when:** `npm run dev` opens the app, a colored frame counter plays in the Player, and a server-side render of the same composition produces an MP4 you can open. The same composition file produced both.

---

## M1 · Lottie on screen · DONE

**Build**
- `<LottieLayer>` in `composition` wrapping `@remotion/lottie`
- **Full-frame absolutely positioned wrapper.** This is the fix for the positioning bug.
- Hardcode one template JSON path for now
- Composite it over a solid background

**Tests**
- Regression: the Lottie wrapper renders at the composition's full width and height with the layer at origin (this is the positioning-bug guard)
- Composition renders without throwing when given a valid Lottie JSON

**Done when:** a real Bodymovin export plays inside the Player, overlaying the background, filling the frame, at the right speed.

---

## M2 · The mutation layer · DONE

The most important pure function in the codebase. See `SPEC.md` section 2.

**Build**
- `applyLottieValues(source, values, schema)` in `composition`
- Text via `layer.t.d.k[].s.t`
- Fill color via shape items `ty: "fl"`, `.c.k`, normalized RGBA
- Stroke color via `ty: "st"`
- Image via the `assets` array
- Pure. Deep clone. Never mutates `source`. Memoized on `values`.

**Tests**
- Changing a text value produces new JSON with the new string and leaves everything else byte-identical
- `source` is unmodified after the call
- Hex to normalized RGBA conversion is correct at the boundaries (`#000000`, `#FFFFFF`, a mid value)
- An unknown key is ignored rather than throwing
- Called twice with the same values, returns a memoized result

**Done when:** typing into a test harness changes the text on screen live, with no reload.

---

## M3 · Tag reader and schema generator · DONE

**Build**
- Walk a Lottie JSON, find every layer whose name starts with `cc.`
- Parse `cc.<role>` and `cc.<role>.<n>`
- Map role to `kind` per the table in `SPEC.md` 1.1
- Emit `TemplateParam[]` including the JSON pointer `path`
- Derive `maxChars` from the AE text box where available
- Extract referenced font families into meta

**Tests**
- A fixture Lottie with each role produces the expected schema
- Repeated `cc.stat.N` tags produce N distinct params in order
- An unknown `cc.` role is reported as an error naming the layer
- A `cc.accent` on a layer with no fill is reported as an error naming the layer
- Case sensitivity: `cc.Headline` does not match `cc.headline` and is reported as unknown

**Done when:** running the generator on the real template prints the full tag list and writes a `schema.json` that matches what was authored.

---

## M4 · Ingest CLI · DONE

**Build**
- `npm run ingest -- <path-to-bodymovin-export> --ad-type "Contrast" --name "..."`
- Copies the Lottie and assets into `/templates/<slug>/`
- Runs the schema generator, writes `schema.json` and `meta.json`
- Runs validation from `SPEC.md` 1.4. Rejects and names the offending layer.
- **Prints every `cc.` tag it found**, so the author can see what was picked up
- Registers the template in SQLite
- Generates a thumbnail

**Tests**
- A valid fixture ingests and produces all three files plus a DB row
- A fixture with a missing font fails validation with the font name in the message
- A fixture with an unknown tag fails validation with the layer name in the message
- Ingesting twice with the same slug updates rather than duplicating

**Done when:** one command turns a fresh Bodymovin export into a template visible in the app. **This is AT-1.**

---

## M5 · Library UI · DONE

**Build**
- Ad type > ad example browse, per `SPEC.md` section 3
- Thumbnails, duration, dimensions
- Click a template, create a project, land in the editor
- The Console styling from `DESIGN.md`

**Tests**
- Library lists templates grouped by ad type in sort order
- Creating a project from a template copies the schema defaults into `project_value`

**Done when:** you can browse the library and open a template into the editor.

---

## M6 · Schema-driven inspector · DONE

**Build**
- Inspector renders controls **generated from the schema**. No per-template code.
- Text inputs with `maxChars` enforced
- Color pickers with hex input
- Changes flow into `applyLottieValues` and update the Player live
- Debounce to keep typing smooth
- Values persist to `project_value`

**Tests**
- A template with 3 text and 1 color param renders exactly 4 controls
- Typing updates the rendered composition
- Reloading the page restores the saved values
- `maxChars` blocks input past the limit

**Done when:** you change text and a color and watch it happen live. Reload and it is still there. **This is most of AT-3.**

---

## M7 · Media upload and proxies · DONE

**Build**
- Upload endpoint, files land in `/media/originals`
- `ffprobe` for width, height, duration, fps
- `ffmpeg` proxy at 960x540, H.264, `-movflags +faststart`
- Poster thumbnail
- `media_asset` row
- Static media route **with correct CORS headers.** This is the missing-export bug guard.

**Tests**
- Regression: the media route responds with `Access-Control-Allow-Origin` (this is the export-bug guard)
- Upload produces original, proxy, and thumbnail on disk plus a DB row
- Probe metadata matches a known fixture

**Done when:** you upload a clip and see its thumbnail and correct duration in the app.

---

## M8 · Footage and image params · DONE

**Build**
- `cc.mediaFill` slot: user footage renders through the template's designated area
- Composition takes a `mediaSrc` prop. Preview gets the proxy. Export gets the original. **This is the two-runners split. Wire it now and never fork it.**
- `cc.logo` image replacement through the Lottie `assets` array
- Fit and crop behavior for mismatched aspect ratios

**Tests**
- The composition renders the proxy path when given proxy props and the original path when given original props
- Logo replacement swaps the asset and leaves the rest of the JSON identical

**Done when:** you swap the background footage and the logo and both appear correctly. **AT-3 complete.**

---

## M9 · Timeline · DONE

**Build**
- Element stack in z order with in and out points
- Playhead scrubbing
- Toggle elements on and off
- Timecode display in IBM Plex Mono

**Tests**
- Moving an element's in point changes when it appears in the rendered output
- Toggling an element off removes it from the composition

**Done when:** you can scrub the timeline and move an element in time, and the monitor follows.

---

## M10 · Transitions · DONE

**Build**
- `@remotion/transitions` with `TransitionSeries` between elements
- A small preset list: cut, fade, wipe, slide
- Transition choice stored per element boundary

**Tests**
- A chosen transition appears in the rendered frames at the boundary
- Changing the transition changes the output

**Done when:** you pick a transition between two elements and see it play.

---

## M11 · Export and parity · DONE

The milestone that decides whether this is a product.

**Build**
- `POST /render`, in-process queue, one job at a time
- `renderMedia` against the same composition with original media
- Progress polling, download link
- **Parity script:** extract export frames at given timestamps, compare against Player frames at the same timestamps

**Tests**
- Regression: an export of a template with an ingested Lottie layer contains that layer (this is the missing-export-bug guard)
- Render job moves through queued, rendering, done
- Parity script reports below-threshold difference on a fixture

**Done when:** you export a full-resolution MP4, open it, and it matches what you saw. **This is AT-5 and it requires watching the file.**

---

## M12 · Playback performance · IN PROGRESS

Only start this after M11. Measure before optimizing.

**Build**
- Measure and record current frame rate on the real template
- Apply the levers in `SPEC.md` section 5 in order, measuring after each
- Only mount Lottie elements near the playhead

**Tests**
- A recorded performance baseline that later work can be compared against

**Done when:** sustained 24fps or better on the real template on a normal laptop. **This is AT-4.**

---

## M13 · Fonts · DONE

**Build**
- Extract font references at ingest, fail validation on missing fonts
- `@font-face` loading in the app
- Wait for `document.fonts.ready` before the first render
- Ship font files alongside templates

**Tests**
- Ingest fails with a clear message when a referenced font is absent
- A template renders identical text metrics before and after a reload

**Done when:** text in the app matches the After Effects reference in size, weight, and line breaks.

---

## M14 · Background removal · DONE

Spike. Timeboxed. Cut this before cutting anything else.

**Build**
- Chroma key shader first, with spill suppression and threshold controls
- Only if chroma key is solid: evaluate one ML matting option

**Tests**
- Chroma key on a green-screen fixture produces expected alpha at sampled pixels

**Done when:** a green-screen clip keys cleanly in preview and in export.

---

## M15 · After Effects pre-flight script · IN PROGRESS

**Build**
- `tools/ae-preflight/preflight.jsx`, run from After Effects via File > Scripts > Run Script File
- Reports every `cc.` tag with layer and resolved role
- Flags untagged text layers
- Flags unsupported effects, blend modes, and 3D layers by layer name
- Reports comp duration, dimensions, fps, and referenced fonts
- Writes a plain text report next to the project file

**Tests**
- Manual. Run it on the real template and confirm the report matches what is in the comp.

**Done when:** running it inside After Effects on a real template produces an accurate report. It does not export anything.

---

## M16 · After Effects project dump script · IN PROGRESS

The pre-flight script (M15) answers "will this tag work". This answers "what is actually in this project", so a real template can be analysed against what Lottie carries before any ingest work is guessed at.

**Build**
- `tools/ae-preflight/dump.jsx`, run from After Effects via File > Scripts > Run Script File
- Walks the whole project: every comp, footage item, solid and folder
- For every layer: type, index, parent, in/out/start, stretch, blend mode, 3D, track matte, enabled/solo/shy/guide flags
- For every property: match name, value, every keyframe (time, value, in/out interpolation, temporal ease), expression text and whether it is enabled
- Text layers: font, size, text, box text, tracking, leading, and every text animator
- Shape layers: groups, paths (vertex counts), fills, strokes, gradients, trim paths, repeaters, merge paths
- Masks: mode, feather, expansion, vertex count
- Effects: name, match name, every parameter value
- Per-comp summary: keyframe, expression, effect and mask counts, plus every expression's source listed by layer and property
- Writes `dump-<project>.txt` (readable tree) and `dump-<project>.json` (hand-serialised, no JSON object in ExtendScript) next to the project file

**Tests** (`tools/ingest/src/dump.test.ts`, walker exercised in Node against a fake project)
- Source is ES3-safe and never renders, saves or changes the project
- Project items: comps with settings, footage with path and dimensions, solids with colour, folders
- Layer flags and timing come through, including parent and track matte
- Property tree: static values, keyframes with interpolation and ease, expressions with enabled flag
- Text document and animators
- Shape contents, masks, effects with parameters
- Summary counts and the expression list
- The JSON writer escapes quotes, newlines and non-ASCII and round-trips through `JSON.parse`

**Done when:** running it on a real project produces files that name every layer, keyframe, expression and effect. Manual run in After Effects by Josh, as with M15.

---

## M17 · Multi-element templates · DONE

Today one Bodymovin export is one element and every element in a project shares the template's single Lottie. SPEC section 3 describes an ad example as several elements (open, lower third, stat callout, end card, disclaimer) already placed on the timeline. This makes that real, with no bespoke code per design.

**Build**
- Handover folder with one sub-folder per element, each a Bodymovin export (`data.json` plus `images/`), and an optional `elements.json` manifest giving each element its slug, name, start frame and z-index. Without a manifest: alphabetical folder order, laid end to end, slugs derived from the folder names.
- A single-export handover (a `data.json` at the top) still works and becomes a one-element template.
- Ingest validates every element (tags, fonts, comp settings) and reports problems prefixed with the element, writes nothing on failure, and writes `templates/<slug>/elements/<element>/{template.json, schema.json, images/}` plus a template-level `meta.json` (with an `elements` list), `fonts/` (the union) and a composite `thumb.png` rendered through the composition with every element in place.
- Every element must share fps, width and height; a mismatch fails naming the element.
- Template duration is the last element's out point.
- `template_element` gains a `name` column (migration adds it to existing databases).
- API: each element returned by `GET /templates/:slug` and `GET /projects/:id` carries its own `schema` and `lottieUrl`; the top-level `schema` goes away. `POST /projects` seeds defaults for every element.
- Export runner (`buildProjectProps`) builds each element from its own Lottie, schema and values. Footage comes from the first element (in start order) that has a media slot and a clip chosen.
- Editor: loads every element's Lottie, keeps values per element, and shows the inspector for the selected element (SPEC section 4). Clicking an element in the timeline selects it; element tabs above the inspector do the same. The preview runner builds each element's Lottie exactly as the export runner does.
- The composition does not change: `ElementProps` already carries one Lottie per element.

**Tests**
- Ingest: three-folder handover with manifest produces three element directories, meta with timing, three `template_element` rows, and a 240-frame template; no manifest gives alphabetical sequential order; a bad tag fails naming element and layer with nothing written; mismatched fps fails naming the element; fonts are the union shipped once; the thumbnail renderer receives every element with its timing; duplicate element slugs are rejected; the single-export path still works and lands in `elements/<slug>/`.
- Server: element files resolve to `elements/<slug>/` with a fallback to the template root for old layouts; `GET /templates/:slug` and `GET /projects/:id` carry per-element schema and lottieUrl; `POST /projects` seeds defaults for every element; `buildProjectProps` gives each element its own Lottie and values and takes footage from the element that has it.
- App: the editor loads both Lotties, shows the first element's controls, switches to the second element's controls when its timeline row is clicked, saves with that element's id, and hands the Player two different Lotties. Timeline reports row selection.

**Done when:** the three-element fixture ingests with one command, opens with three bars on the timeline, each element's text edits live in the preview, and the export matches the preview (parity script) with a human watching.

---

## M18 · Transform editing · DONE

Josh's concern (2026-09-13): the content feels locked. Every tagged text and image layer already carries its position, scale and rotation in the Lottie JSON; this exposes them, as offsets from what the designer authored, so the animation itself is untouched.

**Build**
- New param kind `transform`. The schema generator adds a `<key>.transform` param (with `for: <key>`) for every text and image tag that is not locked (`cc.safe.*` stays fixed). Colours, footage slots and untagged layers get none.
- Value `{ x, y, scale, rotation }`: x and y are fractions of the frame (CLAUDE.md: positions are fractions), scale a multiplier, rotation degrees. Default is the identity.
- `applyLottieValues` applies a transform to the layer's `ks`: position offset added to the static value or to every keyframe (split x/y dimensions included), scale multiplied, rotation added. Same code in both runners, as always.
- Inspector: a Placement row under each text and image control with X, Y, Scale, Rotation and Reset.
- Monitor: a "Drag on monitor" toggle per placement. While on, an invisible capture surface sits over the Player and dragging moves that layer; the preview itself shows the result. It draws nothing (the monitor stays untouched visually) and is off by default. Flagged in STATUS as the one deliberate exception to "nothing overlays the monitor"; Josh can veto it.
- Element timing already lives on the timeline (M9), so per-layer retiming is not part of this.

**Tests**
- Composition: static position offset in pixels from fractions; every keyframe (and end value) offset; split-dimension positions; scale multiplied leaving z alone; rotation added; identity is a no-op; source untouched; bad values ignored.
- Schema generator: transform params for text and image tags, keyed and ordered after their parent, none for locked, colour or media tags; path is the layer.
- Inspector: placement inputs render under the parent control; editing X reports a fraction; Reset restores the identity.
- Editor: dragging on the monitor surface moves the layer in the Player's props by the right number of pixels and saves the transform value.

**Done when:** a headline can be nudged and scaled in the browser, the change survives a reload, and the export matches the preview (parity script).

---

## M19 · Fidelity harness · DONE

AT-2 is Germain's call: does the app's render hold up against the After Effects reference? Until now there was nothing to put in front of him but two videos. This puts numbers, side-by-side frames and a difference map in front of him, and turns fidelity into something every later change is checked against.

**Build**
- `reference.mp4` in a handover folder is copied into `templates/<slug>/reference.mp4` at ingest.
- `npm run fidelity -- --template <slug> [--project <id>] [--reference <mp4>] [--render <mp4>] [--samples 12] [--threshold 6]`: renders the template with its authored defaults (or a project) through the export runner, samples both videos at the same points in time (not frame indexes, so a reference at another frame rate still lines up), scales the reference to the composition size, and compares each pair with the parity comparison.
- For every sample: the reference frame, the render frame, a difference heat map, and a side-by-side strip (reference | render | difference) written to `media/fidelity/<slug>-<time>/`, plus `report.txt` and `report.json`. Each line names the time, the mean and max difference, the share of differing pixels, and the region (as fractions of the frame) where the differences are.
- Verdict per run: within threshold on every sample, or the worst sample named with its region. Exit 1 on differences, so it can gate later work.
- `buildTemplateDefaultProps` in the export runner: the template as authored, no project needed.

**Tests**
- Sample times are evenly spaced and never hit the very end.
- The difference map of identical frames is black with no region; a drawn box shows up as a region at the right fractions and the right share of pixels.
- The report names the worst sample and its region and round-trips as JSON.
- End to end with ffmpeg-made videos (a solid clip and the same clip with a box drawn on it): the harness flags the box's region on every sample and writes every file.
- Template default props carry every element with its authored values.
- Ingest copies `reference.mp4` when it is there.

**Done when:** the harness runs on a template with a reference, the strips open and show what differs, and the report says where. Verified here against a reference made from the moved-headline export of the three-part project: the open's frames flag the headline region, the end card passes.

---

## M20 · Footage trim and audio · DONE

Ads have sound, and a staffer's clip is rarely the right length. Both go through the same composition so the export carries exactly what the preview played.

**Build**
- Footage value gains `inS`, `outS` and `muted`. The composition plays the clip from `inS`, stops it at `outS`, and mutes its own sound when asked; `mediaTiming` turns seconds into frames in one place for both runners.
- A music bed per project: upload an audio file (mp3, wav, m4a, aac, ogg, flac) through the same upload; it is probed, stored as a media asset of kind `audio` (no proxy, no poster), and both runners use the original. `project_audio` holds the chosen track, its volume and where in the track to start. The composition renders it with Remotion's `Audio`.
- API: `GET /projects/:id` carries `audio`; `PUT /projects/:id/audio` sets or clears it. Media assets carry `kind`.
- Inspector: under the footage control, Start and End in seconds and a "Mute footage sound" tick. A new Audio panel: pick a track, volume, start offset, or none. The Footage panel accepts audio uploads and lists them.
- Export: the MP4 carries the mixed sound because the composition does.

**Tests**
- `mediaTiming`: seconds to frames, ignores empty or backwards values.
- The composition hands OffthreadVideo `startFrom`, `endAt` and `muted`, and renders `Audio` with the track, volume and start.
- Upload of an ffmpeg-made wav becomes an asset of kind `audio` with its duration and no proxy; a video upload stays kind `video`; junk is still rejected.
- `project_audio` round trip through the API, validation of asset kind, clearing.
- The export runner carries trim frames on the footage and the audio track at an absolute URL.
- Inspector trim fields and mute report the right value shape; the Audio panel reports track, volume and start; the editor hands the Player an `audio` prop and saves it.

**Done when:** a trimmed clip starts where the user set it in both preview and export, and a music bed is audible in the exported MP4 (ffprobe shows the audio stream; a human listens).

---

## M21 · Footage per element · DONE

Since M17 a template has several elements, but footage was still one slot per project, taken from the first element that had one. A real spot has different footage under the open, the middle and the end card. Josh said keep going; this is the limit STATUS has flagged twice.

**Build**
- The footage slot moves from the composition's props to each element: `ElementProps.media`. The composition renders an element's footage inside that element's own Sequence, under its Lottie, so it starts and stops with the element and its trim is relative to the element's in point. Chains with transitions carry it the same way.
- The export runner builds each element's footage from that element's own `cc.mediaFill` value. No more "first element wins".
- The editor: the Footage panel's "use this clip" goes to the selected element when it has a slot, else to the first element that does; each element's inspector shows its own clip, trim, fit and key.
- Nothing changes in the database: footage values were already stored per element.

**Tests**
- The composition renders one video per element that has footage, each in its own slot rectangle, and none for elements without.
- The export runner gives each element its own clip and leaves the others empty; preview and export differ only in proxy versus original.
- Editor: choosing a clip with the end card selected puts it on the end card, not the open.
- Existing render, parity and fidelity checks keep passing with the prop moved.

**Done when:** the three-part project plays the green-screen clip under the open and the test pattern under the end card, in preview and in the export (parity script).

---

## M22 · Projects in the library · DONE

Every click on a template made a new project, and the only way back to one was its URL. A staffer needs to find yesterday's spot, rename it, copy it for a second market, and throw away a mistake. Not accounts, not workspaces: one shared list, as CLAUDE.md's non-goals require.

**Build**
- Library: a Projects section above the templates listing every project with its name, template and last change. Open, Rename (inline), Duplicate, Delete (two clicks: the second confirms).
- Editor header: the project name is editable in place.
- API: `PATCH /projects/:id` renames; `POST /projects/:id/duplicate` copies values, timeline overrides, transitions and the music bed into a new project named "… copy"; `DELETE /projects/:id` removes the project and everything that hangs off it (values, timeline, transitions, music bed, render rows; rendered files stay on disk).

**Tests**
- Rename persists and refuses an empty name; duplicate produces a second project with the same values, overrides, transitions and music bed and its own id; delete removes the project and its rows and 404s afterwards.
- Library lists projects newest first, opens one, renames one, duplicates one, and deletes one only after the confirmation click.
- Editor header rename saves and shows the new name.

**Done when:** you can leave a project, find it again in the library, rename it, copy it and delete the copy, in the browser.

---

## M23 · Undo and redo · DONE

An editor without undo punishes every experiment. Josh said keep going; this is the next thing a staffer reaches for.

**Build**
- One history of editor snapshots (values, timeline overrides, transitions, music bed). Every change pushes a snapshot; fast successive changes to the same control (typing, dragging) coalesce into one step so undo goes back a word, not a keystroke.
- Undo and Redo buttons in the header, plus Ctrl+Z and Ctrl+Shift+Z or Ctrl+Y anywhere except inside a text field, where the browser's own text undo stays in charge.
- Undoing saves like any other change: values through the existing debounced save, element moves, transitions and the music bed through their own calls, only for what differs.
- History is per editor session; a reload starts fresh.

**Tests**
- History: push, undo, redo, redo cleared by a new push, coalescing within the window for the same key and not across keys, capped length.
- Editor: type into a field, undo restores the earlier text in the field and the Player and saves it; redo brings the new text back; undo of a timeline move saves the old in/out points; buttons disable when there is nothing to undo or redo; Ctrl+Z from the page body undoes, Ctrl+Z inside the text field does not.

**Done when:** in the browser, a wrong edit is one Ctrl+Z away and the preview follows.

---

## M24 · Ingest from the browser · DONE

AT-1 is "one command". Josh does not like terminals, and neither will the person who gets the next template from Germain. The command stays; the browser gets a way to run it.

**Build**
- Library: an "Add template" form. Pick the handover folder (the browser sends every file with its path inside the folder), give it a name and an ad type, press Ingest. Progress while it runs; on success the library refreshes and the tag report is shown; on failure every problem the ingest found, naming the element, layer or font, exactly as the command prints them.
- Server: `POST /templates/ingest` takes the files, stages them under a temporary folder with their relative paths (anything trying to escape the folder is refused), and runs the same ingest command as a child process, so there is one ingest, not two. Its output comes back verbatim.
- No zip handling, no drag and drop: a folder picker is enough and needs no new dependency.

**Tests**
- Server: files land at their relative paths with the picked folder's own name stripped; the command is run with the right folder, name, ad type and slug; a failing command becomes a 400 carrying its problems; missing name or ad type, no files, and a path with `..` are refused.
- Form: chosen files are sent with their relative paths and the fields; a failure shows the problems; a success reports the slug and refreshes the library.

**Done when:** the three-part fixture folder ingests from the library page in the browser and appears as a template without touching a terminal.

---

## M25 · Editor polish · DONE

Four small things a staffer hits within the first hour, bundled because each is a morning's work, not a milestone: past exports, a crash that does not blank the page, a way back to what the designer authored, and nudging by keyboard.

**Build**
- Export history: the export panel lists this project's earlier renders (time, download link, or the error) and refreshes when a new one finishes.
- Error boundary around the editor: a thrown error shows what happened and a way back to the library instead of a blank page.
- "Reset to authored" beside any text, colour or image control whose value differs from the designer's default.
- Arrow keys nudge the placement being dragged on the monitor by half a percent of the frame (2% with Shift), outside text fields.

**Tests**
- Export panel lists earlier renders from the API and adds the one just finished.
- The boundary renders its fallback with the message when a child throws, and the fallback's button calls back.
- Reset appears only when the value differs and restores the default.
- Arrow keys move the dragged placement; Shift multiplies; nothing happens with no drag active or inside a text field.

**Done when:** each of the four works in the browser.

---

## M26 · Sample project builder · IN PROGRESS

Josh asked for a sample project to follow the guide with. An After Effects project file cannot be written outside After Effects, so a script builds it in place.

**Build**
- `tools/ae-preflight/sample-project.jsx`: builds the "Contrast :30" sample from the guide inside After Effects: the handover folder with numbered sub-folders, fonts and manifest on the Desktop, four tagged comps with animation, a master comp for the reference render, the logo imported, the project saved. Renders nothing.
- `docs/AE-STEP-BY-STEP.md` points at it as the head start.

**Tests**
- The script's plan obeys the ingest rules: known roles on the right layer types, no duplicates per comp, every role covered, one size and frame rate, the two copied fonts only, the timeline inside the master, `elements.json` as the ingest expects. ES3-safe source that never renders.

**Done when:** Josh runs it once in After Effects, exports the comps with Bodymovin, renders the master comp, and the folder ingests from the library page.

---

## Out of scope, do not build

Everything in the non-goals list in `CLAUDE.md`. Plus:

- The full UXP After Effects panel (Phase B)
- Multi-aspect-ratio reflow
- Remotion Lambda or distributed rendering
- Broadcast delivery specs (bitrate targets, LUFS normalization)
- The FEC compliance rule engine
