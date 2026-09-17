---
name: CampaignCut
description: A navy studio for turning a designer's After Effects template into a spot; the video is the interface, the panels read blue rather than black, and one sky-blue accent carries navy ink.
colors:
  bg: "#091422"
  stage: "#06192c"
  panel: "#0e1d31"
  raised: "#15273f"
  hover: "#1d3350"
  line: "#26405f"
  line-strong: "#3f6fa6"
  fg: "#eaf2fb"
  fg-2: "#9db4d0"
  fg-3: "#7f96b4"
  blue: "#4d9fe6"
  blue-hover: "#6fb4f0"
  blue-deep: "#3b8bd2"
  blue-tint: "rgba(77, 159, 230, 0.16)"
  on-blue: "#06192c"
  bar: "#071324"
  red: "#e0563f"
  red-ink: "#ec7360"
  red-tint: "rgba(224, 86, 63, 0.16)"
  green: "#5fc08a"
  green-tint: "rgba(95, 192, 138, 0.16)"
  yellow: "#ffd76a"
  yellow-tint: "rgba(255, 215, 106, 0.18)"
  yellow-ink: "#ffd76a"
  white: "#ffffff"
  black: "#000000"
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
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "16px"
  xl: "22px"
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
    textColor: "{colors.on-blue}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
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
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 14px"
  button-secondary-hover:
    backgroundColor: "{colors.hover}"
  button-ghost:
    textColor: "{colors.fg-2}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 14px"
  button-ghost-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.fg}"
  button-danger:
    textColor: "{colors.red-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 14px"
  button-danger-hover:
    backgroundColor: "{colors.red-tint}"
  button-sm:
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "28px"
    padding: "0 10px"
  chip:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.fg-2}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "28px"
    padding: "0 12px"
  chip-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.fg}"
  chip-pressed:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.on-blue}"
  icon-button:
    textColor: "{colors.fg-2}"
    rounded: "{rounded.pill}"
    size: "32px"
  icon-button-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.fg}"
  icon-button-play:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.on-blue}"
    rounded: "{rounded.pill}"
    size: "36px"
  segmented:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.pill}"
    padding: "2px"
  segmented-option:
    textColor: "{colors.fg-2}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 12px"
  segmented-option-active:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.on-blue}"
  readiness-pill-check:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.on-blue}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "28px"
    padding: "0 12px"
  readiness-pill-blocked:
    backgroundColor: "{colors.red}"
    textColor: "{colors.on-blue}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "28px"
    padding: "0 12px"
  readiness-pill-ready:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.fg}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "28px"
    padding: "0 12px"
  length-chip:
    textColor: "{colors.fg-2}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "28px"
    padding: "0 10px"
  length-chip-chosen:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.fg}"
  field:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
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
    padding: "8px"
  scene-chip-onscreen:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.on-blue}"
  overlay-chip:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.fg}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "28px"
    padding: "0 12px"
  transition-marker-cut:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg-3}"
    typography: "{typography.fact}"
    rounded: "{rounded.pill}"
    height: "24px"
    padding: "0 6px"
  transition-marker-preset:
    backgroundColor: "{colors.blue-tint}"
    textColor: "{colors.blue}"
    typography: "{typography.fact}"
    rounded: "{rounded.pill}"
    height: "24px"
    padding: "0 6px"
  top-bar:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.fg}"
    height: "52px"
    padding: "0 16px"
  scene-strip:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.fg}"
    padding: "12px 24px"
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
    backgroundColor: "{colors.black}"
    rounded: "{rounded.lg}"
  badge-in-use:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.on-blue}"
    typography: "{typography.fact}"
    rounded: "{rounded.xs}"
    padding: "1px 6px"
  badge-timecode:
    textColor: "{colors.white}"
    typography: "{typography.fact}"
    rounded: "{rounded.xs}"
    padding: "1px 4px"
  trim-bar:
    backgroundColor: "{colors.blue-tint}"
    rounded: "{rounded.pill}"
    height: "28px"
  trim-bar-kept:
    backgroundColor: "{colors.blue}"
  trim-grip:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.pill}"
    width: "12px"
  menu:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.lg}"
    padding: "4px"
  menu-item:
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  menu-item-hover:
    backgroundColor: "{colors.hover}"
---

# Design System: CampaignCut

## Overview

**Creative North Star: "The Navy Studio"**

