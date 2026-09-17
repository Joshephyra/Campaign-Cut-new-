#!/usr/bin/env node
/*
  CampaignCut: run one ExtendScript in After Effects with nobody at the
  keyboard (M38). The pattern that works on Josh's machine, written down
  once instead of typed each time:

    1. After Effects must not be running (it is never killed from here).
    2. Launch AfterFX.exe with no project and wait until its window title
       says "Untitled".
    3. Send the script with `AfterFX.exe -s "..."`, setting $.__ccQuiet so
       nothing pops up, and $.__ccConfig when a config file is given.
    4. Watch the script's log for its done line (or FAILED / ERROR).
    5. Wait for After Effects to quit, which the script does itself.

  Usage:
    node tools/ae-preflight/run-unattended.mjs --script tools/ae-preflight/starter-pack.jsx --log "C:/Users/me/Desktop/starter-pack/starter-pack.log" --done BUILT
    node tools/ae-preflight/run-unattended.mjs --script tools/ae-preflight/bodymovin-export.jsx --config "C:/.../export-config.jsx" --log "C:/.../bodymovin-export.log" --done "ALL DONE"

  Options: --ae <AfterFX.exe path> (default: After Effects 2026), --timeout <seconds> (default 600),
  --attach (use an After Effects that is already open on an empty project instead of launching one).
  Exit code 0 when the done line appeared and After Effects quit; 3 when the script finished but After
  Effects stayed open (a person closes it with File > Exit); 1 otherwise, with the log's tail printed.
*/
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt;
};
const script = opt('--script');
const logPath = opt('--log');
const done = opt('--done', 'ALL DONE');
const config = opt('--config');
const ae = opt('--ae', 'C:\\Program Files\\Adobe\\Adobe After Effects 2026\\Support Files\\AfterFX.exe');
const timeoutMs = Number(opt('--timeout', '600')) * 1000;
const attach = args.includes('--attach');

if (!script || !logPath) {
  console.error('usage: run-unattended.mjs --script <file.jsx> --log <log file the script writes> [--done <line>] [--config <config.jsx>] [--timeout <seconds>]');
  process.exit(2);
}
if (!fs.existsSync(ae)) {
  console.error(`After Effects not found at ${ae}`);
  process.exit(2);
}
const scriptAbs = path.resolve(script).replace(/\\/g, '/');
const configAbs = config ? path.resolve(config).replace(/\\/g, '/') : '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// tasklist rather than Get-Process: PowerShell exits 1 when no process matches, and the title is in the last CSV column.
const aeProcesses = () => {
  const out = execFileSync('tasklist.exe', ['/V', '/FI', 'IMAGENAME eq AfterFX.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
  return out
    .split(/\r?\n/)
    .filter((l) => l.startsWith('"AfterFX.exe"'))
    .map((l) => {
      const cells = l.split('","').map((c) => c.replace(/^"|"$/g, ''));
      return { id: cells[1], title: cells[cells.length - 1] };
    });
};
const tail = () => (fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/).slice(-12).join('\n') : '(no log yet)');
const say = (s) => console.log(`[run-unattended] ${s}`);

const started = Date.now();
const timeLeft = () => timeoutMs - (Date.now() - started);

// 1. Never two instances, never a kill: a running After Effects is the person's.
const running = aeProcesses();
if (running.length > 0 && !attach) {
  console.error('After Effects is already running. Close it (File > Exit) and run this again, or pass --attach when it sits on an empty project; it is never closed from here.');
  process.exit(1);
}
if (attach && running.length === 0) say('nothing to attach to; launching instead');
// The log is the script's own; a stale one from the last run must not count.
if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

// 2. Launch fresh (unless attaching) and wait for the empty project.
if (running.length === 0) {
  say(`launching ${ae}`);
  spawn(ae, [], { detached: true, stdio: 'ignore' }).unref();
} else {
  say(`attaching to the open After Effects ("${running[0].title}")`);
}
// An attached instance may still hold the last script's project; every script opens its own, so no wait.
let ready = attach && running.length > 0;
while (!ready && timeLeft() > 0) {
  await sleep(2000);
  const procs = aeProcesses();
  if (procs.some((p) => /Untitled/i.test(p.title))) {
    ready = true;
    break;
  }
  if (procs.some((p) => /Crash|Repair|Recover/i.test(p.title))) {
    console.error('After Effects is showing a dialog that needs a person (its title mentions crash repair or recovery). Click through it, close After Effects, and run this again.');
    process.exit(1);
  }
}
if (!ready) {
  console.error('After Effects did not reach an empty project in time; leaving it open for a person to look at.');
  process.exit(1);
}
say('After Effects is up with an empty project');

// 3. Send the script.
const code = `$.__ccQuiet = true;${configAbs ? ` $.__ccConfig = '${configAbs}';` : ''} $.evalFile(new File('${scriptAbs}'));`;
say(`sending ${path.basename(scriptAbs)}${configAbs ? ` with ${path.basename(configAbs)}` : ''}`);
try {
  execFileSync(ae, ['-s', code], { stdio: 'ignore', timeout: 60000 });
} catch (err) {
  // The -s hand-off returns as soon as the running instance takes the script; a non-zero exit is not a failure by itself.
  say(`hand-off returned ${err && err.status !== undefined ? err.status : 'with a signal'}; watching the log`);
}

// 4. Watch the log.
const doneRe = new RegExp(done.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
let outcome = 'timeout';
while (timeLeft() > 0) {
  await sleep(2000);
  if (!fs.existsSync(logPath)) continue;
  const text = fs.readFileSync(logPath, 'utf8');
  if (doneRe.test(text)) {
    outcome = 'done';
    break;
  }
  if (/^(FAILED|ERROR)/m.test(text)) {
    outcome = 'failed';
    break;
  }
}
if (outcome !== 'done') {
  console.error(`${outcome === 'failed' ? 'The script failed' : 'No done line in time'}. Log tail:\n${tail()}`);
  console.error('After Effects is left open for a person to look at; it is never closed from here.');
  process.exit(1);
}
say(`done line seen: "${done}"`);

// 5. Wait for the script's own quit.
let quit = false;
const quitBy = Date.now() + Math.min(Math.max(timeLeft(), 30000), 120000);
while (Date.now() < quitBy) {
  await sleep(2000);
  if (aeProcesses().length === 0) {
    quit = true;
    break;
  }
}
if (!quit) {
  console.error('The script finished but After Effects has not quit. Close it (File > Exit), or pass --attach to the next run while it sits on an empty project.');
  console.log(tail());
  process.exit(3);
}
say('After Effects quit cleanly');
console.log(tail());
