# Preparing your After Effects project for CampaignCut

A step-by-step guide for the designer. It takes an organised After Effects project, in this case the 6-second "Ayudando y Perjudicando" square GIF, and gets it into CampaignCut so that a campaign staffer sees it exactly as you built it and can change the words, the photo and the disclaimer without breaking anything.

Nothing here needs a terminal. Everything happens inside After Effects, Finder or Explorer, and the Bodymovin panel. Expect about two hours the first time, most of it in the clean-up pass.

Two files come with this guide. Put them somewhere easy to find, such as the Desktop:

- `preflight.jsx`, a script that checks one comp and writes a report
- `dump.jsx`, a script that writes a map of the whole project for the developer

---

## 0. What "1 to 1" means here, and what it costs

CampaignCut plays your animation with Lottie, the same engine that plays Bodymovin exports on the web. Lottie is narrower than After Effects. It carries shapes, masks, text, images, transforms, easing and parenting faithfully. It does not carry effects, layer styles, blend modes, 3D, cameras or motion blur.

So "1 to 1" is achieved by building with the things Lottie carries, and by baking everything else into images before export. The look does not change. What changes is where the look lives: a torn edge stops being a Roughen Edges effect and becomes the PNG it always rendered to.

The user gets a narrow set of controls: the text you tag, the photos you tag, the disclaimer, a nudge and scale on each tagged layer, plus the app's own extras (colour treatments, a call-out on one word, the 16:9, 4:5 and 9:16 versions). Everything you do not tag is locked. Timing, animation and fonts are always locked. That is the product.

---

## 1. What we saw in your GIF, and where each piece goes

We looked at `DGA_Ayudando y Perjudicando_6s_Gif_V2.gif`: 1080 by 1080, 6 seconds, two beats with a hard cut at 3 seconds. This table is the plan for the whole job. Every row is either "tag it" (the user may change it) or "lock it, bake it" (it stays exactly as you built it).

| What is on screen | What to do | Layer name |
|---|---|---|
| Navy paper background with the grain | Lock it. Make it a real layer (a solid or a PNG), not the comp's background colour. If the grain is an effect or a Multiply-blended texture, bake it into the PNG. | `bg-paper` |
| The big faint "$" watermark | Lock it. Text or shapes, either is fine. If it uses a blend mode or reduced-opacity effect, use plain opacity instead. | `bg-dollar` |
| Red blocks behind the photo and in the corner | Lock them, or tag one of them `cc.accent` if all your red lives in one shape layer (see 4.4). | `red-block-1`, `red-block-2` |
| Joe Lombardo cut-out photo | Tag it: a photo the user can replace. | `cc.image.1` |
| Elon Musk polaroid photo | Tag it too. Tag the photo layer only, not the tape or the frame. | `cc.image.2` |
| The polaroid's tape and frame | Lock them. | `polaroid-tape`, `polaroid-frame` |
| "JOE LOMBARDO:" kicker, beat 1 | Tag it, one line. | `cc.subhead.1` |
| "AYUDA" | Tag it, one line on its own layer. | `cc.headline.1` |
| "A LOS" | Tag it. | `cc.headline.2` |
| "MULTIMILLONARIOS." in red | Tag it. | `cc.headline.3` |
| "JOE LOMBARDO:" kicker, beat 2 | Tag it. | `cc.subhead.2` |
| "PERJUDICA" | Tag it. | `cc.headline.4` |
| "A LAS FAMILIAS" | Tag it. | `cc.headline.5` |
| "DE NEVADA." in red | Tag it. | `cc.headline.6` |
| The cream torn-paper plates behind each line | Tag each one after its line, and it grows and shrinks with the user's copy. A PNG plate is stretched sideways (the torn edge stretches a little with it); a shape plate keeps its corners. Parent each plate to its text layer. | `cc.headline.1.plate` … `cc.headline.6.plate` |
| The red underline that draws on under "MULTIMILLONARIOS" and "FAMILIAS" | Tag it after its line: a shape layer with a stroke and an animated Trim Paths travels perfectly, and its right end now follows the copy. Parent it to the text layer. | `cc.headline.3.underline`, `cc.headline.5.underline` |
| "PAID FOR BY A MORE AFFORDABLE NEVADA" | Tag it. Editable words, locked position and size. Keep it on screen for the whole 6 seconds. | `cc.safe.disclaimer` |

Two beats, one comp. Keep the whole 6 seconds in one comp; the beat-2 text layers simply start at 3 seconds. That keeps your timing exact and avoids splitting shared layers. (If you would rather each beat be its own scene in the app, see Appendix B.)

