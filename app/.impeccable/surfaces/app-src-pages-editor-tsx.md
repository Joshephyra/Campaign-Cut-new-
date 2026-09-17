---
version: 1
slug: "app-src-pages-editor-tsx"
primary_target: "app/src/pages/Editor.tsx"
related_targets: ["app/src/pages/Library.tsx"]
---

## Scope

The editor surface: `/projects/:id`. Visitor mode: Operate. Also governs the library at `/` (same shell, same world).

## Audience and job

Campaign staff, agency and consultant teams who are not designers, at a laptop in a campaign office, turning a designer's template into a finished spot in one sitting. Task: change the words, colours, logo, footage and music, nudge placement, adjust a section's length when footage needs it, export. Proof: the video itself, playing, as they edit it. Constraints: one composition renders preview and export; the monitor stays trustworthy; no timeline (Josh, 2026-09-17); laptop widths only.

## Direction contract

THESIS: The video is the interface. Everything a staffer edits is edited on the monitor itself, and the panels only name what is selected. It refuses the category default of a timeline strip that makes a non-editor feel like an editor, and the earlier Console habit of monospace facts and hairline everything.

OWN-WORLD (replaced 2026-09-17, Josh: "less dark, more blue and fun", then "more like the blue from our prototype"): The prototype's navy studio: a deep navy ground and navy panels that read blue rather than black (#091422, #0e1d31, #15273f, #1d3350 with one navy hairline), the two bars, the 52 px top bar and the scene strip, a step deeper, and the deepest navy around the monitor so footage colour reads true. One accent, the prototype's sky blue (#4d9fe6), filled on the primary action and the selection with navy ink on it (never white), a touch of sheen on the primary pill, tinted on hover and drop targets; gold for "something to check", the prototype's brick red for danger, one green for a readout, all sparingly. Public Sans at the same tight scale with tabular numerals; controls are pills (buttons, chips, segmented, icon buttons), fields and tiles 10 px, panels and cards 16 px; Lucide at one stroke. Presses give a little spring; things that appear pop in with one. The near-black studio (M30) and the light world of earlier today are evidence only.

STORY: I open my spot, I see it playing, I click the headline on the video and type, I drag a clip from the left onto the footage, I press Export, and what comes out is what I saw.

FIRST VIEWPORT: A 52 px deep-navy top bar (the wordmark's sky-blue mark left, project name centre, one raised frame of length and version chips, Undo/Redo, save state, the readiness pill and a sky-blue Export pill with navy ink on the right, the bar's only filled control). Below it three columns: a 280 px library on the left, tabbed as the prototype has it (Templates · Footage · Stock · Brand; under Templates the composer's text box then every shelf folded with its count, opening to picture cards; under Footage the clips and the music bed; since 2026-09-17, M66, replacing the stacked column and the pop-over picker); the monitor in the centre at the largest 16:9 the width allows, opened on a frame where the first scene's design is on screen, with the transport (play, time, scrub, mute, full screen) drawn under it in the world's controls and nothing of the player's own chrome on it; under that a scene strip of chips proportional to length, the one on screen filled blue, the selected one ringed, each with a three-dot menu (duplicate, move, hide, remove); a 320 px properties panel on the right for the selected element (its name and a Show switch, then text, colour, logo, footage, length, how it ends). The primary action is editing on the video; Export is the primary button.

FORM: The category standard played straight, taken by the user (the standing exit): CapCut at its craft level, better designed and made political for Democratic campaigns; since 2026-09-17 in the prototype's navy and sky blue. Seed key 667390b7 (roll acknowledged; a user-pinned decision beats the roll). Code-led: no image generation on this machine.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Memorable moment

Double-click the headline on the video and type while the spot keeps its animation; drag a clip from the library onto the footage and watch the slot light up blue before it lands.

## Unresolved

Logos as a library tab needs a list endpoint the server does not have. (Scene-strip thumbnails: resolved in M37, each chip draws its scene as a lottie-web still at its hold frame with the scene's own values, over the clip in its slot.)
