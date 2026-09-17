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

## M26 · Sample project builder · DONE

Josh asked for a sample project to follow the guide with. An After Effects project file cannot be written outside After Effects, so a script builds it in place.

**Build**
- `tools/ae-preflight/sample-project.jsx`: builds the "Contrast :30" sample from the guide inside After Effects: the handover folder with numbered sub-folders, fonts and manifest on the Desktop, four tagged comps with animation, a master comp for the reference render, the logo imported, the project saved. Renders nothing.
- `docs/AE-STEP-BY-STEP.md` points at it as the head start.

**Tests**
- The script's plan obeys the ingest rules: known roles on the right layer types, no duplicates per comp, every role covered, one size and frame rate, the two copied fonts only, the timeline inside the master, `elements.json` as the ingest expects. ES3-safe source that never renders.

**Done when:** Josh runs it once in After Effects, exports the comps with Bodymovin, renders the master comp, and the folder ingests from the library page.

---

## M27 · The first real template: font faces and the comp background · DONE

The sample project (M26) went through the whole pipeline unattended and the fidelity harness found two things no stand-in could have.

**Build**
- One font file per family AND style. The ingest reads every (family, style) from each export's font list, finds a file for each strictly by style, ships them all, and fails naming family, style and element when one is missing. The composition declares one `@font-face` per face with the weight and style lottie-web asks for.
- The comp background colour travels: `elements.json` may be `{ "background": "#rrggbb", "elements": [...] }`; both runners paint it wherever no element covers the frame.
- Unattended After Effects scripts: `preflight-all.jsx`, `bodymovin-export.jsx` (drives Bodymovin's exporter without its panel) and the builder all quit After Effects cleanly when done and never pop up.

**Tests**
- Face CSS per style; strict style lookup; two faces shipped and a missing face named; background read, validated and absent for the list form; both server builders and the editor use the meta background.

**Done when:** the fidelity comparison of the sample template is within threshold on every sample. It is: 12 of 12, worst mean 5.8.

---

## M28 · Direct manipulation · DONE

Josh's verdict on the first real template (2026-09-17): placement must be click-and-drag on the monitor, not X and Y fields. The "Drag on monitor" toggle and the four number inputs go.

**Build**
- The mutation layer tags every layer that has a placement param with a class (`cc-layer` plus one naming the key) so lottie-web's SVG renderer emits it; each element's Lottie wrapper carries its element id. Same JSON in both runners; the class changes no pixel.
- Monitor: pressing on an editable layer selects its element, makes that placement the active one, pauses playback and drags the layer with the pointer (Shift constrains to one axis). Hovering an editable layer shows a hairline cobalt outline and a move cursor; nothing is drawn at rest. This is the documented exception to "nothing overlays the monitor": one hairline while hovering or dragging, never a panel.
- Hit testing reads the rendered SVG's own bounding boxes, so an animated layer is picked up where it is on the current frame; hidden layers are skipped; the topmost hit wins.
- Arrow keys nudge the active placement (half a percent, 2% with Shift), outside text fields.
- Inspector: the Placement row becomes a hint ("Drag it on the monitor to move it"), a Size slider and a Tilt slider, and Reset. No number inputs.

**Tests**
- Composition: placement layers get the class, other layers do not, the source is untouched; the wrapper carries the element id.
- Hit test: topmost containing rect wins, zero-size rects are skipped, a miss returns nothing.
- Editor: press-drag-release on the monitor moves the layer in the Player's props and saves the transform; a press without movement only selects; the outline exists only while hovering or dragging; arrow keys nudge the active placement after a press; Shift constrains.
- Inspector: Size and Tilt sliders report scale and rotation; Reset restores the identity; no X, Y or toggle controls remain.

**Done when:** a headline can be dragged on the monitor with nothing else clicked first, the change survives a reload, and the export matches the preview.

---

## M29 · Fewer dropdowns, fewer numbers, a cleaner surface · DONE

The rest of Josh's verdict: less rigid numbers, fewer selects, a more polished look.

**Build**
- Timeline: ruler labels spaced by the track's real width so they never collide; bars carry the element name, timecodes appear on hover; the selected bar is outlined in cobalt; the transition on each boundary is a segmented Cut / Fade / Wipe / Slide row with a length slider shown in seconds.
- Footage in the inspector: no select. The chosen clip is a card; clips are picked from thumbnails; trim is a two-handle bar over the clip with the in and out timecodes as facts; screen colour is two swatches.
- Audio: tracks are rows, not a select; the start point is a slider over the track.
- The editor and library get a consistent rhythm: one header, section titles, spacing, and type sizes from a small scale; no change to The Console's rules.

**Tests**
- Ruler: label interval grows with duration and shrinks with width; bars show names.
- Transition row: segmented buttons report the preset with the default length; the slider reports frames.
- Footage: thumbnail buttons report the asset; trim handles report seconds by keyboard and by pointer; swatches report the colour.
- Audio: track rows report the asset; the start slider reports seconds.

**Done when:** no `<select>` remains in the editor and Josh calls it cleaner.

---

## M30 · The video is the interface · DONE

Josh's verdict on M29 (2026-09-17): "polished and professional", the timeline "weird", edit on the video itself. Built with the Impeccable skill: init interview, product record, the category standard taken as the direction (CapCut's craft level, made political for Democratic campaigns), code-led, finish review, DESIGN.md.

