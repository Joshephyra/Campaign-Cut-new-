# STATUS.md

Running log of where the build is. Newest entry first.

---

## 2026-09-17 · M28 Direct manipulation · DONE

**Why**

Josh's verdict on the first real template in the editor: placement must be click-and-drag on the monitor, not X and Y fields; the whole surface needs to be cleaner, with fewer dropdowns and fewer rigid numbers (that half is M29). He also listed what the product will need after the proof of concept; see `docs/ROADMAP.md`, which notes which of those sit on the CLAUDE.md non-goals list.

**What exists now**

- Press an editable layer on the monitor and drag it. Nothing has to be switched on. The mutation layer tags every placement layer with a class (`cc-layer` plus one for its key) and each element's Lottie wrapper carries its element id; lottie-web copies the class onto the layer's `<g>`, so its box on screen, wherever the animation has it on the current frame, is one `getBoundingClientRect` away. Hidden layers have no box. The topmost hit wins.
- A press selects the element and makes that placement the active one (arrow keys nudge it: half a percent, 2% with Shift); playback pauses; Shift while dragging keeps to one axis; a press that started a drag never toggles playback.
- The one thing drawn over the monitor: a hairline cobalt outline around the editable layer under the pointer, while it is under the pointer or being dragged, with a move cursor. Nothing at rest. This replaces M18's invisible capture surface as the documented exception to "nothing overlays the monitor".
- Inspector: the Placement row is a hint ("Drag it on the monitor to move it"), a Size slider (25 to 300%), a Tilt slider (-45 to 45 degrees) and Reset. The X, Y, Scale and Rotation number fields and the "Drag on monitor" toggle are gone. The control whose placement is active carries a cobalt edge.
- Tests: 3 composition (class tag, wrapper id through Main), 3 hit test, 6 editor (drag moves and saves, press selects, miss does nothing, Shift constrains, outline only on hover, arrow keys after a press), 5 inspector. 195 app and composition tests green.

**Verified**

- In the real renderer (Chrome, project 5 on the sample template): the headline's `<g>` carries `cc-layer cc-key-headline_2etransform` inside the wrapper for element 5; hovering shows the outline and the move cursor; a 91 by 51 pixel drag moved the layer by exactly 91 by 51 pixels and saved `x: 0.199, y: 0.199`; the outline was gone after release; the inspector marked the headline active. The pane would not paint a screenshot (known limit), so this was checked through the DOM and the API.

**Next**

M29: fewer dropdowns, fewer numbers, a cleaner surface.

---
## 2026-09-17 · M27 The first real template: font faces and the comp background · DONE

**Why**

The first After Effects template went through the whole pipeline end to end (see M26 below) and the fidelity harness found two things no stand-in could have: 8 of 12 samples over threshold.

**What the harness found, and the fixes**

- **One font file per family was wrong.** Arial Bold and Arial Regular are two faces; the ingest shipped one file for the family, so regular captions rendered from the bold file and drifted a character width per word. Now every (family, style) pair from each export's font list gets its own file, found strictly by style (`Arial-Regular.ttf` / `arial.ttf` for Regular, `Arial-Bold.ttf` / `arialbd.ttf` for Bold; a regular file is never accepted for a bold face). `meta.fontFiles` carries the style; the composition declares one `@font-face` per face with the weight and style lottie-web asks for, and waits for each face before the first frame. Missing faces fail the ingest naming family, style and element.
- **The comp background colour never travelled.** Bodymovin does not export it; After Effects paints it wherever no layer covers the frame, so a reference render contains it. `elements.json` may now be `{ "background": "#rrggbb", "elements": [...] }`; `meta.background` reaches both runners (black when absent). The sample builder writes it.
- Fidelity on the sample after the fixes: 12 of 12 samples within threshold, worst mean 5.8 (edge antialiasing on 220 px stats and a sliding accent bar). Before: worst 25.3.
- Tests: 2 composition (face CSS, style through fontsFor), 3 strict finder, 4 ingest (two faces shipped, missing face named, background read and validated, absent when the list form is used), 1 server (both builders use the meta background), 1 editor. 378 tests green.

**How the template got in without a person clicking through After Effects**

- `AfterFX.exe -s "$.evalFile(...)"` runs a script in After Effects from the command line. It only worked reliably against a freshly launched instance with no project open, so every unattended script opens the project itself, does its work, and quits After Effects cleanly when done (never force-close it: that raises a "Crash Repair Options" dialog on the next launch that blocks all scripts until a person clicks Continue; Josh clicked it twice).
- `preflight-all.jsx` ran the pre-flight over the five comps in two seconds (zero problems). `bodymovin-export.jsx` drove Bodymovin's own exporter without its panel: it loads the extension's scripts, and stands in for the panel on the three hand-offs (font data, image processing, progress). Four comps exported in six seconds. `aerender` rendered the 30 s reference in 16 seconds. `npm run ingest` took the folder; `npm run fidelity` judged it.
- Pop-ups in the scripts honour `$.__ccQuiet` so unattended runs never block.