Two beats, one disclaimer. Use one `cc.safe.disclaimer` layer that runs the full 6 seconds, not one per beat.

---

## 2. Before you touch the project

1. **Know your fonts.** Write down every font family and style in the comp (your condensed headline face in Bold, the disclaimer face, anything else). The app finds most faces on its own: it looks in the fonts already on its computer, in its own font library, and on Google Fonts, and it matches by the names inside each file. You hand over a file only when the app says a face was not found, which happens with commercial faces nobody but you owns. One file per style, `.otf`, `.ttf`, `.woff` or `.woff2`. Two faces can never be handed over: anything from Adobe Fonts (Typekit), which is licensed to your machine only, and any face whose licence forbids embedding. A design set in one of those needs a face that can travel, so swap it now rather than after the export.

2. **Make the handover folder.** On the Desktop, make a folder named `ayudando-6s`. Everything you hand over ends up inside it.

3. **Save a copy of the project into that folder.** File > Save As > Save a Copy. Name it `ayudando-6s.aep` and put it in `ayudando-6s`. Work on this copy from now on. The two scripts write their reports next to the project file, so saving first matters.

4. **Remove what you do not need.** File > Dependencies > Remove Unused Footage, then delete any comps that are not part of the 6-second piece. Fewer things for the reports to list.

---

## 3. The clean-up pass: make the comp Lottie-safe

Go through every layer, top to bottom. For each one, check the list below. The pre-flight script in step 5 catches most of this, but it is quicker to fix it as you go.

### 3.1 Comp settings

Composition > Composition Settings.

- **Size:** 1080 by 1080 is fine. The app opens it as a square (1:1) spot.
- **Frame rate:** keep whatever you authored at (24, 25 or 30). The GIF is 20 fps because of the GIF export; do not change the comp to match it. The app plays and exports at the comp's rate.
- **Duration:** exactly 6.00 seconds. Not 5.96, not 6.04. The app treats a spot as exactly its length and shows a `:06` badge.
- **Background colour:** ignored by Bodymovin. If any navy shows because nothing covers it, add a solid or a shape underneath everything (`bg-paper`).
- **Work area:** double-click the work-area bar so it spans the whole comp. Bodymovin exports the work area.

### 3.2 Things that will not travel, and what to do instead

| If a layer has this | Do this |
|---|---|
| Any effect (Roughen Edges, Turbulent Displace, Noise, Drop Shadow, Fill, Tint, Black & White, Curves, Levels, Glow, Fast Box Blur, anything) | Render that layer's look to a PNG (see 3.3) and replace the layer with the PNG. Then delete the effect. |
| A Layer Style (Drop Shadow, Stroke, Inner Shadow…) | Same: bake to PNG, or rebuild the stroke as a shape layer. |
| A blend mode other than Normal (Multiply, Overlay, Screen…) | Set it to Normal. If the look needs Multiply (the paper grain usually does), bake the grain into the background PNG. |
| Motion blur (the layer switch, or the comp switch) | Turn it off. |
| The 3D switch | Turn it off. |
| A camera or light | Delete it. |
| An adjustment layer | Delete it, and bake its effect into the layers it touched. |
| Time remapping | Remove it. If the timing depends on it, pre-render that layer to a PNG sequence. |
| An expression (wiggle, loopOut, a slider) | Right-click the property > Convert Expression to Keyframes, then delete the expression. |
| Audio | None in a GIF. Leave it out. |
| A photo with a tint or a black-and-white treatment | Do the treatment in Photoshop and import the finished PNG. |
| Text converted to shapes (Create Shapes from Text) | Fine for locked text like the "$". Never for a tagged text layer: it must stay live text. |
| Continuously Rasterize / Collapse Transformations on a precomp | Turn it off. Precomps themselves are fine. |

Safe to keep, no changes: shape layers, fills, strokes, gradients, Trim Paths, masks, mask feather, opacity, position, scale, rotation, anchor point, all easing, parenting, precomps, PNG and JPG images, text layers, text tracking, text animators with range selectors (the app uses one itself).

### 3.3 Baking a look to a PNG

For each layer whose look depends on an effect or a style:

1. Make a new comp the size of the layer's bounding box, or just use the main comp.
2. Solo the layer at a frame where it is fully on screen and untransformed (if it animates in, pick a frame after it has landed).
3. Composition > Save Frame As > File. Format PNG, with alpha (RGB + Alpha, straight or premultiplied is fine).
4. Import the PNG. Put it exactly where the original layer was, with the same anchor point, and copy the original's keyframes onto it (select the original's Transform, Ctrl+C, select the PNG, Ctrl+V).
5. Delete the original layer.

