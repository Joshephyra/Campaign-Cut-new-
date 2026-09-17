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

OWN-WORLD: Dark studio ground (near-black blue-grey, not pure black) so footage colour reads true, with two panel tones and one hairline. One accent: Democratic campaign blue, filled on the primary action and the selection, tinted on hover and drop targets; red for danger only. Public Sans (the US government's own face) at a tight rem scale with tabular numerals; 8 px radius on controls, 12 px on panels; Lucide icons at one stroke. Controls are the CapCut vocabulary played straight: segmented pills, filled sliders with a round thumb, switches, thumbnail grids.

STORY: I open my spot, I see it playing, I click the headline on the video and type, I drag a clip from the left onto the footage, I press Export, and what comes out is what I saw.

FIRST VIEWPORT: A 52 px top bar (wordmark left, project name centre, Undo/Redo, save state and a filled blue Export right). Below it three columns: a 280 px media library on the left (Footage, then Music, stacked rather than tabbed so the one music bed is always in view beside the clips; upload; a grid of draggable thumbnails); the monitor in the centre at the largest 16:9 the width allows, opened on a frame where the first scene's design is on screen, with the transport (play, time, scrub, mute, full screen) drawn under it in the world's controls and nothing of the player's own chrome on it; under that a scene strip of chips proportional to length, the one on screen filled blue, the selected one ringed; a 320 px properties panel on the right for the selected element (its name and a Show switch, then text, colour, logo, footage, length, how it ends). The primary action is editing on the video; Export is the primary button.

FORM: The category standard played straight, taken by the user (the standing exit): CapCut at its craft level, better designed and made political for Democratic campaigns. Seed key 667390b7 (roll acknowledged; a user-pinned decision beats the roll).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Memorable moment

Double-click the headline on the video and type while the spot keeps its animation; drag a clip from the library onto the footage and watch the slot light up blue before it lands.

## Unresolved

Element thumbnails on the scene strip (no cheap frame grab yet; chips carry name and length, sized by length). Logos as a library tab needs a list endpoint the server does not have.
