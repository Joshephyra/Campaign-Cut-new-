/*
  CampaignCut starter element pack builder (M38)

  Run inside After Effects (File > Scripts > Run Script File), or unattended:
    node tools/ae-preflight/run-unattended.mjs --script tools/ae-preflight/starter-pack.jsx

  It builds, from nothing, the "Starter pack": nineteen tagged comps, one per
  element, covering every type the library offers, at the lengths a spot
  adds up from (M52): openings at 5 s and 3 s, proof points at 6 s and 4 s,
  end cards at 7 s and 4 s, so a :30 is 5 + 6 + 6 + 6 + 7 and a :15 is
  3 + 4 + 4 + 4. Lower thirds, headlines, captions, callouts, bars and
  disclaimers sit on those. The handover folder on the Desktop gets numbered
  sub-folders, fonts/ (Arial Regular, Arial Bold and Arial Narrow Bold
  copied from Windows with clean names), an elements.json marked
  libraryOnly (the pack feeds the picker; nobody starts a spot from it), an
  export-config.jsx for bodymovin-export.jsx, and the saved project. A
  master comp lays every element end to end for the reference render.

  ExtendScript is ES3: var only, no arrow functions, no JSON. The PLAN is
  plain data so tools/ingest/src/starterPack.test.ts can check it against
  the ingest's rules without After Effects.
*/

