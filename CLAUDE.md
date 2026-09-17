# CLAUDE.md

Read this file at the start of every session. These rules override your defaults.

---

## What this project is

CampaignCut is a browser-based video editor for political and advocacy ads.

A motion designer builds a template in After Effects. That template is ingested automatically into this app. A campaign staffer who is not a designer opens it, types their own copy, drops in their own footage, and exports a broadcast-spec MP4. The design quality is the product. The user gets a narrow, safe set of controls and cannot break the animation.

**This build is a proof of concept.** It exists to answer one question:

> Can an After Effects template be ingested automatically, edited by a non-designer without breaking, played back smoothly in a browser, and exported at full resolution matching what they saw?

Everything you build serves that question. Nothing else is in scope.

---

## Prime directive: one composition, two runners

There is exactly **one** Remotion composition. It renders both the preview and the export. The only difference between them is a prop:

- **Preview** is rendered by `<Player>`, pointed at a low-resolution proxy of the user's footage.
- **Export** is rendered by `renderMedia`, pointed at the original footage.

Never fork the render path. Never add a preview-only branch. Never write `if (isPreview)` inside the composition. Every divergence between the two is a bug where the user's export does not match what they approved, and that is the failure mode that kills products like this.

The `composition/` package is imported by both the frontend and the render worker. Enforce this with the module graph, not with discipline.

---

## Non-goals: do not build these

This list is a contract. The previous version of this project died by building this list instead of the product.

- Authentication, accounts, logins, password resets, email verification
- Users, roles, permissions, teams, invitations
- Workspaces, multi-tenancy, row-level security
- Billing, subscriptions, usage metering
- The FEC compliance rule engine. The legally required disclaimer is an ordinary editable text field in a locked safe zone. Nothing validates it.
- Audit logging
- Cloud object storage, S3, MinIO, CDN
- Mobile support or responsive layout below laptop width
- Automatic reflow across aspect ratios. Build 16:9 only.
- Real-time collaboration

If the app needs to be reachable on the public internet for a demo, put a single shared password in an env var behind one piece of middleware. That is the entire security model and it is deliberate.

**If you believe something on this list is genuinely required to pass a milestone, stop and say so. Do not build it quietly.**

### Opened on 2026-09-17 (Josh's decision, before the five acceptance tests are closed)

These were non-goals for the proof of concept. Josh chose to start them; they are built in the numbered milestones, one at a time, and the five acceptance tests are still owed on the way.

- An element library: every tagged element of every ingested template, typed (lower third, caption, callout, overlay, background, end card, disclaimer, and so on), addable to any spot.
- Overall style updates and saved themes across a spot.
- Client profiles (a brand guide: logo, colours, fonts, disclaimer) that a spot belongs to. An agency keeps several. This is a record, not an account: still no users, roles or logins.
- Stock footage from one stock site's API, with the key in an environment variable.

---

## Locked stack

Do not substitute. If you think something here is wrong, say so before writing code, not during.

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere. Node 20+. No Go, no Python services. |
| Frontend | React 18, Vite, Tailwind |
| Rendering | Remotion, `@remotion/lottie`, `@remotion/transitions`, `@remotion/player` |
| Server | Node with Fastify. One process. |
| Database | SQLite via `better-sqlite3` |
| Storage | Local filesystem behind a static route |
| Media | FFmpeg and ffprobe via child process |
| Jobs | In-process queue. One render at a time. |
| Tests | Vitest |

---

## Repo layout

```
/app                 React editor (Vite)
/server              Fastify API, render worker, FFmpeg wrappers
/composition         The one Remotion composition. Imported by app AND server.
/tools/ingest        The After Effects to template CLI
/tools/ae-preflight  The .jsx pre-flight script that runs inside After Effects
/templates           Ingested templates: lottie json, assets, generated schema
/media               Uploads, proxies, thumbnails, renders (gitignored)
/docs                SPEC.md, MILESTONES.md, AE-AUTHORING.md, DESIGN.md
```

---

## Session workflow

Every session follows this. No exceptions.

1. **Read** `docs/MILESTONES.md` and find the current milestone. Read `docs/SPEC.md` for the section it references.
2. **Plan.** Write the plan and the test list. Show it to Josh. Wait for approval. Do not write code before the plan is approved.
3. **Red.** Write the tests. Run them. They fail.
4. **Green.** Write the implementation until they pass.
5. **Verify in a browser.** Actually open it. Actually click it. Actually watch the video.
6. **Update** `STATUS.md` with what changed and what is next.
7. **Commit and push.** Josh forgets to push. Remind him every single time, and do it yourself when you can.

### Browser verification is not optional

Three real bugs in the previous build passed a fully green test suite and were caught only by opening a browser. Both of the worst ones are now regression tests you should write early:

- **The positioning bug.** Ingested designs rendered *below* the video frame instead of overlaying it. The fix is a full-frame absolutely positioned wrapper around the Lottie layer.
- **The missing-export bug.** Ingested designs were absent from exports entirely. The render process fetched media over HTTP and a missing CORS header on the media endpoint caused a silent failure. Preview was fine because it ran in a browser with different origin rules.

A milestone is not done until a human has watched the actual output. For export milestones that means watching the actual exported file, not asserting on its existence.

---

## Standing rules

- **No secrets in source.** Everything from environment variables. `.env` is gitignored. No keys as literals, ever.
- **No `eval` and no `new Function`** in template or element code. It caused CSP violations before.
- **Positions are fractions of the frame**, never hardcoded pixel values. This costs nothing now and is what makes multi-format possible later.
- **No building ahead.** If work belongs to a later milestone, note it and stop. Do not helpfully add it.
- **Fail loudly.** An invalid template is rejected with a message naming the specific offending layer. Silent degradation is the enemy. A designer must never discover at export time that a layer they tagged did nothing.
- **Small commits, real messages.** One milestone may be several commits.

---

## Who you are talking to

Josh is the product owner and orchestrator. He is new to the terminal and to GitHub. He is not a professional engineer.

- Give exact commands, and label which window they go in: **Windows PowerShell** or **Claude Code prompt**.
- Explain what a command does before he runs it, in one line.
- When something breaks, tell him what you are going to do about it rather than asking him to diagnose it.
- Do not assume he knows a tool. Do assume he understands the product deeply and will catch you if the design is wrong.

Germain McCarthy is the design partner. He does not touch the code. He reviews templates and makes the call on whether a template survived the trip from After Effects.

---

## Definition of done for the whole build

Five acceptance tests. All five must pass on the same template, in the same session, with a human watching.

- **AT-1 Ingest.** One command turns a Bodymovin export into a working editable template. No bespoke code per design.
- **AT-2 Fidelity.** The app's render is acceptable against the After Effects reference, judged by Germain.
- **AT-3 Editing.** Someone who has never used the tool changes text, a color, the logo, the disclaimer, and the footage, and sees each change live.
- **AT-4 Playback.** Scrubbing and playback at preview resolution are smooth on a normal laptop.
- **AT-5 Export parity.** The exported MP4 matches the preview. Same frames, same text, same colors, same timing.