**Build**
- No timeline. A scene strip under the monitor: press a scene to select it and see it. Timing is the designer's, with a Length slider in the scene's panel that ripples what follows. Show/hide and "how it ends" (Cut, Fade, Wipe, Slide plus a length) live in the panel.
- On the video: double-click a text layer to type in an in-place field anchored to it, every keystroke live; drag a clip from the library onto the video and the footage slot lights up before the drop (a video file from the desktop uploads and lands the same way); press-and-drag placement stays from M28.
- A new visual world: Public Sans (the US government's typeface) self-hosted; a dark studio ground with two panel tones and one hairline; one accent, campaign blue; 8/12 px radii; Lucide icons; themed sliders, switches, swatches, scrollbars, focus and selection. Shared primitives in `ui.tsx`. Library page in the same shell. `PRODUCT.md` and `app/.impeccable/surfaces/…` carry the product truth and the direction contract; `DESIGN.md` records the system.

**Tests**
- Scene chips select and seek; Show hides and saves; the transition control appears only where a scene follows and saves; Length ripples later scenes and saves each; double-click opens the in-place editor, Enter commits to composition and panel and saves, Escape restores, a miss does nothing; library clips are draggable, dragging over the video shows the slot, a drop assigns the clip and saves. The Player stub now records seeks and pauses.

**Done when:** the Impeccable finish review's disposition is ship (or its open findings are Josh's call), DESIGN.md exists, and Josh sees it.

---

## M31 · The element library · DONE

Josh opened the phase-2 features on 2026-09-17 (CLAUDE.md, "Opened on 2026-09-17"). Everything on his list hangs off one change: elements stop belonging to one spot and become a library any spot can add from. Lower thirds, captions, callouts, overlays, backgrounds, end cards and disclaimers are all element types in that library; the app finally knows what an element is.

**Build**
- Element types. `elements.json` entries carry `type`, one of open, headline, lower-third, caption, callout, overlay, stat, background, end-card, disclaimer. When absent the ingest infers it from the slug and says so; an unknown type fails the ingest naming the element. The type lands in `meta.json` and in `template_element.type`.
- The library. `GET /elements` lists every element of every ingested template, typed, with its template's name and thumbnail. A project element may come from any template: it carries its own `templateSlug` and `type`; files and fonts resolve per element, and the composition's font list is merged across the templates involved (both runners).
- Add and remove. `POST /projects/:id/elements` adds a library element at a frame with its authored length and its schema defaults; `DELETE` removes an added element. The spot's own elements stay hideable, not removable.
- Editor. An "Add" chip at the end of the scene strip opens the library grouped by type, from the left panel (never over the video); pressing one adds it at the playhead, selects it and seeks. The panel offers "Remove from spot" on added elements. Duplicating a project copies its added elements.

**Tests**
- Ingest: explicit type kept, missing type inferred from the slug, unknown type rejected naming the element, type written to meta.
- DB: type column on old databases, library listing across templates, add with defaults, project elements include added ones with their template, remove, duplicate copies.
- Server: the three routes; project detail carries templateSlug and type per element and merged font files; render props resolve files per element's template.
- Composition: fontsFor resolves a file against its own template slug.
- Editor: the Add chip lists the library by type, adding places the element at the playhead and selects it, Remove from spot deletes it.

