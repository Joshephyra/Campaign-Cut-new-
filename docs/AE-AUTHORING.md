# AE-AUTHORING.md

How to build an After Effects template so the app can ingest it. Written for whoever is in After Effects, not for the developer.

---

## The short version

1. Build the comp normally, using only things Lottie can carry (see the table below).
2. Rename any layer the user should be able to edit to `cc.<role>`.
3. Run the pre-flight script and fix whatever it flags.
4. Export with Bodymovin.
5. Hand the export folder to the ingest command.

Anything you do not tag is locked. The user cannot touch it. That is the point: they get a safe, narrow set of controls and cannot break your animation.

---

## What Lottie carries

This is the real constraint on the design. It is narrower than After Effects, and it is workable: a lot of the strongest political motion design is exactly this toolkit.

### Use freely

- Shape layers, paths, trim paths, strokes, fills
- Masks
- Gradients (linear and radial)
- Transform animation: position, scale, rotation, opacity, anchor point
- Text layers
- Alpha track mattes
- Embedded images (logos, textures)
- Parenting
- Easing and keyframe interpolation

### Use with caution, test it

- Blend modes (partial support, test the specific one)
- Luma track mattes (partial)
- Time remapping (partial)
- Merge paths (partial)
- Expressions (some evaluate, some get baked at export, some are dropped)

### Will not survive

- Native effects, with very few exceptions
- Third-party effects: Sapphire, Continuum, Particular, Element 3D, anything from a plugin vendor
- Motion blur
- True 3D layers
- Cameras and camera moves
- Adjustment layers with effects on them
- Audio

If you need a look that depends on an effect, bake it into a pre-rendered PNG sequence or a still image and bring that in as an embedded asset. That travels.

---

## The tagging convention

Rename the layer in the timeline. That is the whole mechanism.

```
cc.<role>          one editable slot       cc.headline
cc.<role>.<n>      a repeated slot         cc.stat.1, cc.stat.2, cc.stat.3
```

### The roles

| Tag | Layer type | What the user gets |
|---|---|---|
| `cc.headline` | Text | A text field |
| `cc.subhead` | Text | A text field |
| `cc.body` | Text | A text field |
| `cc.stat.1`, `cc.stat.2`, … | Text | One text field each, in order |
| `cc.accent` | Shape with a fill or stroke | A color picker |
| `cc.surface` | Shape with a fill | A color picker |
| `cc.logo` | Image layer | An image upload |
| `cc.mediaFill` | Shape or solid | Where the user's footage shows through |
| `cc.safe.disclaimer` | Text | A text field. Position and size are locked. |

### Rules that will bite you

- **Tags are case-sensitive.** `cc.Headline` will not match. It will be treated as an unknown tag and the ingest will reject the template and tell you which layer.
- **A misspelled tag is silently locked, unless it still starts with `cc.`.** A layer named `cc.headlnie` is rejected by name (unknown role). A layer named `c.headline` or `headline` is just an untagged layer and stays locked without a word. That is why ingest prints every tag it found. Read that list. If a layer you meant to be editable is not in it, the tag is wrong.
- **Color tags need a real fill or stroke.** Tagging a null or a text layer as `cc.accent` fails validation.
- **Size your text boxes for the longest plausible copy.** The app enforces a character limit derived from your box. If the box is tight, the user gets a tight limit. Campaign names are long.
- **Every font you use must be handed over with the template.** The app fails ingest on a font it does not have, because missing fonts silently reflow text and break the design in ways nobody notices until it is on air.

---

## Naming the rest

Untagged layers are locked, but name them like a person will read them anyway. The pre-flight report lists layers by name and it is much easier to debug `bg-sweep-2` than `Shape Layer 14`.

---

## Before you export

Run the pre-flight script:

**After Effects:** File > Scripts > Run Script File, then pick `tools/ae-preflight/preflight.jsx`

It writes a text report named `preflight-<comp name>.txt` next to your project file (on the Desktop if the project is unsaved) and shows a summary. It will tell you:

- Every `cc.` tag it found and what role it resolved to
- Text layers that look editable but are not tagged
- Any unsupported effect, blend mode, or 3D layer, named by layer
- Comp duration, dimensions, frame rate
- Every font you referenced

Fix everything it flags before exporting. The script does not export anything and does not change your project.

Then run the project dump:

**After Effects:** File > Scripts > Run Script File, then pick `tools/ae-preflight/dump.jsx`

It writes `dump-<project>.txt` and `dump-<project>.json` next to your project file. They list every comp, layer, keyframe, expression, effect and mask in the project. Nothing in them is a verdict; they are the developer's map of what you built, so anything Bodymovin drops on export can be found by name instead of by guesswork. Hand both files over with the export. The script exports nothing and changes nothing.

---

## Exporting

Use Bodymovin.

- Select the comp
- Turn on asset embedding for images, or keep the `images/` folder next to the JSON and hand over both
- Export to an empty folder
- Hand that folder to the ingest command

---

## Handing it off

Give the developer, or the ingest command, a folder containing:

```
<template-name>/
  data.json          the Bodymovin export
  images/            any referenced images
  fonts/             every font file the comp uses
  reference.mp4      an After Effects render of the comp at full quality
  preflight-<comp>.txt   the pre-flight report
  dump-<project>.txt     the project dump, plus its .json twin
```

`reference.mp4` matters. It is what the app's output gets compared against when Germain makes the fidelity call. Without it there is nothing to judge against.
