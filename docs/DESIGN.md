---
name: CampaignCut
description: A dark studio for turning a designer's After Effects template into a campaign spot; the video is the interface.
colors:
  bg: "#0b0d12"
  stage: "#07080b"
  panel: "#12151c"
  raised: "#1a1e27"
  hover: "#20252f"
  line: "#262b36"
  line-strong: "#343b48"
  fg: "#f4f6fa"
  fg-2: "#a9b1c1"
  fg-3: "#7f8899"
  blue: "#2f6bff"
  blue-hover: "#4a7eff"
  blue-deep: "#1b48c2"
  blue-tint: "rgba(47, 107, 255, 0.16)"
  red: "#e5484d"
  red-tint: "rgba(229, 72, 77, 0.14)"
  green: "#3dd68c"
  white: "#ffffff"
typography:
  headline:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.025em"
  section:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "normal"
  body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
    fontFeature: "'tnum' 1, 'cv11' 1"
  label:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "normal"
  fact:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
    fontFeature: "'tnum' 1"
  wordmark:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-0.025em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
  button-primary-active:
    backgroundColor: "{colors.blue-deep}"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-secondary-hover:
    backgroundColor: "{colors.hover}"
  button-ghost:
    textColor: "{colors.fg-2}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-ghost-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.fg}"
  button-danger:
    textColor: "{colors.red}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-danger-hover:
    backgroundColor: "{colors.red-tint}"
  button-sm:
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "28px"
    padding: "0 10px"
  icon-button:
    textColor: "{colors.fg-2}"
    rounded: "{rounded.md}"
    size: "32px"
  icon-button-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.fg}"
  segmented:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.md}"
    padding: "2px"
  segmented-option:
    textColor: "{colors.fg-2}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 12px"
  segmented-option-active:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
  field:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  field-focus:
    backgroundColor: "{colors.panel}"
  card:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.lg}"
  card-hover:
    backgroundColor: "{colors.raised}"
  tile:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.lg}"
    padding: "8px"
  row:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.fg}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  row-selected:
    backgroundColor: "{colors.blue-tint}"
  scene-chip:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  scene-chip-onscreen:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
  top-bar:
    backgroundColor: "{colors.panel}"
    height: "52px"
    padding: "0 16px"
  side-panel:
    backgroundColor: "{colors.panel}"
    width: "280px"
  properties-panel:
    backgroundColor: "{colors.panel}"
    width: "320px"
  monitor-stage:
    backgroundColor: "{colors.stage}"
    padding: "24px"
  monitor:
    backgroundColor: "#000000"
    rounded: "{rounded.lg}"
  badge:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.xs}"
    padding: "1px 6px"
---

# Design System: CampaignCut

## Overview

**Creative North Star: "The Studio Monitor"**

