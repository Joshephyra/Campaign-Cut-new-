# STATUS.md

Running log of where the build is. Newest entry first.

---

## 2026-09-11 · M0 Scaffold · DONE pending Josh's own browser check

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
