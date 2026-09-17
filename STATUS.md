# STATUS.md

Running log of where the build is. Newest entry first.

---

## 2026-09-17 · M52 Timing locked; a spot is exactly its length · DONE

**Why**

Josh's tweaks: timing locked, spots exactly :30 or :15, a :30 convertible to a :15.

**What exists now**

- `project.length_s` (migrated: a template's spot takes the template's seconds, a spot from nothing 30); `PATCH /projects/:id { lengthS }`; render props carry `lengthFrames`; `spotDurationFrames` in the composition gives both runners exactly the length.
- The editor: length chips in the top bar, "14.0 s of 30.0 s" under the monitor, no Length slider, the readiness list's length row (blocking) with "Cut down to :15" when over (`cutDownToFit`: proof points hidden from the end with their overlays, gaps closed, opening and end card kept).
- A headline is an overlay now (`SCENE_TYPES` without headline).
- The starter pack re-authored at standard lengths (nineteen elements; VERIFIED_PACK).
- Tests: 1 server, 1 transitions, 2 compliance, 3 cut-down, 2 editor, 1 pack. The M30 Length-slider test is gone; the M35 test reads the list. 545 tests green (the M30 transport test flaked once under the full parallel run and passed alone, as before).

**Verified**

- Real browser on spot 9 (14 s of content): chips :06 :15 :30 :60 with :30 pressed, the gauge "14.0 s of 30.0 s", no Timing section, the pill "3 to check" blocked, the length row "The spot is 14.0 s; a :30 must be exactly 30.0 s. Add 16.0 s of scenes."; pressing :15 saved 15 and the gauge read "14.0 s of 15.0 s" with "Add 1.0 s of scenes"; back to :30 saved 30.

---

## 2026-09-17 · M53 Collapsible sections · DONE

**What exists now**

- `Section` in `app/src/components/ui.tsx` folds when given an id (`useCollapsed`, remembered in localStorage under `cc.folded.<id>`, wrapped in try/catch); level 3 for blocks inside a section; `note` folds with the body; `action` stays live. Footage, Find stock footage, Music, Colours across the spot, Treatment, Saved themes, Add to the spot, Timing, How it ends, Scene, From the library and Exports all fold.
- Tests: 2 ui. 534 tests green.

**Verified**

- Real browser on spot 9: eleven folding titles (Add to the spot, Footage, Music, Colours across the spot, Treatment, Saved themes, Timing, How it ends, Scene, From the library, Exports; Find stock footage folds inside Footage). Footage folded, the Upload button stayed, and after a reload it was still folded (localStorage cc.folded.footage = 1). Capture in .impeccable/review/m53-folds.png.

---

## 2026-09-17 · M51 The strip in the ad's own words · DONE

**Why**

Josh's tweaks (2026-09-17): the strip should read as political ads are built (opening, proof points, end card), with lower thirds and text on screen as parts of those; the libraries of lower thirds, headlines, captions, callouts, overlays and transitions should be one press away.

**What exists now**

- `composition/src/structure.ts`: `structureOf` (scenes labelled for their place, overlays hung on the scene they start on, stray overlays kept apart) and `proofPointsFor`.
- The strip: OPENING / PROOF POINT 1 / END CARD above each scene chip, the scene's overlays as pills under it. Type labels in the picker read Openings, Proof points: footage, Proof points: stats, End cards, Lower thirds, Headlines, Captions, Callouts, Overlays, Disclaimers, in that order. The left column opens with "Add to the spot": one button per shelf, opening the picker on it, plus Transitions.
- Tests: 3 structure, 1 strip. 532 tests green.

**Verified**

- Real browser on spot 9: the strip reads Opening (Footage background, with Bar lower third under it), Proof point 1 (Headline), End card (Vote end card, with Disclaimer bar under it); the shelves sit at the top of the left column. Capture in .impeccable/review/m51-strip.png.

**Next**

M52 (timing locked, spots exact), M53 (collapsible sections), M54 (stock outlets), M55 (transitions between chips), M56 (animated callouts on a word), from the same tweaks.

---

## 2026-09-17 · Downloads named for the spot and its version · DONE

A download now lands as "rivera-for-senate-new-spot-9x16.mp4" rather than "project-9-7-9x16.mp4" (`app/src/exportName.ts`, on the panel's and the history's links; the render keeps its own name on the server). Tests: 2.

---

## 2026-09-17 · M50 Export every version in one go · DONE

**What exists now**

- `render.aspect` (migrated, 16:9 for older rows); `RenderQueue.enqueue(projectId, aspect?)`; `buildProjectProps({ aspect })`; `POST /render { projectId, aspects? }` answers the first job with every job in `jobs`; every render JSON carries `aspect`.
- Export MP4 gained a caret: "This version (16:9)" / "All four versions (16:9, 1:1, 4:5, 9:16)". The panel follows every job of a batch and reports "Exporting n of 4 · p%", then "4 versions exported · in Exports below"; the history shows each render's version beside its time.
- Tests: 2 server, 2 export panel. 526 tests green.

**Verified**

- Real browser on spot 9: the caret offered "This version (16:9)" and "All four versions"; the batch read "Exporting 1 of 4 0%" and ended "4 versions exported · in Exports below"; the history lists 9:16, 4:5, 1:1 and 16:9 with a download each. ffprobe: project-9-4.mp4 1920×1080, -5-1x1 1080×1080, -6-4x5 1080×1350, -7-9x16 1080×1920.

