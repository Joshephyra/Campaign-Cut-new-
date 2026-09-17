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
