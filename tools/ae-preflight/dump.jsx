/*
  CampaignCut project dump (MILESTONES M16)

  Run inside After Effects: File > Scripts > Run Script File.

  Where preflight.jsx answers "will these tags work", this answers "what is
  actually in this project". It walks every item and every comp and writes
  two files next to the project (Desktop if unsaved):

    dump-<project>.txt   a readable tree: items, then each comp with its
                         layers, modified/animated/expressed properties,
                         keyframes with interpolation and ease, text
                         documents, shape contents, masks, effects, and a
                         summary with every expression and effect listed
    dump-<project>.json  the same structure for tools to read; every
                         property is included, modified or not

  It does NOT export anything and does NOT change the project.

  ExtendScript is ES3: var only, no arrow functions, no JSON object, no
  Array.prototype.indexOf/forEach. The walker takes an "env" of adapters
  around After Effects classes so tools/ingest/src/dump.test.ts can run it
  in Node against a fake project.
*/

var CC_DUMP = (function () {
  /* ------------------------------------------------------------------ */
  /* small helpers                                                       */
  /* ------------------------------------------------------------------ */

  function isArray(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function isObject(v) {
    return v !== null && typeof v === 'object' && !isArray(v);
  }

  function contains(arr, value) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === value) return true;
    }
    return false;
  }

  function quote(s) {
    return '"' + s + '"';
  }

  function num(n) {
    if (typeof n !== 'number') return String(n);
    if (n !== n) return 'NaN';
    var r = Math.round(n * 1000) / 1000;
    return String(r);
  }

  function secs(t) {
    return Number(t).toFixed(3) + 's';
  }

  function hex2(n) {
    var v = Math.max(0, Math.min(255, Math.round(n * 255)));
    var s = v.toString(16).toUpperCase();
    return s.length < 2 ? '0' + s : s;
  }

  /* [r, g, b] or [r, g, b, a] in 0..1 -> #RRGGBB */
  function colorHex(c) {
    return '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]);
  }

  function isColorMatch(matchName) {
    return /Color$/.test(matchName) || / Color\b/.test(matchName) || matchName === 'ADBE Vector Fill Color' || matchName === 'ADBE Vector Stroke Color';
  }

  /* ------------------------------------------------------------------ */
  /* hand-rolled JSON writer (ExtendScript has no JSON object)           */
  /* ------------------------------------------------------------------ */

  function hex4(n) {
    var s = n.toString(16);
    while (s.length < 4) s = '0' + s;
    return s;
  }

  function jsonString(s) {
    var out = '"';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var code = s.charCodeAt(i);
      if (ch === '"') out += '\\"';
      else if (ch === '\\') out += '\\\\';
      else if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else if (code < 0x20 || code > 0x7e) out += '\\u' + hex4(code);
      else out += ch;
    }
    return out + '"';
  }

  function toJson(value, indent) {
    if (indent === undefined) indent = '';
    var inner = indent + '  ';
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return value !== value || value === Infinity || value === -Infinity ? 'null' : String(value);
    if (typeof value === 'string') return jsonString(value);
    if (typeof value === 'function') return 'null';
    if (isArray(value)) {
      if (value.length === 0) return '[]';
      var parts = [];
      for (var i = 0; i < value.length; i++) parts.push(inner + toJson(value[i], inner));
      return '[\n' + parts.join(',\n') + '\n' + indent + ']';
    }
    var keys = [];
    for (var k in value) {
      if (value.hasOwnProperty(k) && typeof value[k] !== 'function' && value[k] !== undefined) keys.push(k);
    }
    if (keys.length === 0) return '{}';
    var props = [];
    for (var j = 0; j < keys.length; j++) props.push(inner + jsonString(keys[j]) + ': ' + toJson(value[keys[j]], inner));
    return '{\n' + props.join(',\n') + '\n' + indent + '}';
  }

  /* ------------------------------------------------------------------ */
  /* value formatting for the readable text                              */
  /* ------------------------------------------------------------------ */

  function formatTextDoc(d) {
    var s = quote(String(d.text).replace(/\r|\n/g, ' / ')) + ' ' + d.font + ' ' + num(d.fontSize) + 'px ' + (d.boxText ? 'box' : 'point');
    if (typeof d.tracking === 'number' && d.tracking !== 0) s += ' tracking ' + num(d.tracking);
    if (typeof d.leading === 'number' && d.leading !== 0) s += ' leading ' + num(d.leading);
    if (d.justification) s += ' ' + d.justification;
    return s;
  }

  function formatValue(v, matchName) {
    if (v === null || v === undefined) return '(none)';
    if (typeof v === 'number') return num(v);
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'string') return quote(v);
    if (isArray(v)) {
      if ((v.length === 3 || v.length === 4) && matchName && isColorMatch(matchName)) return colorHex(v);
      var parts = [];
      for (var i = 0; i < v.length; i++) parts.push(formatValue(v[i]));
      return '[' + parts.join(', ') + ']';
    }
    if (isObject(v)) {
      if (v.font !== undefined && v.text !== undefined) return formatTextDoc(v);
      if (v.vertices !== undefined) return 'path(' + v.vertices + ' vertices, ' + (v.closed ? 'closed' : 'open') + ')';
      var ks = [];
      for (var k in v) {
        if (v.hasOwnProperty(k)) ks.push(k + '=' + formatValue(v[k]));
      }
      return '{' + ks.join(', ') + '}';
    }
    return String(v);
  }

  function formatEase(label, eases) {
    if (!eases || !eases.length) return '';
    var parts = [];
    for (var i = 0; i < eases.length; i++) parts.push('speed ' + num(eases[i].speed) + ', influence ' + num(eases[i].influence));
    return ' ' + label + '(' + parts.join('; ') + ')';
  }

  /* ------------------------------------------------------------------ */
  /* the walk                                                            */
  /* ------------------------------------------------------------------ */

  function readKeys(p, env) {
    var keys = [];
    for (var k = 1; k <= p.numKeys; k++) {
      var key = { time: p.keyTime(k), value: env.describeValue(p.keyValue(k)) };
      try {
        key['in'] = env.interpolationName(p.keyInInterpolationType(k));
        key.out = env.interpolationName(p.keyOutInterpolationType(k));
      } catch (e1) {
        key['in'] = 'UNKNOWN';
        key.out = 'UNKNOWN';
      }
      try {
        key.easeIn = copyEase(p.keyInTemporalEase(k));
        key.easeOut = copyEase(p.keyOutTemporalEase(k));
      } catch (e2) {
        key.easeIn = [];
        key.easeOut = [];
      }
      keys.push(key);
    }
    return keys;
  }

  function copyEase(list) {
    var out = [];
    if (!list) return out;
    for (var i = 0; i < list.length; i++) out.push({ speed: list[i].speed, influence: list[i].influence });
    return out;
  }

  /* A leaf property -> plain record. */
  function readProperty(p, env, ctx, pathNames) {
    var rec = { matchName: p.matchName, name: p.name, modified: !!p.isModified };
    var v;
    try {
      v = env.describeValue(p.value);
    } catch (e) {
      v = null;
    }
    rec.value = v;
    if (p.numKeys > 0) {
      rec.keys = readKeys(p, env);
      ctx.keyframes += rec.keys.length;
    }
    if (p.canSetExpression && p.expression && String(p.expression).length > 0) {
      rec.expression = String(p.expression);
      rec.expressionEnabled = !!p.expressionEnabled;
      ctx.expressions.push({ layer: ctx.layerName, property: pathNames.join(' > '), expression: rec.expression, enabled: rec.expressionEnabled });
    }
    return rec;
  }

  /* A property group -> { matchName, name, type, enabled, properties[], groups[] }. */
  function readGroup(g, env, ctx, pathNames) {
    var type = env.propertyTypeName(g);
    var rec = { matchName: g.matchName, name: g.name, type: type, enabled: g.enabled !== false, properties: [], groups: [] };
    for (var i = 1; i <= g.numProperties; i++) {
      var child = g.property(i);
      var childType = env.propertyTypeName(child);
      var childPath = pathNames.concat([String(child.name)]);
      if (childType === 'PROPERTY') rec.properties.push(readProperty(child, env, ctx, childPath));
      else rec.groups.push(readGroup(child, env, ctx, childPath));
    }
    return rec;
  }

  function readLayer(layer, env, ctx) {
    var kind = env.layerKind(layer);
    ctx.layerName = String(layer.name);
    var rec = {
      index: layer.index,
      name: String(layer.name),
      kind: kind,
      enabled: layer.enabled !== false,
      solo: !!layer.solo,
      shy: !!layer.shy,
      locked: !!layer.locked,
      guide: !!layer.guideLayer,
      inPoint: layer.inPoint,
      outPoint: layer.outPoint,
      startTime: layer.startTime,
      stretch: layer.stretch,
      parent: layer.parent ? String(layer.parent.name) : null,
      source: layer.source ? String(layer.source.name) : null,
      blendMode: env.blendModeName(layer) || 'NORMAL',
      threeD: !!layer.threeDLayer,
      motionBlur: !!layer.motionBlur,
      adjustmentLayer: !!layer.adjustmentLayer,
      timeRemap: !!layer.timeRemapEnabled,
      trackMatte: env.trackMatteName(layer) || 'NO_TRACK_MATTE',
      isTrackMatte: !!layer.isTrackMatte,
      groups: []
    };
    for (var i = 1; i <= layer.numProperties; i++) {
      var g = layer.property(i);
      var t = env.propertyTypeName(g);
      var pathNames = [String(g.name)];
      if (t === 'PROPERTY') {
        /* a bare property at layer level (rare: e.g. time remap) */
        rec.groups.push({ matchName: g.matchName, name: g.name, type: 'PROPERTY', enabled: true, properties: [readProperty(g, env, ctx, pathNames)], groups: [] });
      } else {
        var grp = readGroup(g, env, ctx, pathNames);
        if (g.matchName === 'ADBE Effect Parade') {
          for (var e = 0; e < grp.groups.length; e++) {
            ctx.effects.push({ layer: rec.name, name: grp.groups[e].name, matchName: grp.groups[e].matchName });
          }
        }
        if (g.matchName === 'ADBE Mask Parade') ctx.masks += grp.groups.length;
        rec.groups.push(grp);
      }
    }
    return rec;
  }

  function readItem(item, env) {
    var kind = env.itemKind(item);
    var rec = { kind: kind, id: item.id, name: String(item.name), folder: item.parentFolder ? String(item.parentFolder.name) : null };
    if (kind === 'folder') return rec;
    rec.width = item.width;
    rec.height = item.height;
    rec.duration = item.duration;
    if (kind === 'comp') {
      rec.frameRate = item.frameRate;
      rec.pixelAspect = item.pixelAspect;
      rec.bgColor = item.bgColor ? colorHex(item.bgColor) : null;
      rec.layers = item.numLayers;
    } else if (kind === 'solid') {
      var c = env.solidColor(item);
      rec.color = c ? colorHex(c) : null;
    } else {
      rec.file = env.footagePath(item);
      rec.hasVideo = !!item.hasVideo;
      rec.hasAudio = !!item.hasAudio;
      rec.frameRate = item.frameRate;
    }
    return rec;
  }

  function readComp(item, env) {
    var ctx = { keyframes: 0, expressions: [], effects: [], masks: 0, layerName: '' };
    var flags = { threeD: 0, blendModes: 0, timeRemap: 0, motionBlur: 0, adjustmentLayers: 0, camerasOrLights: 0, trackMattes: 0, precomps: 0 };
    var layers = [];
    for (var i = 1; i <= item.numLayers; i++) {
      var l = readLayer(item.layer(i), env, ctx);
      if (l.threeD) flags.threeD++;
      if (l.blendMode !== 'NORMAL') flags.blendModes++;
      if (l.timeRemap) flags.timeRemap++;
      if (l.motionBlur) flags.motionBlur++;
      if (l.adjustmentLayer) flags.adjustmentLayers++;
      if (l.kind === 'camera' || l.kind === 'light') flags.camerasOrLights++;
      if (l.trackMatte !== 'NO_TRACK_MATTE') flags.trackMattes++;
      if (l.kind === 'precomp') flags.precomps++;
      layers.push(l);
    }
    return {
      id: item.id,
      name: String(item.name),
      width: item.width,
      height: item.height,
      frameRate: item.frameRate,
      duration: item.duration,
      bgColor: item.bgColor ? colorHex(item.bgColor) : null,
      layers: layers,
      summary: { layers: layers.length, keyframes: ctx.keyframes, expressions: ctx.expressions.length, effects: ctx.effects.length, masks: ctx.masks, flags: flags },
      expressions: ctx.expressions,
      effects: ctx.effects
    };
  }

  /* ------------------------------------------------------------------ */
  /* readable text                                                       */
  /* ------------------------------------------------------------------ */

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  function propertyLine(p) {
    var s = p.name + ': ' + formatValue(p.value, p.matchName);
    if (p.keys) s += '  ' + plural(p.keys.length, 'key');
    if (p.expression !== undefined) s += '  expression' + (p.expressionEnabled ? '' : ' (DISABLED)') + ': ' + p.expression.replace(/\r|\n/g, ' ');
    return s;
  }

  function keyLine(key, matchName) {
    return secs(key.time) + ' ' + formatValue(key.value, matchName) + ' ' + key['in'] + '/' + key.out + formatEase('in', key.easeIn) + formatEase('out', key.easeOut);
  }

  function isDefaultEase(eases) {
    if (!eases || !eases.length) return true;
    for (var i = 0; i < eases.length; i++) {
      if (eases[i].speed !== 0 || Math.abs(eases[i].influence - 16.67) > 0.01) return false;
    }
    return true;
  }

  function keyLineShort(key, matchName) {
    var s = secs(key.time) + ' ' + formatValue(key.value, matchName) + ' ' + key['in'] + '/' + key.out;
    if (!isDefaultEase(key.easeIn)) s += formatEase('in', key.easeIn);
    if (!isDefaultEase(key.easeOut)) s += formatEase('out', key.easeOut);
    return s;
  }

  function groupHasContent(g) {
    for (var i = 0; i < g.properties.length; i++) {
      var p = g.properties[i];
      if (p.modified || p.keys || p.expression !== undefined) return true;
    }
    for (var j = 0; j < g.groups.length; j++) {
      if (groupHasContent(g.groups[j])) return true;
    }
    return false;
  }

  function writeGroup(lines, g, indent, inEffects) {
    if (!groupHasContent(g)) return;
    var title = g.name;
    if (inEffects) title += ' (' + g.matchName + ')';
    if (g.enabled === false) title += ' [OFF]';
    lines.push(indent + title);
    for (var i = 0; i < g.properties.length; i++) {
      var p = g.properties[i];
      if (!(p.modified || p.keys || p.expression !== undefined)) continue;
      lines.push(indent + '  ' + propertyLine(p));
      if (p.keys) {
        for (var k = 0; k < p.keys.length; k++) lines.push(indent + '    ' + keyLineShort(p.keys[k], p.matchName));
      }
    }
    for (var j = 0; j < g.groups.length; j++) writeGroup(lines, g.groups[j], indent + '  ', g.matchName === 'ADBE Effect Parade');
  }

  function layerHeader(l) {
    var s = '[' + l.index + '] ' + l.kind + ' ' + quote(l.name);
    if (l.source && l.kind === 'precomp') s += ' -> comp ' + quote(l.source);
    else if (l.source && l.source !== l.name) s += ' -> ' + quote(l.source);
    s += '  in ' + secs(l.inPoint) + ' out ' + secs(l.outPoint) + ' start ' + secs(l.startTime);
    if (l.stretch !== 100) s += ' stretch ' + num(l.stretch) + '%';
    if (l.parent) s += '  parent ' + quote(l.parent);
    if (l.blendMode !== 'NORMAL') s += '  blend ' + l.blendMode;
    if (l.threeD) s += '  3D';
    if (l.motionBlur) s += '  motion blur';
    if (l.timeRemap) s += '  time remap';
    if (l.adjustmentLayer) s += '  adjustment layer';
    if (l.trackMatte !== 'NO_TRACK_MATTE') s += '  matte ' + l.trackMatte;
    if (l.isTrackMatte) s += '  (is a matte)';
    if (!l.enabled) s += '  hidden';
    if (l.solo) s += '  solo';
    if (l.shy) s += '  shy';
    if (l.locked) s += '  locked';
    if (l.guide) s += '  guide';
    return s;
  }

  function itemLine(it) {
    var s = '[' + it.id + '] ' + it.kind + ' ' + quote(it.name);
    if (it.folder) s += '  (in ' + it.folder + ')';
    if (it.kind === 'folder') return s;
    s += '  ' + it.width + ' x ' + it.height;
    if (it.kind === 'comp') s += '  ' + num(it.frameRate) + ' fps  ' + Number(it.duration).toFixed(2) + ' s  bg ' + it.bgColor + '  ' + plural(it.layers, 'layer');
    else if (it.kind === 'solid') s += '  ' + it.color;
    else s += '  ' + (it.file || '(no file)') + (it.hasAudio ? '  audio' : '') + (it.duration ? '  ' + Number(it.duration).toFixed(2) + ' s' : '');
    return s;
  }

  function buildText(dump) {
    var lines = [];
    lines.push('CampaignCut project dump');
    lines.push('========================');
    lines.push('Project: ' + (dump.file || '(unsaved)'));
    lines.push('After Effects: ' + dump.appVersion);
    lines.push('Active comp: ' + (dump.activeComp || '(none)'));
    var counts = { comp: 0, footage: 0, solid: 0, folder: 0 };
    for (var i = 0; i < dump.items.length; i++) counts[dump.items[i].kind] = (counts[dump.items[i].kind] || 0) + 1;
    lines.push('Items: ' + dump.items.length + ' (' + plural(counts.comp, 'comp') + ', ' + counts.footage + ' footage, ' + plural(counts.solid, 'solid') + ', ' + plural(counts.folder, 'folder') + ')');
    lines.push('');
    lines.push('ITEMS');
    for (var j = 0; j < dump.items.length; j++) lines.push('  ' + itemLine(dump.items[j]));
    lines.push('');

    for (var c = 0; c < dump.comps.length; c++) {
      var comp = dump.comps[c];
      var s = comp.summary;
      lines.push('COMP ' + quote(comp.name) + '  ' + comp.width + ' x ' + comp.height + '  ' + num(comp.frameRate) + ' fps  ' + Number(comp.duration).toFixed(2) + ' s');
      lines.push('  SUMMARY: ' + plural(s.layers, 'layer') + ', ' + plural(s.keyframes, 'keyframe') + ', ' + plural(s.expressions, 'expression') + ', ' + plural(s.effects, 'effect') + ', ' + plural(s.masks, 'mask'));
      var f = s.flags;
      lines.push('  FLAGS: 3D ' + f.threeD + ', blend modes ' + f.blendModes + ', time remap ' + f.timeRemap + ', motion blur ' + f.motionBlur + ', adjustment layers ' + f.adjustmentLayers + ', cameras/lights ' + f.camerasOrLights + ', track mattes ' + f.trackMattes + ', precomps ' + f.precomps);
      lines.push('');
      for (var l = 0; l < comp.layers.length; l++) {
        var layer = comp.layers[l];
        lines.push('  ' + layerHeader(layer));
        for (var g = 0; g < layer.groups.length; g++) writeGroup(lines, layer.groups[g], '      ', false);
      }
      lines.push('');
      lines.push('  EXPRESSIONS (' + comp.expressions.length + ')');
      for (var x = 0; x < comp.expressions.length; x++) {
        var ex = comp.expressions[x];
        lines.push('    ' + quote(ex.layer) + ' > ' + ex.property + ': ' + ex.expression.replace(/\r|\n/g, ' ') + (ex.enabled ? '' : '  [DISABLED]'));
      }
      lines.push('  EFFECTS (' + comp.effects.length + ')');
      for (var e = 0; e < comp.effects.length; e++) {
        lines.push('    ' + quote(comp.effects[e].layer) + ': ' + comp.effects[e].name + ' (' + comp.effects[e].matchName + ')');
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  /*
    project: app.project (or a fake with numItems and item(i)).
    env: adapters around After Effects classes:
      appVersion() -> string, projectPath() -> string | null,
      activeCompName(project) -> string | null,
      itemKind(item) -> 'comp' | 'footage' | 'solid' | 'folder',
      footagePath(item) -> string | null, solidColor(item) -> [r,g,b] | null,
      layerKind(layer) -> 'text' | 'shape' | 'footage' | 'precomp' | 'solid' | 'null' | 'camera' | 'light',
      blendModeName(layer), trackMatteName(layer),
      propertyTypeName(prop) -> 'PROPERTY' | 'NAMED_GROUP' | 'INDEXED_GROUP',
      interpolationName(type) -> 'LINEAR' | 'BEZIER' | 'HOLD',
      describeValue(value) -> plain number/array/string/{text doc}/{vertices, closed}
  */
  function buildDump(project, env) {
    var items = [];
    var comps = [];
    for (var i = 1; i <= project.numItems; i++) {
      var item = project.item(i);
      items.push(readItem(item, env));
      if (env.itemKind(item) === 'comp') comps.push(readComp(item, env));
    }
    var dump = { file: env.projectPath(), appVersion: env.appVersion(), activeComp: env.activeCompName(project), items: items, comps: comps };
    return { project: dump, text: buildText(dump), json: toJson(dump) };
  }

  return { buildDump: buildDump, toJson: toJson, formatValue: formatValue };
})();

/* ---------------------------------------------------------------------- */
/* Running inside After Effects                                           */
/* ---------------------------------------------------------------------- */

if (typeof app !== 'undefined' && app && app.project) {
  (function () {
    function enumName(enumObj, value, fallback) {
      for (var k in enumObj) {
        if (enumObj.hasOwnProperty(k) && enumObj[k] === value) return k;
      }
      return fallback;
    }

    function describeValue(v) {
      if (v === null || v === undefined) return null;
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
      if (v instanceof TextDocument) {
        var doc = { font: v.font, fontSize: v.fontSize, text: v.text, boxText: v.boxText };
        try { doc.tracking = v.tracking; } catch (e1) {}
        try { doc.leading = v.leading; } catch (e2) {}
        try { doc.justification = enumName(ParagraphJustification, v.justification, null); } catch (e3) {}
        try { doc.fillColor = v.applyFill ? v.fillColor : null; } catch (e4) {}
        try { doc.strokeColor = v.applyStroke ? v.strokeColor : null; } catch (e5) {}
        try { doc.strokeWidth = v.applyStroke ? v.strokeWidth : 0; } catch (e6) {}
        if (v.boxText) {
          try { doc.boxTextSize = v.boxTextSize; } catch (e7) {}
        }
        return doc;
      }
      if (v instanceof Shape) return { vertices: v.vertices.length, closed: v.closed };
      if (Object.prototype.toString.call(v) === '[object Array]') {
        var out = [];
        for (var i = 0; i < v.length; i++) out.push(describeValue(v[i]));
        return out;
      }
      return String(v);
    }

    function layerKind(layer) {
      if (layer instanceof TextLayer) return 'text';
      if (layer instanceof ShapeLayer) return 'shape';
      if (layer instanceof CameraLayer) return 'camera';
      if (layer instanceof LightLayer) return 'light';
      if (layer.nullLayer) return 'null';
      var src = null;
      try { src = layer.source; } catch (e) { src = null; }
      if (src instanceof CompItem) return 'precomp';
      if (src instanceof FootageItem && src.mainSource instanceof SolidSource) return 'solid';
      return 'footage';
    }

    function itemKind(item) {
      if (item instanceof CompItem) return 'comp';
      if (item instanceof FolderItem) return 'folder';
      if (item instanceof FootageItem && item.mainSource instanceof SolidSource) return 'solid';
      return 'footage';
    }

    function trackMatteName(layer) {
      try {
        if (layer.hasTrackMatte === false) return 'NO_TRACK_MATTE';
        return enumName(TrackMatteType, layer.trackMatteType, 'NO_TRACK_MATTE');
      } catch (e) {
        return 'NO_TRACK_MATTE';
      }
    }

    var env = {
      appVersion: function () { return String(app.version); },
      projectPath: function () { return app.project.file ? app.project.file.fsName : null; },
      activeCompName: function (project) { return project.activeItem && project.activeItem instanceof CompItem ? String(project.activeItem.name) : null; },
      itemKind: itemKind,
      footagePath: function (item) { try { return item.file ? item.file.fsName : null; } catch (e) { return null; } },
      solidColor: function (item) { try { return item.mainSource.color; } catch (e) { return null; } },
      layerKind: layerKind,
      blendModeName: function (layer) { try { return enumName(BlendingMode, layer.blendingMode, 'NORMAL'); } catch (e) { return 'NORMAL'; } },
      trackMatteName: trackMatteName,
      propertyTypeName: function (p) {
        if (p.propertyType === PropertyType.PROPERTY) return 'PROPERTY';
        if (p.propertyType === PropertyType.INDEXED_GROUP) return 'INDEXED_GROUP';
        return 'NAMED_GROUP';
      },
      interpolationName: function (t) { return enumName(KeyframeInterpolationType, t, 'UNKNOWN'); },
      describeValue: describeValue
    };

    var result = CC_DUMP.buildDump(app.project, env);

    var folder = app.project.file ? app.project.file.parent : Folder.desktop;
    var base = app.project.file ? String(app.project.file.name).replace(/\.aep$/i, '') : 'unsaved';
    var safeName = base.replace(/[^A-Za-z0-9_-]+/g, '-');

    function writeFile(name, contents) {
      var f = new File(folder.fsName + '/' + name);
      f.encoding = 'UTF-8';
      f.open('w');
      f.write(contents);
      f.close();
      return f.fsName;
    }

    var txt = writeFile('dump-' + safeName + '.txt', result.text);
    var js = writeFile('dump-' + safeName + '.json', result.json);

    var total = 0;
    for (var c = 0; c < result.project.comps.length; c++) total += result.project.comps[c].summary.keyframes;
    alert(
      'CampaignCut project dump: ' + result.project.comps.length + ' comp(s), ' + result.project.items.length + ' item(s), ' + total + ' keyframe(s).\n\n' +
      'Written:\n' + txt + '\n' + js + '\n\n' +
      'Hand both files over with the Bodymovin export.'
    );
  })();
}