---

## 2026-09-17 · Finish review of the M43–M49 surfaces · DONE

The Impeccable finish reviewer went over the drag-to-reorder chips, the Scene section, the readiness pill and list, the picker's ×N suffix and the hint line. Disposition: fix, one round, then ship. Applied: the drop edge no longer blinks when the pointer crosses a chip's own children; an overlay's drop target is tinted blue as well as ringed, so it reads apart from the selection; the panel section says "Overlay … on the same scene. Drag its chip onto another scene" and "Duplicate" for overlays instead of promising "right after it"; the readiness list is a region that closes on Escape or a press anywhere else; hidden chips show no grab cursor and say "Hidden scene · switch Show on to drag"; the Add chip is sticky at the strip's right edge so it stays in view when the strip scrolls. Done straight after: Move earlier / Move later in the panel's Scene section, the keyboard's route to what a chip drag does, disabled at the ends (real browser: Headline moved before the background and back, saved). Carried to a later round: a custom drag image. Capture: .impeccable/review/review2-editor.png.

---

## 2026-09-17 · M49 Ready to export, in one list · DONE

**Why**

The top bar had grown two separate notes (the disclaimer check, then the empty-slot note) and a first-time user would have had a third and a fourth. One place, one list.

**What exists now**

- `readiness(scenes, fps)` in `composition/src/compliance.ts`: disclaimer (blocks), footage, logo, words; scenes named, up to three then "and N more"; items that do not apply are left out.
- `ExportPanel` shows one pill (`data-testid="readiness"`, `data-ok`, `data-blocked`) that opens "Ready to export?" as a small list under it (`check-<key>` rows). Export is disabled only while the disclaimer blocks.
- Tests: 3 composition, 2 export panel; the M35 editor test now reads the list. 521 tests green.

**Verified**

- Real browser on spot 9: the pill reads "2 to check" (grey; Export enabled); pressed, the list shows Disclaimer on screen 5.0 s (ok), No clip yet in Headline, Your logo is in (ok), Still the designer's words in 2 scenes: Bar lower third, Vote end card. The spot 7 test with a 2.5 s end card reads the same list red with Export disabled. Capture in .impeccable/review/m49-topbar.png.

---

## 2026-09-17 · First-time-user rehearsal of the from-nothing flow; M47 and M48 · DONE

**Why**

With M41–M46 in, the from-nothing flow was walked end to end as a new user would: a spot for a client, four scenes from the starter pack, a clip, the composer's copy, the client's brand, a logo through the panel's own file input, a treatment, and an export through the Export button.

**What the rehearsal found**

- Scenes added to a client's spot did not take the brand until "Apply Rivera for Senate's brand" was pressed. Fixed as M47: a scene added to a client's spot arrives branded; the add answers the scene's values and the editor uses them.
- The export carried the designer's grey stand-in wherever a scene's footage slot had no clip (the Headline has its own slot; only the background had a clip). Fixed as M48: the export panel notes the scenes with no clip yet, by name, without blocking.
- Two disclaimers showed at once on the end card (its own, and the Disclaimer bar added on top of it). Left as it is: both are the user's choice, and the check counts either.

**Verified**

- Real browser, spot 9 "Rivera for Senate: New spot": Footage background with the colour-bars clip, Headline with "Maria Rivera will lower your costs" from the composer, Vote end card, Disclaimer bar landing on the end card; the brand put #1D4ED8 and the client's disclaimer on every scene that carries the role; a logo uploaded through the end card's file input drew in the monitor; Glow set; Export MP4 rendered a 14.06 s 1920×1080 file (media/renders/project-9-3.mp4) with the glow, the brand colours and the disclaimer in its frames. After M47, a Bar lower third added to the same spot arrived in #1D4ED8 with the client's surface colour, with no Apply pressed. After M48 the panel reads "No clip yet in Headline", with the stand-in named in its title, and Export stays enabled.
- Tests: 1 server (M47), 1 composition and 2 export panel (M48). 518 tests green.
- The same spot switched to 9:16: the footage background's full-bleed slot filled the tall frame while its 16:9 surface layer sat auto-fitted in the middle band (the labelled auto-fit, as designed; a designer's 9:16 variant is the answer), two auto-fit boxes and the note showed; export parity at 9:16 (frames 60, 200, 330) all within threshold, worst mean 5.11 on the footage frame (proxy against original at 1080×1920). Captured in .impeccable/review/rehearsal-9x16.png. The spot was put back to 16:9.

---

## 2026-09-17 · M46 Duplicate a scene · DONE

**What exists now**

- The panel's "Scene" section has **Duplicate scene**. The copy is a new scene of the same element with the source's values copied and saved; a scene lands at its source's end and everything from there on moves on by the copy's length; an overlay lands where its source is. The copy is selected and the playhead moves to it.
- Tests: 1 editor. 514 tests green. Export parity on the spot from nothing after M43–M45 (reordered, one element used twice): all within threshold, worst mean 0.58.

**Verified**

- Real browser on the spot from nothing: Headline (5.0 s) selected, Duplicate scene made scene 10000001 at 9.0 s with the same words, selected, saved; the first try had landed at the end of the spot (the re-lay rule keeps gaps), which is why the rule became "at the source's end, everything after moves on".

