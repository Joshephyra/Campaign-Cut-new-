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

## 5. Move a scene (M43)

Drag a scene chip under the video onto another scene chip: left half puts it before, right half after (a blue edge shows which). The scenes re-lay with their lengths; lower thirds and other overlays stay where they were. Drag an overlay chip onto a scene chip to put that overlay on that scene. Without a mouse, the panel's **Move earlier** and **Move later** do the same for a scene.

## 6. The same element twice (M45)

Add **Boxed caption** again: the picker says "in the spot ×2" and the second caption is its own scene, with its own words and timing. Or select any scene and press **Duplicate scene** in the panel: a copy with the same words lands right after it.

## 7. Everything on a client's spot (M47, M48)

Pick **Rivera for Senate** under "New spots for" before **Start from nothing**: every scene you add arrives in that client's colours with its disclaimer. Next to Export MP4 one pill says "Ready to export" or "2 to check"; press it for the list: the disclaimer (which blocks), footage slots with no clip, the designer's stand-in logo, and lines still in the designer's words.

## 8. Every version at once (M50)

The small caret beside **Export MP4** offers "All four versions": 16:9, 1:1, 4:5 and 9:16 render one after another and land in Exports, each named for its version.

## For you to do

- Close After Effects (File > Exit); an unattended run left it open on an empty project.
- Watch `media/renders/parity-project-8.mp4` once: the export of the spot from nothing, with a lower third and a disclaimer.
- Germain's verdict on `media/fidelity/contrast-30-*` and `media/fidelity/starter-pack-*` strips (reference left, our render middle, difference right).
