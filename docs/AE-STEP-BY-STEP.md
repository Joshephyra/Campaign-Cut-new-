# The real template, step by step

A plain walkthrough for making the first real CampaignCut template in After Effects and handing it over. Nothing here needs a terminal. The full reference is `AE-AUTHORING.md`; this is the version you follow with the mouse.

---

## Part 1 · Before you open After Effects

1. Decide what the spot is. A 30 second contrast ad is a good first one. Write down its pieces on paper, in order, with rough timings. For example:
   - Open, 0 to 4 seconds
   - Lower third, 3 to 8 seconds (it overlaps the open)
   - Stat callout, 10 to 15 seconds
   - End card with disclaimer, 25 to 30 seconds
   Each piece becomes one comp. Four pieces, four comps.

2. Pick the fonts now and find their files on your computer. Every font you use has to be handed over as a file (`.ttf`, `.otf`, `.woff` or `.woff2`). If you cannot find the file, do not use the font.

3. Make an empty folder on your Desktop called `contrast-30`. Everything you hand over ends up in here.

---

## Part 2 · Building in After Effects

4. Make a new project and save it straight away, inside the `contrast-30` folder. Saving first matters: the two helper scripts write their reports next to the project file.

5. Make one comp per piece from your list. Every comp must be exactly the same size and frame rate. Use 1920 by 1080 and 30 frames per second. The length of each comp is how long that piece plays.

6. Build each piece normally, but only with things that survive the trip. Safe: shape layers, masks, gradients, text, position, scale, rotation and opacity animation, easing, parenting, images. Not safe: effects of any kind, motion blur, 3D layers, cameras, adjustment layers, audio. If a look needs an effect, render that look to a PNG and bring the PNG in as an image instead.

7. Now name the layers the user may change. This is the whole trick. Click the layer in the timeline, press Enter, and type the new name exactly, lower case:
   - A headline text layer becomes `cc.headline`
   - A smaller line of text becomes `cc.subhead`
   - A paragraph becomes `cc.body`
   - Numbers or stats become `cc.stat.1`, `cc.stat.2`, and so on
   - A shape whose colour the user may change becomes `cc.accent` (or `cc.surface` for a big background panel)
   - The logo image layer becomes `cc.logo`
   - A rectangle where the user's footage should show through becomes `cc.mediaFill`
   - The "Paid for by" line becomes `cc.safe.disclaimer`
   Anything you do not rename stays locked. That is fine and intended. Give the locked layers readable names anyway, like `bg-sweep`, so the reports make sense.

8. Three traps:
   - Capital letters break it. `cc.Headline` is wrong. `cc.headline` is right.
   - Text boxes should be big enough for long copy. The user's character limit comes from the box you draw.
   - A colour tag needs a real shape with a fill or stroke. Do not tag a text layer or a null as `cc.accent`.

9. Check each comp with the pre-flight script. With the comp open, go to File, Scripts, Run Script File, and pick this file from the CampaignCut folder:
   ```
   tools/ae-preflight/preflight.jsx
   ```
   A box pops up with a count of tags and problems. A text file named `preflight-<comp name>.txt` appears next to your project. Open it. Fix everything under PROBLEMS, then run it again until it says READY TO EXPORT. Do this once per comp.

10. Run the project dump once. Same menu, pick:
    ```
    tools/ae-preflight/dump.jsx
    ```
    Two files appear next to your project, `dump-<project>.txt` and `dump-<project>.json`. You do not need to read them. They are for me.

---

## Part 3 · Exporting

11. Install Bodymovin if it is not there yet. Window, Extensions, Bodymovin. If it is missing, get it from the Adobe Exchange (search "Bodymovin") and restart After Effects.

12. Inside `contrast-30`, make one sub-folder per comp, numbered in play order: `01-open`, `02-lower-third`, `03-stat`, `04-end-card`.

13. Open the Bodymovin panel. For each comp: tick the comp, click the destination button and choose its sub-folder, name the file `data.json`, and press Render. If the comp uses images, Bodymovin makes an `images` folder next to `data.json`. Leave it there.

14. Make a `fonts` folder inside `contrast-30` and copy every font file from step 2 into it.

15. Render the reference video. Put all the comps into one master comp in the order and timing from your paper list (or use the longest comp if the spot is one piece). Add it to the Render Queue with the H.264 preset, name the file `reference.mp4`, and save it inside `contrast-30`. This is the video Germain compares against. Render it at the comp's full size and frame rate with nothing extra.

16. Tell the app where each piece starts. Make a plain text file inside `contrast-30` named `elements.json` with this inside, changing the folder names and the start frames to match your list. Frames are seconds times 30.
    ```json
    [
      { "folder": "01-open",        "slug": "open",        "name": "Open",        "startFrame": 0,   "zIndex": 0 },
      { "folder": "02-lower-third", "slug": "lower-third", "name": "Lower third", "startFrame": 90,  "zIndex": 1 },
      { "folder": "03-stat",        "slug": "stat",        "name": "Stat",        "startFrame": 300, "zIndex": 0 },
      { "folder": "04-end-card",    "slug": "end-card",    "name": "End card",    "startFrame": 750, "zIndex": 0 }
    ]
    ```
    If you skip this file, the pieces play one after another in folder order, which is often fine.

17. Look at the folder. It should be:
    ```
    contrast-30/
      elements.json
      01-open/data.json  (+ images/)
      02-lower-third/data.json  (+ images/)
      03-stat/data.json
      04-end-card/data.json
      fonts/
      reference.mp4
      preflight-*.txt
      dump-*.txt and dump-*.json
      your .aep project file
    ```

---

## Part 4 · Putting it in the app

18. Open the app at `http://localhost:5173`. If the page does not load, tell me and I start the server.

19. Near the top, click "From an After Effects export…". Click the folder chooser and pick the whole `contrast-30` folder. Type a name, for example "Contrast :30", pick the ad type "Contrast", and press Ingest.

20. Wait. The first ingest renders a thumbnail and can take a minute. Then one of two things happens:
    - It says "Ingested" and the template appears below. Done.
    - It lists problems, naming the element and the layer or font. Fix those in After Effects, re-export that comp, and press Ingest again. Nothing is written until every problem is gone.

21. Click the new template to make a project, change a headline and drop in a clip, and press Export MP4.

22. Tell me it is in. I run the fidelity comparison against `reference.mp4` and give you and Germain the side-by-side frames and the numbers.