---

## 2026-09-17 · M45 The same element, twice · DONE

**Why**

Building a spot from nothing out of the starter pack, the second caption was impossible: a scene was identified by its template element, so the picker greyed out anything already in the spot.

**What exists now**

- A scene has its own id in the spot (`project_scene`). The first use of an element keeps the element's id as its scene id, so nothing else changed shape and old spots migrate by copying rows; a second use gets a fresh id. `POST /projects/:id/elements` always makes a new scene with its own values. Every element in the detail carries `elementId` beside `id`.
- The picker adds an element again and says "in the spot ×2".
- Tests: 2 server (second use end to end; migration), 1 editor. 513 tests green.

**Verified**

- The live database migrated on the server's restart (rows moved to project_scene; the value and transition tables rebuilt without their template_element constraint, which the first live attempt hit as a 500 before the rebuild existed). Real browser on the spot from nothing: Boxed caption added a second time made scene 10000000 with its own default words beside scene 12 with the edited ones; six chips; the picker reads "in the spot ×2".

---

## 2026-09-17 · M44 Move an overlay onto a scene · DONE

**What exists now**

- Every enabled chip drags. A scene chip dropped on a scene chip reorders (M43); an overlay chip dropped on a scene chip lands on that scene, keeping its length (`moveOverlayToScene` in `app/src/reorder.ts`), and the target rings blue while you hover. Overlay chips take no drops.
- Chips keep a 144 px minimum; the strip scrolls sideways past that instead of squeezing names.
- Tests: 2 helper, 1 editor. 510 tests green.

**Verified**

- Real browser on the spot from nothing: every chip reports draggable; Boxed caption dragged over Headline rang it ("on") and, dropped, moved from 1.0 s to 5.0 s with the other four chips unmoved and the spot saved. In the narrow pane the strip scrolls (scroll width 769 px against 256 px) with every chip at its minimum.

---

## 2026-09-17 · M43 Reorder scenes by dragging chips · DONE

**Why**

A spot from nothing (M41) grows scene by scene, and the second thing a person does after adding scenes is move one. Josh ruled out a timeline; the chips are the scenes, so the chips drag.

**What exists now**

- A scene chip drags (overlay chips do not). Over another scene chip, a blue edge on its left or right half says where the drop lands; the drop re-lays the scenes in the new order (`app/src/reorder.ts`): each keeps its length, the gaps between positions stay, overlays keep their frames. The Player takes it at once; each moved scene is saved through `PUT /projects/:id/elements/:elementId`, debounced, undoable.
- Tests: 4 reorder, 2 editor. 507 tests green.

**Verified**

- Real browser on the spot from nothing (five chips): only the three scene chips are draggable; Headline dragged onto the left half of Footage background showed the blue "before" edge and, dropped, played first (0.0 s) with the background at 4.0 s, the caption, lower third and disclaimer unmoved, and the spot saved; dragged back the same way, the order returned.

**Next**

Josh's call. Built from the prototype's list: everything but Bubbly (M40, waits for a designed pack) and the timeline (parked).

---

## 2026-09-17 · Finish review of the M37–M42 surfaces · DONE