The torn plates, the polaroid tape and the grain are the ones that usually need this. Test by scrubbing: the PNG version should be indistinguishable.

Name image files simply: letters, numbers, dashes. `plate-3.png`, not `Plate 3 (final) v2.png`.

### 3.4 Text layers

For every text layer that will be tagged:

- **One line per layer.** The app edits each line in a single-line field. A two-line headline is two layers. The GIF already has each line on its own plate, so this is probably how it is built.
- **Type the capitals.** Do not rely on the Character panel's All Caps button; Lottie has no such switch, so it exports what you typed. Select the text, and type it in capitals.
- **Paragraph text, not point text.** If the layer is point text, the app cannot derive a character limit and cannot shrink long copy to fit. Convert: right-click the layer in the comp viewer with the Type tool > Convert to Paragraph Text. Then drag the box as wide as the line may ever be: the user's character limit comes from the box you draw, and copy that runs past it is set smaller to fit. Campaign copy runs long.
- **Left, centre or right alignment as you like.** All three travel.
- **Keep the font, size, tracking and leading.** They travel and are locked.
- **No faux bold or faux italic** from the Character panel. Use the real Bold face.

For the disclaimer: one layer, box text, the full 6 seconds, in the safe area. Its words are editable in the app; its position and size are not.

### 3.5 Images

- PNG with transparency for cut-outs and plates, JPG or PNG for the background.
- Import them as footage, one file each, into a project folder named `images`. Do not use image sequences unless you must.
- Do not scale an image above 100 percent in the layer; if you need it bigger, export it bigger.

---

## 4. Tagging: naming the layers the user may change

This is the whole mechanism. A layer whose name starts with `cc.` is editable; any other name is locked. Select the layer in the timeline, press Enter, type the new name exactly, press Enter.

### 4.1 The exact names for this piece

From the table in section 1:

```
cc.subhead.1          JOE LOMBARDO:        (beat 1)
cc.headline.1         AYUDA
cc.headline.2         A LOS
cc.headline.3         MULTIMILLONARIOS.
cc.subhead.2          JOE LOMBARDO:        (beat 2)
cc.headline.4         PERJUDICA
cc.headline.5         A LAS FAMILIAS
cc.headline.6         DE NEVADA.
cc.image.1            the Lombardo cut-out
cc.image.2            the Musk photo inside the polaroid
cc.safe.disclaimer    PAID FOR BY A MORE AFFORDABLE NEVADA
cc.headline.1.plate   the plate behind AYUDA        (and .2 to .6 for the other plates)
cc.headline.3.underline   the underline under MULTIMILLONARIOS
cc.headline.5.underline   the underline under FAMILIAS
```

The plates and underlines are followers, not fields: nothing appears for them in the panel. They move when their line's copy changes.

In the app these appear as Subhead 1, Headline 1 to Headline 6, Subhead 2, Photo 1, Photo 2, Disclaimer, each pre-filled with what you authored. `cc.logo` is reserved for an actual logo, which a client's brand kit fills automatically; this piece has none.

### 4.2 Rules that will bite

- **Lower case, exactly.** `cc.Headline.1` is rejected and the report names the layer. `CC.headline.1` is not a tag at all and the layer is silently locked.
- **No spaces**, no trailing space after the name.
- **Every tag once.** Two layers named `cc.headline.1` is a rejection. That is why the beat-2 lines continue the numbering at 4.
- **Numbers start at 1**, no leading zeros.
- **A text tag must be on a text layer.** `cc.headline.1` on a shape is a rejection.
- **`cc.image.1` and `cc.logo` must be on an image layer** (footage), not a shape or a solid. Tagged layers may sit inside pre-comps: the importer and the pre-flight both walk into them, so a collage can keep its pieces where they are.
- **The disclaimer tag is `cc.safe.disclaimer`**, with `safe` in the middle, and no number.
- **A plate or underline must be a shape layer or an image layer**, named after a text that is tagged in the same comp. `cc.headline.7.plate` with no `cc.headline.7` is a rejection.

### 4.3 Name the locked layers too

Untagged layers stay locked no matter what they are called, but the reports list every layer by name and `Shape Layer 14` helps no one. Use the names in the table in section 1, or anything a person can read.

### 4.4 Optional: a colour the user can change

If every red in the piece lives in one shape layer (several rectangles as groups inside one layer, one Fill), name that layer `cc.accent` and the user gets a colour picker that recolours all of it. If the red is spread across several layers and PNGs, skip this; a picker that recolours one block and not the others is worse than no picker. The red in the text is the text's own colour and stays as you set it.

