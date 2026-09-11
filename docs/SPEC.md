# SPEC.md

The technical specification. `docs/MILESTONES.md` says what to build when. This says what it is.

---

## 1. The template pipeline

This is the strategic center of the product. Everything else is an ordinary web app.

```
Designer builds comp in After Effects
        |
        |  tags editable layers as cc.<role>
        v
Bodymovin export  ->  template.json (Lottie) + assets/
        |
        |  npm run ingest -- <path>
        v
Read cc.* tags  ->  generate param schema  ->  validate  ->  register
        |
        v
Template appears in app library, fully editable, no code written
```

The property that makes this a business rather than a service: **adding a template requires zero engineering**. If any template needs hand-written code, that is a failure of AT-1 and must be reported, not patched.

### 1.1 The tagging convention

Layers tagged with a `cc.` name prefix are editable. Everything untagged is locked craft that renders exactly as animated.

```
cc.<role>          one editable slot       cc.headline
cc.<role>.<n>      a repeated slot         cc.stat.1, cc.stat.2
```

Roles:

| Tag | Kind | Notes |
|---|---|---|
| `cc.headline` | text | |
| `cc.subhead` | text | |
| `cc.body` | text | |
| `cc.stat.N` | text | Repeated. N is 1-based. |
| `cc.accent` | color | Primary brand color |
| `cc.surface` | color | Background or panel color |
| `cc.logo` | image | Replaceable image asset |
| `cc.mediaFill` | media | Slot where user footage shows through |
| `cc.safe.disclaimer` | text | Locked position and size. Text editable only. |

Tags are case-sensitive. A misspelled tag falls through as locked, so **the ingest tool must print every tag it found** so the author can see what was and was not picked up.

The author-facing version of this lives in `docs/AE-AUTHORING.md`. Keep the two in sync.

### 1.2 What Lottie carries

This constrains what can be designed and therefore what the app can support. Validate against it at ingest.

| Travels | Partial | Does not travel |
|---|---|---|
| Shape layers, paths, masks, gradients, transform animation (position, scale, rotation, opacity), editable text, alpha track mattes, embedded images | Blend modes, luma mattes, time remapping, merge paths, expressions (some evaluate, some bake) | Most native and third-party effects (Sapphire, Continuum, Particular, Element 3D), motion blur, true 3D layers, camera moves |

### 1.3 The template contract

A template is three things stored together under `/templates/<slug>/`:

| Piece | File |
|---|---|
| Source | `template.json` (the Lottie) and `assets/` |
| Schema | `schema.json` (generated, never hand-written) |
| Metadata | `meta.json` |

```ts
type TemplateParam = {
  key: string                                     // "headline"
  role: string                                    // "headline" | "accent" | ...
  kind: 'text' | 'color' | 'image' | 'media'
  label: string                                   // human label in the editor
  default: unknown                                // what the designer authored
  maxChars?: number                               // from the AE text box where derivable
  locked?: boolean                                // disclaimer position
  path: string                                    // JSON pointer into the Lottie
}

type TemplateMeta = {
  slug: string
  name: string
  adType: string        // "Contrast" | "Bio" | "Issue" | "GOTV" | "Endorsement"
  durationInFrames: number
  fps: number
  width: number
  height: number
  fonts: string[]       // font families referenced by text layers
}
```

**The editor UI is generated from the schema.** There is no per-template UI code. A template with three text roles and one accent color produces three text fields and a color picker, automatically. This is the property that lets the library scale.

### 1.4 Ingest validation

Reject and name the offending layer. Never degrade silently.

- Every `cc.` tag resolves to a known role
- Text roles are actually text layers
- Color roles resolve to a mutable fill (`ty: "fl"`) or stroke (`ty: "st"`)
- `meta.json` fields are all present and non-zero
- Every font referenced by a text layer is present in `/app/public/fonts`

---

## 2. The Lottie mutation layer

`@remotion/lottie` renders a Lottie JSON and gives you **no API to change text, colors, or images inside it.** This surprised us before. Plan for it.