The Impeccable finish reviewer went over the composer and picker, the scene-chip stills, the Treatment control, the "From nothing" card and the empty states against the editor's direction contract. Disposition: fix, one round, then ship. Applied: scene-chip text truncates instead of running under the Add chip; a footage scene's chip draws its clip under the design; one filled accent on an empty spot (the stage's button; the panel's is ghost); "From nothing" follows the template groups (the audience starts from a designer's template); the picker's "Other" group has its own key; the composer takes focus when the picker opens; the Treatment segmented fills the panel like "How it ends"; the surface brief and DESIGN.md record the stills. Not worth a fix, per the review: the thumbnail-then-still swap on open, the four-line picker note. Captures: .impeccable/review/review-editor.png, review-library.png.

---

## 2026-09-17 · M42 The composer's copy lands; overlays fit the last scene · DONE

**Why**

Two loose ends from M37 and M41 found while building a spot from nothing: the copy typed in the composer previewed in every element but did not travel with the one you picked, and an overlay added near the end of the spot could run on past the last scene over nothing.

**What exists now**

- Adding an element from the picker gives its first text role the composer's copy (never a disclaimer), exactly as the preview showed, and saves it with the element's other values. Nothing typed, nothing changed.
- An overlay is pulled back so it ends with the last scene when it can fit on the scene under the playhead; when it is longer than that scene it stays where it was put (`app/src/landing.ts`).
- The picker's Lotties are fetched once per page and kept for every opening of the picker.
- Tests: 1 editor (copy lands and is saved), 1 landing. 501 tests green.

**Verified**

- Real browser on the spot from nothing: "Costs down, wages up." typed in the composer, Boxed caption added: it landed at the playhead (1.0 s, 4 s) with that line drawn in the monitor, and the spot saved.

**Next**

Josh's call. The prototype's inventory is built but Bubbly (M40) and the timeline (parked).

---

## 2026-09-17 · M41 A spot from nothing · DONE

**Why**

The library (M31), the composer (M37) and the starter pack (M38) make a spot possible without a template. The prototype's composer began on an empty stage; the app now can too.

**What exists now**

- A built-in `blank` template (slug `blank`, library only, no elements, no files) that `buildApp` ensures on every start. `POST /projects { templateSlug: "blank" }` makes an empty spot ("New spot", or "<client>: New spot" with a client). The detail, the render props and the disclaimer rule take an empty spot in their stride: nothing to render, and no export until a disclaimer is on for four seconds.
- Library page: "From nothing" above the templates, one dashed card, "Start a spot from nothing", for the chosen client.
- The editor opens an empty spot with "An empty spot. Everything on the video comes from the library." on the stage and "Nothing on the video yet" in the panel, each with "Add the first scene".
- Landing (`app/src/landing.ts`; `SCENE_TYPES` and `isSceneType` in the composition): a scene lands at the playhead, never past the end, and moves the playhead on to its end; an overlay lands at the playhead, or on the start of the last scene when the playhead is past the end. The picker's note says so.
- Fixed on the way: the opening-frame seek ran on every reload of the spot, so every add reset the playhead to the first scene's hold frame; it now runs once per spot opened.
- Tests: 3 server, 1 scene types, 4 landing, 1 library, 1 editor. 499 tests green.

**Verified**

- Real browser: the Library shows "Start a spot from nothing"; pressing it opened spot 8 ("New spot") empty, with the prompt on the stage and in the panel. "Add the first scene" opened the library; Footage background landed at 0.0 s (5 s), Headline followed at 5.0 s, Bar lower third landed on the Headline at 5.0 s, Disclaimer bar at the playhead (6.0 s, 4 s), after which the disclaimer check read "Disclaimer 4.0 s" and Export was enabled. Captures in .impeccable/review/m41-*.png.
- Export parity on that spot (frames 30, 180, 250): all within threshold, worst mean 0.54. A spot from nothing exports like any other.

**Next**

Josh's call. Everything the prototype listed is built but Bubbly (M40, waits for a designed pack) and the timeline (parked). The five acceptance tests and Germain's verdict are the gate; the human items are unchanged (Germain's verdict on media/fidelity, the fps reading, a first-time user, closing After Effects).

---

## 2026-09-17 · M39 Style treatments · DONE

**Why**

Josh's "overall style updates": the prototype's Clean, Grit, Glow, Bubbly, Opaque. Three of the four are looks laid over the spot; Bubbly is a font swap, which would put text in a font the designer never chose, so it becomes a designed variant from After Effects (M40, parked).

**What exists now**

- `composition/src/treatments.ts` and the composition draw the treatment, so the preview and the export are the same code path: grit is film grain over the whole frame (a fractal-noise SVG tile at 22% overlay blend, footage included) with a touch more contrast on each design; glow is a two-stop drop shadow in the spot's accent colour on each text layer and each accent-coloured layer inside the design (a shadow on the whole design follows its silhouette, and a design's surface fills the frame, so the first try glowed nothing: found by sampling the export), never on the footage; opaque runs every editable text layer but the disclaimer through one SVG filter that dilates the glyphs into a white plate and sets the words in dark ink, the prototype's highlighter look.
- `project.treatment`, clean by default, kept by duplicate; `PATCH /projects/:id { treatment }` (unknown refused, naming the four). Render props carry `treatment`, glow with the accent the spot has set.
- Style panel: "Treatment" under the colours, a segmented Clean · Grit · Glow · Opaque. Pressing one changes the monitor at once and saves.
- `applyLottieValues` tags text layers `cc-text` beside the placement class.
- Tests: 4 treatments, 4 Main, 1 tagging, 2 server, 1 editor. 487 tests green, render tests included.

**Verified**

- Real browser on the Contrast :30 spot: each button sets `data-treatment` on the composition root; grit draws the grain layer last at 0.22 overlay and the design's filter reads contrast(1.12); glow reads drop-shadow in #F05929 (the spot's accent) on the design and none on the footage; opaque puts the plate filter on the headline's text layer. Captures in `.impeccable/review/m39-*.png`.
- Export parity with glow on a duplicate of the spot (npm run parity, frames 30, 120, 240): all within threshold, worst mean 4.16 at frame 30. Pixels sampled above the accent bar in both renders fade from orange to navy over 30 px the same way: the export carries the glow.

**Next**

Josh's call. The prototype's inventory is built except Bubbly (M40, waits for a designed pack) and the timeline (parked). The five acceptance tests and Germain's verdict remain the gate.

---

## 2026-09-17 · M38 The starter element pack · DONE

**Why**

The picker offered three plain templates' worth of elements. A first user test needs range, and Germain's designs are not here yet. A pack built by script in After Effects, exported and ingested unattended, fills the library and proves the handover end to end a second time.

**What exists now**