**Done when:** a lower third from one template can be added to a spot made from another, edited on the video, and exported.

---

## M32 · Style: overall updates and saved themes · DONE

Colours only, by Josh's choice (fonts wait for client profiles, where the client supplies the files).

**Build**
- Colours across the spot: one row per colour role (accent, surface, whatever the designer tagged) across every scene; changing one writes that colour into every scene that carries the role, through one route, so the values stay ordinary project values and both runners are untouched. "Designer's" per role puts the authored colour back. Scenes that disagree say so.
- Saved themes: name the current colours, keep them in the library, apply them to any spot, delete them.

**Tests**
- DB: save, list, delete. Routes: the style route writes by role and answers the values, rejects bad hex naming the role; themes need a name and #rrggbb. Panel: roles collected across scenes with defaults and disagreement; a valid hex applies; reset per role; apply, delete and save-as. Editor: one change recolours both scenes in the Player, saved once through the style route.

**Done when:** one theme change recolours every scene of a spot and the export matches. It does: the values are the same rows the export reads.

---

## M33 · Client profiles · DONE

**Build**
- A client: name, logo, colours by role, disclaimer text. Kept in the library (add, edit, delete); a spot belongs to one; deleting a client leaves its spots without one. Fonts and default music wait: fonts need the client's font files (later), music is one press in the editor.
- The library says which client new spots are for (a chip row; "no client" by default). A spot created for a client opens branded: its colours in every scene by role, its logo in every logo slot, its disclaimer in every disclaimer field; empty parts leave the designer's values. The editor names the client in the top bar and offers "Apply <client>'s brand" to put it back after edits.
- No users, roles or logins (still non-goals): a client is a record anyone at the agency edits.

**Tests**
- DB: save, list, read, update, delete; project.client_id survives old databases; duplicate keeps the client; delete leaves spots clientless. Routes: CRUD with a name and #rrggbb required; create-for-client brands the spot and names it; brand again; no client is 400. Panel: list, add, logo upload through the images route, edit in place, delete behind a confirming press. Library: chips, the chosen client rides on the create call, rows name their client. Editor: top bar names the client, Apply brand merges the values. Ingest: the brand's colour roles equal the role table's.

**Done when:** a new spot for a client opens already branded. It does.

---

## M34 · Stock footage · DONE (live run parked with the key, Josh 2026-09-17)

**Build**
- Pexels, behind a small provider shape so another site can follow. `PEXELS_API_KEY` from `.env` (gitignored; the server loads it, no dependency) or the shell; without it the routes answer 503 naming the variable and the panel shows that message.
- `GET /stock/search?q=` answers normalised results (title, thumbnail, length, size, credit, page). `POST /stock/import` downloads the largest mp4 at or under 1080p and registers it through the same path as an upload (original, proxy, poster, row), named "<title> (<photographer> on Pexels).mp4" so the credit travels with the clip.
- "Find stock footage" under the Footage grid: search on Enter, results with thumbnail, length and credit, "Add to footage" pulls one in and it drags onto the video like any clip.

**Tests**
- Parsing and file choice; no key is 503 naming the variable; search calls Pexels with the key and the query; import downloads through an injected fetch and lands a real asset with proxy and poster (ffmpeg on the fixture); unknown video 404, unknown provider 400. Panel: search, results, import marks the card, the server's message on 503, "nothing matched".

**Done when:** a stock clip found in the app lands in a spot and exports. The path is built and tested end to end with an injected Pexels; the live run needs Josh's key in `.env`.

---

## M35 · The disclaimer's four seconds · DONE

Josh's ruling on the prototype (2026-09-17): the disclaimer must be on screen for at least 4 seconds. The wording is still nobody's business but the campaign's.

**Build**
- One pure rule in the composition package: the seconds a disclaimer is on screen are the union of the enabled elements that carry a non-empty disclaimer text, in seconds; the minimum is 4.0.
- The export refuses a spot under the minimum, naming the seconds it has and what to do (lengthen the scene, or add a disclaimer from the library). The editor shows the same line beside Export, green or red, and disables Export while red. Nothing else is validated.

