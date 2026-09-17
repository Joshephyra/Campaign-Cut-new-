/*
  CampaignCut pre-flight (SPEC.md section 9, Phase A; MILESTONES M15)

  Run inside After Effects: File > Scripts > Run Script File, with the
  template comp selected in the Project panel or open in the Timeline.

  It walks the comp and writes a plain text report next to the project
  file (or on the Desktop if the project is unsaved). It reports:
    - every cc.* tag found, with its layer and resolved role
    - text layers that look editable but are untagged
    - unsupported effects, blend modes, 3D layers, cameras/lights, time
      remapping, motion blur and adjustment layers, named by layer
    - comp duration, dimensions and frame rate
    - fonts referenced by text layers

  It does NOT export anything and does NOT change the project.

  ExtendScript is ES3: var only, no arrow functions, no JSON, no
  Array.prototype.indexOf. The report logic is kept free of After Effects
  globals (it takes a small "env" of adapters) so it can be unit tested in
  Node against a fake comp; see tools/ingest/src/preflight.test.ts.

  Keep the ROLES table in sync with tools/ingest/src/roles.ts and
  docs/AE-AUTHORING.md.
*/

var CC_PREFLIGHT = (function () {
  var ROLES = {
    'headline': { kind: 'text', label: 'Headline', lines: true },
    'subhead': { kind: 'text', label: 'Subhead', lines: true },
    'body': { kind: 'text', label: 'Body', lines: true },
    'stat': { kind: 'text', label: 'Stat', repeated: true },
    'accent': { kind: 'color', label: 'Accent colour' },
    'surface': { kind: 'color', label: 'Surface colour' },
    'logo': { kind: 'image', label: 'Logo' },
    'mediaFill': { kind: 'media', label: 'Footage' },
    'safe.disclaimer': { kind: 'text', label: 'Disclaimer', locked: true }
  };

  function knownRoles() {
    var out = [];
    for (var k in ROLES) {
      if (ROLES.hasOwnProperty(k)) out.push(k);
    }
    return out.join(', ');
  }

  function contains(arr, value) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === value) return true;
    }
    return false;
  }

  function trim(s) {
    return String(s).replace(/^\s+|\s+$/g, '');
  }

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = ' ' + s;
    return s;
  }

  /* cc.<role> or cc.<role>.<n>. Case-sensitive. */
  function parseTag(layerName) {
    var tag = trim(layerName);
    if (tag.substring(0, 3) !== 'cc.') return null;
    var rest = tag.substring(3);
    if (rest.length === 0) return null;
    var m = /^(.+)\.(\d+)$/.exec(rest);
    if (m) return { tag: tag, role: m[1], index: parseInt(m[2], 10) };
    return { tag: tag, role: rest, index: null };
  }

  function quote(s) {
    return '"' + s + '"';
  }

  /*
    comp: an After Effects CompItem (or a fake with the same fields:
          name, width, height, frameRate, duration, numLayers, layer(i)).
    env:  adapters around After Effects classes:
          isTextLayer(layer), isShapeLayer(layer), isCameraOrLight(layer),
          blendModeName(layer), effectsOf(layer) -> [{name, matchName}],
          textDocumentOf(layer) -> {font, fontSize, text, boxText} | null,
          hasFillOrStroke(layer)
  */
  function buildReport(comp, env) {
    var lines = [];
    var tags = [];
    var problems = [];
    var notes = [];
    var fonts = [];
    var seenKeys = [];

    lines.push('CampaignCut pre-flight report');
    lines.push('=============================');
    lines.push('Comp: ' + comp.name);
    lines.push('Size: ' + comp.width + ' x ' + comp.height);
    lines.push('Frame rate: ' + comp.frameRate + ' fps');
    lines.push('Duration: ' + Number(comp.duration).toFixed(2) + ' s (' + Math.round(comp.duration * comp.frameRate) + ' frames)');
    lines.push('Layers: ' + comp.numLayers);
    lines.push('');

    for (var i = 1; i <= comp.numLayers; i++) {
      var layer = comp.layer(i);
      var name = String(layer.name);
      var isText = env.isTextLayer(layer);
      var isShape = env.isShapeLayer(layer);

      /* ---- fonts and untagged text ---- */
      if (isText) {
        var doc = env.textDocumentOf(layer);
        if (doc && doc.font && !contains(fonts, doc.font)) fonts.push(doc.font);
      }

      /* ---- unsupported features (will not survive Bodymovin/Lottie) ---- */
      if (env.isCameraOrLight(layer)) {
        problems.push(quote(name) + ': camera or light layer; Lottie has no cameras or lights');
        continue;
      }
      if (layer.threeDLayer) problems.push(quote(name) + ': 3D layer; true 3D does not travel');
      var blend = env.blendModeName(layer);
      if (blend && blend !== 'NORMAL') problems.push(quote(name) + ': blend mode ' + blend + '; only NORMAL is reliable');
      if (layer.timeRemapEnabled) problems.push(quote(name) + ': time remap is only partially supported; test it or bake it');
      if (layer.motionBlur) problems.push(quote(name) + ': motion blur does not travel; turn it off');
      if (layer.adjustmentLayer) problems.push(quote(name) + ': adjustment layer; its effects will not travel');
      var effects = env.effectsOf(layer) || [];
      for (var e = 0; e < effects.length; e++) {
        problems.push(quote(name) + ': effect "' + effects[e].name + '" (' + effects[e].matchName + ') will not travel; bake it or remove it');
      }

      /* ---- tags ---- */
      var parsed = parseTag(name);
      if (!parsed) {
        if (isText) notes.push('Untagged text layer ' + quote(name) + ': the user will not be able to edit it. Tag it (cc.headline, cc.subhead, cc.body, cc.stat.N, cc.safe.disclaimer) or leave it locked on purpose.');
        continue;
      }

      var spec = ROLES[parsed.role];
      if (!spec) {
        problems.push(quote(parsed.tag) + ': unknown role "' + parsed.role + '". Known roles: ' + knownRoles() + '. Tags are case-sensitive.');
        tags.push({ layer: parsed.tag, status: 'error' });
        continue;
      }
      if (spec.repeated && parsed.index === null) {
        problems.push(quote(parsed.tag) + ': role "' + parsed.role + '" is repeated and needs an index, e.g. cc.' + parsed.role + '.1');
        tags.push({ layer: parsed.tag, status: 'error' });
        continue;
      }
      if (!spec.repeated && !spec.lines && parsed.index !== null) {
        problems.push(quote(parsed.tag) + ': role "' + parsed.role + '" is not repeatable; drop the ".' + parsed.index + '"');
        tags.push({ layer: parsed.tag, status: 'error' });
        continue;
      }

      var key = parsed.role + (parsed.index === null ? '' : '.' + parsed.index);
      if (contains(seenKeys, key)) {
        problems.push(quote(parsed.tag) + ': duplicate tag; another layer already uses it');
        tags.push({ layer: parsed.tag, status: 'error' });
        continue;
      }

      var ok = true;
      if (spec.kind === 'text' && !isText) {
        problems.push(quote(parsed.tag) + ': tagged as text but not a text layer');
        ok = false;
      }
      if (spec.kind === 'color') {
        if (!isShape) {
          problems.push(quote(parsed.tag) + ': tagged as a colour but not a shape layer, so it has no fill or stroke');
          ok = false;
        } else if (!env.hasFillOrStroke(layer)) {
          problems.push(quote(parsed.tag) + ': shape has no fill or stroke to change');
          ok = false;
        }
      }
      if (spec.kind === 'image' && (isText || isShape)) {
        problems.push(quote(parsed.tag) + ': tagged as an image but not an image (footage) layer');
        ok = false;
      }
      if (!ok) {
        tags.push({ layer: parsed.tag, status: 'error' });
        continue;
      }

      seenKeys.push(key);
      var extra = '';
      if (spec.kind === 'text') {
        var td = env.textDocumentOf(layer);
        if (td) extra = td.boxText ? '  box text, ' + td.fontSize + 'px' : '  point text (no character limit can be derived), ' + td.fontSize + 'px';
      }
      tags.push({ layer: parsed.tag, status: spec.kind, detail: extra });
    }

    lines.push('Tags found: ' + tags.length);
    if (tags.length === 0) lines.push('  (none) - no layer name starts with "cc."');
    for (var t = 0; t < tags.length; t++) {
      var status = tags[t].status === 'error' ? 'ERROR' : tags[t].status;
      var padded = tags[t].layer;
      while (padded.length < 24) padded += ' ';
      lines.push('  ' + padded + ' ' + status + (tags[t].detail ? tags[t].detail : ''));
    }
    lines.push('');

    lines.push('Fonts referenced: ' + (fonts.length ? fonts.join(', ') : '(none)'));
    lines.push('  Every font listed must be handed over with the template.');
    lines.push('');

    if (notes.length) {
      lines.push('NOTES (' + notes.length + ')');
      for (var n = 0; n < notes.length; n++) lines.push('  - ' + notes[n]);
      lines.push('');
    }

    if (problems.length) {
      lines.push('PROBLEMS (' + problems.length + ')');
      for (var p = 0; p < problems.length; p++) lines.push('  - ' + problems[p]);
      lines.push('');
      lines.push('VERDICT: FIX BEFORE EXPORTING. The ingest will reject tagging mistakes and the unsupported features will not survive the trip.');
    } else {
      lines.push('PROBLEMS (0)');
      lines.push('');
      lines.push('VERDICT: READY TO EXPORT. Export with Bodymovin into an empty folder, add fonts/ and reference.mp4, and hand it over.');
    }

    return { text: lines.join('\n'), lines: lines, tags: tags, problems: problems, notes: notes, fonts: fonts };
  }

  return { parseTag: parseTag, buildReport: buildReport, ROLES: ROLES };
})();

