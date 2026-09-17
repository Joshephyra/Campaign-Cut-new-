/*
  CampaignCut sample project builder (docs/AE-STEP-BY-STEP.md)

  Run inside After Effects: File > Scripts > Run Script File.

  It builds, from nothing, the sample "Contrast :30" template exactly as
  the step-by-step guide describes: four tagged comps (open, lower third,
  stat, end card), a master comp laying them out for the reference render,
  the handover folder with numbered sub-folders, fonts/ (Arial Regular and
  Bold copied from Windows with clean names) and elements.json, and saves
  the project inside that folder. What is left for a person: run
  preflight.jsx, export each comp with Bodymovin into its sub-folder, and
  render the master comp to reference.mp4.

  ExtendScript is ES3: var only, no arrow functions, no JSON. The PLAN is
  plain data so tools/ingest/src/sampleProject.test.ts can check it (every
  tag a known role on the right layer type, one size and frame rate, the
  manifest consistent with the master comp) without After Effects.
*/

var CC_SAMPLE = (function () {
  var W = 1920;
  var H = 1080;
  var FPS = 30;

  /* Colours as [r, g, b] in 0..1. */
  var INK = [0.06, 0.09, 0.16];
  var NAVY = [0.06, 0.09, 0.16];
  var TEAL = [0.09, 0.39, 0.45];
  var ORANGE = [0.94, 0.35, 0.16];
  var WHITE = [1, 1, 1];
  var GREY = [0.55, 0.58, 0.64];

  var FONT_REGULAR = 'ArialMT';
  var FONT_BOLD = 'Arial-BoldMT';

  /*
    Each comp: slug, name, seconds, and layers bottom to top. Layer kinds:
      shape  { name, rect: [x, y, w, h] (pixels, top-left), fill, anim? }
      solid  { name, rect, color }
      text   { name, text, font, size, box: [w, h], pos: [x, y], color, anim? }
      image  { name, file: 'logo', pos: [x, y], scale }
    anim: { fadeIn: [from, to] seconds } and/or { slideY: [px, from, to] }
    and/or { scaleX: [from, to] } (all times in seconds).
  */
  var PLAN = {
    width: W,
    height: H,
    fps: FPS,
    background: INK,
    folderName: 'contrast-30',
    fonts: [
      { from: 'arial.ttf', to: 'Arial-Regular.ttf' },
      { from: 'arialbd.ttf', to: 'Arial-Bold.ttf' }
    ],
    comps: [
      {
        slug: 'open',
        name: 'Open',
        folder: '01-open',
        seconds: 4,
        layers: [
          { kind: 'solid', name: 'cc.mediaFill', rect: [1056, 0, 864, 1080], color: [0.2, 0.2, 0.2] },
          { kind: 'shape', name: 'cc.surface', rect: [0, 0, 1056, 1080], fill: NAVY },
          { kind: 'shape', name: 'cc.accent', rect: [160, 590, 700, 18], fill: ORANGE, anim: { scaleX: [0.25, 0.95] } },
          { kind: 'text', name: 'cc.headline', text: 'THEY VOTED AGAINST IT', font: FONT_BOLD, size: 88, box: [880, 240], pos: [160, 300], color: WHITE, anim: { fadeIn: [0.5, 1.2], slideY: [60, 0.5, 1.2] } },
          { kind: 'shape', name: 'progress-dot', rect: [940, 930, 24, 24], fill: WHITE }
        ]
      },
      {
        slug: 'lower-third',
        name: 'Lower third',
        folder: '02-lower-third',
        seconds: 5,
        layers: [
          { kind: 'shape', name: 'lower-third-plate', rect: [120, 860, 900, 120], fill: TEAL, anim: { fadeIn: [0, 0.4] } },
          { kind: 'shape', name: 'cc.accent', rect: [120, 860, 12, 120], fill: ORANGE },
          { kind: 'text', name: 'cc.subhead', text: 'Jane Example, State Senate', font: FONT_REGULAR, size: 44, box: [820, 60], pos: [160, 880], color: WHITE, anim: { fadeIn: [0.2, 0.7] } },
          { kind: 'text', name: 'cc.body', text: 'Voted to raise your taxes three times', font: FONT_REGULAR, size: 30, box: [820, 44], pos: [160, 930], color: GREY, anim: { fadeIn: [0.4, 0.9] } },
          { kind: 'image', name: 'cc.logo', file: 'logo', pos: [1560, 900], scale: 100 }
        ]
      },
      {
        slug: 'stat',
        name: 'Stat callout',
        folder: '03-stat',
        seconds: 5,
        layers: [
          { kind: 'shape', name: 'cc.surface', rect: [0, 0, 1920, 1080], fill: TEAL },
          { kind: 'text', name: 'cc.stat.1', text: '3x', font: FONT_BOLD, size: 220, box: [700, 260], pos: [160, 300], color: WHITE, anim: { fadeIn: [0.2, 0.8], slideY: [40, 0.2, 0.8] } },
          { kind: 'text', name: 'cc.stat.2', text: '$1,200', font: FONT_BOLD, size: 220, box: [900, 260], pos: [900, 300], color: WHITE, anim: { fadeIn: [0.6, 1.2], slideY: [40, 0.6, 1.2] } },
          { kind: 'text', name: 'cc.body', text: 'tax votes, and what they cost a family each year', font: FONT_REGULAR, size: 44, box: [1600, 60], pos: [160, 620], color: WHITE, anim: { fadeIn: [1.0, 1.5] } },
          { kind: 'shape', name: 'cc.accent', rect: [160, 720, 400, 14], fill: ORANGE, anim: { scaleX: [1.2, 1.8] } }
        ]
      },
      {
        slug: 'end-card',
        name: 'End card',
        folder: '04-end-card',
        seconds: 5,
        layers: [
          { kind: 'solid', name: 'cc.mediaFill', rect: [1056, 0, 864, 1080], color: [0.2, 0.2, 0.2] },
          { kind: 'shape', name: 'cc.surface', rect: [0, 0, 1056, 1080], fill: NAVY },
          { kind: 'text', name: 'cc.headline', text: 'VOTE NOVEMBER 3', font: FONT_BOLD, size: 88, box: [880, 240], pos: [160, 380], color: WHITE, anim: { fadeIn: [0.3, 1.0] } },
          { kind: 'image', name: 'cc.logo', file: 'logo', pos: [1560, 900], scale: 100 },
          { kind: 'text', name: 'cc.safe.disclaimer', text: 'Paid for by Example Committee', font: FONT_REGULAR, size: 28, box: [860, 40], pos: [160, 980], color: GREY }
        ]
      }
    ],
    /* Where each comp starts in the master comp, in frames. */
    timeline: [
      { slug: 'open', startFrame: 0, zIndex: 0 },
      { slug: 'lower-third', startFrame: 90, zIndex: 1 },
      { slug: 'stat', startFrame: 300, zIndex: 0 },
      { slug: 'end-card', startFrame: 750, zIndex: 0 }
    ],
    masterName: 'Contrast 30 (reference)',
    masterSeconds: 30
  };

  function compBySlug(slug) {
    for (var i = 0; i < PLAN.comps.length; i++) {
      if (PLAN.comps[i].slug === slug) return PLAN.comps[i];
    }
    return null;
  }

  /* The elements.json the ingest reads, built by hand (no JSON in ExtendScript). */
  function manifestJson() {
    var lines = ['['];
    for (var i = 0; i < PLAN.timeline.length; i++) {
      var t = PLAN.timeline[i];
      var c = compBySlug(t.slug);
      var line = '  { "folder": "' + c.folder + '", "slug": "' + c.slug + '", "name": "' + c.name + '", "startFrame": ' + t.startFrame + ', "zIndex": ' + t.zIndex + ' }';
      lines.push(line + (i < PLAN.timeline.length - 1 ? ',' : ''));
    }
    lines.push(']');
    return lines.join('\n') + '\n';
  }

  return { PLAN: PLAN, manifestJson: manifestJson, compBySlug: compBySlug };
})();