---

## 2026-09-15 · M26 Sample project builder · DONE: built, exported, rendered, ingested and judged on 2026-09-17

**Why**

Josh asked for a sample project to follow the step-by-step guide with. An `.aep` cannot be written from here, so a script builds it inside After Effects instead.

**What exists now**

- `tools/ae-preflight/sample-project.jsx` (ES3 ExtendScript, File > Scripts > Run Script File). Builds the sample "Contrast :30": a `contrast-30` folder on the Desktop with `01-open` … `04-end-card`, `fonts/` (Arial Regular and Bold copied from Windows and renamed so the ingest's style lookup finds them), `elements.json`; four tagged comps at 1920x1080, 30 fps (open with surface, accent, headline, footage slot; lower third with subhead, body, accent, logo; stat callout with two stats, body, accent; end card with headline, disclaimer, logo, footage slot), each with fade, slide or scale animation; a master comp "Contrast 30 (reference)" laying them out at frames 0, 90, 300 and 750 for the reference render; the logo imported from the stand-in fixture; the project saved into the folder. It renders nothing; the person exports with Bodymovin and renders the master comp.
- The PLAN is plain data; `tools/ingest/src/sampleProject.test.ts` (9 tests) checks it against the ingest's own rules: known roles on the right layer types, no duplicates per comp, every role covered, only the two copied fonts used, the timeline inside the master, and `elements.json` exactly as the ingest expects.
- `docs/AE-STEP-BY-STEP.md`: a plain guide for the whole hand-over (also the answer to "like I am five"), now with the script as the head start.

**Verified**

- Node: 9 plan tests green; ES3 safety checked. Not run inside After Effects (Josh's run).

---

## 2026-09-13 · M25 Editor polish · DONE

**Why**

Four small things a staffer hits in the first hour, bundled because each is a morning's work.

**What exists now**

- Export history: an Exports section in the inspector column lists the project's earlier renders newest first (time and a Download link, or the error), reloading when an export finishes. It lives in the column, not as a dropdown from the header, so nothing hangs over the monitor.
- Error boundary: `app/src/components/ErrorBoundary.tsx` wraps the editor. A thrown render error shows the message, a Reload button and "Back to library" instead of a blank page (the crash seen during a hot reload on 2026-09-13 would now be visible).
- "Reset to authored" beside any text, colour or image control whose value differs from the designer's default.
- Arrow keys nudge the placement being dragged on the monitor by 0.5% of the frame (2% with Shift), outside text fields.
- Tests: 2 export history, 2 boundary, 2 reset, 1 nudge. 358 tests green.

**Verified in the browser**

- Project 3 shows Exports with the earlier `project-3-2.mp4` download link. The rest rest on the tests; the in-app pane still cannot take screenshots.

**Next**

Nothing queued. Every further step (real template and AT-2, After Effects panel, own renderer) needs Josh.

---

## 2026-09-13 · M24 Ingest from the browser · DONE

**Why**

AT-1 is "one command", and Josh does not like terminals; neither will whoever receives the next template. The command stays; the browser now runs it.

**What exists now**

- Library: an "Add template" form (collapsed until opened). Pick the handover folder with the browser's folder picker (every file travels with its path inside the folder), give a name and an ad type, press Ingest. Progress while it runs; on success the library reloads and the full output is available; on failure every problem the ingest found is listed verbatim.
- Server: `POST /templates/ingest` (multipart: `name`, `adType`, optional `slug`, and each file with its relative path as the filename). Files are staged under a temporary folder with the picked folder's own name stripped; any path that is absolute or climbs out is refused. Then the SAME ingest command (`tools/ingest`) runs as a child process through tsx, so there is one ingest, not two; its output comes back verbatim and the `  - ` problem lines are picked out on 400. The staging folder is removed afterwards. `runIngest` is injectable for tests. The multipart plugin now keeps directory paths (`preservePath`) and allows many files per request.
- Tests: 4 route (staging and stripping, slug from name, failing command to 400 with problems, refusals), 3 form (files with paths and fields sent, problems shown, button gating). 351 tests green.

**Verified**

- Live server: the three-part fixture posted through the route exactly as the form sends it (curl multipart with relative filenames) came back HTTP 200 and rewrote `templates/three` (meta and thumbnail timestamps) through the real command, thumbnail render included.
- Browser: the library shows "Add template"; opening it shows the folder picker, name, ad type and Ingest. The native folder dialog cannot be driven from the in-app pane, so the click-through with a real folder is Josh's to do once.

**Next**

Nothing queued. The After Effects panel, an own renderer and the real template remain Josh's calls.

---

## 2026-09-13 · M23 Undo and redo · DONE

**Why**

An editor without undo punishes every experiment. Josh said keep going; this is the next thing a staffer reaches for.

**What exists now**

- `app/src/history.ts`: a pure history (past, present, future) over one snapshot of everything the user edits: values, timeline overrides, transitions, music bed. Fast successive changes to the same control within 800 ms fold into one step (typing a word, one drag); 100 steps are kept; a new change clears redo.
- Editor: every change names its control (`<element>:<param>`, `element:<id>`, `transition:<id>`, `audio`) before setting state; an effect pushes the snapshot. Undo and Redo buttons in the header (disabled when empty) and Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y anywhere except inside a text field, select or textarea, where the browser's own text undo stays in charge.
- Restoring a snapshot saves what differs: values through the existing debounced value save (it diffs against what was last saved), element moves and toggles, transitions (a removed one is saved as a cut) and the music bed through their own calls. History is per editor session.
- Tests: 6 history, 4 editor (buttons start disabled; text edit undone in the field and the Player and saved, then redone; a timeline toggle undone and saved; Ctrl+Z from the page undoes while Ctrl+Z inside the text field does not). 344 tests green.

**Verified in the browser**

- Project 3: typed "UNDO TEST" into the headline, the preview showed it; clicked Undo, the preview showed "OPEN HEADLINE" again and the server holds "OPEN HEADLINE" (checked via the API). The in-app pane still cannot take screenshots, so this was checked through the page's accessibility tree and the API.

**Next**

Nothing queued. Candidates needing Josh's call: the real template (AT-2), the After Effects panel, an own Lottie renderer.

---

## 2026-09-13 · M22 Projects in the library · DONE

**Why**

Every click on a template made a new project and the only way back was its URL. A staffer needs to find yesterday's spot, rename it, copy it for a second market, and throw away a mistake. One shared list, no accounts (CLAUDE.md non-goals).

**What exists now**

- Library: a Projects section above the templates lists every project newest first with its name, template and last change. Open, Rename (inline; Enter saves, Escape cancels), Duplicate (opens the copy), Delete (a second "Really delete" click confirms; "Keep" backs out). Rename and delete apply the API's answer to the list without a refetch.
- Editor header: the project name has a "rename" control; Enter saves.
- API: `PATCH /projects/:id` (400 on an empty name), `POST /projects/:id/duplicate` (copies values, timeline overrides, transitions and the music bed into "<name> copy"), `DELETE /projects/:id` (project, values, overrides, transitions, music bed and render rows; rendered files stay on disk). DB: `renameProject`, `duplicateProject` (one transaction), `deleteProject`.
- Tests: 3 server (rename, duplicate with every child table, delete with 404 afterwards), 4 library (list order and facts, open, rename, duplicate, two-click delete), 1 editor header rename; the older library test now mocks fetch by URL. 334 tests green.

**Verified**

- Browser: the library shows the Projects list with the four projects, template names and timestamps, above the two templates.
- The in-app browser pane stopped delivering keyboard input and screenshots partway through (its viewport also shrank; a name-overlap at narrow widths got fixed with a one-line truncate). Rename and delete were therefore exercised through the live API: duplicated project 3 to 4, renamed it "Second market", deleted it, list back to three. The click flows are covered by the library tests. Josh should rename and delete a copy once in his own browser.

**Next**

Nothing queued. Candidates needing Josh's call: the real template (AT-2), the After Effects panel, an own Lottie renderer, undo/redo in the editor.

---

## 2026-09-13 · M21 Footage per element · DONE

**Why**

Josh said keep going. Since M17 a template has several elements, but footage was one slot per project, taken from the first element that had one; STATUS had flagged that twice. A real spot has different footage under the open and the end card.

**What exists now**

- The footage slot moved from the composition's props to each element: `ElementProps.media` (`MainProps.media` is gone). `Main` renders an element's footage inside that element's own Sequence, under its Lottie, through a shared `ElementView`, so it starts and stops with the element, its trim is relative to the element's in point, and chains with transitions carry it the same way.
- The export runner builds each element's footage from that element's own `cc.mediaFill` value; the template-as-authored props carry none.
- Editor: "use this clip" in the Footage panel goes to the selected element when it has a slot, else to the first element that does. Each element's inspector shows its own clip, trim, fit and key. No database change: footage values were already stored per element.
- The three-part fixture's end card gained a `cc.mediaFill` slot so two elements can carry different clips. Tests: composition (one video per element with footage, each in its own slot), export runner (end card has a clip, open has none), editor (chosen clip lands on the selected element and the Player gets one clip per element); render, parity and fidelity checks updated for the moved prop. 326 tests green.

**Verified in the export**

- Project 3: green-screen clip (trimmed, muted) on the open, test pattern (contain) on the end card. `npm run parity -- --id 3 --frames 45,200`: both within threshold (mean 0.50 and 3.73). Export frame 200 shows the end card with the letterboxed test pattern in its slot; frame 45 the open with the green screen. The in-app browser pane stopped painting reliably during this milestone (tiny, zoomed captures), so the preview side rests on the editor tests and parity rather than a screenshot; Josh should open project 3 and scrub to 6 s once.

**Next**

M22 projects in the library: list, reopen, rename, duplicate, delete. Today a project can only be reached by its URL.

---

## 2026-09-13 · M20 Footage trim and audio · DONE

**Why**

Ads have sound and a staffer's clip is rarely the right length. Both had to go through the one composition so the export carries exactly what the preview played.

**What exists now**

- Footage trim and mute: the footage value gains `inS`, `outS`, `muted`. `mediaTiming` (composition) turns seconds into clip frames in one place; `Main` hands `OffthreadVideo` `startFrom`, `endAt` and `muted`. Inspector: Start and End (seconds) and "Mute footage sound" under the footage control, with the clip length shown.
- Music bed: audio uploads (mp3, wav, m4a, aac, ogg, flac) go through the same `POST /media`; they are probed with ffprobe, stored as media assets of kind `audio` (no proxy, no poster; both runners play the original) and listed in the Footage panel with a ♪ tile. `project_audio` holds one track per project with volume and start; `PUT /projects/:id/audio` sets or clears it, `GET /projects/:id` returns it. `Main` renders it with Remotion's `Audio`. New Audio panel under Footage: track, volume, start. Clicking an audio row in the Footage panel picks it as the bed; the footage slot only offers video.
- `media_asset` gained `kind` (migration adds it to existing databases).
- Tests: 2 composition (mediaTiming), 2 (Main video trim and Audio), 5 server (audio upload with an ffmpeg-made wav, rejection, music-bed round trip and validation, export runner props), 4 inspector, 3 audio panel, 2 editor. 324 tests green.

**Verified in the browser and in the export**

- Uploaded a 10 s wav made with ffmpeg; it appears in the Footage panel as audio. Chose it as the music bed, volume 39%. Set the green-screen clip to start 0.5 s, end 1.5 s, muted. All of it saved (checked via the API).
- Exported project 3 through the real render queue (Export MP4 path, `POST /render`): the MP4 has an h264 video stream and an AAC audio stream of 8.04 s; ffmpeg volumedetect reports mean -41.9 dB, max -35.3 dB (silence would read about -91 dB). The trim itself is asserted through the export runner's props; the green-screen fixture is too uniform to show a visible difference between 0.5 s and 0 s by eye. Josh should listen to `media/renders/project-3-2.mp4` once.
- Not done: ducking, fades, more than one track, per-element footage. Volume is Remotion's linear `volume`; if 39% sounds quieter than expected, that is where to look.

**Next**

The agreed roadmap (M16 to M20) is complete. What remains needs a real After Effects template: run `npm run fidelity` on it, then decide on the own-renderer question and the After Effects panel.

---

## 2026-09-13 · M19 Fidelity harness · DONE

**Why**

AT-2 is Germain's call on whether a template survived the trip from After Effects. Until now there was nothing to give him but two videos. This gives him side-by-side frames, a difference map and a report that says where they differ, and gives us something every later change is checked against.

**What exists now**

- `npm run fidelity -- --template <slug> [--project <id>] [--reference ref.mp4] [--render out.mp4] [--samples 12] [--threshold 6]` (`server/src/cli-fidelity.ts`, `server/src/fidelity.ts`). Renders the template as authored (new `buildTemplateDefaultProps`, no project needed) or a project, then samples the reference and the render at the same points in time (so a reference at another frame rate lines up), scales the reference to the composition size, and compares each pair with the parity comparison.
- Per sample it writes the reference frame, our frame, a difference map (black where equal, brighter where not) and a strip (reference | render | difference) to `media/fidelity/<slug>-<time>/`, plus `report.txt` and `report.json`. Each line has the time, mean and max difference, share of differing pixels, and the region of the differences as fractions of the frame. Verdict names the worst sample and its region. Exit 1 on differences.
- Ingest copies a handed-over `reference.mp4` into the template dir and records it in `meta.json`; the CLI finds it there by default.
- `docs/AE-AUTHORING.md`: what the reference must be and what happens to it.
- Tests: 9 (sample times, difference map and region on synthetic frames, report text and JSON, end to end on two ffmpeg-made clips where one has a box drawn on it, template default props, reference copy at ingest). 306 tests green.

**Verified by eye**

- Stand-in reference: the export of project 3 (moved, scaled headline, green-screen footage). `--template three` (as authored) against it: 8 of 8 samples over threshold, region named, and the strip at 1.5s shows exactly why: both headline positions and the footage slot light up in the difference map. `--project 3` against the same file: 6 of 6 samples at mean 0.00, WITHIN THRESHOLD.
- No real After Effects reference exists yet, so this is a check of the harness, not of fidelity. The moment Josh or Germain hands over a template with `reference.mp4`, the command above is the AT-2 evidence.

**Next**

M20 footage trim and audio.

---

## 2026-09-13 · M18 Transform editing · DONE

**Why**

Josh: "I want to be able to actually edit the content." Every tagged layer's position, scale and rotation were already in the Lottie JSON; nothing exposed them. This does, as offsets from what the designer authored, so the animation stays intact.

**What exists now**

- New param kind `transform` (`composition/src/transform.ts`). Value `{ x, y, scale, rotation }`: x and y are fractions of the frame, scale a multiplier, rotation degrees; the identity is the default. `applyLottieValues` offsets `ks.p` (static or every keyframe, start and end values, separate x/y dimensions too), multiplies `ks.s` on x and y, adds to `ks.r`. Same code for both runners.
- The schema generator adds `<key>.transform` (with `for: <key>`, path = the layer) after every text and image param that is not locked. `cc.safe.*` stays put; colours and footage slots get none. Both templates were re-ingested so their schema files carry the new params; existing projects fall back to the identity until a placement is saved.
- Inspector: a Placement row under each text and image control: X, Y (percent of frame), Scale (percent), Rotation (degrees), Reset, and a "Drag on monitor" toggle.
- Monitor: while a placement is being dragged, an invisible pointer surface sits over the Player and the drag moves the layer by the fraction of the monitor travelled; the preview is the only feedback. It draws nothing and is off by default. **This is a deliberate, invisible exception to "nothing ever overlays the monitor" (SPEC section 4). Josh can veto it; the numeric fields do everything the drag does.**
- Per-layer retiming is not included: element timing already lives on the timeline (M9).
- Tests: 6 composition (offsets, keyframes, split dimensions, scale, rotation, purity), 4 schema generator, 5 inspector, 2 editor (drag surface). 297 tests green.

**Verified in the browser and in the export**

- Project 3 (Three Part), Open element: typing X 10 and Scale 150 moved and enlarged the headline live at 00:01:16; the accent bar stayed put (it is a colour, not a placement). "Drag on monitor", then a real mouse drag down-left, moved the headline to X -6.1 / Y 32.9 with the fields following. Reload: the placement came back exactly.
- `npm run parity -- --id 3 --frames 45,89,200` with the moved, scaled headline: all within threshold (mean diff 0.95 to 2.00). Export frame 45 shows the headline where the preview had it.

**Next**

M19 fidelity harness (render vs `reference.mp4`), then M20 footage trim and audio.

---

## 2026-09-13 · M17 Multi-element templates · DONE

**Why**

SPEC section 3 describes an ad example as several elements already placed on the timeline. Until now one Bodymovin export was one element and every element in a project shared the template's single Lottie. This is the data-model step Josh's "far more complicated" templates need, and it required no bespoke code per design.

**What exists now**

- Handover: a folder of Bodymovin exports, one sub-folder per element, with an optional `elements.json` (folder, slug, name, startFrame, zIndex). Without it, folders are taken in name order and laid end to end. A single export still works and becomes a one-element template. `docs/AE-AUTHORING.md` has the layout and the manifest.
- Ingest validates every element (tags, fonts, comp settings) and reports problems prefixed with the element. Every element must share fps and size. Writes `templates/<slug>/elements/<element>/{template.json, schema.json, images/}`, a template-level `meta.json` with an `elements` list, `fonts/` (the union), and a composite `thumb.png` rendered at the busiest frame nearest the middle (the bare middle frame of the fixture landed in a gap and came out black). Re-ingest removes elements that are gone. The stand-in was re-ingested into the new layout; a fallback reads pre-M17 templates from the template root.
- `template_element` gained `name` (migration adds it to existing databases). `GET /templates/:slug` and `GET /projects/:id` return each element with its own `schema` and `lottieUrl`; the top-level schema is gone. `POST /projects` seeds every element's defaults.
- Export runner (`buildProjectProps`) builds each element from its own Lottie, schema and values, resolving images against the element's directory. Footage comes from the first element in start order that has a media slot and a clip chosen.
- Editor: loads every element's Lottie, keeps values per element, shows the inspector for the selected element, with element tabs above it and selection by clicking a name in the timeline. The Footage panel drives the first element with a media slot. The composition did not change.
- Fixture: `tools/ingest/fixtures/multi` (open 0-90, lower third 60-120 on top, end card 150-240; 240 frames).
- Tests: 10 ingest (multi handover), 2 (thumbnail frame), 3 (element file resolution), 3 (routes), 3 (export runner), 3 (editor with several elements), 2 (timeline selection); older tests updated for per-element schema and the new layout. 279 tests green.

**Verified in the browser and in the export**

- Library shows "Three Part" with the composite thumbnail (open + lower third) at 00:08:00.
- Project opens with three bars (Lower third on top, End card, Open), element tabs, Open's four controls. Selecting Lower third shows Subhead and Logo; typing "Josh for Council" appears in the preview at 00:02:28 and is saved with element id 3 (checked via the API). End card at 00:06:00 shows its own headline, disclaimer, logo and panel. Choosing a clip fills the Open element's slot with the proxy.
- `npm run parity -- --id 3 --frames 45,89,105,130,200`: all five frames within threshold (mean diff 0.00 to 1.56 of 255). The exported frame 89 shows the open headline, the edited lower third text and the logo, matching the preview.

**Next**

M18 transform editing, M19 fidelity harness, M20 footage trim and audio.

---

## 2026-09-13 · M16 After Effects project dump script · IN PROGRESS: written and unit-tested; needs one manual run inside After Effects

**Why**

Josh asked for the build to become more sophisticated and for a way to hand over a real After Effects project for analysis. A `.aep` is binary, so the only complete view of a project is what After Effects tells a script. The pre-flight script (M15) judges tags; this one records everything.

**What exists now**

- `tools/ae-preflight/dump.jsx`: ES3 ExtendScript, run via File > Scripts > Run Script File. Walks every project item and every comp and writes `dump-<project>.txt` (readable tree) and `dump-<project>.json` (machine-readable, every property included) next to the project file, Desktop if unsaved. Exports nothing, changes nothing.
- Per item: kind (comp, footage, solid, folder), folder, size, duration, frame rate, background or solid colour, footage file path and audio flag.
- Per layer: kind (text, shape, footage, precomp, solid, null, camera, light), in/out/start, stretch, parent, source, blend mode, 3D, motion blur, time remap, adjustment layer, track matte, hidden/solo/shy/locked/guide.
- Per property: match name, value, every keyframe with time, value, in/out interpolation and temporal ease, expression text and enabled flag. Text documents carry font, size, text, box/point, tracking, leading, justification. Shape paths and mask paths are recorded as vertex counts. Colours print as hex in the text.
- Per comp: summary counts (layers, keyframes, expressions, effects, masks) and flag counts (3D, blend modes, time remap, motion blur, adjustment layers, cameras/lights, track mattes, precomps), then every expression by layer and property path, and every effect by layer with its match name.
- The text view omits unmodified static properties so a real project stays readable; the JSON keeps them all.
- `tools/ingest/src/dump.test.ts` (10 tests): ES3-safety and no-write checks on the source, a JSON-writer round trip with escaping, and the walker over a fake two-comp project covering items, layer flags, keyframes with ease, expressions, text animators, shapes, masks, effects and the summary.
- `docs/AE-AUTHORING.md`: the dump step added after pre-flight, and the two dump files added to the hand-off list.

**Verified**

- Node: all 10 tests green; the readable output printed and read through by eye.
- Not yet verified inside After Effects. That is Josh's run, same as M15.

**Next**

M17: multi-element templates. Then M18 transform editing, M19 fidelity harness, M20 footage trim and audio, as agreed on 2026-09-13.

---

## Where things stand after the 2026-09-11 build session

Milestones M0 to M15 are built. Every one has red-then-green tests, a browser or rendered-frame check by Claude, and is pushed to GitHub (github.com/Joshephyra/Campaign-Cut-new-, branch main). Test count: 244 across 48 files, plus one skipped check that waits for a visible-tab performance run.

**Acceptance tests, honestly**

- AT-1 Ingest: one command turns a Bodymovin export into an editable template with no bespoke code. Done and exercised on the hand-made stand-in. Not yet run on a real After Effects export.
- AT-2 Fidelity: the pipeline is in place (Lottie on screen, fonts loaded before the first frame, images and footage resolved for both runners). Germain's call needs a real template plus its `reference.mp4`. Not possible without one.
- AT-3 Editing: text, colour, logo, disclaimer and footage all change live and persist. Done.
- AT-4 Playback: the measurement harness exists (`/projects/<id>?perf=8`); one reading of 23.4 fps came from a throttled in-app pane. Needs one reading from Josh's own browser tab.
- AT-5 Export parity: Export button, queue, download, and the parity script all work; parity passes on the stand-in. Done on the stand-in, to be repeated on the real template with a human watching.

**What only Josh (or Germain) can do next**

1. Open `http://localhost:5173/projects/1?perf=8` in a normal browser tab and report the "measured … fps" line (M12).
2. Run `tools/ae-preflight/preflight.jsx` once inside After Effects and confirm the report (M15).
3. Build the representative template in After Effects, tag it, export with Bodymovin, add `fonts/` and `reference.mp4`, and hand the folder over. Then: `npm run ingest -- <folder> --ad-type "Contrast" --name "..."`, open it, export it, and compare with the reference side by side. That is the fidelity question this whole build exists to answer.

**Known limits worth knowing**

- ~~One Bodymovin export is one element.~~ Lifted by M17 (2026-09-13): a folder of exports becomes a multi-element template. Footage is still one slot per project, taken from the first element that has one.
- The chroma key is a colour-matrix key, not matting. ML matting was not evaluated.
- `docs/DESIGN.md` never existed in the pack; the interface follows the SPEC section 4 summary.
- The lottie-web canvas renderer stalls the Player and was rejected; SVG stays.

---

## 2026-09-11 · M15 After Effects pre-flight script · IN PROGRESS: written and unit-tested; needs one manual run inside After Effects

**What exists now**

- `tools/ae-preflight/preflight.jsx`: ES3 ExtendScript. Run it from After Effects via File > Scripts > Run Script File with the template comp selected. It walks the comp and writes `preflight-<comp name>.txt` next to the project file (Desktop if unsaved), then shows a summary alert. It exports nothing and changes nothing.
- The report lists: comp name, size, frame rate, duration and frame count; every `cc.*` tag with its resolved role (and for text, whether it is box text with a derivable character limit); fonts referenced by every text layer; NOTES for untagged text layers; PROBLEMS naming the layer for unknown roles, wrong layer types, missing fills, duplicates, cameras and lights, 3D layers, non-NORMAL blend modes, time remap, motion blur, adjustment layers and every effect; a VERDICT line (READY TO EXPORT or FIX BEFORE EXPORTING).
- The report logic is separated from After Effects globals behind a small adapter object, so `tools/ingest/src/preflight.test.ts` runs it in Node against a fake comp (8 tests, including an ES3-safety check on the source: no const/let/arrows/JSON/array methods, no render or save calls). The role table mirrors `tools/ingest/src/roles.ts`; keep both in sync.
- `docs/AE-AUTHORING.md` updated: the report file name, and the misspelled-tag rule made unambiguous.
- 244 tests across 48 files. Typecheck clean.

**What Josh needs to do (the milestone's test is manual)**

Open any comp in After Effects, then File > Scripts > Run Script File and pick `tools/ae-preflight/preflight.jsx`. Confirm the alert appears and the text file next to the project lists the layers as expected. If After Effects raises an error, paste the whole message.

**Next:** nothing on the milestone list. Remaining human items are collected at the end of this file's newest entry.

---

## 2026-09-11 · M14 Background removal (spike) · DONE (Josh delegated sign-off): chroma key ships; ML matting not attempted

**What exists now**

- `composition/src/chroma.ts`: a colour-matrix chroma key. Alpha = 1 − k·(screen − average of the other two channels), k = 1 + threshold; a component transfer hardens the edge; a second matrix pulls the screen colour out of kept pixels (spill). Green or blue screen. `chromaFilter(key)` returns the two matrices and a stable filter id.
- `Main` applies it as an SVG `<filter>` via CSS on the footage inside the slot, with the slot backing transparent while keyed so the composition shows through. Same filter in the Player and in `renderMedia`: no preview/export split and no exception to one-composition-two-runners, which SPEC 7 allowed but did not require.
- Stored inside the footage value (`{ assetId, fit, key: { color, threshold, spill } }`); both runners pass it as `media.key`. Inspector: "Key out green screen" toggle, screen colour, threshold and spill sliders.
- `chroma.render.test.ts` renders a generated green-screen clip (`composition/fixtures/greenscreen-2s.mp4`, green field with a red square) through a real render: without the key the green is green; with it the background shows through and the red square survives. Unit tests cover the matrices.
- 236 tests across 47 files. Typecheck clean.

**Verified by eye**

- Editor on project 2 with the green-screen clip: key on, threshold 0.5, spill 0.3, the SVG filter attached to the footage; the monitor shows the red square on black with no green.
- Server render of the same project: sampled pixels at frame 40 are black where the green screen was, red at the square, navy on the panel.

**Limits, stated plainly**

- It is a matrix key, not a matting model: soft hair edges, shadows on the screen and uneven lighting will show. Yellows and cyans lose some opacity because they contain the screen colour. Spill suppression tints kept pixels slightly toward neutral.
- ML matting (SPEC 7 step 2) was not evaluated. The chroma key met the milestone's done-when on a clean screen, and the spike was timeboxed as instructed.

**Next:** M15, After Effects pre-flight script.

---

## 2026-09-11 · M13 Fonts · DONE (Josh delegated sign-off)

**What exists now**

- Ingest ships each referenced font file into `templates/<slug>/fonts/` and records it in `meta.json` as `fontFiles: [{ family, file }]`. The lookup prefers the file matching the Lottie's `fStyle` (Regular, Bold…), then Regular, then the first match. The M4 rejection of missing fonts is unchanged.
- `composition/src/fonts.tsx`: `TemplateFonts` injects one `@font-face` per font (family name equals the Lottie's `fFamily`, so lottie-web's text picks it up) and holds the first frame with `delayRender` until `document.fonts.load` and `document.fonts.ready` resolve (SPEC 8). Both runners honour that, so preview and export wait the same way. `fontsFor(meta.fontFiles, slug, base)` builds the URLs per runner (`/api` in the Player, the server origin for export); `fontFaceCss` handles ttf/otf/woff/woff2 and data URIs.
- `MainProps.fonts`; `GET /projects/:id` now includes `meta`; `buildProjectProps` passes absolute font URLs; the editor passes `/api` ones.
- Ingest thumbnails render with the shipped fonts and the template's images embedded as data URIs, so they are correct without a running server.
- `fonts.render.test.ts`: two fresh real renders of a Plex text line are pixel-identical, and differ from a render without the font. Ingest, server and editor tests cover the plumbing.
- 226 tests across 45 files. Typecheck clean.

**Verified by eye**

- Thumbnail: "STAND-IN HEADLINE" in IBM Plex Sans (was a serif fallback since M4).
- Editor: a `@font-face` style tag for the template font is present, `document.fonts.check` reports IBM Plex Sans loaded, the SVG text's font-family is IBM Plex Sans.
- Export of project 1: frame 75 shows the headline in Plex; parity at frames 75 and 200 within threshold.

**Notes**

- "Matches the After Effects reference in size, weight and line breaks" is Germain's call on a real template; the mechanism is in place and proven deterministic.
- Fonts are loaded by family name only. A template that uses two weights of one family under the same `fFamily` needs the Bodymovin `fName` mapped to a weight; not needed by the stand-in.

**Next:** M14, background removal (chroma key spike).

---

## 2026-09-11 · M12 Playback performance · IN PROGRESS: needs one measurement on a visible browser tab

**What exists now**

- `app/src/perf.ts`: `summarizePlayback` (fps from the Player's `frameupdate` timestamps, dropped-frame estimate, worst gap) and `measurePlayback`. Open the editor with `?perf=<seconds>` and it plays from frame 0 for that long, then prints the result in the footer and on `window.__ccPerf`.
- `docs/perf-baseline.json`: the recorded baseline and every lever tried, with the environment each run happened in. `app/src/perf.test.ts` checks its shape; the "sustains 24 fps" check runs only against a run made on a visible tab.
- Composition: `LOTTIE_RENDERER` (one setting for both runners; stays `svg`) and `PREMOUNT_FRAMES = 15` (each element mounts 15 frames before its in point so its first frame is ready). Elements outside their window were already unmounted by `Sequence`.

**What was measured**

- Baseline, svg, no premount, stand-in with footage and a fade: 23.4 fps over 7.9 s, 1 dropped frame, worst gap 52 ms. Measured in the in-app browser pane right after it was fronted.
- Every later run returned 0 frames: the pane stops painting when the desktop app window is behind other windows, which pauses the animation loop the Player runs on. Forcing paints with screenshots made the Player advance but measured the screenshots (4.4 fps with one-second gaps), so it is not a valid number. Recorded as such.
- Lever 2 (canvas renderer): the Player never advanced a frame and the Lottie did not draw, in four runs. Reverted. Not a free switch.
- Lever 1 (lower proxy): not applied; the proxy is already 960 wide.

**What Josh needs to do (this is AT-4's human half anyway)**

Open `http://localhost:5173/projects/1?perf=8` in a normal browser tab, wait ten seconds, and read the green or red "measured … fps" line under the video. Tell me the number. If it is 24 or more, I record it under environment "visible" and M12 is done. If it is under 24, the next lever is a 640-wide proxy, and comparing `?perf=8` on project 2 (no footage) tells us whether footage or Lottie is the cost.

**Next:** M13, fonts.

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