/* ---------------------------------------------------------------------- */
/* Running inside After Effects                                           */
/* ---------------------------------------------------------------------- */

if (typeof app !== 'undefined' && app && app.project) {
  (function () {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
      alert('CampaignCut pre-flight: select or open the template comp first.');
      return;
    }

    function blendModeName(layer) {
      for (var k in BlendingMode) {
        if (BlendingMode.hasOwnProperty(k) && BlendingMode[k] === layer.blendingMode) return k;
      }
      return 'NORMAL';
    }

    function effectsOf(layer) {
      var out = [];
      var group = null;
      try {
        group = layer.property('ADBE Effect Parade');
      } catch (err) {
        group = null;
      }
      if (!group) return out;
      for (var i = 1; i <= group.numProperties; i++) {
        var fx = group.property(i);
        out.push({ name: fx.name, matchName: fx.matchName });
      }
      return out;
    }

    function textDocumentOf(layer) {
      try {
        var doc = layer.property('ADBE Text Properties').property('ADBE Text Document').value;
        return { font: doc.font, fontSize: doc.fontSize, text: doc.text, boxText: doc.boxText };
      } catch (err) {
        return null;
      }
    }

    function hasFillOrStrokeIn(group) {
      for (var i = 1; i <= group.numProperties; i++) {
        var prop = group.property(i);
        if (prop.matchName === 'ADBE Vector Graphic - Fill' || prop.matchName === 'ADBE Vector Graphic - Stroke') return true;
        if (prop.matchName === 'ADBE Vector Group') {
          var inner = prop.property('ADBE Vectors Group');
          if (inner && hasFillOrStrokeIn(inner)) return true;
        }
      }
      return false;
    }

    function hasFillOrStroke(layer) {
      try {
        var root = layer.property('ADBE Root Vectors Group');
        return root ? hasFillOrStrokeIn(root) : false;
      } catch (err) {
        return false;
      }
    }

    var env = {
      isTextLayer: function (layer) { return layer instanceof TextLayer; },
      isShapeLayer: function (layer) { return layer instanceof ShapeLayer; },
      isCameraOrLight: function (layer) { return layer instanceof CameraLayer || layer instanceof LightLayer; },
      blendModeName: blendModeName,
      effectsOf: effectsOf,
      textDocumentOf: textDocumentOf,
      hasFillOrStroke: hasFillOrStroke
    };

    var report = CC_PREFLIGHT.buildReport(comp, env);

    var folder = app.project.file ? app.project.file.parent : Folder.desktop;
    var safeName = String(comp.name).replace(/[^A-Za-z0-9_-]+/g, '-');
    var file = new File(folder.fsName + '/preflight-' + safeName + '.txt');
    file.encoding = 'UTF-8';
    file.open('w');
    file.write(report.text);
    file.close();

    /* Unattended runs (preflight-all.jsx) set $.__ccQuiet: a pop-up would stop them. */
    if (!$.__ccQuiet) {
      alert(
        'CampaignCut pre-flight: ' + report.tags.length + ' tag(s), ' + report.problems.length + ' problem(s), ' + report.fonts.length + ' font(s).\n\n' +
        'Report written to:\n' + file.fsName + '\n\n' +
        (report.problems.length ? 'Fix the problems before exporting.' : 'Ready to export.')
      );
    }
  })();
}
