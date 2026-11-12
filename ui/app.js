/* =====================================================================
 * app.js — wires the compiler to the user interface
 * ===================================================================== */
(function () {
  'use strict';
  var ML = window.MetroLang, P = window.Panels;
  var net = new ML.Network(window.METRO_DATA);
  var $ = function (id) { return document.getElementById(id); };
  var last = null, journeySig = '', dirty = {}, stepMode = null, autoplayNext = false;

  var TABS = [
    { id: 'tokens', label: 'Tokens', phase: 'lexer' },
    { id: 'parse', label: 'Parse Tree', phase: 'parser' },
    { id: 'ast', label: 'AST', phase: 'parser' },
    { id: 'symbols', label: 'Symbol Table', phase: 'semantic' },
    { id: 'semantic', label: 'Semantic', phase: 'semantic' },
    { id: 'ir', label: 'IR', phase: 'ir' },
    { id: 'opt', label: 'Optimizer', phase: 'optimizer' },
    { id: 'output', label: 'Output', phase: 'codegen' },
    { id: 'target', label: 'Target Code', phase: 'codegen' },
    { id: 'network', label: 'Network' }
  ];
  var PHASE_TAB = { lexer: 'tokens', parser: 'parse', semantic: 'semantic', ir: 'ir', optimizer: 'opt', codegen: 'output' };
  var PHASE_ICON = { lexer: '1', parser: '2', semantic: '3', ir: '4', optimizer: '5', codegen: '6' };
  var PHASE_EXPLAIN = {
    lexer: 'The lexer splits the source text into tokens: keywords, line names, words and semicolons.',
    parser: 'The parser checks the token order against the grammar and builds the parse tree and the AST.',
    semantic: 'The semantic analyser checks the journey against the real metro network using the symbol table.',
    ir: 'The IR generator turns the AST into quadruples, adding the direction, the stops and the stations in between.',
    optimizer: 'The optimizer removes redundant rides and changes, and suggests a faster route.',
    codegen: 'The code generator produces the journey card, the animated map, the directions and the JSON e-ticket.'
  };
  var activeTab = 'output';

  /* ---------------- theme ---------------- */
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var savedTheme = store('ml-theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  $('btnTheme').onclick = function () {
    var cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next); store('ml-theme', next);
  };

  /* ---------------- header bits ---------------- */
  $('lineDots').innerHTML = net.lines.map(function (l) { return '<i style="background:' + l.colour + '" title="' + l.name + ' Line"></i>'; }).join('');
  var exSel = $('examples'), groups = {};
  exSel.innerHTML = '<option value="">📂 Examples…</option>';
  window.METRO_EXAMPLES.forEach(function (ex, i) {
    if (!groups[ex.group]) { groups[ex.group] = document.createElement('optgroup'); groups[ex.group].label = ex.group; exSel.appendChild(groups[ex.group]); }
    var o = document.createElement('option'); o.value = i; o.textContent = ex.title; groups[ex.group].appendChild(o);
  });
  exSel.onchange = function () {
    if (exSel.value === '') return;
    var ex = window.METRO_EXAMPLES[+exSel.value];
    autoplayNext = true;
    editor.setValue(ex.code); compile();
    toast('Loaded: ' + ex.title);
    exSel.value = '';
  };
  $('stationList').innerHTML = Object.keys(net.stations).sort().map(function (s) { return '<option value="' + P.esc(s) + '">'; }).join('');
  $('stationInput').addEventListener('change', function (e) {
    var name = net.findStation(e.target.value);
    if (name) { editor.insert(name); e.target.value = ''; }
  });

  /* ---------------- editor ---------------- */
  var lineColours = {}; net.lines.forEach(function (l) { lineColours[l.id] = l.colour; });
  var editor = new Editor({
    textarea: $('source'), pre: $('highlight'), gutter: $('gutter'), lineColours: lineColours,
    onChange: function (src) {
      store('ml-draft', src);
      if ($('autoCompile').checked) scheduleCompile();
      else editor.setAnalysis(ML.lex(src).tokens, []);
    },
    onCursor: function (l, c) { $('cursorPos').textContent = 'Ln ' + l + ', Col ' + c; },
    onRun: function () { autoplayNext = true; compile(); }
  });
  var timer = null;
  function scheduleCompile() { clearTimeout(timer); timer = setTimeout(compile, 280); }
  $('btnCompile').onclick = function () { autoplayNext = true; compile(); if (activeTab === 'network') showTab('output'); };

  /* ---------------- tabs & pipeline ---------------- */
  $('tabs').innerHTML = TABS.map(function (t) {
    return '<button class="tab" role="tab" data-tab="' + t.id + '">' + (t.phase ? '<span class="dot" id="dot-' + t.id + '"></span>' : '') + t.label + '</button>';
  }).join('');
  $('tabs').onclick = function (e) { var b = e.target.closest('.tab'); if (b) showTab(b.dataset.tab); };

  $('pipeline').innerHTML = ML.PHASES.map(function (p) {
    return '<div class="phase pending" data-phase="' + p.id + '" id="ph-' + p.id + '" title="' + PHASE_EXPLAIN[p.id] + '"><span class="ph-icon">' + PHASE_ICON[p.id] + '</span><div><div class="ph-name">' + p.name + '</div><div class="ph-meta" id="phm-' + p.id + '">—</div></div></div>';
  }).join('');
  $('pipeline').onclick = function (e) { var p = e.target.closest('.phase'); if (p) showTab(PHASE_TAB[p.dataset.phase]); };

  function showTab(id) {
    activeTab = id;
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === id); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + id); });
    document.querySelectorAll('.phase').forEach(function (p) { p.classList.toggle('active', PHASE_TAB[p.dataset.phase] === id || (id === 'ast' && p.dataset.phase === 'parser') || (id === 'symbols' && p.dataset.phase === 'semantic') || (id === 'target' && p.dataset.phase === 'codegen')); });
    renderView(id);
    if (id === 'output') { requestAnimationFrame(function () { map.refit(); }); if (autoplayNext && last && last.ok) { autoplayNext = false; setTimeout(function () { V().replay(); }, 450); } }
  }

  /* ---------------- compile ---------------- */
  function compile() {
    var src = editor.getValue();
    last = ML.compile(src, net);
    editor.setAnalysis(last.lex.tokens, last.errors.concat(last.warnings));
    TABS.forEach(function (t) { dirty[t.id] = true; });
    renderPipeline(last);
    renderConsole(last);
    updateJourney(last);
    renderView(activeTab);
    if (activeTab === 'output' && autoplayNext && last.ok) { autoplayNext = false; setTimeout(function () { V().replay(); }, 500); }
    if (!last.ok) autoplayNext = false;
  }

  function renderPipeline(r, upto) {
    ML.PHASES.forEach(function (p, i) {
      var el = $('ph-' + p.id), st = r.status[p.id] || 'pending';
      if (upto !== undefined && i > upto) st = 'pending';
      el.className = 'phase ' + st + (el.classList.contains('active') ? ' active' : '');
      el.querySelector('.ph-icon').textContent = st === 'ok' ? '✓' : st === 'error' ? '✕' : st === 'warning' ? '!' : st === 'skipped' ? '–' : PHASE_ICON[p.id];
      var meta = '—';
      if (st !== 'skipped' && st !== 'pending') {
        var ms = (r.time[p.id] || 0).toFixed(2) + ' ms';
        if (p.id === 'lexer') meta = r.lex.tokens.length + ' tokens · ' + ms;
        if (p.id === 'parser') meta = r.parse.ast.body.length + ' statements · ' + ms;
        if (p.id === 'semantic') meta = (r.sem.errors.length ? r.sem.errors.length + ' errors' : r.sem.symbols.length + ' symbols') + ' · ' + ms;
        if (p.id === 'ir') meta = r.ir.length + ' quads · ' + ms;
        if (p.id === 'optimizer') meta = r.opt.log.filter(function (l) { return !l.advisory; }).length + ' rewrites · ' + ms;
        if (p.id === 'codegen') meta = r.out.summary.minutes + ' min · ₹' + r.out.summary.fare;
        if (st === 'error') { var n = r.errors.filter(function (e) { return e.phase === ({ lexer: 'lexical', parser: 'syntax', semantic: 'semantic' })[p.id]; }).length; meta = n + ' error' + (n > 1 ? 's' : ''); }
      } else if (st === 'skipped') meta = 'skipped';
      $('phm-' + p.id).textContent = meta;
      el.classList.remove('pulse'); void el.offsetWidth; if (upto === i) el.classList.add('pulse');
    });
    TABS.forEach(function (t) {
      if (!t.phase) return;
      var st = r.status[t.phase] || 'pending', idx = ML.PHASES.map(function (p) { return p.id; }).indexOf(t.phase);
      if (upto !== undefined && idx > upto) st = 'pending';
      $('dot-' + t.id).className = 'dot ' + st;
    });
    var total = Object.keys(r.time).reduce(function (s, k) { return s + r.time[k]; }, 0);
    $('timeBadge').textContent = 'compiled in ' + total.toFixed(1) + ' ms';
  }

  function renderConsole(r) {
    var ne = r.errors.length, nw = r.warnings.length;
    $('errCount').textContent = ne + ' error' + (ne === 1 ? '' : 's');
    $('warnCount').textContent = nw + ' warning' + (nw === 1 ? '' : 's');
    var phaseName = { lexical: 'Lexical', syntax: 'Syntax', semantic: 'Semantic' };
    var items = r.errors.concat(r.warnings).map(function (e) {
      return '<div class="msg ' + e.severity + '" data-line="' + e.line + '" data-col="' + e.col + '" data-len="' + e.length + '"><span class="m-code">' + e.code + '</span><span class="m-text">' + P.esc(e.message) +
        ' <span class="m-where">' + phaseName[e.phase] + ' · line ' + e.line + ':' + e.col + '</span></span>' + (e.hint ? '<span class="m-hint">' + P.esc(e.hint) + '</span>' : '') + '</div>';
    });
    if (r.ok) {
      var s = r.out.summary;
      items.unshift('<div class="msg ok"><span class="m-code">✔ OK</span><span class="m-text">Compiled successfully: <b>' + P.esc(s.from) + ' → ' + P.esc(s.to) + '</b>, ' + s.totalStops + ' stops, ' + s.interchanges + ' change' + (s.interchanges === 1 ? '' : 's') + ', ~' + s.minutes + ' min, ₹' + s.fare + '</span>' +
        (r.opt.log.length ? '<span class="m-hint">Optimizer: ' + P.esc(r.opt.log.map(function (l) { return l.rule + ' ' + l.title; }).join(' · ')) + '</span>' : '') + '</div>');
    }
    $('console').innerHTML = items.join('');
  }
  function jumpFrom(e) {
    var m = e.target.closest('.msg[data-line]');
    if (m) editor.goTo(+m.dataset.line, +m.dataset.col, +m.dataset.len);
  }
  $('console').onclick = jumpFrom;

  /* ---------------- views ---------------- */
  var parseTreeView = null, astTreeView = null;
  function renderView(id) {
    if (!last || !dirty[id]) return;
    dirty[id] = false;
    var r = last;
    if (id === 'tokens') $('view-tokens').innerHTML = P.tokens(r, net);
    if (id === 'parse') {
      $('parseToolbar').innerHTML = '<b style="font-size:13px">Parse tree</b><span style="font-size:12px;color:var(--muted)">Concrete syntax tree built by the recursive-descent parser: blue = grammar rules (non-terminals), white = tokens (terminals), red = error recovery. Drag to pan, scroll to zoom, click a node to find it in the code.</span>';
      parseTreeView = TreeView.render($('parseTree'), TreeView.fromParseTree(r.parse.parseTree), { onSelect: selectNode, title: 'parse tree' });
    }
    if (id === 'ast') {
      $('astToolbar').innerHTML = '<b style="font-size:13px">Abstract syntax tree</b><span style="font-size:12px;color:var(--muted)">Only the meaning is kept: no semicolons or keywords. ' + (r.sem ? 'Nodes are decorated with semantic information (resolved names and types).' : '') + ' Click a node to find it in the code.</span>';
      astTreeView = TreeView.render($('astTree'), r.parse.ast.body.length ? TreeView.fromAST(r.parse.ast, r.sem, net) : null, { onSelect: selectNode, title: 'AST', emptyText: 'No statements parsed yet' });
    }
    if (id === 'symbols') $('view-symbols').innerHTML = P.symbols(r, net);
    if (id === 'semantic') $('view-semantic').innerHTML = P.semantic(r, net);
    if (id === 'ir') $('view-ir').innerHTML = P.ir(r, net);
    if (id === 'opt') $('view-opt').innerHTML = P.opt(r, net);
    if (id === 'target') $('view-target').innerHTML = P.target(r, net);
    if (id === 'network') { $('view-network').innerHTML = P.network(net, netFilter); bindNetSearch(); }
  }
  function selectNode(n) { if (n.loc && n.loc.line) editor.highlight(n.loc.line, n.loc.col, n.loc.length); }

  // delegated clicks inside views
  $('tabBody').addEventListener('click', function (e) {
    var t = e.target.closest('[data-tok]');
    if (t && last) { var tok = last.lex.tokens[+t.dataset.tok]; if (tok && tok.type !== 'EOF') editor.highlight(tok.line, tok.col, tok.length); return; }
    var m = e.target.closest('.msg[data-line]'); if (m) { jumpFrom(e); return; }
    var ins = e.target.closest('[data-ins]'); if (ins) { insertStation(ins.dataset.ins); return; }
    var more = e.target.closest('[data-more]');
    if (more) { more.parentNode.querySelectorAll('[data-hide]').forEach(function (x) { x.style.display = ''; }); more.remove(); return; }
    if (e.target.id === 'useAdvice' && last && last.opt.advice) { autoplayNext = true; editor.setValue('// Fastest route suggested by the optimizer (O5)\n' + last.opt.advice.code); compile(); showTab('output'); toast('Loaded the faster route'); }
    if (e.target.id === 'copyJSON' && last && last.out) { copy(last.out.ticketJSON); }
    if (e.target.id === 'dlJSON' && last && last.out) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([last.out.ticketJSON], { type: 'application/json' }));
      a.download = 'metro-ticket.json'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }
  });
  var netFilter = '';
  function bindNetSearch() {
    var s = $('netSearch'); if (!s) return;
    s.oninput = function () { netFilter = s.value; dirty.network = true; renderView('network'); var n = $('netSearch'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  }
  function insertStation(name) {
    var ta = $('source'), before = ta.value.slice(0, ta.selectionStart);
    var needSpace = before && !/[\s"]$/.test(before);
    editor.insert((needSpace ? ' ' : '') + name);
    toast('Inserted "' + name + '"');
  }

  /* ---------------- map + journey ---------------- */
  var map = new MapView($('mapBox'), net, {
    tip: $('mapTip'),
    onStationClick: insertStation,
    onStation: function (i, p, path) { highlightTimeline(i); updateNowAt(i, path); },
    onProgress: function (f) { $('progressBar').style.width = (f * 100).toFixed(1) + '%'; },
    onPlayState: function (playing, finished) { $('btnPlay').textContent = playing ? '❚❚ Pause' : (finished ? '▶ Play again' : '▶ Play'); }
  });
  $('legend').innerHTML = net.lines.map(function (l) { return '<span class="line-pill ' + l.name + '" data-line="' + l.id + '" style="background:' + l.colour + '" title="Show / hide">' + l.name + '</span>'; }).join('') +
    '<span class="badge" style="margin-left:6px">◯ interchange</span><span class="badge">' + Object.keys(net.stations).length + ' stations</span>';
  $('legend').onclick = function (e) { var p = e.target.closest('[data-line]'); if (p) { var on = map.toggleLine(p.dataset.line); if (map3d) map3d.toggleLine(p.dataset.line); p.classList.toggle('off', !on); } };
  $('btnPlay').onclick = function () { if (V().playing) V().pause(); else V().play(); };
  $('btnReplay').onclick = function () { V().replay(); };
  $('speed').onchange = function () { map.speed = +$('speed').value; if (map3d) map3d.speed = map.speed; };
  map.speed = +$('speed').value;
  /* ---------------- 2D / 3D view ---------------- */
  var map3d = null, viewMode = '2d';
  function V() { return viewMode === '3d' && map3d && map3d.scene ? map3d : map; }
  var viewCallbacks = {
    onStation: function (i, p, path) { highlightTimeline(i); updateNowAt(i, path); },
    onProgress: function (f) { $('progressBar').style.width = (f * 100).toFixed(1) + '%'; },
    onPlayState: function (playing, finished) { $('btnPlay').textContent = playing ? '❚❚ Pause' : (finished ? '▶ Play again' : '▶ Play'); },
    onCameraTakeover: function () { $('camMode').value = 'free'; map3d.setCameraMode('free'); }
  };
  function setView(mode) {
    if (mode === '3d' && !window.WebGLRenderingContext) { toast('3D needs a browser with WebGL'); return; }
    V().pause();
    viewMode = mode; store('ml-view', mode);
    document.querySelectorAll('#viewSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.view === mode); });
    $('camMode').hidden = $('glowWrap').hidden = mode !== '3d';
    $('mapBox').classList.toggle('is3d', mode === '3d');
    $('map3dBox').hidden = mode !== '3d';
    if (mode === '2d') { if (map3d) map3d.setVisible(false); map.refit(); syncView(); return; }
    if (!map3d) map3d = new Map3D($('map3dBox'), net, viewCallbacks);
    Map3D.load().then(function () {
      if (!map3d.scene) {
        map3d.init();
        map3d.speed = map.speed;
        map3d.setShowAll($('showAllLabels').checked);
        Object.keys(map.hidden).forEach(function (id) { if (map.hidden[id]) map3d.toggleLine(id); });
        $('map3dLoading').remove();
      }
      if (viewMode !== '3d') return;
      map3d.setCameraMode($('camMode').value);
      map3d.setGlow($('glow').checked);
      map3d.setVisible(true);
      if (last && last.ok && map3d.journey !== last.out) map3d.showJourney(last.out);
      syncView();
      if (last && last.ok) setTimeout(function () { if (viewMode === '3d') map3d.replay(); }, 300);
    }).catch(function (e) {
      toast('Could not load the 3D engine — staying in 2D');
      console.error(e); setView('2d');
    });
  }
  function syncView() {
    var v = V();
    $('btnPlay').textContent = '▶ Play';
    if (last && last.ok) { highlightTimeline(Math.max(0, v.lastIdx)); updateNowAt(Math.max(0, v.lastIdx), last.out.path); }
  }
  $('viewSeg').onclick = function (e) { var b = e.target.closest('button'); if (b && b.dataset.view !== viewMode) setView(b.dataset.view); };
  $('camMode').onchange = function () { if (map3d) map3d.setCameraMode($('camMode').value); };
  $('glow').onchange = function () { if (map3d) map3d.setGlow($('glow').checked); };
  $('showAllLabels').onchange = function () { map.setShowAll($('showAllLabels').checked); if (map3d) map3d.setShowAll($('showAllLabels').checked); };

  var tlNodes = [];
  function updateJourney(r) {
    $('journey').innerHTML = P.journey(r, net);
    if (!r.ok) {
      journeySig = ''; map.clearJourney(); if (map3d && map3d.scene) map3d.clearJourney(); $('nowAt').style.display = 'none';
      $('btnPlay').disabled = $('btnReplay').disabled = true;
      return;
    }
    $('btnPlay').disabled = $('btnReplay').disabled = r.out.path.length < 2;
    // map timeline DOM nodes to path indices
    var path = r.out.path, p = 0;
    tlNodes = [];
    $('journey').querySelectorAll('.tl-stop').forEach(function (n) {
      var st = n.dataset.st;
      if (p < path.length && path[p].station === st) { n.dataset.idx = p; p++; }
      else if (p > 0 && path[p - 1].station === st) n.dataset.idx = p - 1;
      tlNodes.push(n);
    });
    var sig = JSON.stringify(path.map(function (x) { return x.station + x.colour; }));
    if (sig !== journeySig) { journeySig = sig; map.showJourney(r.out); if (map3d && map3d.scene) map3d.showJourney(r.out); }
    else { highlightTimeline(V().lastIdx); }
    updateNowAt(Math.max(0, V().lastIdx), path);
  }
  function highlightTimeline(i) {
    tlNodes.forEach(function (n) {
      var k = +n.dataset.idx;
      n.classList.toggle('passed', k <= i); n.classList.toggle('current', k === i);
      if (k === i && n.style.display === 'none') n.style.display = '';
    });
    var cur = tlNodes.filter(function (n) { return +n.dataset.idx === i; })[0];
    if (cur && V().playing) { var pane = $('journey'), top = cur.offsetTop - pane.clientHeight / 2; pane.scrollTo({ top: top, behavior: 'smooth' }); }
  }
  function updateNowAt(i, path) {
    var box = $('nowAt');
    if (!path || !path.length || !last || !last.ok) { box.style.display = 'none'; return; }
    var p = path[i], nxt = path[i + 1], line = net.lineById[p.line.toLowerCase()];
    var isEnd = i === path.length - 1;
    box.style.display = '';
    box.innerHTML = '<span class="sub">' + (i === 0 ? 'Starting at' : isEnd ? 'Arrived at' : 'Now at') + '</span><b>' + P.esc(p.station) + '</b>' +
      (isEnd ? '<span class="sub">🎉 Journey complete · ' + last.out.summary.minutes + ' min · ₹' + last.out.summary.fare + '</span>'
        : '<span class="sub">' + P.pill(net, (nxt ? nxt.line : p.line)) + ' next: ' + P.esc(nxt.station) + ' · ' + (path.length - 1 - i) + ' stops to go</span>');
  }

  /* ---------------- step mode ---------------- */
  $('btnStep').onclick = function () {
    autoplayNext = false;
    compile();
    stepMode = { i: 0 };
    $('stepBanner').classList.add('show');
    stepShow();
  };
  function stepShow() {
    var ph = ML.PHASES[stepMode.i], st = last.status[ph.id];
    renderPipeline(last, stepMode.i);
    showTab(PHASE_TAB[ph.id]);
    $('stepTitle').textContent = 'Phase ' + (stepMode.i + 1) + ' of 6 · ' + ph.name;
    $('stepText').textContent = ' — ' + PHASE_EXPLAIN[ph.id] + (st === 'error' ? '  ✖ Errors found here, so compilation stops.' : '');
    var lastStep = stepMode.i === ML.PHASES.length - 1 || st === 'error';
    $('stepNext').textContent = lastStep ? 'Done ✓' : 'Next phase ▶';
    stepMode.done = lastStep;
    if (ph.id === 'codegen' && st === 'ok') setTimeout(function () { V().replay(); }, 500);
  }
  $('stepNext').onclick = function () { if (stepMode.done) return endStep(); stepMode.i++; stepShow(); };
  $('stepExit').onclick = endStep;
  function endStep() { stepMode = null; $('stepBanner').classList.remove('show'); renderPipeline(last); }

  /* ---------------- modals ---------------- */
  function modal(title, html) { $('modalTitle').textContent = title; $('modalBody').innerHTML = html; $('modalBack').classList.add('open'); }
  $('modalClose').onclick = function () { $('modalBack').classList.remove('open'); };
  $('modalBack').onclick = function (e) { if (e.target === $('modalBack')) $('modalBack').classList.remove('open'); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $('modalBack').classList.remove('open'); });
  $('btnGuide').onclick = function () { modal('MetroLang language guide', P.guide(net)); };
  $('btnTests').onclick = function () {
    var t0 = performance.now();
    var data = window.METRO_DATA_CHECKS(net), tests = window.runMetroTests(ML, net), ms = performance.now() - t0;
    var all = data.concat(tests), passed = all.filter(function (x) { return x.pass; }).length;
    var h = '<div class="stat-row"><div class="stat"><div class="v" style="color:var(--ok)">' + passed + '</div><div class="k">Passed</div></div><div class="stat"><div class="v" style="color:' + (all.length - passed ? 'var(--err)' : 'var(--muted)') + '">' + (all.length - passed) + '</div><div class="k">Failed</div></div><div class="stat"><div class="v">' + ms.toFixed(0) + ' ms</div><div class="k">Run time</div></div></div>';
    h += '<p style="font-size:12.5px;color:var(--muted);margin-top:0">The same suite runs from the terminal with <code>node tests/run-tests.js</code>. Click a compiler test to load it into the editor.</p>';
    h += '<h4>Data integrity</h4><div class="table-wrap"><table class="grid"><tbody>' + data.map(function (d) { return '<tr><td style="width:30px">' + (d.pass ? '✅' : '❌') + '</td><td>' + P.esc(d.name) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<h4>Compiler tests</h4><div class="table-wrap"><table class="grid"><tbody>' + tests.map(function (d, i) { return '<tr class="clickable" data-test="' + i + '"><td style="width:30px">' + (d.pass ? '✅' : '❌') + '</td><td>' + P.esc(d.name) + (d.pass ? '' : '<div style="color:var(--err);font-size:12px">' + P.esc(d.detail) + '</div>') + '</td><td class="lexeme" style="color:var(--muted);font-size:11px;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + P.esc(d.code) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    modal('Test suite: ' + passed + ' / ' + all.length + ' passed', h);
  };
  $('modalBody').addEventListener('click', function (e) {
    var tr = e.target.closest('[data-test]');
    if (tr) { var t = window.METRO_TESTS[+tr.dataset.test]; editor.setValue(t.code.replace(/; /g, ';\n')); compile(); $('modalBack').classList.remove('open'); toast('Loaded test: ' + t.name); }
  });

  /* ---------------- utils ---------------- */
  var toastT = null;
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 1800); }
  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('Copied to clipboard'); }, function () { toast('Copy failed'); });
  }
  window.addEventListener('resize', function () { if (activeTab === 'output') map.refit(); });

  /* ---------------- start ---------------- */
  // URL options (handy for demos): #ex=3&tab=parse&theme=light
  var hash = {};
  location.hash.replace(/^#/, '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) hash[p[0]] = decodeURIComponent(p[1] || ''); });
  if (hash.theme) document.documentElement.setAttribute('data-theme', hash.theme);
  var draft = store('ml-draft'), exIdx = hash.ex !== undefined ? +hash.ex : null;
  editor.setValue(exIdx !== null && window.METRO_EXAMPLES[exIdx] ? window.METRO_EXAMPLES[exIdx].code : (draft && draft.trim() ? draft : window.METRO_EXAMPLES[0].code));
  autoplayNext = true;
  compile();
  showTab(TABS.some(function (t) { return t.id === hash.tab; }) ? hash.tab : 'output');

  if (hash.view === '3d' || (hash.view === undefined && store('ml-view') === '3d')) setView('3d');
  if (hash.cam) { $('camMode').value = hash.cam; if (map3d) map3d.setCameraMode(hash.cam); }
  if (hash.modal === 'tests') $('btnTests').click();
  if (hash.modal === 'guide') $('btnGuide').click();

  // keep the map framed whenever its box changes size (tab switch, window resize)
  if (window.ResizeObserver) {
    var lastW = 0;
    new ResizeObserver(function (en) {
      var w = Math.round(en[0].contentRect.width);
      if (w && Math.abs(w - lastW) > 4) { lastW = w; map.refit(); }
    }).observe($('mapBox'));
  }
})();