- `tools/ae-preflight/starter-pack.jsx` builds sixteen elements covering every library type but "open": Headline, Bar lower third, Stacked lower third, Boxed caption, Pop-on caption, Callout, Big stat, Two stats, Pull quote, Top bar, Split background, Footage background, Vote end card, Learn more end card, Disclaimer bar, Disclaimer card. Arial Narrow Bold for headlines and stats, Arial for the rest; campaign blue accent and navy surface as the recolourable roles. Disclaimers hold four seconds. `tools/ingest/src/starterPack.test.ts` checks the plan (14 tests).
- `tools/ae-preflight/run-unattended.mjs` runs one script in After Effects unattended: launch fresh or `--attach`, hand off with `-s`, watch the log, never kill. The three scripts (build, pre-flight, export) ran through it; `aerender` made the 72 s reference; `npm run ingest` took the folder. A quit called inside a command-line script is ignored by After Effects, so it may stay open on an empty project between runs (`--attach` uses it); a person closes it with File > Exit at the end.
- `elements.json` `"libraryOnly": true` keeps a pack out of the "start a spot" grid while every element stays in "Add to the spot" (`template.library_only`, migrated).
- Ingest rule, found by the pack: After Effects reports Arial Narrow Bold as family "Arial", style "Narrow Bold"; the ingest moves the width into the family so the face does not collide with Arial Bold. `docs/AE-AUTHORING.md` says so and names the file the designer must hand over.
- Composition fix, found by the fidelity harness: the elements now mount only once the template fonts are ready (`TemplateFonts` wraps them). Before, an element at frame 0 measured its text in the fallback font and kept those widths: the first headline drew Arial Narrow glyphs at Arial spacing and wrapped differently from After Effects. Both runners take the same path.
- Tests: 14 plan, 2 ingest (libraryOnly, width rule), 1 server route, 2 Main. 475 tests green.

**Verified**

- After Effects, unattended: built (16 comps + master), pre-flight 17 comps with zero problems, Bodymovin exported 16 comps, aerender 72 s reference, ingest 16 elements with Arial Narrow and Arial faces shipped.
- Real browser on the Contrast :30 spot: "Add to the spot" lists 24 elements, the 16 pack elements draw as stills in Arial Narrow and Arial; "LOWER COSTS NOW" typed in the composer appeared in every text element; Headline added to the spot draws in the monitor with narrow widths (first line 1378 units, as After Effects wrapped it).
- Fidelity against the reference: before the composition fix 11 of 12 samples within threshold, the first headline at mean 8.84 (narrow glyphs at Arial spacing, wrapped on a different word); after it 12 of 12, worst mean 3.09 on that same headline (edge antialiasing on 116 px type). Strips in media/fidelity/starter-pack-1789637478919.

**Next**

M39, style treatments (Grit, Glow, Bubbly, Opaque), or Germain's real pack through the same handover. Human: close After Effects (File > Exit) when convenient.

---

## 2026-09-17 · M37 The composer · DONE

**Why**

The original prototype's strongest idea: type your copy once and see it in every element before you choose one. Also the scene strip: the chips now draw the scene as edited, not a stock thumbnail.

**What exists now**

- `GET /elements` carries each element's Lottie URL, schema and fonts (`server/src/app.ts`).
- `app/src/components/ElementPreview.tsx`: a still of one element at one frame, values applied through the same `applyLottieValues` the composition uses, drawn once by lottie-web (svg renderer, no autoplay, destroyed on unmount). A preview that will not draw is logged, not fatal.
- The library picker ("Add to the spot") opens with a composer field. Typing copy puts it in each element's first text role (never a disclaimer) and redraws every element at its hold frame; template fonts are loaded into the picker so the previews are set in the designer's type. The library's Lotties are fetched once and cached for the dialog's life.
- Each scene chip under the monitor draws its scene with the spot's own values at the chip's hold frame, in the spot's aspect.
- Tests: 6 ElementPreview, 1 library composer, 1 scenes thumbs, server library listing. lottie-web is mocked in the app test setup (jsdom has no canvas); the tests that care what was drawn record it. 455 tests green.

**Verified**

- Real browser on the Contrast :30 spot: four scene chips each draw an SVG of their scene with the current headline ("Hi yes hello"); the library opened with eight elements, "A NEW DIRECTION" typed in the composer appeared in all eight previews in the template's type. Headless capture at 1440 in `.impeccable/review/m37-editor.png`.

**Next**

M38, the starter element pack: a set of elements built in After Effects and ingested, so the library has real range (lower thirds, callouts, end cards, backgrounds) for the first user test. Then M39, style treatments.

---

## 2026-09-17 · M36 Aspect-ratio versions · DONE

**Why**

Josh's ruling after reviewing the original prototype: 16:9 is the master and a spot is versioned into 1:1, 4:5 and 9:16. CLAUDE.md now says so; automatic reflow as the way to make other ratios stays out.

**What exists now**

- A spot has an aspect (16:9 by default; `project.aspect`, added to old databases). The frame follows it in both runners: the Player takes its size from the project, the render's `calculateMetadata` takes it from the props, so an export in 9:16 is a 1080×1920 file named `project-<id>-<render>-9x16.mp4`. Positions stay fractions of the frame.
- Designer variants: `elements.json` entries may carry `variants: { "9:16": "<folder>" }`. The ingest checks the export is exactly the ratio's frame and carries the same tags as the master (naming the element and ratio when not), ships it under `elements/<slug>/variants/<9x16>/` with its own schema and images, records it in `meta.json`, and includes its fonts. Both runners resolve an element's files per aspect: the variant when it exists, the master otherwise.
- Auto-fit: a scene with no variant is contained and centred in the new frame in pixels of the frame, over the template background; a footage slot that filled the 16:9 frame fills the new frame, any other slot maps into the box. Dragging an auto-fitted layer moves it by the right amount. The scene's panel says "Auto-fitted from 16:9. Ask the designer for a 9:16 version of this scene."
- A Version group in the top bar (16:9 · 1:1 · 4:5 · 9:16): pressing one saves it and reloads the spot at that ratio's files; the monitor takes the ratio (limited by height for tall versions) and the facts line shows the frame.
- Docs: `docs/AE-AUTHORING.md` documents `variants`.
- Tests: 2 aspect, 4 Main auto-fit, 1 metadata, 3 ingest variants, 4 server (file resolution, PATCH and duplicate, detail and render props, file name), 1 editor. 452 tests green.