### 4.5 How the plates and underlines follow the copy

The app measures the user's copy in your font, works out how much wider or narrower it is than yours, and moves every follower of that line by the difference, in the direction the text grows (to the right for left-aligned text, both ways for centred, to the left for right-aligned). Draw each plate to fit your own copy, exactly as you have. Parent each plate and underline to its text layer (pick-whip it), so their scales and positions read the same.

Paragraph (box) text is fitted first: copy wider than the box is set smaller until it fits, never below half size and never smaller than your own copy needed. So a long headline stays one line and its plate follows the smaller line. If you would rather a line never shrank, make it point text; then only the plate grows.

The app can also circle, underline, highlight or enlarge any one word of a tagged line on its own, drawing on in the campaign's accent colour. That is the staffer's choice per spot; your drawn underlines stay yours.

---

## 5. Pre-flight: check the comp

1. Open the comp in the timeline (or select it in the Project panel).
2. File > Scripts > Run Script File. Pick `preflight.jsx`.
3. A box shows a count of tags and problems. A report named `preflight-<comp name>.txt` appears next to the project file, inside `ayudando-6s`. Open it. Run it on the master comp: it walks into every pre-comp inside it, so one report covers the whole piece.
4. Under **PROBLEMS**, every line names a layer and says what is wrong: an effect that will not travel, a blend mode, a bad tag. Fix each one in After Effects.
5. Under **NOTES**, untagged text layers are listed. Check that every one of them is meant to be locked. The "$" watermark is; a headline line you forgot to rename is not.
6. Under **TAGS FOUND**, check that all eleven tags from 4.1 are there with the right role, and that the text ones say "box text". "Point text" means step 3.4 was skipped for that layer.
7. Run it again until the last line reads **READY TO EXPORT**.

Then, once: File > Scripts > Run Script File, pick `dump.jsx`. Two files appear next to the project, `dump-ayudando-6s.txt` and `.json`. You do not need to read them; they let the developer find anything by name if something goes missing in export.

If After Effects will not run scripts: Edit > Preferences > Scripting & Expressions > tick "Allow Scripts to Write Files and Access Network", then try again.

---

## 6. Export with Bodymovin

### 6.1 Install it, if it is not there

Window > Extensions > Bodymovin. If it is not listed, get it from Adobe Exchange (search Bodymovin, it is free), install, restart After Effects.

### 6.2 Settings

In the Bodymovin panel, tick your comp, then click its Settings (the gear). Set these and leave the rest at their defaults:

| Setting | Value | Why |
|---|---|---|
| Export mode | Standard | |
| Glyphs | **off** | Real text with real fonts, so the words stay editable |
| Hidden layers | off | |
| Guides | off | |
| Original asset names | **on** | So `plate-3.png` stays `plate-3.png` |
| Copy original assets / Include original assets | **on** | Image files go into an `images` folder next to the JSON, untouched |
| Compress images | off | |
| Encode images (inline / base64) | off | |
| Skip images | off | |
| Bake expressions | off | There should be none left after 3.2 |
| Include audio | off | |

### 6.3 Destination

