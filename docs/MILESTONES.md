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

## Out of scope, do not build

Everything in the non-goals list in `CLAUDE.md`. Plus:

- The full UXP After Effects panel (Phase B)
- Multi-aspect-ratio reflow
- Remotion Lambda or distributed rendering
- Broadcast delivery specs (bitrate targets, LUFS normalization)
- The FEC compliance rule engine
