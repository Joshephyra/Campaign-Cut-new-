# STATUS.md

Running log of where the build is. Newest entry first.

---
## 2026-09-11 · M2 The mutation layer · built and verified by Claude, awaiting Josh's own check

**What exists now**

- `composition/src/applyLottieValues.ts`: the pure function from SPEC.md section 2. Deep-clones the Lottie, applies user values by schema, never touches the source, memoized on the values object (WeakMap). Handles text (`t.d.k[*].s.t`, every keyframe), fill and stroke colour (`c.k` as normalised RGBA; animated colours get every keyframe), and image assets (`p`, `u`, `e`). Unknown keys and invalid colours are ignored.
- `composition/src/schema.ts`: `TemplateParam` and `ParamValues` types. `path` is an RFC 6901 JSON pointer whose target depends on kind (text: the layer; color: the fill/stroke item; image: the asset).
- `composition/src/jsonPointer.ts` and `hexToRgba.ts`: small pure helpers with their own tests.
- `templates/standin/schema.json`: hand-written schema for the stand-in (headline, disclaimer, accent, surface). M3 generates this automatically.
- App: a throwaway harness above the Player with one control per schema param. Typing runs `applyLottieValues` and the Player updates live. M6 replaces it with the generated inspector.
- `npm run render:standin -- --values file.json --out name.mp4` renders with edits applied, through the same function.
- 37 tests across 8 files. Typecheck clean.

**Verified by eye**

- Server MP4 with edited values (`m2-edited.mp4`): frame 75 shows the new headline, new disclaimer, cobalt bar and plum panel. The export carries the edits through the same code path as the preview.
- Browser: set the headline field to "VOTE TUESDAY"; the Player's SVG text changed to match without a reload and the old string was gone.

**Notes**

- The root `render:standin` script now ends in `--` so flags pass through npm to the server workspace.

**Next:** M3, tag reader and schema generator. Not started.

---

## 2026-09-11 · M1 Lottie on screen · DONE (verified by Josh in browser and MP4)

**What exists now**

- `composition/src/LottieLayer.tsx`: the Lottie renderer inside a full-frame absolutely positioned wrapper. This is the fix for the positioning bug and `LottieLayer.test.tsx` guards it.
- `composition/src/Main.tsx` replaces the M0 frame counter: solid background from props, Lottie composited over it. Frame counter files removed.
- `composition/src/lottieDuration.ts`: derives composition frames from the Lottie's in/out points and authored fps. Used by the Player (app) and by `calculateMetadata` in the Remotion root (server), so both runners get the same length.
- `templates/standin/template.json`: a hand-written Bodymovin-format stand-in with `cc.surface`, `cc.accent`, `cc.headline`, `cc.safe.disclaimer` and one untagged `progress-dot`. It is the hardcoded template for M1 and will serve as a fixture for M2 and M3. Replace with a real After Effects export when one exists.
- `npm run render:standin` (was `render:m0`) renders it server-side to `media/renders/m1-standin.mp4`.
- 15 tests across 5 files. Typecheck and app build clean.

**Verified by eye**

- Server MP4: h264, 1920x1080, 30 fps, 150 frames. Frames 0, 10, 40, 75, 149 extracted and inspected: panel wipes in, bar grows, headline fades up, dot crosses the frame reaching centre at 75 and right edge at 149. Layout matches the authored coordinates, so the Lottie is overlaying the frame, not sitting below it.
- Browser Player: same animation plays over the teal background. Measured in the page: the Lottie SVG's bounding box equals the composition's bounding box exactly; wrapper style is absolute, top 0, left 0, 100% by 100%.

**Notes**

- Text uses Arial by family name; lottie-web falls back to the system font. Fonts are handled properly in M13.
- The dev-server preview pane is flaky at taking screenshots; DOM measurement via script was used alongside.

**Next:** M2, the mutation layer. Not started.

---


## 2026-09-11 · M0 Scaffold · DONE (verified by Josh in browser and MP4)

**What exists now**

- npm workspaces monorepo: `app`, `server`, `composition`, `tools/ingest` (placeholder only).
- `composition` exports the one Remotion composition: `main`, 1920x1080, 30 fps, 150 frames. It draws a solid colour and a frame counter with timecode. `FrameCounter.tsx` is the Remotion wrapper, `FrameCounterView.tsx` is the pure view the unit tests exercise.
- `app`: Vite + React 18 + Tailwind 4. Shows the composition in `<Player>` and a `server: ok` indicator that reaches the API through Vite's `/api` proxy.
- `server`: Fastify 5 with `GET /health`. `npm run render:m0` bundles the composition and renders it with `renderMedia` to `media/renders/m0-frame-counter.mp4`.
- `npm run dev` starts both. `npm run test` runs Vitest across all workspaces (11 tests). `npm run typecheck` and `npm run build -w app` pass.

**Verified by eye**

- Player in the browser shows the counter and plays.
- MP4 probed: h264, 1920x1080, 30/1 fps, 150 frames, 5.0 s. Frames 0, 75, 149 extracted and inspected; counter and timecode are correct.

**Bugs caught by browser verification, not by tests**

- The server honoured the generic `PORT` env var, which the dev-server launcher sets to the app's port. The page said `server: down`. Renamed to `CAMPAIGNCUT_SERVER_PORT`.
- Remotion's bundler (esbuild) breaks under Vitest's jsdom environment. The bundling test is marked `@vitest-environment node`.

**Decisions**

- TypeScript pinned to 5.9, not 7.x. React pinned to 18 per CLAUDE.md. All `@remotion/*` at 4.0.523 exactly.
- Remotion downloads Chrome Headless Shell (113 MB) on first render into `node_modules/.remotion`. Gitignored via `node_modules`.

**Next:** M1, Lottie on screen. Not started.