**Tests**
- Rule: union of overlapping scenes, disabled scenes skipped, empty text skipped, no disclaimer is zero. Route: a short disclaimer is 400 naming the seconds; a long one renders. Editor: the line beside Export and the disabled button.

**Done when:** an export with a 2.5 s disclaimer is refused with a clear reason, and the same spot exports once its end card is lengthened.

---

## M36 · Aspect-ratio versions · DONE

Josh's ruling on the prototype (2026-09-17): 16:9 is the master; a spot is versioned into 1:1, 4:5 and 9:16.

**Build**
- A spot has an aspect (16:9 by default). The frame size follows it in both runners (1920×1080, 1080×1080, 1080×1350, 1080×1920); the monitor and the export use it; positions stay fractions of the frame.
- Designer variants: `elements.json` entries may name a variant export per ratio (`"variants": { "9:16": "02-lower-third-9x16" }`); the ingest validates and ships them beside the element with the same tags, so the same values apply. A spot in 9:16 renders each element's 9:16 variant where one exists.
- Auto-fit: where no variant exists, the 16:9 element is contained and centred in the new frame over the template background, footage slots that fill the 16:9 frame fill the new frame instead, and the scene's panel says "Auto-fitted from 16:9" so nobody mistakes it for a design.
- A version chip row in the top bar (16:9 · 1:1 · 4:5 · 9:16). Exports carry the ratio in the file name.

**Tests**
- Frame size per aspect; variant resolution per element; auto-fit geometry (contain, background, full-bleed slot); ingest variants validated and shipped; render props at each ratio; the chip row changes the monitor and the export.

**Done when:** a 16:9 spot switched to 9:16 previews and exports at 1080×1920, with a designer's 9:16 lower third used where it exists and the rest auto-fitted and labelled.

---

## M37 · The composer · DONE

The prototype's best idea: the user types their copy once and sees it in every element before choosing one. And the scene strip shows each scene as it actually stands, not a stock thumbnail.

**Build**
- `GET /elements` carries each element's Lottie URL, schema and fonts, so the app can draw it.
- `ElementPreview`: a still of one element at one frame, values applied, drawn once by lottie-web into a box. No Player; a dozen stills are cheap.
- The library picker has a composer field ("Preview every text element with your copy"): the copy goes into each element's first text role, disclaimers excepted, and every preview redraws with it at its hold frame. Template fonts load into the picker so the previews are set in the designer's type.
- Each scene chip under the monitor draws its scene with the spot's own values at its hold frame.

**Tests**
- `previewValues` rules; ElementPreview draws with svg renderer, no autoplay, holds the frame, destroys on unmount; the library test asserts every text element is redrawn with the typed copy; the scenes test asserts a thumb per chip; the server test asserts the richer element listing.

**Done when:** copy typed in the composer appears in every text element of the library, and the scene chips show the spot as edited.

---

## M38 · The starter element pack · DONE

The library had three plain templates. A first user test needs range: lower thirds, captions, callouts, stats, backgrounds, end cards, disclaimers. Germain's real designs come later; until then a pack built by script inside After Effects, through the same handover the guide describes, so it proves the pipeline as well as filling the picker.

**Build**
- `tools/ae-preflight/starter-pack.jsx`: sixteen tagged comps at 1920x1080, 30 fps (headline; bar and stacked lower thirds; boxed and pop-on captions; callout and pull quote; big stat and two stats; top bar; split and footage backgrounds; vote and learn-more end cards; disclaimer bar and card), each with fade, slide, scale or pop animation and a fade-out where an overlay needs one. Handover folder on the Desktop with numbered sub-folders, fonts/ (Arial Regular, Arial Bold, Arial Narrow Bold from Windows), `elements.json` (typed, library only, background), `export-config.jsx`, the saved project, a master comp end to end for the reference.
- `tools/ae-preflight/run-unattended.mjs`: launches After Effects fresh (or attaches with `--attach`), sends a script with `$.__ccQuiet` and `$.__ccConfig`, watches the script's log for its done line, never kills the app. `bodymovin-export.jsx` and `preflight-all.jsx` take their project and comps from the config.
- `elements.json` may say `"libraryOnly": true`: the template feeds "Add to the spot" and is left out of the "start a spot" grid (`template.library_only`, `GET /templates` filters, `GET /elements` does not).
- Ingest rule: a width word After Effects folds into a font's style ("Narrow Bold") moves into the family ("Arial Narrow", Bold), so the face is its own and the file is found by it.
- Composition fix found by the pack: elements mount only once the template fonts are ready. lottie-web measures characters when it builds a text layer and keeps the widths; an element at frame 0 measured in the fallback font and drew the right glyphs at the wrong spacing.