**Verified**

- Real browser on the Contrast :30 spot: Version 9:16 saved, the monitor turned portrait, two auto-fit boxes drew on screen, the panel showed the note, the facts read 1080×1920; back to 16:9 afterwards.
- A fresh spot switched to 9:16 exported through the parity script: a 1080×1920 MP4 (ffprobe), all four frames within threshold of the preview; the headline sits centred in the tall frame over the template background.

**Next**

Josh's call. Everything the prototype review opened is built except what he parked (the timeline).

---

## 2026-09-17 · M35 The disclaimer's four seconds · DONE

**Why**

Josh's ruling after reviewing the original prototype: a disclaimer must be on screen for at least 4 seconds. CLAUDE.md's rule is amended to exactly that one check; the wording is still nobody's business but the campaign's.

**What exists now**

- One pure rule in the composition package (`disclaimerCheck`): the seconds a disclaimer is on screen are the union of the enabled scenes whose disclaimer text is not empty. Below 4.0 s the message says the seconds it has and what to do; with none it says so.
- The export route refuses a spot under the minimum with that sentence (400) before anything is queued. The editor computes the same rule from the same function and shows it beside Export: a green shield with the seconds when fine, the red sentence with Export disabled when not. Lengthening the scene in its panel frees it live.
- Tests: 5 rule, 2 route, 1 editor; two older render fixtures gained a five-second disclaimer because a spot without one no longer exports. 437 tests green.

**Verified**

- Real browser and server on the Contrast :30 project, whose end card had been shortened to 2.5 s: the line reads "Disclaimer on screen for 2.5 s; it must be at least 4.0 s. Lengthen the scene that carries it.", Export is disabled, and `POST /render` answers 400 with the same sentence.

**Next**

M36: aspect-ratio versions.

---

## 2026-09-17 · M34 Stock footage · DONE (live run awaits Josh's key)

**Why**

The last of the four phase-2 features Josh opened: stock footage found and pulled in without leaving the editor.

**What exists now**

- Pexels (free key at pexels.com/api) behind a small provider shape. The key comes from `PEXELS_API_KEY` in `.env` (gitignored; `.env.example` shows the line; the server now loads `.env` itself, no dependency) or the shell. Without a key the routes answer 503 naming the variable and the panel shows that sentence; nothing else changes.
- `GET /stock/search?q=` answers normalised results; `POST /stock/import` downloads the largest mp4 at or under 1080p and registers it through the same function uploads now use (original, proxy, poster, row), named "<title> (<photographer> on Pexels).mp4" so the credit rides with the clip everywhere it shows.
- "Find stock footage" under the Footage grid in the editor: type, Enter, thumbnails with length and credit, "Add to footage" pulls one in and marks the card; the clip then presses or drags onto the video like any upload.
- Tests: 2 parsing, 3 route (one runs the real ffmpeg pipeline on the fixture through an injected fetch), 2 panel. 431 tests green.

**Verified**

- Real browser without a key: searching shows "Stock footage is off: set PEXELS_API_KEY in .env and restart the server", and the route answers 503. The full import path is proven by the route test against an injected Pexels; the live search and import are Josh's to run once the key is in `.env`.

**Next**

Josh parked the Pexels key (2026-09-17): stock stays built and tested against a stand-in, with no live run for now. The phase-2 list is built; the five acceptance tests and Germain's verdict are still the gate for the proof of concept.

---

## 2026-09-17 · M33 Client profiles · DONE

**Why**

The third phase-2 feature: an agency keeps several clients, and a spot made for one should open already branded. A client is a record in the library, not an account; users and logins stay non-goals.

**What exists now**

- Clients in the library: name, logo (uploaded through the same images route as a logo swap), colours by role (accent, surface; the same roles the tag vocabulary knows, kept equal by a test), disclaimer. Add, edit in place, delete behind a confirming press. Deleting a client leaves its spots with no client.
- "New spots for" chips above the templates: pick a client (or no client) and every spot you start from a template is for them. The spot is named "<client>: <template>", and opens branded: colours written into every scene by role, the logo into every logo slot, the disclaimer into every disclaimer field, through the same server-side write as M32's style, so the values are ordinary project values and both runners are untouched. Empty parts of a brand leave the designer's values alone.
- The editor names the client in the top bar ("Contrast :30 · for Rivera for Senate") and the Style panel offers "Apply <client>'s brand" to put it back after edits. Duplicating a spot keeps its client. Project rows in the library name their client.
- Routes: `GET/POST/PATCH/DELETE /clients`, `POST /projects` takes `clientId`, `POST /projects/:id/brand`. Schema: `client` table, `project.client_id` (added to old databases).
- Tests: 2 database, 3 route, 3 panel, 2 library, 1 editor, 1 ingest. 424 tests green.

**Verified**

- Through the running server: a client "Rivera for Senate" (blue accent, dark surface, a disclaimer) then a Contrast :30 spot created for it opened with the accent and surface written into every scene, the disclaimer in the end card, and the logo untouched (the client had none); the test spot was deleted, the client kept for Josh to see.

