# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: people on the campaign side who are not designers, turning a motion designer's template into a finished spot. Josh confirmed the audience is broader than one campaign staffer: agencies and consultants who run several client campaigns use it too (agencies hold several client profiles; see docs/ROADMAP.md). The exact roster of roles is undecided. They work at a laptop, in one sitting, in well under an hour per spot. Secondary: the motion designer (Germain McCarthy) who builds the templates in After Effects and judges whether the app's render honours the design; they never touch code.

## Product Purpose

CampaignCut is a browser video editor for political and advocacy ads. A designer builds a template in After Effects; it is ingested automatically; a non-designer opens it, types their own copy, drops in their own footage and logo, adjusts what the template allows, and exports a broadcast-spec MP4 that matches what they saw. The design quality is the product. Success for the user is an export they trust matches the preview; success for the build is the five acceptance tests in CLAUDE.md (ingest, fidelity, editing, playback, export parity).

## Positioning

The template is the designer's real After Effects work, ingested without bespoke code per design, and the user gets a narrow, safe set of controls that cannot break the animation. One composition renders both the preview and the export, so what they approve is what they get. Neighbouring tools either hand the user a blank canvas (and the design suffers) or lock the design entirely (and the user cannot make it theirs).

## Operating Context

- Templates arrive as Bodymovin (Lottie) exports plus fonts and a reference render; ingest generates the schema of what is editable (text roles, colours, logo, footage slot, disclaimer, placement).
- Editing happens on the video itself: press and drag layers on the monitor, type into the text where it sits, drop footage onto the slot. Element timing is the designer's, with small length adjustments allowed when footage needs a section shorter or longer. There is no timeline (Josh, 2026-09-17).
- Footage is uploaded locally; proxies play in the preview, originals render in the export. One music bed per project. Chroma key for green-screen clips.
- Exports run on the same machine, one at a time, and appear in an export history.
- 16:9 only in this phase. Laptop width and up; no mobile.

## Capabilities and Constraints

- Confirmed: multi-element templates; per-element footage; text, colour, logo, disclaimer (text only, position locked), placement (drag, size, tilt), footage fit, trim, mute, chroma key; transitions between elements (cut, fade, wipe, slide); undo/redo; projects list with rename, duplicate, delete; ingest from a folder in the browser.
- Locked stack: React 18, Vite, Tailwind, Remotion, Fastify, SQLite, FFmpeg. TypeScript everywhere.
- Hard rules: one composition, two runners; no preview-only branch; positions are fractions of the frame; fail loudly naming the layer; no secrets in source; no `eval`.
- Non-goals for the proof of concept (CLAUDE.md): accounts, teams, billing, brand kits, stock integrations, cloud storage, mobile, multi-aspect reflow, collaboration. Josh's later list (docs/ROADMAP.md) waits until he amends that list.
- Terminology: template, element, project, footage, slot, music bed, export, reference render, placement.

## Brand Commitments

- Name: CampaignCut.
- Visual direction (Josh, 2026-09-17): the category standard, played straight. Sit alongside CapCut, at its craft level, "but better designed and made to look political for Democratic campaigns". This replaces the earlier "Console" look (dark, hairlines, zero radius, cobalt) which is now evidence only.
- The program monitor stays trustworthy: nothing sits over the video except the direct-manipulation affordances (a hairline around the layer under the pointer, an in-place text editor while typing).

## Evidence on Hand

- Real templates: `templates/standin`, `templates/multi`, and the locally built `templates/contrast-30` (sample After Effects project; Arial, gitignored). Reference renders and fidelity strips under `media/fidelity/`.
- Real footage and music are whatever the user uploads; the repo holds only fixtures. No customer names, testimonials, or metrics exist and none may be invented.
- Logos: stand-in fixture logo only.

## Product Principles

- The designer's work survives the trip: nothing the user can do breaks the animation.
- The video is the interface: edit on the monitor first, panels second.
- Fewer dropdowns, fewer typed numbers; dragging, sliders, thumbnails, segmented choices.
- What you approve is what you export.
- Fail loudly, early, naming the layer.
