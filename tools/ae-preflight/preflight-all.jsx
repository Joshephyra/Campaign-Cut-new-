/*
  CampaignCut: run preflight.jsx over every comp of a project, unattended.

  Usage (from a shell):
    AfterFX.exe -r "tools/ae-preflight/preflight-all.jsx"

  It opens the project named in PROJECT below (or uses the one already open
  when PROJECT is empty), makes each comp active in turn, runs preflight.jsx
  on it with alerts silenced, and writes preflight-all.log in the project's
  folder as it goes, so a stalled run still leaves a trace. It changes
  nothing in the project.
*/

var PROJECT = 'C:/Users/josho/Desktop/contrast-30/contrast-30.aep';
var LOG_DIR = 'C:/Users/josho/Desktop/contrast-30';

(function () {
  var lines = [];
  var logFile = new File(LOG_DIR + '/preflight-all.log');
  function log(s) {
    lines.push(s);
    logFile.encoding = 'UTF-8';
    logFile.open('w');
    logFile.write(lines.join('\n') + '\n');
    logFile.close();
  }

  try {
    log('started ' + new Date().toString());
    var scriptFile = new File($.fileName);
    log('script: ' + scriptFile.fsName);
    var preflight = new File(scriptFile.parent.fsName + '/preflight.jsx');
    log('preflight.jsx exists: ' + preflight.exists);

    if (PROJECT) {
      var f = new File(PROJECT);
      if (!f.exists) {
        log('Project not found: ' + PROJECT);
        return;
      }
      var open = app.project.file ? app.project.file.fsName : '(none)';
      log('project open now: ' + open);
      if (!app.project.file || app.project.file.fsName !== f.fsName) {
        app.open(f);
        log('opened ' + f.fsName);
      }
    }

    /* Silence the per-comp summary box so the run needs no clicks. */
    var realAlert = alert;
    alert = function () {};

    var count = 0;
    for (var i = 1; i <= app.project.numItems; i++) {
      var item = app.project.item(i);
      if (!(item instanceof CompItem)) continue;
      item.openInViewer();
      try {
        $.evalFile(preflight);
        count++;
        log('Checked comp "' + item.name + '"');
      } catch (err) {
        log('FAILED on comp "' + item.name + '": ' + err);
      }
    }

    alert = realAlert;
    log(count + ' comp(s) checked. Reports are the preflight-*.txt files in this folder.');
  } catch (outer) {
    log('ERROR: ' + outer + (outer.line ? ' (line ' + outer.line + ')' : ''));
  }
})();
