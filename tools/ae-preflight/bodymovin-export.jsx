/*
  CampaignCut: export comps with Bodymovin, unattended.

  Usage (from a shell, After Effects installed with the Bodymovin extension):
    AfterFX.exe -r "tools/ae-preflight/bodymovin-export.jsx"

  Bodymovin is a panel, but its whole exporter lives in ExtendScript files
  under the extension folder, loaded by its initializer.jsx. This script
  loads them the same way, stands in for the panel where the exporter
  talks back to it (font data, progress events), and renders the comps
  named in EXPORTS one after another. Every step is written to
  bodymovin-export.log next to the project; a final line "ALL DONE" or
  "FAILED ..." says how it ended.

  It uses the same export settings a person would tick in the panel for a
  CampaignCut template: standard JSON, real text (no glyph shapes), image
  files kept with their original names in an images/ folder.
*/

/*
  M38: $.__ccConfig may name a config file (a .jsx declaring
  var CC_CONFIG = { project, logDir, exports: [{ comp, destination }] }),
  as the starter pack builder writes; without it the sample's paths apply.
*/
var CC_CONFIG = null;
if (typeof $.__ccConfig === 'string' && $.__ccConfig) $.evalFile(new File($.__ccConfig));
var PROJECT = CC_CONFIG ? CC_CONFIG.project : 'C:/Users/josho/Desktop/contrast-30/contrast-30.aep';
var LOG_DIR = CC_CONFIG ? CC_CONFIG.logDir : 'C:/Users/josho/Desktop/contrast-30';
var BODYMOVIN_DIR = 'C:/Program Files (x86)/Common Files/Adobe/CEP/extensions/bodymovin';
var EXPORTS = CC_CONFIG ? CC_CONFIG.exports : [
  { comp: 'Open', destination: 'C:/Users/josho/Desktop/contrast-30/01-open/data.json' },
  { comp: 'Lower third', destination: 'C:/Users/josho/Desktop/contrast-30/02-lower-third/data.json' },
  { comp: 'Stat callout', destination: 'C:/Users/josho/Desktop/contrast-30/03-stat/data.json' },
  { comp: 'End card', destination: 'C:/Users/josho/Desktop/contrast-30/04-end-card/data.json' }
];
/* Bodymovin's "ascent" for a font is a percentage of the size; Arial is close to this. */
var FONT_ASCENT = 71.6;
var QUIT_WHEN_DONE = true;

var CC_BM = (function () {
  var lines = [];
  var logFile = new File(LOG_DIR + '/bodymovin-export.log');
  function log(s) {
    lines.push(s);
    logFile.encoding = 'UTF-8';
    logFile.open('w');
    logFile.write(lines.join('\n') + '\n');
    logFile.close();
  }

  function settings() {
    return {
      segmented: false,
      segmentedTime: 10,
      standalone: false,
      avd: false,
      glyphs: false,
      bundleFonts: false,
      inlineFonts: false,
      hiddens: false,
      original_assets: true,
      original_names: true,
      should_encode_images: false,
      should_compress: false,
      should_skip_images: false,
      should_include_av_assets: false,
      compression_rate: 80,
      extraComps: { active: false, list: [] },
      guideds: false,
      ignore_expression_properties: false,
      export_old_format: false,
      use_source_names: false,
      shouldTrimData: false,
      skip_default_properties: false,
      not_supported_properties: false,
      pretty_print: false,
      export_mode: 'standard',
      export_modes: { standard: true, demo: false, standalone: false, banner: false, avd: false, smil: false, rive: false, reports: false },
      demoData: { backgroundColor: '#ffffff' },
      expressions: { shouldBake: false, shouldCacheExport: false, shouldBakeBeyondWorkArea: false, sampleSize: 1 },
      audio: { isEnabled: false, shouldRaterizeWaveform: false, bitrate: 128 },
      metadata: { includeFileName: false, customProps: [] }
    };
  }

  return { log: log, settings: settings };
})();