**Next**

M34: stock footage. Needs Josh's API key for the stock site.

---

## 2026-09-17 · M32 Style: colours across the spot and saved themes · DONE

**Why**

The second phase-2 feature. Josh chose colours only for now; fonts come with client profiles (M33), where the client supplies the font files, because swapping fonts inside a designer's template is where designs break.

**What exists now**

- "Colours across the spot" in the left column: one row per colour role the designer tagged (accent, surface, and whatever else), showing the first scene's colour and the designer's; a valid hex or a swatch pick writes that colour into every scene that carries the role. "Designer's" puts the authored colour back per role. When scenes disagree the row says so.
- `POST /projects/:id/style { colors }` does the writing on the server from each element's own schema, so the result is ordinary project values: undo, reload, preview and export all see the same rows and nothing in either runner changed. The editor merges the answer in and marks it saved.
- Saved themes: `theme` table, `GET/POST/DELETE /themes`; "Save as theme" names the current colours; a theme row applies to the open spot with one press, or is deleted.
- Tests: 1 database, 3 route, 4 panel, 1 editor. 412 tests green.

**Verified**

- Real browser on Contrast :30: setting the accent to #1D4ED8 across the spot wrote it into every scene that carries the role (three of the four), recoloured the fills on the video, and showed in the scene's own Accent field; "Save as theme" stored "Union blue" and it appeared with an Apply button; the designer's orange was put back the same way.

**Next**

M33: client profiles.

---

## 2026-09-17 · M31 The element library · DONE

**Why**

Josh opened the phase-2 features ("I want to start adding in the other features"). CLAUDE.md's non-goals were amended for the four he chose (element library, style and themes, client profiles, stock footage; users and accounts stay out). Every one of those hangs off elements becoming a library any spot can add from, and the app knowing what an element is.

**What exists now**

