# Try this

What was built on 2026-09-17 after the prototype review, and how to see each piece in the app. Open http://localhost:5173 with the dev server running (`npm run dev` from the Claude Code prompt, or ask for it to be started).

## 1. The composer (M37)

Open any spot. Under the video, press the **+ Add** chip at the end of the scene strip. The left column becomes **Add to the spot**. Type a line in the field at the top ("Preview every text element with your copy"): every element in the library redraws with your words, in the designer's font. Pick one with **+**: it lands with your words already in it.

The scene chips under the video are pictures of each scene as it stands now, not stock thumbnails. Change the headline and the chip changes.

## 2. The starter pack (M38)

The picker lists sixteen elements from **Starter pack**: a headline, two lower thirds, two captions, a callout and a pull quote, two stats, a top bar, two backgrounds, two end cards, two disclaimers. They were built by a script inside After Effects, exported and ingested with nobody at the keyboard, and judged against their After Effects reference by the fidelity harness (12 of 12 within threshold). They do not appear as spots to start from; they feed the picker.

## 3. Treatments (M39)

In the left column, under **Colours across the spot**, the **Treatment** row: **Clean · Grit · Glow · Opaque**. Press one and the video takes it at once, across every scene. Glow glows in the spot's accent colour. Export carries the treatment (checked frame by frame against the preview).

Bubbly from the prototype is not there: it is a font swap, and text must stay in the designer's font, so it becomes a designed variant from After Effects later (M40 in `docs/MILESTONES.md`).

## 4. A spot from nothing (M41, M42)

On the library page, below the templates, **Start from nothing**. The spot opens empty with **Add the first scene** on the video. Add a background, then a headline: each lands after the last. Add a lower third: it lands on the scene under the playhead. Add a disclaimer: the Export button comes alive once a disclaimer is on for four seconds.

Spot **New spot** in the projects list is one built this way, from the starter pack.

## For you to do

- Close After Effects (File > Exit); an unattended run left it open on an empty project.
- Watch `media/renders/parity-project-8.mp4` once: the export of the spot from nothing, with a lower third and a disclaimer.
- Germain's verdict on `media/fidelity/contrast-30-*` and `media/fidelity/starter-pack-*` strips (reference left, our render middle, difference right).