CampaignCut is a studio lit in blue. The ground is a deep navy, the panels a navy one step lighter, and every surface reads as blue rather than black: the eye always knows it is in a campaign's colour, not in a dark-mode default. Two bars frame the work, the 52 px top bar and the scene strip along the bottom, and each sits one step deeper than the panels with a hairline closing it, so the shell has a floor and a ceiling. In the middle the wall around the monitor is the deepest navy of all and the monitor itself is the only pure black, so the footage's own colour reads true against it. Everything a campaign staffer edits is edited on the video; the panels around it only name what is selected and offer the few controls the designer allowed.

The controls are CapCut's vocabulary made rounder and bouncier, in the prototype's colours: every pressable thing is a pill (buttons, chips, icon buttons, segmented groups, the trim bar and its grips), fields and rows are 10 px, panels, tiles, cards and the monitor 16 px, and a press gives a little under the pointer on one spring with a hint of overshoot. One accent, the prototype's sky blue, is filled on the primary action and the selection, and it always carries navy ink, never white; the primary pill wears a faint sheen at its top, the one gradient in the world. Gold means "something to check", the prototype's brick red means danger, one green is a readout, and all three are flat and sparing. Density is a working tool's: 13 px body, 12 px labels, 11 px facts with tabular numerals, 36 px controls, 20 px panel gutters, Public Sans throughout. The whole vocabulary is written once against a set of tokens, and two scopes re-read only the ground tokens so the same Button, Chip and Segmented serve the panels, the bars and the stage without a colour class of their own.

This world landed on 2026-09-17 at the product owner's call ("less dark, more blue and fun", then "more polished and professional, more like the blue from our prototype"), taken from the campaigncut_3 prototype. Two earlier worlds are evidence only: the near-black "Studio Monitor" (M30), and the light "Daylight Cutting Room" of earlier the same day, which was rejected before it shipped. Nothing here extends either.

**Key Characteristics:**
- Navy that reads blue: a deep navy ground, navy panels one step lighter, the two bars one step deeper, and the deepest navy around the monitor so footage colour reads true.
- One accent, sky blue, filled on the primary action and the selection and always carrying navy ink; tinted at 16% for hover, drop targets and active rows; a faint sheen on the primary pill only.
- Poster colours used flat and sparingly: gold with navy ink for "something to check", brick red for danger and failure (a lighter red for text on navy), one green for a passed readout.
- Pills for everything pressable; 10 px on fields, rows and menu items, 16 px on panels, tiles, cards, scene chips and the monitor, 22 px reserved for the outermost library containers.
- Public Sans at a tight 11/12/13/15/16/18 px scale, semibold headings with tight tracking, tabular numerals on every number, sentence case everywhere.
- One spring (`cubic-bezier(0.22, 1.15, 0.36, 1)`): presses give to 96%, things that appear pop in from 94%, knobs and thumbs slide on it.
- Nothing sits over the video at rest.

## Colors

A campaign palette in a night studio: eight navy steps from the wall to the strongest line, three text steps, one sky-blue accent that always carries navy ink, and three poster colours that appear only when they mean something.