/* ---------------------------------------------------------------------- */
/* Running inside After Effects                                           */
/* ---------------------------------------------------------------------- */

if (typeof app !== 'undefined' && app && app.project) {
  (function () {
    var PLAN = CC_SAMPLE.PLAN;

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

    function addRect(layer, name, rect, fill) {
      var contents = layer.property('ADBE Root Vectors Group');
      var group = contents.addProperty('ADBE Vector Group');
      group.name = name;
      var inner = group.property('ADBE Vectors Group');
      var rc = inner.addProperty('ADBE Vector Shape - Rect');
      rc.property('ADBE Vector Rect Size').setValue([rect[2], rect[3]]);
      rc.property('ADBE Vector Rect Position').setValue([0, 0]);
      var fl = inner.addProperty('ADBE Vector Graphic - Fill');
      fl.property('ADBE Vector Fill Color').setValue([fill[0], fill[1], fill[2], 1]);
      /* anchor at the rectangle's left edge so a scaleX animation grows rightwards */
      layer.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([-rect[2] / 2, 0]);
      layer.property('ADBE Transform Group').property('ADBE Position').setValue([rect[0], rect[1] + rect[3] / 2]);
    }

    function animate(layer, anim) {
      if (!anim) return;
      var tf = layer.property('ADBE Transform Group');
      if (anim.fadeIn) {
        var op = tf.property('ADBE Opacity');
        op.setValueAtTime(anim.fadeIn[0], 0);
        op.setValueAtTime(anim.fadeIn[1], 100);
      }
      if (anim.slideY) {
        var pos = tf.property('ADBE Position');
        var at = pos.value;
        pos.setValueAtTime(anim.slideY[1], [at[0], at[1] + anim.slideY[0]]);
        pos.setValueAtTime(anim.slideY[2], [at[0], at[1]]);
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
          addRect(layer, l.name + ' rect', l.rect, l.fill);
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
          doc.fillColor = l.color;
          doc.applyFill = true;
          doc.justification = ParagraphJustification.LEFT_JUSTIFY;
          layer.property('ADBE Text Properties').property('ADBE Text Document').setValue(doc);
          layer.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([-l.box[0] / 2, -l.box[1] / 2]);
          layer.property('ADBE Transform Group').property('ADBE Position').setValue([l.pos[0], l.pos[1]]);
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
          animate(layer, l.anim);
        }
      }
      return comp;
    }

    /* Always build into a fresh project, so running twice never doubles the comps. */
    var logoSource = new File(repoRoot().fsName + '/tools/ingest/fixtures/standin/images/logo.png');
    if (!logoSource.exists) {
      alert('CampaignCut sample: could not find the logo image at\n' + logoSource.fsName + '\n\nRun this script from its place inside the CampaignCut folder.');
      return;
    }
    app.newProject();
    app.beginUndoGroup('CampaignCut sample project');

    /* 1. The handover folder on the Desktop, with its sub-folders. */
    var root = ensureFolder(new Folder(Folder.desktop.fsName + '/' + PLAN.folderName));
    for (var f = 0; f < PLAN.comps.length; f++) ensureFolder(new Folder(root.fsName + '/' + PLAN.comps[f].folder));
    var fontsDir = ensureFolder(new Folder(root.fsName + '/fonts'));

    /* 2. Fonts: Arial Regular and Bold from Windows, renamed so the ingest finds the right style. */
    var missingFonts = [];
    for (var i = 0; i < PLAN.fonts.length; i++) {
      var src = new File('C:/Windows/Fonts/' + PLAN.fonts[i].from);
      if (src.exists) src.copy(fontsDir.fsName + '/' + PLAN.fonts[i].to);
      else missingFonts.push(PLAN.fonts[i].from);
    }

    /* 3. The manifest. */
    writeText(new File(root.fsName + '/elements.json'), CC_SAMPLE.manifestJson());

    /* 4. The logo image, from the repo's stand-in fixture. */
    var logoFile = new File(repoRoot().fsName + '/tools/ingest/fixtures/standin/images/logo.png');
    if (!logoFile.exists) {
      alert('CampaignCut sample: could not find the logo image at\n' + logoFile.fsName + '\n\nRun this script from its place inside the CampaignCut folder.');
      app.endUndoGroup();
      return;
    }
    var logoItem = app.project.importFile(new ImportOptions(logoFile));
    logoItem.name = 'logo.png';

    /* 5. The comps. */
    var comps = {};
    for (var c = 0; c < PLAN.comps.length; c++) comps[PLAN.comps[c].slug] = buildComp(PLAN.comps[c], logoItem);

    /* 6. The master comp for the reference render. */
    var master = app.project.items.addComp(PLAN.masterName, PLAN.width, PLAN.height, 1, PLAN.masterSeconds, PLAN.fps);
    master.bgColor = PLAN.background;
    for (var t = PLAN.timeline.length - 1; t >= 0; t--) {
      var entry = PLAN.timeline[t];
      var layer = master.layers.add(comps[entry.slug]);
      layer.startTime = entry.startFrame / PLAN.fps;
    }
    /* higher zIndex must sit higher in the stack: re-order by zIndex, then by start */
    var order = PLAN.timeline.slice(0);
    order.sort(function (a, b) { return a.zIndex - b.zIndex || a.startFrame - b.startFrame; });
    for (var o = 0; o < order.length; o++) {
      for (var li = 1; li <= master.numLayers; li++) {
        if (master.layer(li).source === comps[order[o].slug]) master.layer(li).moveToBeginning();
      }
    }
    master.openInViewer();

    /* 7. Save the project inside the handover folder. */
    app.project.save(new File(root.fsName + '/' + PLAN.folderName + '.aep'));

    app.endUndoGroup();

    /* A summary file instead of a pop-up, so unattended runs (AfterFX.exe -r) leave nothing modal behind. */
    var summary =
      'CampaignCut sample project built.\n' +
      'Folder: ' + root.fsName + '\n' +
      'Comps: ' + PLAN.comps.length + ' tagged comps plus "' + PLAN.masterName + '".\n' +
      (missingFonts.length ? 'Fonts not found in C:\\Windows\\Fonts: ' + missingFonts.join(', ') + '\n' : 'Fonts copied: Arial Regular and Bold.\n') +
      'Next: run preflight.jsx on each comp, export each comp with Bodymovin into its numbered sub-folder as data.json, and render "' + PLAN.masterName + '" to reference.mp4 in the same folder.\n';
    writeText(new File(root.fsName + '/sample-project.log'), summary);
  })();
}