Click the destination (the folder icon on the comp's row). Choose the `ayudando-6s` folder and name the file `data.json`. Then press Render. When it finishes, `ayudando-6s` holds `data.json` and an `images` folder.

If Bodymovin reports missing fonts, it is only telling you it cannot embed them; that is expected. The font files travel separately (section 8).

---

## 7. Render the reference video

This is the file the app's output is judged against. Without it there is nothing to compare.

1. Select the comp. Composition > Add to Render Queue.
2. Output Module: H.264 (if H.264 is not in the list, render a Lossless QuickTime and convert it in Media Encoder, or use File > Export > Add to Adobe Media Encoder Queue with the H.264 "Match Source, High bitrate" preset).
3. Render Settings: Best, full resolution, the comp's frame rate. Nothing added.
4. Output To: inside `ayudando-6s`, named `reference.mp4`.
5. Render.

Also copy the original GIF into the folder. It is the thing everyone has already approved.

---

## 8. Fonts

Usually nothing to do. When the folder is ingested, the app looks for each face in its own fonts, in its font library, among the fonts installed on its computer and on Google Fonts, and it reads the names inside each file, so a face is found whatever its file is called. If a face is found nowhere, the ingest stops and names it, and Josh asks you for the file. Then:

1. Inside `ayudando-6s`, make a folder named `fonts`.
2. Copy the file for that face into it, one file per style.
3. Any file name works; `Family-Style.ext` with no spaces is clearest: `KnockoutHTF-Bold.otf`.

To save the round trip, put the files for your commercial faces in `fonts/` from the start. A regular file is never accepted in place of a bold one: the browser would fake the weight and the text would drift from what you rendered.

---

## 9. Check the folder and hand it over

The folder should look like this:

```
ayudando-6s/
  data.json                       the Bodymovin export
  images/                         every PNG and JPG the comp uses
  fonts/                          one file per font style
  reference.mp4                   your render of the comp
  DGA_Ayudando y Perjudicando_6s_Gif_V2.gif
  preflight-<comp name>.txt       the last report, reading READY TO EXPORT
  dump-ayudando-6s.txt
  dump-ayudando-6s.json
  ayudando-6s.aep                 the project, so we can look inside
```

Zip the folder and send it to Josh.

### What happens next

1. Josh drops the folder into the app ("Add a template", then "From an After Effects export…"). The app reads every tag and every font and either accepts the template or lists what is wrong, naming the layer or the font. Nothing half-works: it is in, or it is not.
2. We run the fidelity check: the app renders your template untouched and compares it frame by frame with `reference.mp4`, writing side-by-side strips (yours, ours, the difference). You get those strips back.
3. You look at the strips and at the spot in the browser and say whether it survived. If something drifted, the strips show where, and it is usually one baked layer away from right.

---

## 10. Final self-check

Before you zip, tick every line:

- [ ] The comp is 1080 by 1080, exactly 6.00 s, work area spanning the whole comp
- [ ] No effects, layer styles, blend modes, motion blur, 3D, cameras, adjustment layers, time remap or expressions remain
- [ ] The navy background is a layer, not the comp background colour
- [ ] Every tagged text layer is live text, paragraph text, one line, typed in capitals
- [ ] The eleven tags from 4.1 are present, lower case, each once, and every plate and underline is tagged after its line and parented to it
- [ ] The disclaimer is `cc.safe.disclaimer` and on screen the full 6 s
- [ ] The Lombardo and Musk photos are image layers named `cc.image.1` and `cc.image.2`
- [ ] Every locked layer has a readable name
- [ ] The pre-flight report ends READY TO EXPORT
- [ ] Bodymovin settings: Glyphs off, original asset names on, originals copied
- [ ] `fonts/` holds a file for each commercial face, one per style (the app finds the rest)
- [ ] `reference.mp4` and the original GIF are in the folder
- [ ] The dump files and the .aep are in the folder

---

## Appendix A: what the staffer will be able to do

- Change each tagged line, with a character limit from your box
- Replace either photo (Photo 1 and Photo 2)
- Change the disclaimer's words
- Nudge, scale or rotate any tagged layer a little; your animation on it is kept underneath
- Type longer or shorter copy and watch each plate and underline follow it; a long line in a box shrinks to fit rather than wrapping
- Circle, underline, highlight or enlarge one word of any line
- Apply a treatment across the spot (clean, grit, glow, opaque)
- Export the square as built, or 16:9, 4:5 and 9:16 versions of it. Those versions letterbox your square until you author a variant at that size (Appendix C)

And not: change timing, animation, fonts, colours you did not tag, or anything untagged.

## Appendix B: two scenes instead of one

If you want the app to treat the two beats as two scenes (so a staffer can drop one, reorder, or put a transition between them), split the piece into two comps of 3.00 s each, `Beat 1` and `Beat 2`, sharing a background precomp. Tag each comp on its own (`cc.subhead`, `cc.headline.1` to `.3`, `cc.image.1`, `cc.image.2`, `cc.safe.disclaimer` in each; numbering restarts per comp). Export each comp to its own sub-folder, `01-beat-1/data.json` and `02-beat-2/data.json`, and add a file named `elements.json` at the top of the handover folder:

```json
{
  "background": "#173B57",
  "elements": [
    { "folder": "01-beat-1", "name": "Ayuda",     "type": "open",     "startFrame": 0 },
    { "folder": "02-beat-2", "name": "Perjudica", "type": "end-card", "startFrame": 72 }
  ]
}
```

`startFrame` is seconds times the comp's frame rate (72 at 24 fps, 90 at 30 fps). The reference render is still the full 6 seconds. Everything else in this guide applies to each comp.

## Appendix C: other sizes

A 9:16 (1080 by 1920) or 4:5 (1080 by 1350) version is a second export of the same comp re-laid-out at that size, with the same tags, in a sub-folder named for the ratio, declared in `elements.json` as `"variants": { "9:16": "01-beat-1-9x16" }`. Not needed for this proof; ask when you want it.