**Tests**
- The plan against the ingest rules (types, roles, unique slugs and folders, disclaimers at four seconds, fonts, boxes inside the frame, manifest and export config); libraryOnly through ingest, database and routes; the width rule; Main holds elements until faces load.

**Done when:** the pack builds, exports, renders and ingests with nobody at the keyboard; all sixteen elements draw in the picker with the composer's copy; the fidelity harness judges the pack against its After Effects reference.

---

## M39 · Style treatments · DONE

The prototype's Clean, Grit, Glow and Opaque: a look over the whole spot that the designs cannot be broken by. Bubbly is not a treatment (see M40).

**Build**
- `composition/src/treatments.ts`: `TREATMENTS` (clean, grit, glow, opaque), `treatmentFor` (glow takes the spot's first accent colour), `treatmentLayerFilter`. `MainProps.treatment`.
- The composition draws each treatment, so both runners agree: grit lays a fractal-noise tile over the whole frame at 22% overlay and puts `contrast(1.12)` on each design; glow puts a two-stop drop shadow in the accent on each text and accent layer inside the design (never on the whole design, whose surface fills the frame, and never on the footage); opaque runs every editable text layer but the disclaimer through one SVG filter that dilates the glyphs into a white plate and sets the text in dark ink. Text layers carry `cc-text` from `applyLottieValues` for that.
- `project.treatment` (clean by default, copied by duplicate); `PATCH /projects/:id { treatment }` refuses an unknown one; the detail and the render props carry it.
- Style panel: a "Treatment" segmented control under the colours, "across the spot"; the Player takes it at once, the project route saves it.

**Tests**
- Treatment props and filters; Main draws each treatment (grain last, filter on the design not the footage, plate filter addressed to text); text layers tagged; PATCH, detail, duplicate, render props with the spot's accent; the editor control.

**Done when:** each treatment shows in the monitor and the export matches the preview with one on.

---

## M40 · Bubbly, as a designed variant · NOT STARTED

The prototype's Bubbly is a font swap (Fredoka) and rounded corners. Text must render in the designer's font, so Bubbly is not a treatment over a design; it is a designed variant of the element, made in After Effects. `elements.json` `variants` would take a style key beside the ratio keys (`"bubbly": "02-lower-third-bubbly"`), the ingest would validate the variant carries the master's tags, and a spot with the Bubbly style would use the variant where one exists and say so where none does, exactly as the aspect versions do. Needs a designed pack to be worth building; parked until Germain's elements or a bubbly starter pack exist.

---

## M41 · A spot from nothing · DONE

With an element library and a starter pack, a spot no longer has to begin as a template. The prototype's composer started from an empty stage; so does this.

**Build**
- A built-in `blank` template (library only, no elements, no files), ensured on every server start. `POST /projects { templateSlug: "blank" }` makes an empty spot named "New spot" (or "<client>: New spot"), with no auto-made element.
- Library page: a "From nothing" section with one card, "Start a spot from nothing", for the chosen client.
- The editor opens an empty spot and says so on the video and in the panel, with "Add the first scene" in both places.
- Where a library element lands (`app/src/landing.ts`, on `SCENE_TYPES` in the composition): a scene (open, headline, stat, background, end card) lands at the playhead, never past the end of the last scene, and moves the playhead on to its own end, so scenes added one after another follow one another; an overlay (lower third, caption, callout, bar, disclaimer) lands at the playhead, and past the end lands on the start of the last scene, so it always overlays something. An empty spot puts everything at 0.
- The opening-frame seek runs once per spot opened, not on every reload (it had been resetting the playhead after every add).

**Tests**
- Blank template and spot (server); scene types; landing and the playhead after; the library card; the editor's empty state and three adds in a row.

**Done when:** a spot built from nothing out of the starter pack plays and exports like any other.

---

## M42 · The composer's copy lands; overlays fit the last scene · DONE

- The copy typed in the picker's composer lands with the element you add (its first text role, never a disclaimer) and is saved.
- An overlay is pulled back to end with the last scene when it fits on the scene under the playhead; longer than that scene, it stays put.
- The picker's Lotties are cached for the page.

---

## M43 · Reorder scenes by dragging chips · DONE

A spot built from nothing needs its scenes moved; until now the only way was to remove and re-add. Still no timeline: the chips under the video are the scenes, and a scene chip drags.

**Build**
- Scene chips (open, headline, stat, background, end card) are draggable. Dropping one on the left half of another scene chip puts it before, on the right half after; a blue edge on the target says which while you hover.
- `app/src/reorder.ts`: the scenes are re-laid in the new order, each keeping its length, with the gaps between consecutive positions kept, so a template's pacing survives and an end-to-end spot stays end to end. Overlays (lower thirds, captions, callouts, bars, disclaimers) stay at their frames: they sit on whatever scene is under them.
- Every moved scene is saved through the existing element route, debounced like a length change. Undo covers it.

**Tests**
- Re-laying before and after, gaps kept, end-to-end kept, overlays untouched, no-ops; the editor: only scene chips drag, a drop re-lays the Player at once and saves the moved scenes.

**Done when:** a scene dragged to a new place in the strip plays there, and the export follows.

---

## M44 · Move an overlay onto a scene · DONE

- An overlay chip (lower third, caption, callout, bar, disclaimer) drags too. Dropped on a scene chip, which rings blue while you hover, the overlay starts where that scene starts and keeps its length. Nothing else moves. Scene chips are the only drop targets.
- Chips keep their 144 px minimum and the strip scrolls sideways when a spot has more scenes than fit, instead of squeezing names.

---

## M45 · The same element, twice · DONE

A spot from nothing needs two captions and two lower thirds. Until now a scene's identity was its template element's id, so an element could be in a spot once and the picker greyed it out.

**Build**
- Scenes: `project_scene (project_id, scene_id, element_id, …)` replaces the per-project element rows. A scene's id is the template element's id the first time an element is used (the spot's own elements included), so values, transitions and every older spot need no translation; a second use gets a fresh id (from 10,000,000 up). Old databases move their rows over on open.
- `POST /projects/:id/elements` always makes a new scene with its own default values and returns it; every element carries `elementId` beside its scene `id`. Timing, values, transitions, removal and duplication work per scene.
- The picker no longer greys an element that is in the spot; it says "in the spot" or "in the spot ×2" and adds again.

**Tests**
- A second add makes a second scene with a fresh id and its own values, timing, transition and removal, and a duplicate carries both; an old database's rows migrate; the editor shows two scenes from one element.

---

## M46 · Duplicate a scene · DONE

- A "Scene" section in the panel with **Duplicate scene**: a second copy of the selected scene, with its words and colours, right after it. A scene lands at its source's end and everything from there on moves on by the copy's length; an overlay lands where the source is, to be dragged onto another scene. The copy is a new scene of the same element (M45), selected, and saved.

---

## M47 · A client's spot brands what is added · DONE

- A scene added from the library to a spot that belongs to a client arrives in the client's brand (colours by role, logo, disclaimer), as the spot's own scenes did at creation. `POST /projects/:id/elements` answers the new scene with its values, and the editor takes those instead of the schema defaults.

---

## M48 · The export panel names empty footage slots · DONE

- `emptySlots` in the composition: the enabled scenes whose footage slot has no clip, in play order. The export panel says "No clip yet in Headline" or "No clip yet in 2 scenes" (the names in the title), as a note, never a block: the designer's stand-in shows there, in the export too.

---

## Out of scope, do not build

Everything in the non-goals list in `CLAUDE.md`. Plus:

- The full UXP After Effects panel (Phase B)
- Automatic reflow as the way to make other aspect ratios (versions are M36)
- Remotion Lambda or distributed rendering
- Broadcast delivery specs (bitrate targets, LUFS normalization)
- The FEC compliance rule engine