- Element types: `open`, `headline`, `lower-third`, `caption`, `callout`, `overlay`, `stat`, `background`, `end-card`, `disclaimer` (in the composition package, shared by ingest, server and app). `elements.json` entries may carry `type`; when absent the ingest infers it from the slug; an unknown type fails the ingest naming the element and the allowed list. The type lands in `meta.json` and `template_element.type` (old databases get the column and a backfill from slugs; `server/src/cli-backfill-types.ts` does the same by hand).
- The library: `GET /elements` lists every element of every template with its type, template and thumbnail. `POST /projects/:id/elements` adds one at a frame with its authored length and its schema defaults; `DELETE` removes an added one; the spot's own elements are refused (hide them instead). Project elements carry `templateSlug`, `type` and `added`; files, image bases and fonts resolve per element's own template in both runners, and the font list is merged across every template involved (`projectFontFiles`). Duplicating a project copies added elements.
- Editor: an Add chip at the end of the scene strip opens the library in the left column (never over the video), grouped by type with template thumbnails; pressing one adds it at the playhead, selects it, seeks to it and shows its controls; elements already in the spot are dimmed. "Remove from spot" in the panel for added elements.
- Docs: `docs/AE-AUTHORING.md` documents `type`; `docs/SPEC.md` sections 3 and 4 describe the library.
- Transitions and overlaps: chaining now leads into the next scene that actually follows (starts at or after the element's end); a scene added over another, a lower third over the open, keeps its own timing instead of being pulled into the open's transition. The panel's "How it ends" follows the same rule.
- Tests: 2 element-type, 3 ingest, 5 database, 4 route, 3 composition, 2 editor. 403 tests green across the repo.

**Verified**

- In the real browser on the Contrast :30 project: Add opened the library grouped Open / Lower thirds / Stats / End cards / Overlays; pressing "Lower third from Three Part" added a fifth scene at the playhead, selected it, rendered its layers on the video with the Three Part template's own font, showed its Subhead control, and saved it with `templateSlug: three`; at its own frame it rendered over the Open beside the spot's own lower third; Remove from spot took it out again.

**Next**

M32: overall style and saved themes.

---

## 2026-09-17 · M30 The video is the interface · DONE

**Why**

Josh on M29: a good step, still "rudimentary"; he wants it polished and professional, the timeline gone ("the then cut seems weird"), and editing on the video itself: drag things in, edit on the video. He asked to lean into the Impeccable skill.

**How it was decided**

- Impeccable's init interview: the user is broader than one staffer (agencies and consultants with several clients); success is an export they trust. `PRODUCT.md` at the root records it.
- Visual direction: Josh took the category standard, played straight: sit alongside CapCut at its craft level, "but better designed and made to look political for Democratic campaigns". The direction roll ran (seed 667390b7) and the user's choice binds. Code-led (no image generation here). The direction contract lives in `app/.impeccable/surfaces/app-src-pages-editor-tsx.md`.
- No timeline. Timing stays the designer's, with a Length slider per scene for when footage needs more room; transitions and show/hide moved into the scene's panel.

**What exists now**

- The world: Public Sans (self-hosted, one variable file), a dark studio ground with two panel tones and one hairline, one accent (campaign blue) filled on the primary action and the selection and tinted on hover and drop targets, red for danger only, 8/12 px radii, Lucide icons, themed sliders, switches, swatches, scrollbars, focus and selection. Shared controls in `app/src/components/ui.tsx`. The library page shares the shell.
- The editor: top bar (Library, wordmark, project name, Undo/Redo, save state, Export); library on the left (footage thumbnails to press or drag, music bed with volume and start); the monitor in the centre at the largest 16:9 the width allows; a scene strip under it; the scene's panel on the right (Show, the generated controls, Timing, How it ends) with Exports at the bottom.
- On the video: press-and-drag placement (M28) with the hairline outline; double-click a text layer to type in an in-place field anchored below it, every keystroke live, Enter to finish, Escape to put it back; drag a clip from the library over the video and the footage slot of the scene on screen lights up blue with "Drop to use here", the drop lands it; a video file dragged from the desktop uploads and lands the same way.
- Length: lengthening a scene moves every scene that started after it; overlapping scenes stay. Saved per element.
- Removed: the Timeline component and its tests. `docs/SPEC.md` section 4 rewritten for the new surface; `DESIGN.md` at the root records the system.
- Tests: 9 new editor tests (scenes, show, how it ends, length ripple, in-place typing commit and cancel, drop a clip); the Player stub now records seeks and pauses. 383 tests green across the repo. The Impeccable detector ran over every changed file: no findings.

**Verified**

- Headless Chrome captures at 1440×900 and 1280×800 (`.impeccable/review/`, gitignored): the three columns, the monitor, the scene strip, the panel and the library all render in the new world with Public Sans.
- The in-app pane cannot emulate a laptop width, so Josh's own eyes at his width are still owed.

**Finish review**

The Impeccable finish reviewer (a fresh agent, screenshots and contract only) returned **fix** with seven material findings: the monitor opened on the empty first frame of the entrance animation (nothing to press); the Player's stock controls sat over the video; the on-screen scene chip was not filled; the library had no primary action and ended on a heading with a link; one type step was missing; the top-bar name cluster ran together and the save state was invisible at idle; the stacked Footage/Music sections were an uncited deviation from the brief. All seven were fixed in one batch: the Player opens on a scene's hold frame (a second in) and chips seek there; the Player chrome is off and a transport (play, clock, scrub, mute, full screen, Space to play) sits under the monitor in the world's controls; the on-screen chip is filled blue and chips are proportional to length; the library's top bar has a filled "Add template" button and the add section is a dashed region; the panel name is 18 px and the monitor hint 12 px; the name cluster has a middle dot and a pencil, "Saved" shows at idle; the brief cites the stacked sections. The verdict pass scored six resolved and one partial (the add region was not yet visible) and named one regression (a fourth time format on the transport clock); both were fixed, recaptured and scored resolved. Final disposition: **ship**, remaining: clear. `docs/DESIGN.md` and `.impeccable/design.json` record the built system.

---

## 2026-09-17 · M29 Fewer dropdowns, fewer numbers, a cleaner surface · DONE

**Why**

The second half of Josh's verdict: less rigid numbers, fewer selects, a more polished look. Built straight after M28 in the same session.

**What exists now**

- No `<select>` and no number field anywhere in the editor. Checked in the browser: zero of each on the sample project.
- Timeline: ruler labels are spaced from the track's measured width (at least 56 px apart, stepping 1, 2, 5, 10, 15, 30 or 60 s), so a 30 s spot no longer prints "0s1s2s3s…" on top of itself; bars carry the element name, with the in and out timecodes as a hover title; pressing a bar selects its element; the selected bar is outlined in cobalt. The transition on each boundary is a segmented row (Cut, Fade, Wipe, Slide) with a length slider read out in seconds.
- Footage in the inspector: the Footage panel's thumbnails are the picker; the inspector shows the chosen clip as a card (thumbnail, name, length, size), Fill/Fit as two buttons, "Use the authored slot" to go back, and Trim as a two-handle bar over the clip: drag a handle or press the bar to bring the nearer one, or nudge a focused handle with the arrow keys (0.1 s, 1 s with Shift); the handles cannot cross; the times sit beside the bar as facts. Screen colour for the key is two swatches.
- Music: tracks are rows ("No music" plus one per upload); volume and the start point are sliders with their values beside them.
- Rhythm: one 56 px header with the project name, its template, Undo/Redo as a paired control, the save state in a fixed slot and a stronger Export button; a 22 rem sidebar with the element tabs as one segmented bar; section titles at one size and tracking everywhere (editor, footage, music, exports, library); facts in mono, controls in sans. The Console's rules are unchanged: hairlines, no radius, cobalt only when active.
- Tests: ruler interval and rendered labels, named bars, segmented transitions and their slider, footage card and authored-slot return, trim bar by pointer and keyboard with the no-crossing rule, colour swatches, music rows and start slider; the editor's music test follows. 390 tests green across the repo.

**Verified**

- Browser (project 5): zero selects, zero number inputs; ruler labels 0s, 10s, 20s, 30s on a 308 px track; every bar named with its timecodes in the title; three transition groups plus Fit; the trim bar reads "0.0 s – 15.0 s of 15.0 s" for the chosen 15 s clip; sliders present for transition length, Size, Tilt, volume and start. Screenshots of the editor and the library taken in the pane.
- Not yet: Josh's own eyes on it at laptop width. The pane here is 800 px wide, so the timeline bars truncate their names; at laptop width they do not.

**Next**

Josh reviews the surface and says what still feels rigid. Germain's verdict on the fidelity strips (AT-2) is still the gate for the proof of concept.

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