(function () {
  var log = CC_BM.log;
  var current = -1;

  try {
    log('started ' + new Date().toString());

    /* No pop-ups: Bodymovin alerts when the panel bridge is missing; that is expected here. */
    alert = function (m) { log('alert suppressed: ' + m); };

    var f = new File(PROJECT);
    if (!f.exists) {
      log('FAILED project not found: ' + PROJECT);
      return;
    }
    if (!app.project.file || app.project.file.fsName !== f.fsName) {
      app.open(f);
      log('opened ' + f.fsName);
    }

    var init = new File(BODYMOVIN_DIR + '/jsx/initializer.jsx');
    if (!init.exists) {
      log('FAILED Bodymovin not found at ' + BODYMOVIN_DIR);
      return;
    }
    $.evalFile(init);
    log('Bodymovin scripts loaded (' + $.__bodymovin.bm_versionHelper.get() + ')');

    var bm = $.__bodymovin;

    /* Stand in for the panel. */
    bm.bm_eventDispatcher.sendEvent = function (type, data) {
      if (type === 'bm:render:update') {
        if (data && data.message) log('  ' + data.message + (data.progress !== undefined ? ' (' + Math.round(data.progress * 100) + '%)' : ''));
        if (data && data.isFinished === true) {
          log('finished ' + data.fsPath);
          $.__ccNext();
        } else if (data && data.isFinished === false) {
          log('FAILED render of ' + EXPORTS[current].comp + ': ' + data.message);
        }
      } else if (type === 'bm:render:fonts') {
        var list = [];
        for (var i = 0; i < data.fonts.length; i++) {
          list.push({ fName: data.fonts[i].name, fFamily: data.fonts[i].family, fStyle: data.fonts[i].style, ascent: FONT_ASCENT });
          log('  font ' + data.fonts[i].name + ' (' + data.fonts[i].family + ', ' + data.fonts[i].style + ')');
        }
        $.__ccFontData = { list: list };
        app.scheduleTask('$.__bodymovin.bm_renderManager.setFontData($.__ccFontData);', 20, false);
      } else if (type === 'bm:image:process') {
        /* The panel would compress or inline the image here; we keep the original file, so just say "unchanged". */
        log('  image kept: ' + (data && data.path ? data.path : ''));
        app.scheduleTask('$.__bodymovin.bm_sourceHelper.imageProcessed(false);', 20, false);
      } else if (type === 'bm:alert') {
        log('  Bodymovin says: ' + (data && data.message ? data.message : data));
      } else if (type === 'console:log') {
        log('  log: ' + data);
      } else if (type === 'bm:report:saved' || type === 'bm:render:start') {
        /* quiet */
      } else {
        log('  event ' + type);
      }
    };
    bm.bm_eventDispatcher.log = function (d) { log('  log: ' + d); };
    bm.bm_eventDispatcher.alert = function (m) { log('  Bodymovin alert: ' + m); };

    function compNamed(name) {
      var comps = bm.bm_projectManager.getCompositions();
      for (var i = 0; i < comps.length; i++) {
        if (comps[i].name === name) return comps[i];
      }
      return null;
    }

    $.__ccNext = function () {
      current += 1;
      if (current >= EXPORTS.length) {
        log('ALL DONE ' + new Date().toString());
        /* Quit cleanly so the next launch starts fresh with no crash dialog; nothing in the project is worth saving. */
        if (QUIT_WHEN_DONE) app.scheduleTask('app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); app.quit();', 1000, false);
        return;
      }
      var job = EXPORTS[current];
      var comp = compNamed(job.comp);
      if (!comp) {
        log('FAILED no comp named "' + job.comp + '"');
        return;
      }
      var dest = new File(job.destination);
      log('exporting "' + job.comp + '" -> ' + dest.fsName);
      bm.bm_compsManager.renderComposition({
        id: comp.id,
        name: comp.name,
        absoluteURI: dest.absoluteURI,
        destination: dest.fsName,
        settings: CC_BM.settings()
      });
    };

    $.__ccNext();
  } catch (err) {
    log('FAILED ' + err + (err.line ? ' (line ' + err.line + ')' : ''));
  }
})();