var CC_PACK = (function () {
  var W = 1920;
  var H = 1080;
  var FPS = 30;

  /* Colours as [r, g, b] in 0..1. Only cc.accent and cc.surface are recoloured by the user. */
  var INK = [0.06, 0.09, 0.16];
  var NAVY = [0.06, 0.09, 0.16];
  var BLUE = [0.18, 0.42, 1.0];
  var BLACK = [0.02, 0.03, 0.06];
  var WHITE = [1, 1, 1];
  var GREY = [0.72, 0.75, 0.8];
  var SLOT = [0.2, 0.2, 0.2];

  var HEAD = 'ArialNarrow-Bold';
  var BOLD = 'Arial-BoldMT';
  var TEXT = 'ArialMT';

  /*
    Each comp: slug, name, type, folder, seconds, layers bottom to top.
      shape  { name, rect: [x, y, w, h], fill, radius?, opacity?, anchor?: 'center', anim? }
      solid  { name, rect, color, opacity? }
      text   { name, text, font, size, box: [w, h], pos: [x, y], color, align?: 'center' | 'right', anim? }
      image  { name, file: 'logo', pos: [x, y], scale }
    anim (seconds): fadeIn [from, to], fadeOut [from, to], slideX [px, from, to],
    slideY [px, from, to], scaleX [from, to], pop [from, to] (scale up with a fade).
  */
  var PLAN = {
    width: W,
    height: H,
    fps: FPS,
    background: INK,
    folderName: 'starter-pack',
    name: 'Starter pack',
    adType: 'Library',
    fonts: [
      { from: 'arial.ttf', to: 'Arial-Regular.ttf' },
      { from: 'arialbd.ttf', to: 'Arial-Bold.ttf' },
      { from: 'ARIALNB.TTF', to: 'ArialNarrow-Bold.ttf' }
    ],
    comps: [
      {
        slug: 'opening', name: 'Opening', type: 'open', folder: '01-opening', seconds: 5,
        layers: [
          { kind: 'solid', name: 'cc.mediaFill', rect: [0, 0, 1920, 1080], color: SLOT },
          { kind: 'shape', name: 'shade', rect: [0, 620, 1920, 460], fill: BLACK, opacity: 60, anim: { fadeIn: [0, 0.4] } },
          { kind: 'shape', name: 'cc.accent', rect: [160, 690, 180, 14], fill: BLUE, anim: { scaleX: [0.2, 0.7] } },
          { kind: 'text', name: 'cc.headline', text: 'A NEW DIRECTION FOR OUR STATE', font: HEAD, size: 116, box: [1600, 300], pos: [160, 730], color: WHITE, anim: { fadeIn: [0.3, 0.9], slideY: [50, 0.3, 0.9] } }
        ]
      },
      {
        slug: 'opening-short', name: 'Short opening', type: 'open', folder: '02-opening-short', seconds: 3,
        layers: [
          { kind: 'solid', name: 'cc.mediaFill', rect: [0, 0, 1920, 1080], color: SLOT },
          { kind: 'shape', name: 'shade', rect: [0, 620, 1920, 460], fill: BLACK, opacity: 60, anim: { fadeIn: [0, 0.3] } },
          { kind: 'shape', name: 'cc.accent', rect: [160, 690, 180, 14], fill: BLUE, anim: { scaleX: [0.1, 0.5] } },
          { kind: 'text', name: 'cc.headline', text: 'A NEW DIRECTION', font: HEAD, size: 116, box: [1600, 300], pos: [160, 730], color: WHITE, anim: { fadeIn: [0.2, 0.6], slideY: [50, 0.2, 0.6] } }
        ]
      },
      {
        slug: 'headline', name: 'Headline', type: 'headline', folder: '03-headline', seconds: 4,
        layers: [
          { kind: 'shape', name: 'cc.accent', rect: [160, 690, 180, 14], fill: BLUE, anim: { scaleX: [0.2, 0.7], fadeOut: [3.6, 4] } },
          { kind: 'text', name: 'cc.headline', text: 'LOWER COSTS. HIGHER WAGES.', font: HEAD, size: 116, box: [1600, 300], pos: [160, 730], color: WHITE, anim: { fadeIn: [0.3, 0.9], slideY: [50, 0.3, 0.9], fadeOut: [3.6, 4] } }
        ]
      },
      {
        slug: 'lower-third-bar', name: 'Bar lower third', type: 'lower-third', folder: '04-lower-third-bar', seconds: 5,
        layers: [
          { kind: 'shape', name: 'cc.surface', rect: [120, 860, 980, 130], fill: NAVY, anim: { slideX: [-1200, 0, 0.5], fadeOut: [4.5, 5] } },
          { kind: 'shape', name: 'cc.accent', rect: [120, 860, 14, 130], fill: BLUE, anim: { slideX: [-1200, 0, 0.5], fadeOut: [4.5, 5] } },
          { kind: 'text', name: 'cc.subhead', text: 'Jane Example', font: BOLD, size: 48, box: [900, 60], pos: [170, 876], color: WHITE, anim: { fadeIn: [0.3, 0.7], fadeOut: [4.5, 5] } },
          { kind: 'text', name: 'cc.body', text: 'Candidate for State Senate', font: TEXT, size: 32, box: [900, 44], pos: [170, 936], color: GREY, anim: { fadeIn: [0.5, 0.9], fadeOut: [4.5, 5] } }
        ]
      },
      {
        slug: 'lower-third-stack', name: 'Stacked lower third', type: 'lower-third', folder: '05-lower-third-stack', seconds: 5,
        layers: [
          { kind: 'shape', name: 'cc.accent', rect: [120, 820, 700, 80], fill: BLUE, anim: { scaleX: [0, 0.4], fadeOut: [4.5, 5] } },
          { kind: 'text', name: 'cc.subhead', text: 'JANE EXAMPLE', font: HEAD, size: 60, box: [660, 70], pos: [140, 826], color: WHITE, anim: { fadeIn: [0.3, 0.6], fadeOut: [4.5, 5] } },
          { kind: 'shape', name: 'cc.surface', rect: [120, 900, 900, 80], fill: NAVY, anim: { scaleX: [0.2, 0.6], fadeOut: [4.5, 5] } },
          { kind: 'text', name: 'cc.body', text: 'Voted to protect Social Security', font: TEXT, size: 34, box: [860, 48], pos: [140, 916], color: WHITE, anim: { fadeIn: [0.5, 0.9], fadeOut: [4.5, 5] } }
        ]
      },
      {
        slug: 'caption-boxed', name: 'Boxed caption', type: 'caption', folder: '06-caption-boxed', seconds: 4,
        layers: [
          { kind: 'shape', name: 'cc.surface', rect: [360, 900, 1200, 110], fill: BLACK, opacity: 85, anim: { fadeIn: [0, 0.3], fadeOut: [3.6, 4] } },
          { kind: 'shape', name: 'cc.accent', rect: [360, 900, 1200, 6], fill: BLUE, anim: { scaleX: [0, 0.4], fadeOut: [3.6, 4] } },
          { kind: 'text', name: 'cc.body', text: "She'll fight to bring costs down.", font: TEXT, size: 40, box: [1120, 60], pos: [400, 926], color: WHITE, align: 'center', anim: { fadeIn: [0.2, 0.5], fadeOut: [3.6, 4] } }
        ]
      },
      {
        slug: 'caption-pop', name: 'Pop-on caption', type: 'caption', folder: '07-caption-pop', seconds: 3,
        layers: [
          { kind: 'shape', name: 'cc.accent', rect: [520, 460, 880, 160], fill: BLUE, anchor: 'center', anim: { pop: [0, 0.35], fadeOut: [2.6, 3] } },
          { kind: 'text', name: 'cc.headline', text: 'LOWER COSTS', font: HEAD, size: 104, box: [840, 130], pos: [540, 476], color: WHITE, align: 'center', anim: { pop: [0.05, 0.4], fadeOut: [2.6, 3] } }
        ]
      },
      {
        slug: 'callout', name: 'Callout', type: 'callout', folder: '08-callout', seconds: 4,
        layers: [
          { kind: 'shape', name: 'cc.surface', rect: [1180, 120, 620, 250], fill: NAVY, anim: { slideX: [760, 0, 0.5], fadeOut: [3.5, 4] } },
          { kind: 'shape', name: 'cc.accent', rect: [1180, 120, 10, 250], fill: BLUE, anim: { slideX: [760, 0, 0.5], fadeOut: [3.5, 4] } },
          { kind: 'text', name: 'cc.subhead', text: 'THE RECORD', font: HEAD, size: 40, box: [540, 50], pos: [1220, 150], color: GREY, anim: { fadeIn: [0.4, 0.8], fadeOut: [3.5, 4] } },
          { kind: 'text', name: 'cc.body', text: 'Voted against the bill three times in two years', font: TEXT, size: 34, box: [540, 140], pos: [1220, 210], color: WHITE, anim: { fadeIn: [0.5, 0.9], fadeOut: [3.5, 4] } }
        ]
      },
      {
        slug: 'stat-big', name: 'Big stat', type: 'stat', folder: '09-stat-big', seconds: 6,
        layers: [
          { kind: 'shape', name: 'cc.surface', rect: [0, 0, 1920, 1080], fill: NAVY },
          { kind: 'text', name: 'cc.stat.1', text: '$1,200', font: HEAD, size: 320, box: [1600, 340], pos: [160, 250], color: WHITE, anim: { fadeIn: [0.2, 0.8], slideY: [40, 0.2, 0.8] } },
          { kind: 'shape', name: 'cc.accent', rect: [160, 630, 420, 16], fill: BLUE, anim: { scaleX: [0.8, 1.3] } },
          { kind: 'text', name: 'cc.body', text: 'more a year for the average family', font: TEXT, size: 52, box: [1600, 70], pos: [160, 690], color: GREY, anim: { fadeIn: [1.0, 1.5] } }
        ]
      },
      {
        slug: 'stat-pair', name: 'Two stats', type: 'stat', folder: '10-stat-pair', seconds: 6,
        layers: [
          { kind: 'shape', name: 'cc.surface', rect: [0, 0, 1920, 1080], fill: NAVY },
          { kind: 'text', name: 'cc.stat.1', text: '3x', font: HEAD, size: 260, box: [760, 280], pos: [160, 300], color: WHITE, align: 'center', anim: { fadeIn: [0.2, 0.8], slideY: [40, 0.2, 0.8] } },
          { kind: 'shape', name: 'cc.accent', rect: [950, 300, 20, 280], fill: BLUE, anim: { fadeIn: [0.4, 0.8] } },
          { kind: 'text', name: 'cc.stat.2', text: '14%', font: HEAD, size: 260, box: [760, 280], pos: [1000, 300], color: WHITE, align: 'center', anim: { fadeIn: [0.6, 1.2], slideY: [40, 0.6, 1.2] } },
          { kind: 'text', name: 'cc.body', text: 'tax votes, and the rate went up', font: TEXT, size: 48, box: [1600, 64], pos: [160, 640], color: GREY, align: 'center', anim: { fadeIn: [1.0, 1.5] } }
        ]
      },
      {
        slug: 'quote', name: 'Pull quote', type: 'background', folder: '11-quote', seconds: 6,
        layers: [
          { kind: 'solid', name: 'cc.mediaFill', rect: [0, 0, 1920, 1080], color: SLOT },
          { kind: 'shape', name: 'shade', rect: [0, 0, 1920, 1080], fill: BLACK, opacity: 60 },
          { kind: 'shape', name: 'cc.accent', rect: [160, 220, 16, 500], fill: BLUE, anim: { fadeIn: [0.1, 0.5] } },
          { kind: 'text', name: 'cc.headline', text: '"She showed up for us when it counted."', font: BOLD, size: 72, box: [1400, 360], pos: [220, 230], color: WHITE, anim: { fadeIn: [0.3, 0.9] } },
          { kind: 'text', name: 'cc.subhead', text: 'Local news, March 2026', font: TEXT, size: 36, box: [1400, 50], pos: [220, 660], color: GREY, anim: { fadeIn: [0.8, 1.2] } }
        ]
      },
      {
        slug: 'top-bar', name: 'Top bar', type: 'overlay', folder: '12-top-bar', seconds: 4,
        layers: [
          { kind: 'shape', name: 'cc.accent', rect: [0, 0, 1920, 88], fill: BLUE, anim: { slideY: [-100, 0, 0.4], fadeOut: [3.5, 4] } },
          { kind: 'text', name: 'cc.subhead', text: 'BREAKING: NEW VOTING RECORD RELEASED', font: HEAD, size: 48, box: [1800, 60], pos: [60, 14], color: WHITE, anim: { fadeIn: [0.3, 0.6], fadeOut: [3.5, 4] } }
        ]
      },
      {
        slug: 'background-split', name: 'Split background', type: 'background', folder: '13-background-split', seconds: 6,
        layers: [
          { kind: 'solid', name: 'cc.mediaFill', rect: [960, 0, 960, 1080], color: SLOT },
          { kind: 'shape', name: 'cc.surface', rect: [0, 0, 960, 1080], fill: NAVY },
          { kind: 'shape', name: 'cc.accent', rect: [940, 0, 20, 1080], fill: BLUE }
        ]
      },
      {
        slug: 'background-footage', name: 'Footage background', type: 'background', folder: '14-background-footage', seconds: 6,
        layers: [
          { kind: 'solid', name: 'cc.mediaFill', rect: [0, 0, 1920, 1080], color: SLOT },
          { kind: 'shape', name: 'cc.surface', rect: [0, 0, 1920, 1080], fill: NAVY, opacity: 45 }
        ]
      },
      {
        slug: 'background-footage-short', name: 'Short footage background', type: 'background', folder: '15-background-footage-short', seconds: 4,
        layers: [
          { kind: 'solid', name: 'cc.mediaFill', rect: [0, 0, 1920, 1080], color: SLOT },
          { kind: 'shape', name: 'cc.surface', rect: [0, 0, 1920, 1080], fill: NAVY, opacity: 45 }
        ]
      },
      {
        slug: 'end-card-vote', name: 'Vote end card', type: 'end-card', folder: '16-end-card-vote', seconds: 7,
        layers: [
          { kind: 'shape', name: 'cc.surface', rect: [0, 0, 1920, 1080], fill: NAVY },
          { kind: 'text', name: 'cc.headline', text: 'VOTE NOVEMBER 3', font: HEAD, size: 160, box: [1600, 190], pos: [160, 290], color: WHITE, align: 'center', anim: { fadeIn: [0.2, 0.8], slideY: [40, 0.2, 0.8] } },
          { kind: 'shape', name: 'cc.accent', rect: [760, 500, 400, 14], fill: BLUE, anchor: 'center', anim: { pop: [0.6, 1.0] } },
          { kind: 'text', name: 'cc.subhead', text: 'Polls are open 7 am to 8 pm', font: TEXT, size: 48, box: [1600, 64], pos: [160, 550], color: GREY, align: 'center', anim: { fadeIn: [0.8, 1.3] } },
          { kind: 'image', name: 'cc.logo', file: 'logo', pos: [860, 690], scale: 100, anim: { fadeIn: [1.0, 1.5] } },
          { kind: 'text', name: 'cc.safe.disclaimer', text: 'Paid for by Example Committee', font: TEXT, size: 28, box: [1600, 40], pos: [160, 990], color: GREY, align: 'center' }
        ]
      },
      {
        slug: 'end-card-learn', name: 'Learn more end card', type: 'end-card', folder: '17-end-card-learn', seconds: 4,
        layers: [
          { kind: 'solid', name: 'cc.mediaFill', rect: [1056, 0, 864, 1080], color: SLOT },
          { kind: 'shape', name: 'cc.surface', rect: [0, 0, 1056, 1080], fill: NAVY },
          { kind: 'text', name: 'cc.headline', text: 'LEARN MORE', font: HEAD, size: 120, box: [900, 150], pos: [120, 300], color: WHITE, anim: { fadeIn: [0.2, 0.8], slideY: [40, 0.2, 0.8] } },
          { kind: 'shape', name: 'cc.accent', rect: [120, 470, 300, 14], fill: BLUE, anim: { scaleX: [0.6, 1.0] } },
          { kind: 'text', name: 'cc.body', text: 'janeexample.com', font: BOLD, size: 56, box: [900, 72], pos: [120, 520], color: WHITE, anim: { fadeIn: [0.8, 1.3] } },
          { kind: 'image', name: 'cc.logo', file: 'logo', pos: [120, 760], scale: 100, anim: { fadeIn: [1.0, 1.5] } },
          { kind: 'text', name: 'cc.safe.disclaimer', text: 'Paid for by Example Committee', font: TEXT, size: 26, box: [900, 38], pos: [120, 1000], color: GREY }
        ]
      },
      {
        slug: 'disclaimer-bar', name: 'Disclaimer bar', type: 'disclaimer', folder: '18-disclaimer-bar', seconds: 4,
        layers: [
          { kind: 'shape', name: 'cc.surface', rect: [0, 1000, 1920, 80], fill: BLACK, opacity: 80, anim: { fadeIn: [0, 0.3] } },
          { kind: 'text', name: 'cc.safe.disclaimer', text: 'Paid for by Example Committee. Approved by Jane Example.', font: TEXT, size: 28, box: [1800, 40], pos: [60, 1020], color: WHITE, anim: { fadeIn: [0.1, 0.4] } }
        ]
      },
      {
        slug: 'disclaimer-card', name: 'Disclaimer card', type: 'disclaimer', folder: '19-disclaimer-card', seconds: 4,
        layers: [
          { kind: 'shape', name: 'cc.surface', rect: [0, 0, 1920, 1080], fill: NAVY },
          { kind: 'image', name: 'cc.logo', file: 'logo', pos: [860, 300], scale: 100, anim: { fadeIn: [0.1, 0.5] } },
          { kind: 'shape', name: 'cc.accent', rect: [860, 560, 200, 8], fill: BLUE, anchor: 'center', anim: { pop: [0.3, 0.7] } },
          { kind: 'text', name: 'cc.safe.disclaimer', text: "Paid for by Example Committee, example.com, and not authorized by any candidate or candidate's committee.", font: TEXT, size: 32, box: [1400, 120], pos: [260, 620], color: WHITE, align: 'center', anim: { fadeIn: [0.4, 0.9] } }
        ]
      }
    ],
    masterName: 'Starter pack (reference)'
  };

  function masterSeconds() {
    var total = 0;
    for (var i = 0; i < PLAN.comps.length; i++) total += PLAN.comps[i].seconds;
    return total;
  }

  /* #rrggbb for a [r, g, b] colour in 0..1. */
  function hex(c) {
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var v = Math.round(c[i] * 255).toString(16).toUpperCase();
      out += v.length < 2 ? '0' + v : v;
    }
    return out;
  }

  /*
    The elements.json the ingest reads, built by hand (no JSON in
    ExtendScript). No startFrame: the ingest lays the elements end to end,
    which is all a library pack needs. libraryOnly keeps it out of the
    "start a spot" grid.
  */
  function manifestJson() {
    var lines = ['{', '  "background": "' + hex(PLAN.background) + '",', '  "libraryOnly": true,', '  "elements": ['];
    for (var i = 0; i < PLAN.comps.length; i++) {
      var c = PLAN.comps[i];
      var line = '    { "folder": "' + c.folder + '", "slug": "' + c.slug + '", "name": "' + c.name + '", "type": "' + c.type + '", "zIndex": 0 }';
      lines.push(line + (i < PLAN.comps.length - 1 ? ',' : ''));
    }
    lines.push('  ]');
    lines.push('}');
    return lines.join('\n') + '\n';
  }

  /* The config bodymovin-export.jsx and preflight-all.jsx read through $.__ccConfig. */
  function exportConfigJsx(root) {
    var lines = ['var CC_CONFIG = {', "  project: '" + root + '/' + PLAN.folderName + ".aep',", "  logDir: '" + root + "',", '  exports: ['];
    for (var i = 0; i < PLAN.comps.length; i++) {
      var c = PLAN.comps[i];
      lines.push("    { comp: '" + c.name + "', destination: '" + root + '/' + c.folder + "/data.json' }" + (i < PLAN.comps.length - 1 ? ',' : ''));
    }
    lines.push('  ]');
    lines.push('};');
    return lines.join('\n') + '\n';
  }

  return { PLAN: PLAN, manifestJson: manifestJson, exportConfigJsx: exportConfigJsx, masterSeconds: masterSeconds };
})();