### Primary
- **Sky Blue** (`{colors.blue}`, #4d9fe6): the one accent. Filled on the primary action (Export MP4 and its options chevron, Add template, the play button, the active segmented option, a pressed chip, the on-screen scene chip, the active transition preset, the "In use" badge, the kept range of the trim bar, the checked switch, the filled part of every slider, the wordmark's mark) and on the selection (the 1 px ring around the layer under the pointer, the border of the footage tile in use, the 2 px focus ring). As text it marks a live state: the save indicator while saving, "Creating project…", "Add" on a stock clip, the plus on a library item, the name of a transition preset that is not a cut. Lifts to **Blue Hover** (`{colors.blue-hover}`, #6fb4f0) on hover and drops to **Blue Deep** (`{colors.blue-deep}`, #3b8bd2) when pressed.
- **Navy Ink** (`{colors.on-blue}`, #06192c): the text and icon colour on every sky-blue fill, and on the gold and brick fills of the readiness pill. White on sky blue would not read, and the prototype never did it. The wordmark's play triangle is Navy Ink on a Sky Blue square.
- **Blue Tint** (`{colors.blue-tint}`, sky blue at 16%): states that are about the accent but not the action: the active inspector field's row, the trim bar's track, the drop target on the video, the transition marker that is not a cut, the hovered Add chip (at 40% of the tint). The 3 px focus ring on fields uses it; text selection uses the same blue at 35%.

### Secondary
- **Brick Red** (`{colors.red}`, #e0563f) is the fill: the readiness pill only while the disclaimer blocks an export (with Navy Ink), and the border of a field that is invalid. **Red Ink** (`{colors.red-ink}`, #ec7360) is the same message as text, a step lighter so it reads on navy: error lines, a failed export, the blocking line in the readiness list, the delete action on hover, the danger button ("Remove from spot"). **Red Tint** (`{colors.red-tint}`, 16%) is the hover ground of the danger button and the ground of the library's load-error line. Never decoration, never emphasis.
- **Gold** (`{colors.yellow}`, #ffd76a): "something to check". Filled on the readiness pill while the list beside Export has open items, with Navy Ink text. **Gold Ink** (`{colors.yellow-ink}`, the same #ffd76a used as text) is the same message on the length gauge under the monitor when the content does not fill the spot. **Gold Tint** (`{colors.yellow-tint}`, 18%) is declared for a soft gold ground; no component uses it yet.
- **Readout Green** (`{colors.green}`, #5fc08a): a readout only: the shield on "Ready to export", the checks in the readiness list, "Added" on a stock clip, playback that met its target. Not a button, not a badge, not a fill. **Green Tint** (`{colors.green-tint}`, 16%) is declared and unused.

### Neutral
- **Bar Navy** (`{colors.bar}`, #071324): the deepest step the chrome uses, painted on the top bar and the scene strip through the `.on-bar` scope, and on any panel-toned thing inside the stage. Never a fill inside a panel.
- **Wall Navy** (`{colors.stage}`, #06192c): the ground under the monitor (the `.on-stage` scope) and behind every thumbnail and scene still, so a video's own black reads as black. The same value as Navy Ink, which is why the world's ink on blue looks like the wall.
- **Ground Navy** (`{colors.bg}`, #091422): the page behind everything on the library page and behind the editor's columns.
- **Panel Navy** (`{colors.panel}`, #0e1d31): the two side columns, library cards, the project list, menus and the readiness list, the floating text editor (at 95% with a backdrop blur), the cut marker and the Add chip on the strip.
- **Raised** (`{colors.raised}`, #15273f): anything you can pick up or press that is not the primary action: secondary buttons, chips at rest, fields, segmented frames, tiles, rows, scene chips at rest, the frame around the length and version chips and around Undo/Redo, the readiness pill when everything is in.
- **Hover** (`{colors.hover}`, #1d3350): the hover state of any raised or ghost surface, menu items under the pointer, and the chosen length and version chip (so Export stays the top bar's only accent fill).
- **Line** (`{colors.line}`, #26405f) and **Line Strong** (`{colors.line-strong}`, #3f6fa6): the one hairline between columns and sections, under the top bar and over the strip, around fields, chips and tiles; the stronger step for hovered borders, dashed drop zones, the unfilled slider track, the switch off state and the scrollbar thumb.
- **Fg** (`{colors.fg}`, #eaf2fb), **Fg 2** (`{colors.fg-2}`, #9db4d0), **Fg 3** (`{colors.fg-3}`, #7f96b4): three text steps, all blue-white. Fg for content, values, section titles and the wordmark; Fg 2 for labels, chips at rest, level-3 titles and secondary text; Fg 3 for facts, placeholders, hints, the cut marker and the chevron on a foldable title.
- **White** (`{colors.white}`): the round knobs only (slider thumb, switch knob, trim grips) and the timecode text on a thumbnail's black glass. **Black** (`{colors.black}`): the monitor, and the 70% glass behind a timecode badge. Both sit on the wall or on footage, never on a panel.

Older components still reference `ink`, `hairline`, `muted`, `cobalt` and `danger`; in the stylesheet these are aliases that resolve to `on-blue`, `line`, `fg-2`, `blue` and `red`. They are not a second palette, they are not re-read by the scopes, and new work must use the new names.

### Scopes
The tokens above are written once. Two class scopes re-read only the ground tokens, so one component vocabulary serves three grounds; nothing inside a scope carries a colour class of its own, and the accent, the text steps and the poster colours are the same everywhere.

- **`.on-bar`** (the top bar and the scene strip): `bg` and `panel` become Bar Navy. Everything else holds: raised chips and frames sit on the bar as they sit on a panel, the Export pill is still Sky Blue with Navy Ink, the wordmark's mark is still Sky Blue. The hairline that closes each bar is the ordinary `line`.
- **`.on-stage`** (the column around the monitor: transport, hint line, facts): `bg` becomes Wall Navy and `panel` becomes Bar Navy, so anything panel-toned that floats over the stage is deeper than the wall. The play button, the scrubber and the length gauge keep their tokens.

### Named Rules
**The Navy Ink Rule.** Text and icons on a Sky Blue, Gold or Brick fill are Navy Ink (`on-blue`), never white and never `fg`. A white label on sky blue is the one contrast mistake the prototype never made.

**The One Blue Rule.** Sky Blue is the only accent. Filled means "the action or the thing selected"; tinted means "about to become selected" (hover, drop target, active row). If two blue fills are visible in one panel, one of them is wrong. Export is the top bar's one blue fill; the play button is the stage's.

**The Scope Rule.** A component never knows which ground it is on. Put it inside `.on-bar` or `.on-stage` and the ground tokens change under it; adding a colour class or a hex to make something read on a bar is the bug, not the fix.

**The Poster Colour Rule.** Red, gold and green are messages, not moods: red when something failed or is about to be destroyed, gold when there is something to check before export, green when a check passed. Each is flat, sparing, and never a highlight, a brand note or a required-field marker. Red as text is Red Ink; red as a fill is Brick.

**The Footage Owns Colour Rule.** Around the monitor the ground is the deepest navy and the monitor is black. Anything colourful inside that column is the user's video, logo or accent swatch, never the chrome.

## Typography

**Display Font:** none; the interface has no display size.
**Body Font:** Public Sans (with ui-sans-serif, system-ui, Segoe UI), self-hosted as one variable file plus a 400 italic.
**Label/Mono Font:** none. Numbers use Public Sans with tabular figures (`tnum`) instead of a monospace face.

**Character:** a plain, civic grotesque that reads as government-grade rather than startup-grade, set small and confident on navy. Headings are semibold with tight tracking; everything else is regular or medium at small sizes. The `cv11` alternate is on globally; the root size is 14 px and every role sets its own.

### Hierarchy
- **Headline** (600, 18px, 1.45, tracking -0.025em): the selected element's name at the top of the properties panel; "Nothing on the video yet".
- **Title** (600, 16px, 1.45, tracking -0.025em): library group headings ("Projects", an ad type, "From nothing").
- **Section** (600, 13px, 1.45): panel section titles ("Footage", "Music", "How it ends", "Scene", "Add to the spot"), with a 14 px Fg 3 chevron when foldable; the project name in the top bar (with the template and client in Fg 3 beside it). A block inside a section (level 3) drops to 12 px semibold in Fg 2.
- **Body** (400, 13px, 1.45): field text, menu items, scene chip names, the empty-spot line; buttons use it at 500. The floating text editor uses it at 15px/500. Project row names and template card names in the library are the one 14 px/500 use.
- **Label** (500, 12px, 1.45): field names above controls, slider names, chips, small buttons, the length and version chips, the readiness pill, the save state, the transport clock, hint copy, group labels on the strip.
- **Fact** (400, 11px, 1.45, tabular): durations, resolutions, timestamps, notes under a section title, counters, timecode badges, the "In use" badge (at 600), transition markers, "Reset to authored".
- **Wordmark** (700, 15px, tracking -0.025em): "CampaignCut" in Fg beside the 22 px play mark (a 6 px-radius Sky Blue square with a Navy Ink triangle; the same on the bar).

### Named Rules
**The Tabular Numbers Rule.** Every number a user compares (times, sizes, fps, percentages, hex codes) sits in tabular figures so it does not jitter as it changes. There is no monospace font in this world.

**The Sentence Case Rule.** Every heading, label, chip and button is sentence case at its natural tracking. The only uppercase text is a hex colour code in its field. There are no kickers, eyebrows or tracked small caps.

## Layout

The editor is a fixed three-column shell under a 52 px Bar Navy top bar at laptop widths and up (1280 px is the floor; nothing reflows below it). The left column is a 280 px media library on Panel Navy (Add to the spot, Footage, Find stock footage, Music, Colours across the spot, stacked rather than tabbed), the right a 320 px properties panel, each closed by one hairline toward the centre. The centre takes the rest on the Wall Navy: the monitor at the largest 16:9 the width and height allow (max 1400 px wide, or what fits above a 300 px reserve) centred in 24 px of stage, the transport row under it with 12 px above, a one-line hint under that with facts right-aligned, and the Bar Navy scene strip pinned to the bottom of the column with a hairline above it. The library page uses the same bar (20 px side padding) over a centred 72rem container with 32 px gutters, a project list, a row of client chips, and template cards three across at 16 px gaps.

Panels are divided into sections with 20 px horizontal and 16 px vertical padding (the media column's shelves use 16 × 12), each ending in one hairline and none after the last. Inside a section the rhythm is 12 px between a title and its content, 8 px between siblings, 6 px between a label and its control, 4 px between a value and its fact. Controls are 36 px tall (28 px small), icon buttons 32 px (28 px inside a grouped pair), rows 36 px (48 px in the library's project list), thumbnails and swatches on an 8 px grid. Width, not stacking, changes with viewport: the columns hold their pixel widths and the strip scrolls sideways once its chips would fall under 176 px.

## Elevation & Depth

Depth is tonal. Eight navy steps do the layering: the wall, the bar, the ground, the panel, raised, hover, then the two lines; one hairline does the separating. Shadows exist for exactly two jobs: a card shadow so a filled blue pill, an active segmented option or a trim grip sits a hair above its track; and a float shadow for the few things that sit over another surface rather than in it: the monitor on the wall, menus and the readiness list, the transition popover on the strip, and the in-place text editor over the video (which also blurs the video behind it at 95% panel opacity). Panels, fields, tiles, chips at rest and rows never carry a shadow. The one highlight is the sheen: a white-to-clear gradient at 16% over the top 60% of the primary pill, and nowhere else.

### Shadow Vocabulary
- **card** (`box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3)`): the primary button, the active segmented option, the trim grips, and anything else filled blue that should sit on its surface.
- **float** (`box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.35)`): the monitor, menus, popovers, the readiness list and the text editor.
- **knob** (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5)` on slider thumbs; `0 1px 2px rgba(0, 0, 0, 0.4)` on the switch knob): the round white knobs only.

### Named Rules
**The Flat Panel Rule.** Panels, fields, tiles and rows never carry a shadow. If something needs to look nearer, it moves one tonal step up (panel to raised to hover); it does not lift.

**The One Sheen Rule.** The only gradient in the chrome is `cc-sheen`, a faint top highlight on a Sky Blue primary fill (Export MP4 and its chevron, Add template). Slider tracks paint their fill with a hard two-stop gradient, which is a fill, not a sheen. Nothing else fades, glows or blends.

**The Nothing At Rest Rule.** Nothing is drawn over the video at rest. The only overlays are the 1 px blue ring around the layer under the pointer, the in-place text editor while typing, and the dashed blue drop target while a clip is dragged over the footage. Each appears with the one `cc-appear` motion (220 ms on the spring, from 94% scale) and is removed outright, and none animates under `prefers-reduced-motion`.

**The One Spring Rule.** There is one easing, `--ease-spring` (`cubic-bezier(0.22, 1.15, 0.36, 1)`): a hint of overshoot, never elastic. `cc-press` scales a pressed control to 96% over 160 ms on it; `cc-appear` pops a new thing in over 220 ms; the switch knob slides 14 px over 220 ms and the slider thumb grows to 120% over 160 ms on it. Colour changes stay on a plain 150 ms ease.

## Shapes

Round where it is pressed, soft where it holds. Every pressable control is a full pill (999 px): buttons, chips, icon buttons, segmented frames and their options, the length and version chips and their frame, the Undo/Redo frame, the readiness pill, the client chips, the transition marker and its popover, the trim bar and its grips, the colour swatch, sliders, switches and scrollbar thumbs. Fields, menu items, music rows, thumbnails inside tiles and the drop box on the video are 10 px (`md`); panels, tiles, cards, scene chips, the monitor, menus, the readiness list, drop zones, the Add chip and the text editor are 16 px (`lg`); 22 px (`xl`) is declared for the outermost library containers; the timecode and "In use" badges, the layer outline and the folded-title focus are 6 px (`xs`); the drop badge on the video is 8 px (`sm`). Borders are 1 px hairlines in `line`, stepping to `line-strong` on hover and used dashed (in `line-strong`, or blue when active) for anywhere a file or element can be dropped. Focus is a 2 px blue outline at 2 px offset following the control's own radius, or a 2 px blue ring on tiles, chips and cards. Nothing is square-cornered.

## Components

Controls are CapCut's vocabulary made rounder: pills that give a little when pressed, quiet until touched, in navy with one sky-blue fill. Every control comes from `app/src/components/ui.tsx` (Button, Chip, IconButton, Segmented, Slider, Switch, Section, FieldLabel, Wordmark) so the same action looks the same everywhere, and every one of them is written in tokens so it re-reads inside `.on-bar` and `.on-stage`.

### Buttons
- **Shape:** a pill, 36 px tall with 14 px side padding at 13 px/500; small is 28 px tall, 10 px padding, 12 px text. Icon-first with an 8 px gap (6 px small); Lucide at 16 px (14 px small), 1.75 stroke. Every button carries `cc-press`.
- **Primary:** Sky Blue fill, Navy Ink text, the sheen, the card shadow. One per surface: Export MP4 in the top bar, Add template in the library. Hover lifts to Blue Hover, press drops to Blue Deep.
- **Secondary:** raised fill, Fg text, hairline border; hover steps to the hover fill and a Line Strong border. The default variant (Download MP4, Apply the brand, Duplicate scene).
- **Ghost:** no fill, Fg 2 text; hover to Fg text on the hover fill. Cancel, Keep, Library (a 32 px pill with the chevron), Move earlier / Move later, Rename / Duplicate / Delete in the project list.
- **Danger:** Red Ink text, no fill; hover on Red Tint. Confirming a delete; Remove from spot.
- **Export split button:** the filled Export MP4 with its right corners squared, and a 36 × 32 px chevron icon button in the same fill and sheen against a Navy Ink hairline at 25%; the chevron opens a 256 px panel-toned menu (role menu, 16 px radius, float shadow, 4 px padding, 10 px items at 13 px) with "This version" and "All four versions".
- **Readiness pill:** a 28 px pill beside Export with a shield icon and `cc-press`. Solid Gold with Navy Ink and "N to check" while the list has open items; solid Brick with Navy Ink while the disclaimer blocks; quiet raised with a hairline and a green shield reading "Ready to export" when everything is in. The two filled states brighten 10% on hover. It opens a 320 px panel-toned list under it (16 px radius, float shadow, 12 px padding, `cc-appear`; a region, not a modal), one 12 px row per check with a green check, a Fg 3 circle or a Red Ink shield, and a chip beside a line that has a fix.
- **Icon button:** 32 px round, ghost treatment (28 px inside the Undo/Redo frame, which is a raised pill with a hairline and 2 px padding). Play is the one icon button filled Sky Blue, at 36 px.
- **States:** 150 ms colour transition; disabled at 40% opacity (35% for icon buttons) with pointer events off; focus uses the global 2 px blue outline.

### Chips
- **Style:** a 28 px pill, 12 px side padding, 12 px/500, `cc-press`. At rest raised fill with a hairline and Fg 2 text; hover to the hover fill, Fg text and a Line Strong border.
- **State:** pressed (`aria-pressed`) is filled Sky Blue with Navy Ink. Used for the shelf of elements to add, a word to call out, the stock outlets (with "soon" ones dashed and disabled at 40%), the client under "New spots for" (a 32 px variant), the fix beside a readiness line, and the overlay chips on the scene strip. Focus is a 2 px blue ring.
- **Length and version chips:** 28 px pills at 12 px/500 tabular (:06 · :15 · :30 · :60 and 16:9 · 1:1 · 4:5 · 9:16) inside one raised pill frame with a 1 px hairline divider; the chosen one is the hover tone, not blue, so Export remains the bar's one accent fill.

### Segmented control
- **Style:** a 2 px-padded raised pill frame with a hairline border; options are pills, 32 px tall (28 px small) at 13 px/500 (12 px small), Fg 2 text, `cc-press`.
- **State:** the active option is filled Sky Blue with Navy Ink and the card shadow; the others hover to the hover fill and Fg text. Used for footage fit (Fill / Fit) and how a scene ends (Cut / Fade / Wipe / Slide, full-width when it owns a row).

### Sliders and switches
- **Slider:** a 4 px pill track, Sky Blue up to the value and Line Strong after, with a 16 px white thumb ringed 2 px in blue and shadowed; the thumb grows to 120% on hover and focus on the spring. Laid out as name (12 px Fg 2, 56 px) · track · value (12 px Fg, tabular, right-aligned, 56 px). Disabled at 40%. The scrubber under the monitor is the same slider.
- **Switch:** 36 × 22 px pill, Line Strong when off and Sky Blue when on, with an 18 px white knob that slides 14 px in 220 ms on the spring. "Show" beside the element name, Mute footage sound, Key out green screen.
- **Trim bar:** a 28 px pill in Blue Tint with a hairline; the kept range is filled Sky Blue; the two grips are 12 px-wide white pills with a 2 px blue border and the card shadow, draggable and keyboard sliders. Its readout above is 12 px: "Trim" in Fg 2 left, "0.0 s – 2.0 s of 2.0 s" tabular in Fg right.

### Inputs / Fields
- **Style:** raised fill, hairline border, 10 px radius, 8 px × 12 px padding, 13 px text at 1.4; placeholder in Fg 3. Labelled above by a 12 px/500 Fg 2 name with an optional 11 px tabular fact on the right (character count, range), 6 px below the label.
- **Hover / Focus:** border to Line Strong on hover; on focus the border turns Sky Blue, the fill drops to Panel Navy, and a 3 px Blue Tint ring appears; outline off. The field's whole row in the inspector sits on Blue Tint with a 60% blue hairline while it is the active one on the video.
- **Error:** `aria-invalid` turns the border Brick, and an 11 px Red Ink line sits under it. Hex fields are uppercase and tabular; the colour swatch beside them is a 36 px round pill with a hairline border and 3 px inset.

### Cards / Containers
- **Panel sections:** 20 × 16 px padding, 13 px/600 title on the left with a 14 px Fg 3 chevron before it (turns -90° when folded, the fold remembered per browser) and an optional action on the right that stays live while folded; an optional 11 px Fg 3 note under the title; one hairline below, none after the last.
- **Tiles** (the logo picker, the footage tile in the inspector, chroma settings, library items in the picker): raised fill, hairline border, 16 px radius, 8 px padding (12 px for a settings card), an 80 to 96 px 16:9 thumbnail on the Wall Navy with a 10 px radius on the left; hover steps the border to Line Strong.
- **Thumbnail tiles** (media library, stock results): raised fill, hairline border, 16 px radius, a full-width 16:9 thumbnail on the Wall Navy with a white 11 px tabular timecode badge bottom-right on 70% black (6 px radius), a Sky Blue "In use" badge with Navy Ink top-left at 11 px/600 when selected (and a blue border on the tile), then a 12 px name and 11 px Fg 3 facts. They drag; the cursor says so.
- **Rows** (tracks, exports): 36 px, raised fill, 10 px radius, 12 px side padding, 12 px text with an 11 px tabular fact right; the selected row uses Blue Tint and a blue check.
- **Library cards:** Panel Navy, hairline border, 16 px radius, a 16:9 thumbnail on the Wall Navy, 14 px name and 12 px Fg 3 facts; hover raises the fill and strengthens the border. The project list is the same card as a hairline-divided list at 48 px per row (name 14 px/500 turning Sky Blue on hover; Rename, Duplicate and Delete as 28 px ghost pills, Delete going Red Ink on hover). "Start from nothing" is the same card with a dashed Line Strong border that turns blue on hover.
- **Drop zones:** dashed Line Strong border, 16 px radius, centred 12 px copy; hover turns the dash blue over a 40% Blue Tint.
- **Menus and lists that float:** Panel Navy, hairline, 16 px radius, float shadow, `cc-appear`, 13 px items with 10 px corners hovering to the hover fill.

### Navigation
- **Top bar (`.on-bar`):** 52 px of Bar Navy closed by one hairline, 16 px side padding in the editor and 20 px in the library. The wordmark left (in the editor, a ghost "Library" back pill then the wordmark, in a 280 px slot aligned to the media column), the project name centred at 13 px/600 with the template and client in Fg 3 beside it and a pencil icon button to rename; then the length and version chips in one raised frame, Undo/Redo as a raised pair of 28 px icon buttons, the save state in 12 px, the readiness pill and the Export split pill right. On the library the bar carries only the wordmark and the Sky Blue Add template pill.
- **Scene strip (`.on-bar`):** a Bar Navy band with 24 × 12 px padding and a hairline above, its chips laid out proportionally to length (basis 0, minimum 176 px, 8 px gap) at 8 px padding and 16 px radius. Each scene chip carries a 64 px still of the scene on the Wall Navy beside a 13 px/500 name and an 11 px tabular fact, and a row of 28 px overlay pills under it. A group label ("Opening", "End card") sits above each group in 12 px Fg 2. At rest a chip is raised; the chip on screen is filled Sky Blue with Navy Ink (its fact at 75% ink); the selected chip carries a 2 px blue ring at 2 px offset. Between two scenes a 24 px round transition marker sits centred on the chip row: a Panel Navy pill with a hairline in Fg 3 for a cut, a Blue Tint pill with a blue border and the preset's name in Sky Blue otherwise; pressed, a panel-toned pill group floats above it with the four presets on `cc-appear`, the current one filled blue. Every chip drags; a scene over another scene shows a 3 px inset blue edge on the left or right half; an overlay over a scene tints it. The Add chip is a 16 px dashed cell in Panel Navy, sticky at the strip's right edge over a fade in the bar's own navy, going blue-dashed on Blue Tint when hovered.

### Program monitor (signature, `.on-stage`)
Black, 16 px radius, float shadow, on 24 px of Wall Navy; the largest 16:9 the width allows. It shows nothing of the player's own chrome; the transport under it is the world's controls on the stage: a 36 px Sky Blue round play button with a Navy Ink glyph, a 12 px tabular clock with the total in Fg 3, the filled slider as scrubber, ghost mute and full-screen icon buttons, then a one-line 12 px Fg 2 hint ("Drag a headline or logo to move it · double-click text to type · drop a clip on the footage · drag a chip to reorder") with 11 px Fg 3 facts on the right (frame size, fps, the length gauge, which turns Gold when the content does not fill the spot, "preview at proxy quality"). A measured-playback line reads green or Red Ink. Over the video only three things ever draw: a 1 px inset blue ring with 6 px corners around the layer under the pointer; a floating text editor (Panel Navy at 95% with backdrop blur, blue hairline, float shadow, 16 px radius, 8 px padding, 15 px/500 text with an 11 px Fg 3 counter row); and while a clip is dragged, a 2 px dashed blue box on Blue Tint with a small Sky Blue "Drop to use here" badge in Navy Ink (8 px radius, 12 px/500) in its corner, on `cc-appear`. The cursor becomes `move` over a layer.

## Do's and Don'ts

### Do:
- **Do** use one Sky Blue fill per surface for the action or the selection, and Blue Tint (16%) for hover, drop targets and active rows; Export is the bar's one fill and Play is the stage's.
- **Do** put Navy Ink (`on-blue`) on every Sky Blue, Gold or Brick fill: text, icon, the wordmark's triangle, the chevron's divider.
- **Do** put a component on a different ground by wrapping it in `.on-bar` or `.on-stage`, and let the ground tokens re-read; write every component in `bg`/`panel`/`raised`/`hover`/`line`/`fg`/`blue`/`on-blue` names and nothing else.
- **Do** make everything pressable a pill with `cc-press`, keep fields, rows and menu items at 10 px, panels, tiles, cards, scene chips and the monitor at 16 px.
- **Do** step surfaces tonally (wall, bar, ground, panel, raised, hover) and separate with one 1 px `line` hairline; go to `line-strong` only on hover, on dashed drop zones and on unfilled tracks.
- **Do** use the poster colours flat and only as messages: Gold with Navy Ink for "something to check", Brick as a fill and Red Ink as text for failure and destruction, green for a passed readout.
- **Do** set every number in tabular figures at 11 or 12 px, in Fg for the value and Fg 3 for the fact.
- **Do** build every control from `ui.tsx` and Lucide at 16 px / 1.75 stroke (14 px inside small controls), and animate only on `--ease-spring` (`cc-press`, `cc-appear`, knobs and thumbs).
- **Do** draw overlays on the video only in response to the pointer, with `cc-appear`, and remove them outright when the pointer leaves.
- **Do** write labels, chips and buttons in sentence case at 12 or 13 px; reserve 18 px semibold for the one selected-element name.

### Don't:
- **Don't** put white text on a Sky Blue fill, or `fg` on Gold or Brick; the ink on every fill is `on-blue`, and the prototype is the proof it reads.
- **Don't** put anything over the video at rest: no watermark, no safe-zone guides, no persistent handles, no player chrome.
- **Don't** add a colour class or a hex for a ground (`bg-[#071324]`, `bg-black`, `text-white`) inside a bar or on the stage; the scopes re-read `bg` and `panel`, and a literal breaks on the next ground. The monitor's black and the knobs' white are the only literals, and they sit on the wall.
- **Don't** carry a dark literal from the old worlds (the near-black Studio Monitor's `#0b0d10`-style grounds, the light world's white panels and campaign-blue bars); the navy steps are the tokens, and both earlier worlds are evidence only.
- **Don't** paint Bar Navy on anything but the top bar, the scene strip and a panel-toned thing over the stage, and don't put a Wall Navy well inside a panel; the only deepest ground is the wall around the monitor and the thumbnails' own frames.
- **Don't** use red for anything but failure and destructive confirmation, Gold for anything but "something to check", or green as a button, badge, fill or accent.
- **Don't** add a second accent, a brand colour, or any gradient beyond the one sheen on the primary pill; the footage and the user's own accent swatch are the only other colour on screen, and the poster colours are flat.
- **Don't** put shadows on panels, fields, tiles, chips at rest or rows; only the monitor, floating menus and lists, the text editor, filled blue pills and round knobs carry one.
- **Don't** use a monospace face, uppercase tracked labels, letter-spaced kickers or eyebrow lines; the only uppercase is a hex code in its field.
- **Don't** reach for the alias tokens (`ink`, `hairline`, `muted`, `cobalt`, `danger`) in new work; they exist only so untouched components keep compiling, and they do not re-read inside a scope.
- **Don't** introduce dropdowns or typed number fields for what a slider, segmented control, switch, chip or drag on the video can do.
- **Don't** reflow below 1280 px or collapse the columns; this is a laptop-width tool.