CampaignCut is a dark studio built around one trustworthy screen. The video plays in the centre on a near-black stage; everything a campaign staffer edits is edited on the video itself, and the panels around it only name what is selected and offer the few controls the designer allowed. The world is the category standard (a CapCut-grade desktop editor) played straight and made political: one Democratic campaign blue does every job an accent can do, the type is Public Sans (the US government's own face), and nothing decorative competes with the footage.

Density is a working tool's: 13 px body, 12 px labels, 11 px facts with tabular numerals, 36 px controls, 20 px panel gutters. Surfaces are tonal steps of the same blue-grey rather than lines; a single hairline separates the three columns and the sections within them. Radii are soft and consistent (8 px on controls, 12 px on panels and tiles), sliders are filled tracks with a round white thumb, choices are segmented pills, on/off is a switch. Motion is one 160 ms ease-in used only for things that appear over the video.

This world replaces the earlier "Console" look (hairlines everywhere, zero radius, IBM Plex, cobalt, monospace facts). Those choices are evidence only; nothing here extends them.

**Key Characteristics:**
- Dark blue-grey studio ground so footage colour reads true; the monitor is the only pure black.
- One accent (campaign blue) filled on the primary action and the current selection, tinted on hover and drop targets; red for danger only; green for one pass/fail readout.
- Public Sans everywhere in the UI at a tight 11/12/13/15/16/18 px scale, semibold headings with tight tracking, tabular numerals on every number.
- Tonal layering (stage, bg, panel, raised, hover) plus one hairline; shadows appear only under things that float over the video.
- CapCut's control vocabulary played straight: filled sliders, segmented pills, switches, thumbnail grids, 16 px Lucide icons at 1.75 stroke.
- Nothing sits over the video at rest.

## Colors

One hue family runs the whole interface: the neutrals are blue-grey steps and the accent is campaign blue, so the footage is the only thing on screen with a colour of its own.

### Primary
- **Campaign Blue** (`{colors.blue}`): the one accent. Filled on the primary action (Export MP4, the play button, the active segmented option, the on-screen scene chip, the "In use" badge, the wordmark's play mark) and on the selection (the hairline around the layer under the pointer, the checked switch, the filled part of every slider). Lifts to **Blue Hover** (`{colors.blue-hover}`) on hover and drops to **Blue Deep** (`{colors.blue-deep}`) when pressed.
- **Blue Tint** (`{colors.blue-tint}`): the accent at 16% alpha for states that are about the accent but not the action: hovered drop zones, the selected music row, the active inspector field, the drop target on the video. Text selection uses the same blue at 35%; the trim range on the footage bar uses it at 35%.

### Secondary
- **Signal Red** (`{colors.red}`) and **Red Tint** (`{colors.red-tint}`): errors, failed exports, the delete-confirm button, an invalid hex field. Never decoration, never emphasis.
- **Pass Green** (`{colors.green}`): a single readout colour (ingest succeeded, playback met its target). Not a button, not a badge.

### Neutral
- **Stage** (`{colors.stage}`): the ground under the monitor and behind thumbnails; the darkest surface so the video's own black reads as black.
- **Ground** (`{colors.bg}`): the page background behind everything.
- **Panel** (`{colors.panel}`): the top bar, the two side columns, the scene strip, library cards, the floating text editor.
- **Raised** (`{colors.raised}`): anything you can pick up or press that is not the primary action: secondary buttons, fields, segmented groups, tiles, rows, scene chips at rest.
- **Hover** (`{colors.hover}`): the hover state of any raised or ghost surface.
- **Line** (`{colors.line}`) and **Line Strong** (`{colors.line-strong}`): the one hairline between columns and sections, around fields and tiles; the stronger step for hovered borders, dashed drop zones, the unfilled slider track, and the switch off state.
- **Foreground** (`{colors.fg}`), **Foreground 2** (`{colors.fg-2}`), **Foreground 3** (`{colors.fg-3}`): three text steps. fg for content and values, fg-2 for labels and secondary text, fg-3 for facts, placeholders and hints.
- **White** (`{colors.white}`): text on blue and the slider thumb, switch knob and trim handles.

Older components still reference `ink`, `hairline`, `muted`, `cobalt` and `danger`; in the stylesheet these are aliases that resolve to `bg`, `line`, `fg-2`, `blue` and `red`. They are not a second palette and new work must use the new names.

### Named Rules
**The One Blue Rule.** Campaign blue is the only accent. Filled means "the action or the thing selected"; tinted means "about to become selected" (hover, drop target, active row). If two blue fills are visible in one panel, one of them is wrong.

**The Red Is Danger Rule.** Red appears only when something failed or is about to be destroyed. It is never a highlight, a brand note or a required-field marker.

**The Footage Owns Colour Rule.** The interface has one hue. Anything colourful on screen is the user's video, logo or accent swatch, never the chrome.

## Typography

**Display Font:** none; the interface has no display size.
**Body Font:** Public Sans (with ui-sans-serif, system-ui, Segoe UI), self-hosted as one variable file plus a 400 italic.
**Label/Mono Font:** none. Numbers use Public Sans with tabular figures (`tnum`) instead of a monospace face.

**Character:** a plain, civic, slightly condensed grotesque that reads as government-grade rather than startup-grade. Headings are semibold with tight tracking; everything else is regular or medium at small sizes. The `cv11` alternate is on globally.

### Hierarchy
- **Headline** (600, 18px, 1.45, tracking -0.025em): the selected element's name at the top of the properties panel; the error page title.
- **Title** (600, 16px, 1.45, tracking -0.025em): library group headings ("Projects", an ad type, "Add a template").
- **Section** (600, 13px, 1.45): panel section titles ("Footage", "Music", "Timing", "How it ends"); the project name in the top bar.
- **Body** (400, 13px, 1.45): field text, buttons, scene chip names; the floating text editor uses it at 15px/500.
- **Label** (500, 12px, 1.45): field names above controls, slider names, top-bar links, small buttons, the transport clock, panel copy.
- **Fact** (400, 11px, 1.45, tabular): durations, resolutions, timestamps, hints, counters, the "Reset to authored" link. The 10px thumbnail badges are the one size below it.
- **Wordmark** (700, 15px, tracking -0.025em): "CampaignCut" beside the blue play mark.

### Named Rules
**The Tabular Numbers Rule.** Every number a user compares (times, sizes, fps, percentages, hex codes) sits in tabular figures so it does not jitter as it changes. There is no monospace font in this world.

**The Sentence Case Rule.** Every heading, label and button is sentence case. The only uppercase text is a hex colour code in its field.

## Layout

The editor is a fixed three-column shell under a 52 px top bar at laptop widths and up (1280 px is the floor; nothing reflows below it). The left column is a 280 px media library (Footage, then Music, stacked rather than tabbed), the right a 320 px properties panel, and the centre takes the rest: the monitor at the largest 16:9 the width allows (max 1400 px wide) centred in 24 px of stage, the transport row under it with 12 px above, a one-line hint under that, and a scene strip pinned to the bottom of the column. The library page uses the same top bar over a centred 72rem container with 32 px gutters and a three-column card grid at 16 px gaps.

Panels are divided into sections with 20 px horizontal and 16 px vertical padding (16 px horizontal in the narrower media panel), each ending in one hairline. Inside a section the rhythm is 12 px between a title and its content, 8 px between siblings, 6 px between a label and its control, 4 px between a value and its fact. Controls are 36 px tall (28 px small), icon buttons 32 px, rows 36 px, thumbnails and swatches on an 8 px grid. Width, not stacking, changes with viewport: the wordmark hides below 1280 px and the columns hold their pixel widths.

## Elevation & Depth

Depth is tonal. Five surface steps (stage, ground, panel, raised, hover) read as layers by lightness, and one hairline does the separating. Shadows exist for exactly two jobs: a small card shadow on the filled blue action, the active segmented option and the trim handles, so a pressed thing sits a hair above its track; and a float shadow on the monitor and on the in-place text editor, the two things that sit over the stage rather than in it. The text editor also blurs the video behind it at 95% panel opacity.

### Shadow Vocabulary
- **card** (`box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3)`): the primary button, the active segmented pill, trim handles, and anything else filled blue that should sit on its surface.
- **float** (`box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.35)`): the monitor and overlays that float above the video. Nothing in a panel floats.
- **thumb** (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5)` on slider thumbs; `0 1px 2px rgba(0, 0, 0, 0.4)` on the switch knob): the round white knobs only.

### Named Rules
**The Flat Panel Rule.** Panels, fields, tiles and rows never carry a shadow. If something needs to look nearer, it moves one tonal step up (panel to raised to hover); it does not lift.

**The Nothing At Rest Rule.** Nothing is drawn over the video at rest. The only overlays are the hairline blue outline around the layer under the pointer, the in-place text editor while typing, and the dashed blue drop target while a clip is dragged over the footage. Each appears with the one `cc-appear` motion (160 ms, ease `cubic-bezier(0.2, 0.8, 0.2, 1)`, from 98.5% scale) and is removed outright, and none animates under `prefers-reduced-motion`.

## Shapes

Softly rounded, never pill-shaped, except where the thing is literally round. Controls (buttons, fields, segmented groups, icon buttons, rows, swatches, the trim bar) are 8 px; the option inside a segmented group is 6 px so it nests inside the 8 px frame with 2 px of padding; panels, tiles, cards, scene chips, the monitor and the text editor are 12 px; the outermost library cards and the ingest drop zone are 16 px; badges and the layer outline are 4 px. Slider tracks, thumbs, switches and scrollbar thumbs are full pills (999 px). Borders are 1 px hairlines in `line`, stepping to `line-strong` on hover and used dashed (in `line-strong`, or blue when active) for anywhere a file can be dropped. Focus is a 2 px blue outline at 2 px offset, or a 2 px blue ring on tiles and cards. Nothing is square-cornered.

## Components

Controls are CapCut's vocabulary played straight: tactile, filled, quiet until touched. Every control comes from `app/src/components/ui.tsx` so the same action looks the same everywhere.

### Buttons
- **Shape:** softly rounded (8 px), 36 px tall with 14 px side padding at 13 px/500; small is 28 px tall, 10 px padding, 12 px text. Icon-first with an 8 px gap (6 px small); Lucide at 16 px (14 px small), 1.75 stroke.
- **Primary:** campaign blue fill, white text, card shadow. One per surface: Export MP4 in the top bar, Add template in the library, Ingest, Reload. Hover lifts to blue-hover, press drops to blue-deep.
- **Secondary:** raised fill, foreground text, hairline border; hover steps to hover fill and line-strong border. The default variant (Upload, Download).
- **Ghost:** no fill, fg-2 text; hover to fg text on hover fill. Cancel, Keep, Back to library.
- **Danger:** red text, no fill; hover on red tint. Only for confirming a delete.
- **Readiness pill:** a 28 px raised pill beside Export, shield icon, "Ready to export" in `fg-3` with a green shield, "N to check" in `fg-2`, red only while the disclaimer blocks; it opens a 320 px panel-toned list under it (a region, not a modal: Escape or a press anywhere else closes it), one row per check with a green check, a grey circle or a red shield.
- **Icon button:** 32 px square (28 px inside grouped pairs like Undo/Redo, 36 px for Play), ghost treatment. Play is the one icon button filled blue.
- **States:** 150 ms colour transition; disabled at 40% opacity (35% for icon buttons) with pointer events off; focus uses the global 2 px blue outline.

### Segmented control
- **Style:** a 2 px-padded raised frame with a hairline border and 8 px radius; options are 32 px tall (28 px small) at 13 px/500, 6 px radius, fg-2 text.
- **State:** the active option is filled blue with white text and the card shadow; the others hover to hover fill and fg text. Used for footage fit (Fill / Fit), how a scene ends (Cut / Fade / Wipe / Slide), and full-width when it owns a row.

### Sliders and switches
- **Slider:** a 4 px pill track, blue up to the value and line-strong after, with a 14 px white thumb ringed 2 px in blue and shadowed; the thumb scales to 115% on hover and focus. Laid out as name (12 px fg-2, 56 px) · track · value (12 px fg, tabular, right-aligned, 56 px). Disabled at 40%.
- **Switch:** 34 × 20 px pill, line-strong when off and blue when on, with a 16 px white knob that slides 14 px in 150 ms on the same ease as `cc-appear`.

### Inputs / Fields
- **Style:** raised fill, hairline border, 8 px radius, 8 px × 10 px padding, 13 px text; placeholder in fg-3. Labelled above by a 12 px/500 fg-2 name with an optional 11 px tabular fact on the right (character count, range).
- **Hover / Focus:** border to line-strong on hover; on focus the border turns blue and the fill drops to panel, outline off.
- **Error:** `aria-invalid` turns the border red. Hex fields are uppercase and tabular; the colour swatch beside them is a 36 px, 8 px-radius chip with a hairline border and 3 px inset.

### Cards / Containers
- **Panel sections:** 20 × 16 px padding, 13 px/600 title on the left with an optional action on the right, one hairline below, none after the last.
- **Tiles** (footage card, logo picker, music settings): raised fill, hairline border, 12 px radius, 8 px padding, an 80 px 16:9 thumbnail on stage on the left; hover steps the border to line-strong.
- **Rows** (tracks, exports): 36 px, raised fill, 8 px radius, 12 px side padding, 12 px text with an 11 px tabular fact right; a selected row uses blue tint and a blue check.
- **Library cards:** panel fill, hairline border, 16 px radius, a 16:9 thumbnail on stage that scales to 102% over 300 ms on hover, 14 px name and 12 px facts in a 14 px pad; hover raises the fill and strengthens the border. Project rows sit in the same card as a hairline-divided list at 48 px per row.
- **Drop zones:** dashed line-strong border, 12 px (16 px for the ingest well), centred 12 px copy; hover turns the dash blue over a 40% blue tint.

### Navigation
- **Top bar:** 52 px, panel fill, one hairline below. Wordmark (or "Library" back link plus wordmark in the editor) left in a 280 px slot aligned to the library column, project name centred at 13 px/600 with the template name in fg-3 beside it and a pencil icon button to rename, then Undo/Redo as a raised, hairline-bordered pair of 28 px icon buttons, the save state in 12 px, and the filled blue Export button right.
- **Scene strip:** a panel-toned bar with one hairline above, 24 × 12 px padding, chips laid out proportionally to length (basis 0, minimum 176 px, 8 px gap) at 8 px padding, each with a 64 px still of the scene (an `ElementPreview`: lottie-web drawing the scene at its hold frame with its own values, over the clip in its footage slot) beside a 13 px/500 name and an 11 px tabular fact, both truncated, never wrapped. The library picker draws the same stills at 96 px with the composer's copy in every text element. Every chip drags; only scene chips take a drop. A scene over another scene chip shows a 3 px blue inset edge on the left or right half (before or after); an overlay over a scene chip rings it blue (it lands on that scene). The strip scrolls sideways once chips would fall under their 176 px minimum. Enabled chips show a grab cursor and a title ("Drag to reorder" / "Drag onto a scene"); a hidden chip shows neither and says why. The "on" target is tinted blue as well as ringed, so it reads apart from the selection. The Add chip is sticky at the strip's right edge over a panel-toned fade, so it stays in view when the strip scrolls. The hint line under the monitor names the drag. The panel's Scene section carries Move earlier / Move later (ghost, small, arrow-to-line icons) as the keyboard's route to the same reorder, disabled at the ends. The chip on screen is filled blue with white text; others are raised and hover to hover fill; the selected chip carries a blue ring.

### Program monitor (signature)
Black, 12 px radius, float shadow, on a 24 px stage; the largest 16:9 the width allows. It shows nothing of the player's own chrome; the transport under it is the world's controls (a blue 36 px play button, a 12 px tabular clock with the total in fg-3, the filled slider as scrubber, ghost mute and full-screen icon buttons) and a one-line 12 px fg-2 hint with 11 px fg-3 facts on the right. Over the video only three things ever draw: a 1 px inset blue ring with 4 px corners around the layer under the pointer, a floating text editor (panel at 95% with backdrop blur, blue hairline, float shadow, 8 px padding, 15 px/500 text with an 11 px fg-3 counter row), and while a clip is dragged, a 2 px dashed blue box on blue tint with a small blue "Drop to use here" badge in its corner. The cursor becomes `move` over a layer.

## Do's and Don'ts

### Do:
- **Do** use one blue fill per surface for the action or the selection, and blue tint (16%) for hover, drop targets and active rows.
- **Do** step surfaces tonally (stage, bg, panel, raised, hover) and separate with one 1 px `line` hairline; go to `line-strong` only on hover, on dashed drop zones and on unfilled tracks.
- **Do** keep the radius pairing: 8 px on controls, 6 px on an option nested inside a control, 12 px on panels, tiles and chips, 16 px on outer cards, pills only on sliders, switches and scrollbars.
- **Do** set every number in tabular figures at 11 or 12 px, in fg for the value and fg-3 for the fact.
- **Do** build every control from `ui.tsx` (Button, IconButton, Segmented, Slider, Switch, Section, FieldLabel) and Lucide at 16 px / 1.75 stroke (14 px inside small controls).
- **Do** draw overlays on the video only in response to the pointer, with `cc-appear`, and remove them outright when the pointer leaves.
- **Do** write labels and buttons in sentence case at 12 or 13 px; reserve 18 px semibold for the one selected-element name.

### Don't:
- **Don't** put anything over the video at rest: no watermark, no safe-zone guides, no persistent handles, no player chrome.
- **Don't** use red for anything but failure and destructive confirmation, and don't use green as a button, badge or accent.
- **Don't** add a second accent, a gradient, or a brand colour to the chrome; the footage and the user's own accent swatch are the only colour on screen.
- **Don't** put shadows on panels, fields, tiles or rows; only the monitor, the text editor, filled blue controls and round knobs carry one.
- **Don't** use a monospace face, uppercase labels, letter-spaced kickers or eyebrow lines; the old Console look (IBM Plex, zero radius, hairlines everywhere, cobalt) is replaced, not extended.
- **Don't** reach for the alias tokens (`ink`, `hairline`, `muted`, `cobalt`, `danger`) in new work; they exist only so untouched components keep compiling.
- **Don't** introduce dropdowns or typed number fields for what a slider, segmented control, switch or drag on the video can do.
- **Don't** reflow below 1280 px or collapse the columns; this is a laptop-width tool.
