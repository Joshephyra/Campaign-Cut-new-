# START-HERE.md

Your guide, not Claude Code's. Every command below is labeled with which window to type it in.

Two windows matter:

- **PowerShell** is the black or blue terminal window in Windows. Open it with the Start menu, type `powershell`, press Enter.
- **Claude Code** is where you talk to Claude about the code. You start it from inside PowerShell.

---

## Part 1 · One-time setup

You only do this once. If you already have some of these, skip that step.

### 1.1 Install Node

Node is what runs the app.

**PowerShell:**
```powershell
winget install OpenJS.NodeJS.LTS
```

Close PowerShell completely, then open a new one. Check it worked:

**PowerShell:**
```powershell
node --version
```

You want a number starting with 20 or higher. If you get an error saying node is not recognized, restart your computer and try again.

### 1.2 Install Git

Git is what saves versions of your code and talks to GitHub.

**PowerShell:**
```powershell
winget install Git.Git
```

Close PowerShell, open a new one, then check:

**PowerShell:**
```powershell
git --version
```

### 1.3 Tell Git who you are

Use the same email as your GitHub account.

**PowerShell:**
```powershell
git config --global user.name "Josh Owen"
git config --global user.email "josh@frameitforwardproductions.com"
```

### 1.4 Install FFmpeg

FFmpeg handles the video processing.

**PowerShell:**
```powershell
winget install Gyan.FFmpeg
```

Close PowerShell, open a new one, then check:

**PowerShell:**
```powershell
ffmpeg -version
```

You will see a wall of text. That is correct.

### 1.5 Install Claude Code

**PowerShell:**
```powershell
npm install -g @anthropic-ai/claude-code
```

---

## Part 2 · Make the project

### 2.1 Create the folder

**PowerShell:**
```powershell
mkdir $env:USERPROFILE\dev\campaigncut
cd $env:USERPROFILE\dev\campaigncut
```

`mkdir` makes a folder. `cd` moves you into it. From now on, every PowerShell command assumes you are inside this folder.

If you close PowerShell and come back later, get back here with:

**PowerShell:**
```powershell
cd $env:USERPROFILE\dev\campaigncut
```

### 2.2 Put the documents in place

Copy the four files from this pack into the folder:

```
campaigncut\
  CLAUDE.md
  docs\SPEC.md
  docs\MILESTONES.md
  docs\AE-AUTHORING.md
```

`CLAUDE.md` goes in the top level. The other three go in a `docs` folder. Make the `docs` folder first:

**PowerShell:**
```powershell
mkdir docs
```

Then drag the files in with File Explorer. `CLAUDE.md` into `campaigncut`, the other three into `campaigncut\docs`.

### 2.3 Start Git

**PowerShell:**
```powershell
git init
git add .
git commit -m "Add build documents"
```

`git init` starts tracking this folder. `git add .` stages everything. `git commit` saves a snapshot.

### 2.4 Put it on GitHub

1. Go to github.com and sign in.
2. Click the **+** in the top right, then **New repository**.
3. Name it `campaigncut`.
4. Set it to **Private**.
5. Do **not** check any of the boxes for README, .gitignore, or license. You already have files.
6. Click **Create repository**.

GitHub shows you a page with commands. You want the two lines under "push an existing repository." They look like this, with your username instead of `YOURNAME`:

**PowerShell:**
```powershell
git remote add origin https://github.com/YOURNAME/campaigncut.git
git branch -M main
git push -u origin main
```

A browser window will open asking you to sign in to GitHub. Do that once and it remembers.

### 2.5 Start Claude Code

**PowerShell:**
```powershell
claude
```

That is it. You are now talking to Claude Code inside your project folder. It can read every file in there.

---

## Part 3 · Running a build session

Do one milestone per session. Do not try to do two.

### Your opening message, every session

Paste this into **Claude Code**, changing the milestone number:

```
Read CLAUDE.md, docs/SPEC.md, and docs/MILESTONES.md.

We are working on M0 only. Do not start M1.

Give me the plan and the test list first. Do not write any code
until I approve the plan.
```

### What should happen

1. Claude reads the documents.
2. Claude gives you a plan and a list of tests.
3. **You read the plan.** If it is building something on the non-goals list, say so. If it is doing more than the milestone, say so.
4. You say "approved, go ahead."
5. Claude writes failing tests, then the code, then gets the tests passing.
6. Claude tells you how to look at it in a browser.
7. **You actually look at it.** Click things. Watch the video.
8. Claude updates `STATUS.md`.
9. Claude commits and pushes.

### Your closing message, every session

Paste this into **Claude Code**:

```
Update STATUS.md, mark this milestone DONE in docs/MILESTONES.md,
commit, and push to GitHub. Then tell me what M<next> will involve
so I know what to expect.
```

### If you need to check it pushed

**PowerShell:** (open a second PowerShell window, leave Claude Code running in the first)
```powershell
cd $env:USERPROFILE\dev\campaigncut
git status
```

If it says "nothing to commit, working tree clean" and "Your branch is up to date with 'origin/main'," you are good. If it says anything about commits ahead, tell Claude Code to push.

---

## Part 4 · Things that will go wrong

**"npm is not recognized"** or **"git is not recognized"**
You did not restart PowerShell after installing. Close it fully and open a new one. If that fails, restart the computer.

**A command hangs and nothing happens**
Press `Ctrl` and `C` together. That cancels it.

**Claude Code starts building something on the non-goals list**
Say: *"That is on the non-goals list in CLAUDE.md. Stop and tell me why you think it is required."* Do not let it continue. This is exactly how the last build was lost.

**Claude Code says the tests pass and moves on**
Ask: *"Did you verify this in a browser? Show me what you saw."* Green tests missed three real bugs in the previous build.

**You are not sure what a command does**
Ask Claude Code before running it. That is a good use of the tool.

**Something is broken and you cannot tell why**
Paste the entire error, all of it, into Claude Code. Do not summarize it or trim it. The part that looks like noise is usually the part that matters.

---

## Part 5 · The order of operations

Before any of this matters, you need the fidelity answer.

1. Build the representative template in After Effects. Hard, not simple.
2. Germain reviews it.
3. Run M0, M1, and M2. That is the smallest thing that can answer the question.
4. Load the real template. Compare against `reference.mp4` side by side.
5. **Germain makes the call.**

If the answer is good, keep going through the milestones. If the answer is bad, stop and come back to me before building anything else. Everything downstream of M2 assumes Lottie carries the design, and there is no point building an editor for a pipeline that does not work.

That is the whole reason M1 and M2 come first.
