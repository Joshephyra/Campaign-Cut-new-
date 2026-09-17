# ROADMAP.md

What Josh expects the product to need after the proof of concept passes its five acceptance tests. Recorded 2026-09-17. Nothing here is in scope until Josh moves it into `MILESTONES.md`.

Josh opened brand kits and themes, client profiles and stock footage on 2026-09-17 (see CLAUDE.md, "Opened on 2026-09-17"); they are now milestones M31 to M34 in `docs/MILESTONES.md`. Users, teams and accounts stay non-goals.

## Element types a template library will need

Lower thirds, text on screen, headlines, captions, animated callouts, overlays, transitions, backgrounds, end cards, disclaimers.

Today every element comes from a designer's After Effects comp and the app has no idea which of these it is. A library the size Josh describes needs each element to declare its type at ingest (an `elements.json` field, or a comp-name convention) so the editor can offer "add a lower third" rather than "add element 03".

## Style

- Overall style updates and overall themes: one change (a palette, a font pairing) applied across every element of a spot.
- Brand guide per client profile: colours, fonts, logo, disclaimer text, applied when a project is created. **Non-goal today (brand kits, saved themes).**
- Agencies hold several client profiles. **Non-goal today (users, teams, workspaces).**

## Footage

- Stock connections: search and pull clips straight from stock sites' APIs. **Non-goal today (stock footage integrations).** Also needs API keys, which the standing rules keep out of source.

## Interaction rules Josh set

- Fewer dropdowns. Fewer rigid numbers. Direct manipulation: drag on the monitor, sliders, thumbnails, segmented buttons.
- Cleaner and more polished, within The Console (hairlines, no radius, cobalt only when active).

## The original prototype (campaigncut_3.html, reviewed 2026-09-17)

Josh's first prototype, read feature by feature against the build. "Built" means it exists and is tested; "partly" names what is missing; "not yet" is open; "decision" collides with a rule Josh set and needs his call.

### Design decisions worth carrying over

- **The composer.** One text box at the top of the library; every text element previews with the user's own copy. Our library picker shows the template thumbnail for every element; previewing each element with the user's headline is the single biggest upgrade to the picker.
- **A grouped library.** Lower thirds, text on screen, headlines, captions, animated callouts, overlays, transitions, backgrounds, end cards, disclaimers. Our element types already match this grouping (M31).
- **Sidebar tabs**: Templates, Themes, Stock, Brand. We stack Footage, Music, Style in one column; tabs would scale better as the library grows.
- **The Brand tab's structure**: client, colours, typefaces, per-project accent fonts, logo variations, saved photos, textures, default disclaimer. Our client profile (M33) covers client, colours, one logo and the disclaimer.
- **Theme packs with beats** (Intro, Proof 1 to 4, Ending): a whole spot's structure as a set of typed, droppable elements. In our model this is exactly a template with typed elements, plus a style.
- **Export presets by destination** (CTV, Social, Broadcast, General) with the specs on the card, and a compliance line under them.
- **Safe margins on the monitor**, a "Program" label, a full-screen button, a five-button transport with timecode.

### Feature inventory and status

| Prototype feature | Status |
|---|---|
| Text templates: lower thirds, text on screen (stat, pull quote, kinetic line), headlines, captions (pop-on, karaoke, word pop, boxed), end cards (vote, donate, learn more), disclaimers (bottom bar, full card) | Partly: the library and its types exist (M31); the elements themselves come from After Effects templates, and today there are three plain templates. Needs a designed element pack (Germain, or a starter pack built unattended). |
| Composer: user's copy previews in every template | Not yet. |
| Style treatments: Clean, Grit, Glow, Bubbly, Opaque | Not yet. Josh's "overall style updates". Grit/Glow/Opaque are post-effects over an element; Bubbly is a font and radius swap. |
| Favorites (elements and themes) | Not yet. |
| Animated callouts: underline, circle or arrow on chosen words, dragged in | Not yet. Needs per-word layout inside a text element: a new element kind, not a tagged layer. |
| Overlays: halftone, moiré, vignette, scanlines, grain, light leak | Not yet as elements; the type exists. Each is a small After Effects comp or a composition-level effect. |
| Transitions: hard cut, dip to black, flag wipe, push left | Partly: cut, fade, wipe, slide exist (M10). Dip to black and a flag-coloured wipe are presets to add. |
| Backgrounds: solid, gradient, linen, paper | Not yet as elements; the type exists. |
| Images: upload, effects (B&W, outline cut-out, roto with edge refine), edited-images library | Partly: logo upload exists; green-screen key exists (M14). B&W and outline are filters; roto (automatic subject matting) is a big separate piece. |
| Theme packs (White Board, Blueprint, Rubber Stamp, GOTV, Collage, Exposé, On the Record, Red Alert), each with six beats | Not yet as designs. Structurally a template with six typed elements plus a style; the pipeline can take them today. |
| Saved themes (colours) | Built (M32). |
| Stock: search across Shutterstock, Filmpac, Filmsupply, Envato; SFX, footage and photos; "cleared for political use" | Partly: Pexels footage search and import (M34, key parked). Other providers need contracts and keys; SFX and photos are the same path with a different media kind. |
| Brand: client select and save, brand colours, typefaces, accent fonts per project, logo variations, saved photos, textures, default disclaimer | Partly: clients with colours, one logo and disclaimer (M33). Typefaces, accent fonts, logo variations, saved photos and textures are not yet. |
| Version: aspect ratios 16:9, 1:1, 4:5, 9:16 | Decision: CLAUDE.md says 16:9 only, no automatic reflow. The honest route is a designer-authored variant per ratio; automatic reflow is the trap the rule exists for. |
| Version: length 60, 45, 30, 15, 6 s and custom | Partly: scene lengths can be changed (M30) and the spot follows; a one-press retime to a target length is not yet. |
| Export presets: CTV, Social (captions burned in), Broadcast (ProRes, loudness, slate), General | Partly: one H.264 MP4 export (M11). Presets, loudness normalisation and ProRes are listed as out of scope in MILESTONES; Josh's call. |
| Disclaimer: required, minimum 4 s, compliance line at export | Decision: CLAUDE.md says the disclaimer is an ordinary field and nothing validates it (the compliance engine killed the last build). A minimum-length check at export is small, but it is a rule to reopen, not a feature to slip in. |
| Timeline: tracks V2/V1/A1/Disclaimer, blade, snap, markers, zoom, import base cut, eye toggles | Decision: Josh removed the timeline on 2026-09-17 in favour of editing on the video. Show/hide and length live in the scene panel. Markers and blade have no home without a timeline. |
| Monitor: program label, aspect chip, fit, safe margins, full screen | Partly: full screen exists; safe margins are not drawn (they would be a documented overlay, like the drop target). |
| Transport with hh:mm:ss:ff timecode | Partly: play, scrub, mute, full screen (M30); no step buttons; time shown in seconds by Josh's "fewer rigid numbers" rule. |
| Undo / redo | Built (M23). |
| Toasts | Not used: nothing overlays the monitor; messages sit in panels. |