The approach that worked: deep-clone the Lottie JSON and mutate it before handing it to the player.

- **Text** lives at `layer.t.d.k[].s.t` on text layers
- **Fill color** on shape items of type `fl`, at `.c.k`, as normalized RGBA (0 to 1, not 0 to 255)
- **Stroke color** on items of type `st`, same shape
- **Images** referenced through the top-level `assets` array by asset id

Build this as a pure function with real tests:

```ts
applyLottieValues(source: LottieJSON, values: Record<string, unknown>, schema: TemplateParam[]): LottieJSON
```

It must be pure. It must not mutate `source`. It is called on every keystroke in the editor, so it must be fast enough to run at interactive speed on a template-sized JSON, and memoized on the values object.

This is fiddly and version-sensitive to the Bodymovin export. Do not reach for a library. Write it, test it, own it.

---

## 3. Project structure and data model

The library is organized as **ad type > ad example > elements**.

```
Ad Type            "Contrast", "Bio", "Issue", "GOTV", "Endorsement"
  └─ Ad Example    a complete designed spot, e.g. "Contrast :30 / Split Record"
       └─ Elements the ingested pieces already placed on the timeline:
                   open, lower third, stat callout, transition, end card, disclaimer
```

**The user starts from a finished spot, not a blank canvas.** They pick an ad example and it already has its elements arranged. Their job is to fill it in and swap footage, not to assemble it. This is a deliberate simplification and it should be preserved.

SQLite tables:

| Table | Columns of note |
|---|---|
| `ad_type` | `id`, `name`, `sort` |
| `template` | `id`, `slug`, `name`, `ad_type_id`, `duration_frames`, `fps`, `width`, `height`, `thumb_path` |
| `template_element` | `id`, `template_id`, `slug`, `z_index`, `start_frame`, `end_frame` |
| `project` | `id`, `template_id`, `name`, `created_at`, `updated_at` |
| `project_value` | `project_id`, `element_id`, `param_key`, `value_json` |
| `media_asset` | `id`, `original_path`, `proxy_path`, `thumb_path`, `width`, `height`, `duration_s`, `fps` |
| `render` | `id`, `project_id`, `status`, `output_path`, `error`, `created_at` |

No user table. No workspace table. No permissions table.

---

## 4. The editor surface

Three regions.

**Program monitor.** The Remotion `<Player>`. **Nothing ever overlays it.** No modals, no toasts, no floating panels on top of the video. This is a hard rule from `DESIGN.md` and it exists because a video editor's monitor has to be trustworthy.

**Timeline.** The element stack in order, with in and out points. Elements can be moved in time and toggled on and off. They cannot be added from a general library in this phase.

**Inspector.** Generated from the selected element's schema.

| Control | Behavior |
|---|---|
| Text | Per text role. Enforce `maxChars` from the schema. |
| Color | Per color role. Hex input plus swatch. |
| Logo | Image upload, fitted into the authored slot. |
| Footage | Upload and swap the background media. |
| Transitions | Between elements. `@remotion/transitions` presets. Not authored in AE. |
| Disclaimer | Text field. Position and size locked. |
| Background removal | See section 7. |

### Design system: The Console

`docs/DESIGN.md` is the source of truth. Summary:

- Hairlines, not cards. No drop shadows.
- Zero border radius.
- Cobalt (`#2B54E6`) is the accent and appears **only** on active states.
- IBM Plex Sans for interface text. IBM Plex Mono for facts, measurements, timecodes, and filenames.
- Nothing overlays the program monitor.

---

## 5. Playback

**The proxy strategy.** On upload the server probes the file with `ffprobe` and generates:

- A proxy at roughly 960x540, H.264, `-movflags +faststart`, moderate bitrate
- A poster thumbnail

The `<Player>` composition receives the proxy path. The export composition receives the original path. Same composition, one prop different.

**Performance levers**, in the order to reach for them:

1. Drop proxy resolution further. Preview quality is negotiable. Responsiveness is not.
2. Try the `lottie-web` canvas renderer against SVG. Canvas generally wins on animation-heavy content.
3. Only mount Lottie elements near the playhead.
4. Last resort: bake locked non-parameterized elements to transparent-alpha WebM at ingest and play those back in preview only. **This violates one-composition-two-runners and requires an explicit parity test if used at all.**

**Target:** smooth enough that a user can judge their edit. Sustained 24fps or better. Not 60fps.

Measure before optimizing. Do not guess at what is slow.

---

## 6. Export

`renderMedia` from `@remotion/renderer`, running server-side in Node, on the same composition, pointed at original-resolution media.

- One job at a time, simple in-process queue. No fan-out. No Remotion Lambda.
- Output: H.264 MP4, 1920x1080, at the template's authored frame rate.
- The media endpoint **must** send correct CORS headers. See the missing-export bug in `CLAUDE.md`.
- Broadcast delivery specs (bitrate targets, LUFS loudness normalization) are real requirements for political deliverables but are **out of scope**. Leave a hook, move on.

**Parity check.** Build a script that extracts frames from the export at given timestamps and compares them against `<Player>` frames at the same timestamps. This is the automated half of AT-5. The human half is watching the file.

---

## 7. Background removal

The highest-risk feature by schedule. Treat it as a spike, not a given.

1. **Chroma key first.** If the source is shot on green, a GPU shader chroma key is fast, high quality, and cheap. Ship this.
2. **ML matting second, if at all.** `@imgly/background-removal` or MediaPipe selfie segmentation client-side, Robust Video Matting server-side. Expect a quality and performance tradeoff.
3. Splitting preview quality from export quality is legitimate here, and is a deliberate exception to one-composition-two-runners. If you take it, test parity of framing even when edge quality differs.

**This is the first thing cut if the build slips.** Say so early rather than late.

---

## 8. Fonts

Lottie text references font families by name. If the app does not have the designer's exact font, text reflows and the design breaks in ways that are subtle and hard to spot.

- Extract font family references from text layers at ingest
- **Fail validation** on any font not present in `/app/public/fonts`
- Ship the font files alongside the template
- Load them with `@font-face` and wait for `document.fonts.ready` before the first render

---

## 9. The After Effects plugin

Josh's proposal is a plugin that reads a prepared composition directly and pushes it into the app.

**Assessment:** good idea, but it cannot make unsupported features travel. Bodymovin's limitations are Lottie's limitations. A plugin that emitted a richer non-Lottie format would mean writing our own After Effects to web renderer, which is a research project, not a proof of concept.

**Phase A, in scope, last milestone.** A pre-flight `.jsx` script the author runs inside After Effects. It walks the comp and reports:

- Every `cc.` tag found, with its layer and resolved role
- Text layers that look editable but are untagged
- Unsupported effects, blend modes, and 3D layers, named by layer
- Comp duration, dimensions, and frame rate
- Fonts referenced

It writes a plain text report. It does not export anything. One to two days of work, and it captures most of the plugin's real value by catching problems at design time instead of at ingest time.

**Phase B, not in scope.** A full UXP panel with one-click push. If it is ever built, build UXP, not CEP. Adobe is migrating away from CEP.

---

## 10. Ranked risks

| # | Risk | Response |
|---|---|---|
| R-1 | Lottie cannot carry animation-heavy designs at acceptable fidelity | Tested before the build starts. If it fails partially, the answer is a narrower authoring style guide, not more engineering. |
| R-2 | Preview and export drift apart | One composition two runners, enforced structurally. Frame-sampled parity checks. A human watches every export. |
| R-3 | Background removal eats the schedule | Chroma key first. Timeboxed. First thing cut. |
| R-4 | Browser playback performance | Proxy resolution, canvas renderer, mount near playhead. Measure first. |
| R-5 | Font handling breaks designs subtly | Fail ingest validation on missing fonts. Ship fonts with templates. |
| R-6 | Scope creep from the non-goals list | The non-goals list in `CLAUDE.md` is a contract. |