/* ---------------------------------------------------------------------- */
/* Running inside After Effects                                           */
/* ---------------------------------------------------------------------- */

if (typeof app !== 'undefined' && app && app.project) {
  (function () {
    var PLAN = CC_PACK.PLAN;
    var quiet = typeof $.__ccQuiet !== 'undefined' && $.__ccQuiet;
    var logLines = [];
    var logFile = null;

    function scriptFolder() {
      return new File($.fileName).parent;
    }

    /* tools/ae-preflight -> repo root */
    function repoRoot() {
      return scriptFolder().parent.parent;
    }

    function ensureFolder(folder) {
      if (!folder.exists) folder.create();
      return folder;
    }

    function writeText(file, text) {
      file.encoding = 'UTF-8';
      file.open('w');
      file.write(text);
      file.close();
    }

    function log(s) {
      logLines.push(s);
      if (logFile) writeText(logFile, logLines.join('\n') + '\n');
    }

    function fail(message) {
      log('FAILED ' + message);
      if (!quiet) alert('CampaignCut starter pack: ' + message);
    }

    /* Quit after the script returns: a quit called inside a command-line script is ignored (seen 2026-09-17). */
    function finish() {
      if (quiet) app.scheduleTask('app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); app.quit();', 1000, false);
    }

    function addRect(layer, name, rect, fill, radius, centered) {
      var contents = layer.property('ADBE Root Vectors Group');
      var group = contents.addProperty('ADBE Vector Group');
      group.name = name;
      var inner = group.property('ADBE Vectors Group');
      var rc = inner.addProperty('ADBE Vector Shape - Rect');
      rc.property('ADBE Vector Rect Size').setValue([rect[2], rect[3]]);
      rc.property('ADBE Vector Rect Position').setValue([0, 0]);
      if (radius) rc.property('ADBE Vector Rect Roundness').setValue(radius);
      var fl = inner.addProperty('ADBE Vector Graphic - Fill');
      fl.property('ADBE Vector Fill Color').setValue([fill[0], fill[1], fill[2], 1]);
      var tf = layer.property('ADBE Transform Group');
      if (centered) {
        tf.property('ADBE Anchor Point').setValue([0, 0]);
        tf.property('ADBE Position').setValue([rect[0] + rect[2] / 2, rect[1] + rect[3] / 2]);
      } else {
        /* anchor at the rectangle's left edge so a scaleX animation grows rightwards */
        tf.property('ADBE Anchor Point').setValue([-rect[2] / 2, 0]);
        tf.property('ADBE Position').setValue([rect[0], rect[1] + rect[3] / 2]);
      }
    }

    function animate(layer, anim, restOpacity) {
      var tf = layer.property('ADBE Transform Group');
      var op = tf.property('ADBE Opacity');
      var full = restOpacity === undefined ? 100 : restOpacity;
      op.setValue(full);
      if (!anim) return;
      if (anim.fadeIn) {
        op.setValueAtTime(anim.fadeIn[0], 0);
        op.setValueAtTime(anim.fadeIn[1], full);
      }
      if (anim.pop) {
        op.setValueAtTime(anim.pop[0], 0);
        op.setValueAtTime(anim.pop[1], full);
        var ps = tf.property('ADBE Scale');
        ps.setValueAtTime(anim.pop[0], [60, 60]);
        ps.setValueAtTime(anim.pop[1], [100, 100]);
      }
      if (anim.fadeOut) {
        op.setValueAtTime(anim.fadeOut[0], full);
        op.setValueAtTime(anim.fadeOut[1], 0);
      }
      if (anim.slideY || anim.slideX) {
        var pos = tf.property('ADBE Position');
        var at = pos.value;
        var s = anim.slideY || anim.slideX;
        var from = anim.slideY ? [at[0], at[1] + s[0]] : [at[0] + s[0], at[1]];
        pos.setValueAtTime(s[1], from);
        pos.setValueAtTime(s[2], [at[0], at[1]]);
      }
      if (anim.scaleX) {
        var sc = tf.property('ADBE Scale');
        sc.setValueAtTime(anim.scaleX[0], [0, 100]);
        sc.setValueAtTime(anim.scaleX[1], [100, 100]);
      }
    }

    function buildComp(spec, logoItem) {
      var comp = app.project.items.addComp(spec.name, PLAN.width, PLAN.height, 1, spec.seconds, PLAN.fps);
      comp.bgColor = PLAN.background;
      for (var i = 0; i < spec.layers.length; i++) {
        var l = spec.layers[i];
        var layer = null;
        if (l.kind === 'shape') {
          layer = comp.layers.addShape();
          layer.name = l.name;
          addRect(layer, l.name + ' rect', l.rect, l.fill, l.radius, l.anchor === 'center');
        } else if (l.kind === 'solid') {
          layer = comp.layers.addSolid(l.color, l.name, l.rect[2], l.rect[3], 1, spec.seconds);
          layer.name = l.name;
          layer.property('ADBE Transform Group').property('ADBE Position').setValue([l.rect[0] + l.rect[2] / 2, l.rect[1] + l.rect[3] / 2]);
        } else if (l.kind === 'text') {
          layer = comp.layers.addBoxText([l.box[0], l.box[1]], l.text);
          layer.name = l.name;
          var doc = layer.property('ADBE Text Properties').property('ADBE Text Document').value;
          doc.font = l.font;
          doc.fontSize = l.size;
          /* the box keeps its default line spacing when the size changes; make it follow the size */
          try { doc.autoLeading = true; } catch (eLead) { doc.leading = Math.round(l.size * 1.2); }
          /* the Character panel remembers the last tracking used; the pack sets its own */
          try { doc.tracking = 0; } catch (eTrack) {}
          doc.fillColor = l.color;
          doc.applyFill = true;
          doc.justification = l.align === 'center' ? ParagraphJustification.CENTER_JUSTIFY : l.align === 'right' ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY;
          layer.property('ADBE Text Properties').property('ADBE Text Document').setValue(doc);
          if (l.anim && l.anim.pop) {
            /* a pop grows from the box centre */
            layer.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([0, 0]);
            layer.property('ADBE Transform Group').property('ADBE Position').setValue([l.pos[0] + l.box[0] / 2, l.pos[1] + l.box[1] / 2]);
          } else {
            layer.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([-l.box[0] / 2, -l.box[1] / 2]);
            layer.property('ADBE Transform Group').property('ADBE Position').setValue([l.pos[0], l.pos[1]]);
          }
        } else if (l.kind === 'image') {
          layer = comp.layers.add(logoItem);
          layer.name = l.name;
          layer.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([0, 0]);
          layer.property('ADBE Transform Group').property('ADBE Position').setValue([l.pos[0], l.pos[1]]);
          layer.property('ADBE Transform Group').property('ADBE Scale').setValue([l.scale, l.scale]);
        }
        if (layer) {
          layer.inPoint = 0;
          layer.outPoint = spec.seconds;
          animate(layer, l.anim, l.opacity);
        }
      }
      return comp;
    }

    try {
      /* 1. The handover folder on the Desktop, with its sub-folders; the log lives there from the first line. */
      var root = ensureFolder(new Folder(Folder.desktop.fsName + '/' + PLAN.folderName));
      logFile = new File(root.fsName + '/starter-pack.log');
      log('started ' + new Date().toString());
      for (var f = 0; f < PLAN.comps.length; f++) ensureFolder(new Folder(root.fsName + '/' + PLAN.comps[f].folder));
      var fontsDir = ensureFolder(new Folder(root.fsName + '/fonts'));

      var logoFile = new File(repoRoot().fsName + '/tools/ingest/fixtures/standin/images/logo.png');
      if (!logoFile.exists) {
        fail('could not find the logo image at ' + logoFile.fsName + '. Run this script from its place inside the CampaignCut folder.');
        finish();
        return;
      }

      /* Always build into a fresh project, so running twice never doubles the comps. */
      if (app.project) app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
      app.newProject();
      app.beginUndoGroup('CampaignCut starter pack');

      /* 2. Fonts from Windows, renamed so the ingest finds the right style. */
      var missingFonts = [];
      for (var i = 0; i < PLAN.fonts.length; i++) {
        var src = new File('C:/Windows/Fonts/' + PLAN.fonts[i].from);
        if (src.exists) src.copy(fontsDir.fsName + '/' + PLAN.fonts[i].to);
        else missingFonts.push(PLAN.fonts[i].from);
      }
      if (missingFonts.length) log('fonts not found in C:/Windows/Fonts: ' + missingFonts.join(', '));

      /* 3. The manifest and the export config. */
      var rootPosix = root.fsName.replace(/\\/g, '/');
      writeText(new File(root.fsName + '/elements.json'), CC_PACK.manifestJson());
      writeText(new File(root.fsName + '/export-config.jsx'), CC_PACK.exportConfigJsx(rootPosix));

      /* 4. The logo image, from the repo's stand-in fixture. */
      var logoItem = app.project.importFile(new ImportOptions(logoFile));
      logoItem.name = 'logo.png';

      /* 5. The comps. */
      var comps = [];
      for (var c = 0; c < PLAN.comps.length; c++) {
        comps.push(buildComp(PLAN.comps[c], logoItem));
        log('built "' + PLAN.comps[c].name + '"');
      }

      /* 6. The master comp for the reference render: every element end to end. */
      var master = app.project.items.addComp(PLAN.masterName, PLAN.width, PLAN.height, 1, CC_PACK.masterSeconds(), PLAN.fps);
      master.bgColor = PLAN.background;
      var cursor = 0;
      for (var m = 0; m < comps.length; m++) {
        var layer = master.layers.add(comps[m]);
        layer.startTime = cursor;
        cursor += PLAN.comps[m].seconds;
        layer.moveToEnd();
      }

      /* 7. Save the project inside the handover folder. */
      app.project.save(new File(root.fsName + '/' + PLAN.folderName + '.aep'));
      app.endUndoGroup();

      log('Folder: ' + root.fsName);
      log('Comps: ' + PLAN.comps.length + ' tagged comps plus "' + PLAN.masterName + '" (' + CC_PACK.masterSeconds() + ' s).');
      log('BUILT ' + new Date().toString());
    } catch (err) {
      fail(String(err) + (err.line ? ' (line ' + err.line + ')' : ''));
    }
    finish();
  })();
}
