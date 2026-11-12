/* =====================================================================
 * Renderers for each phase tab (pure functions that return HTML)
 * ===================================================================== */
(function (root) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function pill(net, idOrName) {
    var l = net.lineById[String(idOrName).toLowerCase()];
    if (!l) return esc(idOrName);
    return '<span class="line-pill ' + l.name + '" style="background:' + l.colour + '">' + l.name + '</span>';
  }
  function explain(num, html) { return '<div class="explain"><span class="ex-num">' + num + '</span><div>' + html + '</div></div>'; }
  function empty(icon, text) { return '<div class="empty"><div><div class="big">' + icon + '</div>' + text + '</div></div>'; }
  function skipped(r, phase) {
    var first = null;
    ML.PHASES.forEach(function (p) { if (!first && r.status[p.id] === 'error') first = p; });
    return empty('⏸', 'This phase did not run because <b>' + (first ? first.name : 'an earlier phase') + '</b> found errors.<br><span style="font-size:12px">Fix the errors in the console and it will run automatically.</span>');
  }
  var ML = root.MetroLang;

  /* ---------------- Phase 1: tokens ---------------- */
  function tokens(r, net) {
    var toks = r.lex.tokens, counts = {};
    toks.forEach(function (t) { counts[t.type] = (counts[t.type] || 0) + 1; });
    var h = explain('Phase 1 · Lexer', 'The <b>lexical analyser</b> reads the source character by character and groups characters into <b>tokens</b> using regular expressions. Keywords and line names are recognised case-insensitively; whitespace is skipped; comments are kept but ignored by the parser. Click a token to find it in the code.');
    h += '<div class="stat-row">' +
      '<div class="stat"><div class="v">' + toks.length + '</div><div class="k">Tokens</div></div>' +
      Object.keys(counts).map(function (k) { return '<div class="stat"><div class="v">' + counts[k] + '</div><div class="k">' + k + '</div></div>'; }).join('') +
      '<div class="stat"><div class="v" style="color:' + (r.lex.errors.length ? 'var(--err)' : 'var(--ok)') + '">' + r.lex.errors.length + '</div><div class="k">Lexical errors</div></div></div>';
    h += '<div class="section-title">Token stream</div><div class="stream">' + toks.filter(function (t) { return t.type !== 'COMMENT'; }).map(function (t, i) {
      var style = t.type === 'LINE' ? ' style="border-color:' + net.lineById[t.value].colour + '"' : '';
      return '<span class="chip ' + t.type + '" data-tok="' + toks.indexOf(t) + '"' + style + '><small>' + t.type + '</small>' + esc(t.type === 'EOF' ? '$' : (t.type === 'STRING' ? '"' + t.value + '"' : (t.raw || t.value))) + '</span>';
    }).join('') + '</div>';
    h += '<div class="section-title">Token table</div><div class="table-wrap"><table class="grid"><thead><tr><th>#</th><th>Token type</th><th>Lexeme</th><th>Value</th><th>Line</th><th>Col</th></tr></thead><tbody>';
    toks.forEach(function (t, i) {
      var tt = t.type === 'LINE' ? '<span class="tt LINE" style="background:' + net.lineById[t.value].colour + (t.value === 'yellow' ? ';color:#3d2e00' : '') + '">LINE</span>' : '<span class="tt ' + t.type + '">' + t.type + '</span>';
      h += '<tr class="clickable" data-tok="' + i + '"><td>' + (i + 1) + '</td><td>' + tt + '</td><td class="lexeme">' + esc(t.type === 'EOF' ? '' : (t.type === 'STRING' ? '"' + t.value + '"' : (t.raw || t.value))) + '</td><td class="lexeme" style="color:var(--muted)">' + esc(t.type === 'EOF' ? 'end of input' : t.value) + '</td><td>' + t.line + '</td><td>' + t.col + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<div class="section-title">Regular definitions</div><pre class="code-block">' + Object.keys(ML.LEX_PATTERNS).map(function (k) {
      var pad = k; while (pad.length < 10) pad += ' ';
      return '<span class="c-key">' + pad + '</span> → ' + esc(ML.LEX_PATTERNS[k]);
    }).join('\n') + '</pre>';
    return h;
  }

  /* ---------------- Phase 3: symbol table ---------------- */
  function symbols(r, net) {
    if (!r.sem) return skipped(r);
    var h = explain('Phase 3 · Symbol table', 'Every identifier in the program (station names and line names) is looked up in the <b>symbol table</b>, which is pre-loaded with the metro network (' + Object.keys(net.stations).length + ' stations, ' + net.lines.length + ' lines). Each entry stores its type, lines and where it is referenced. The second table shows the passenger\'s <b>state</b> after each statement.');
    h += '<div class="section-title">Symbols used in this program</div><div class="table-wrap"><table class="grid"><thead><tr><th>Name</th><th>Kind</th><th>Type</th><th>Lines / info</th><th>Written as</th><th>Lines referenced</th></tr></thead><tbody>';
    r.sem.symbols.forEach(function (s) {
      var info = s.kind === 'line' ? '<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + s.colour + ';vertical-align:middle;margin-right:6px"></span>' + esc((s.lines || []).join(', '))
        : (s.lines || []).map(function (l) { return pill(net, l); }).join(' ');
      h += '<tr class="' + (s.valid ? '' : 'row-err') + '"><td><b>' + esc(s.name) + '</b></td><td>' + s.kind + '</td><td>' + (s.valid ? s.type : '<span style="color:var(--err)">✖ undefined</span>') + '</td><td>' + info + '</td><td class="lexeme">' + esc(s.written) + '</td><td>' + s.refs.join(', ') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<div class="section-title">Journey state after each statement</div><div class="table-wrap"><table class="grid"><thead><tr><th>Step</th><th>Line no.</th><th>Statement</th><th>Current station</th><th>Current line</th><th>Stops so far</th><th>Status</th></tr></thead><tbody>';
    r.sem.trace.forEach(function (t) {
      h += '<tr class="' + (t.status === 'error' ? 'row-err' : '') + '"><td>' + t.step + '</td><td>' + t.line + '</td><td class="lexeme">' + esc(t.statement) + '</td><td>' + esc(t.station) + '</td><td>' + (t.currentLine !== '—' ? pill(net, t.currentLine) : '—') + '</td><td>' + t.stops + '</td><td>' + (t.status === 'ok' ? '<span class="badge ok">✔ ok</span>' : '<span class="badge err">✖ error</span>') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    var ix = Object.keys(net.stations).filter(function (s) { return net.stations[s].isInterchange; });
    h += '<div class="section-title">Interchange stations in the network (' + ix.length + ')</div><div class="table-wrap"><table class="grid"><thead><tr><th>Station</th><th>Lines</th></tr></thead><tbody>' +
      ix.map(function (s) { return '<tr><td>' + esc(s) + '</td><td>' + net.stations[s].lines.map(function (l) { return pill(net, l); }).join(' ') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return h;
  }

  /* ---------------- Phase 3: semantic checks ---------------- */
  function semantic(r, net) {
    if (!r.sem) return skipped(r);
    var h = explain('Phase 3 · Semantic analysis', 'The program is syntactically correct, but does it make sense on the real metro? The analyser walks the AST, tracking the <b>current station</b> and <b>current line</b>, and checks each statement against these rules. Errors stop compilation; warnings do not.');
    var hit = {};
    r.sem.errors.forEach(function (e) { (hit[e.code] = hit[e.code] || []).push(e); });
    r.sem.warnings.forEach(function (e) { (hit[e.code] = hit[e.code] || []).push(e); });
    var nErr = r.sem.errors.length, nWarn = r.sem.warnings.length;
    h += '<div class="stat-row"><div class="stat"><div class="v">' + ML.SEMANTIC_RULES.length + '</div><div class="k">Rules checked</div></div>' +
      '<div class="stat"><div class="v" style="color:var(--err)">' + nErr + '</div><div class="k">Errors</div></div>' +
      '<div class="stat"><div class="v" style="color:var(--warn)">' + nWarn + '</div><div class="k">Warnings</div></div>' +
      '<div class="stat"><div class="v">' + r.sem.events.length + '</div><div class="k">Valid steps</div></div></div>';
    h += '<div class="section-title">Rule checklist</div><div class="rules">';
    ML.SEMANTIC_RULES.forEach(function (rule) {
      var isW = rule[0].charAt(0) === 'W', f = hit[rule[0]];
      var cls = f ? (isW ? 'warn' : 'fail') : 'pass';
      h += '<div class="rule-row ' + cls + '" title="' + esc(f ? f.map(function (x) { return x.message; }).join('\n') : 'passed') + '"><span class="ri">' + (f ? (isW ? '!' : '✖') : '✔') + '</span><span class="rc">' + rule[0] + '</span><span>' + esc(rule[1]) + '</span></div>';
    });
    h += '</div>';
    var all = r.sem.errors.concat(r.sem.warnings);
    if (all.length) {
      h += '<div class="section-title">Findings</div>' + all.map(function (e) {
        return '<div class="msg ' + e.severity + '" data-line="' + e.line + '" data-col="' + e.col + '" data-len="' + e.length + '"><span class="m-code">' + e.code + '</span><span class="m-text">' + esc(e.message) + ' <span class="m-where">line ' + e.line + ':' + e.col + '</span></span>' + (e.hint ? '<span class="m-hint">' + esc(e.hint) + '</span>' : '') + '</div>';
      }).join('');
    } else h += '<div class="msg ok" style="margin-top:14px"><span class="m-code">OK</span><span class="m-text">All semantic rules passed — the journey is valid on the Delhi Metro network.</span></div>';
    return h;
  }

  /* ---------------- Phase 4: IR ---------------- */
  function irTable(ir, net, marks) {
    var h = '<div class="table-wrap"><table class="grid"><thead><tr><th>#</th><th>op</th><th>arg1</th><th>arg2</th><th>result</th><th>details</th></tr></thead><tbody>';
    ir.forEach(function (q) {
      var cls = marks && marks[q.id] ? marks[q.id] : '', a1 = q.arg1, a2 = q.arg2 || '—', res = q.result || '—', det = '';
      if (q.op === 'RIDE') { a1 = pill(net, q.line); det = q.seg.hops + ' stops · towards ' + esc(q.seg.towards) + ' · ~' + Math.round(q.seg.minutes) + ' min'; }
      else if (q.op === 'CHANGE') { a1 = pill(net, q.fromLine); a2 = pill(net, q.toLine); det = 'walk ~' + net.timeModel.interchangeMin + ' min'; }
      else a1 = esc(a1);
      h += '<tr class="' + cls + '"><td>' + (q.id || '') + '</td><td><span class="op">' + q.op + '</span></td><td>' + a1 + '</td><td>' + (q.op === 'CHANGE' ? a2 : esc(a2)) + '</td><td>' + esc(res) + '</td><td style="color:var(--muted);font-size:12px">' + det + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function irListing(ir, net) {
    return '<pre class="code-block">' + ir.map(function (q) {
      var t = esc(ML.irText(q, net));
      return t.replace(/^(L\d+:)\s+(\w+)/, '<span class="c-com">$1</span> <span class="c-op">$2</span>').replace(/(&quot;[^&]*&quot;)/g, '<span class="c-str">$1</span>').replace(/(; .*)$/, '<span class="c-com">$1</span>');
    }).join('\n') + '</pre>';
  }

  function ir(r, net) {
    if (!r.ir) return skipped(r);
    var h = explain('Phase 4 · Intermediate code', 'The checked AST is translated into <b>three-address code</b> written as quadruples <code>(op, arg1, arg2, result)</code>. The IR fills in what the source leaves out: the <b>direction</b> of travel, the <b>number of stops</b>, and every station in between, all computed from the network graph.');
    var c = r.costBefore;
    h += '<div class="stat-row"><div class="stat"><div class="v">' + c.instructions + '</div><div class="k">Instructions</div></div><div class="stat"><div class="v">' + c.stops + '</div><div class="k">Stops</div></div><div class="stat"><div class="v">' + c.changes + '</div><div class="k">Changes</div></div><div class="stat"><div class="v">~' + Math.round(c.minutes) + '</div><div class="k">Minutes</div></div></div>';
    h += '<div class="section-title">Quadruples</div>' + irTable(r.ir, net);
    h += '<div class="section-title">Three-address listing</div>' + irListing(r.ir, net);
    h += '<div class="section-title">Expanded rides (stations in between)</div>';
    r.ir.filter(function (q) { return q.op === 'RIDE'; }).forEach(function (q) {
      h += '<div class="leg-info">' + pill(net, q.line) + '<b>' + esc(q.from) + ' → ' + esc(q.to) + '</b><div style="margin-top:6px;color:var(--muted)">' + q.seg.path.map(esc).join(' → ') + '</div></div>';
    });
    return h;
  }

  /* ---------------- Phase 5: optimizer ---------------- */
  function opt(r, net) {
    if (!r.opt) return skipped(r);
    var h = explain('Phase 5 · Optimization', 'Peephole passes run over the IR until nothing changes (a <b>fixed point</b>). Each rewrite keeps the same start and end station, but removes wasted rides and changes. <b>O5</b> runs Dijkstra on the metro graph and suggests a faster route without changing yours.');
    var b = r.costBefore, a = r.costAfter;
    function delta(x, y, unit) { var d = Math.round(y - x); return d === 0 ? '' : ' <span style="font-size:12px;color:' + (d < 0 ? 'var(--ok)' : 'var(--err)') + '">' + (d > 0 ? '+' : '') + d + unit + '</span>'; }
    h += '<div class="stat-row"><div class="stat"><div class="v">' + b.instructions + ' → ' + a.instructions + delta(b.instructions, a.instructions, '') + '</div><div class="k">Instructions</div></div>' +
      '<div class="stat"><div class="v">' + b.stops + ' → ' + a.stops + delta(b.stops, a.stops, '') + '</div><div class="k">Stops</div></div>' +
      '<div class="stat"><div class="v">' + b.changes + ' → ' + a.changes + delta(b.changes, a.changes, '') + '</div><div class="k">Changes</div></div>' +
      '<div class="stat"><div class="v">' + Math.round(b.minutes) + ' → ' + Math.round(a.minutes) + delta(b.minutes, a.minutes, 'm') + '</div><div class="k">Minutes</div></div></div>';
    var applied = r.opt.log.filter(function (l) { return !l.advisory; });
    h += '<div class="section-title">Optimizations applied (' + applied.length + ')</div>';
    if (!r.opt.log.length) h += '<div class="msg ok"><span class="m-code">✔</span><span class="m-text">Already optimal: no redundant rides or changes were found.</span></div>';
    else h += '<div class="opt-log">' + r.opt.log.map(function (l, i) {
      return '<div class="opt-item ' + (l.advisory ? 'advisory' : '') + '"><span class="rule">' + l.rule + '</span><div><div class="t">' + (i + 1) + '. ' + esc(l.title) + '</div><div class="d">' + esc(l.detail) + '</div></div></div>';
    }).join('') + '</div>';
    // before / after
    var removedIds = {};
    var survived = {};
    r.opt.ir.forEach(function (q) { if (q.origin.length === 1) survived[q.origin[0]] = true; });
    r.ir.forEach(function (q) { if (!survived[q.id]) removedIds[q.id] = 'removed'; });
    var newIds = {};
    r.opt.ir.forEach(function (q) { if (q.origin.length !== 1) newIds[q.id] = 'added'; });
    h += '<div class="split" style="margin-top:16px"><div><div class="section-title">Before</div>' + irTable(r.ir, net, removedIds) + '</div><div><div class="section-title">After</div>' + irTable(r.opt.ir, net, newIds) + '</div></div>';
    if (r.opt.advice) {
      var ad = r.opt.advice;
      h += '<div class="advice"><h4>💡 O5 Route advisor: a faster route exists</h4><div>Your route takes about <b>' + Math.round(ad.yours) + ' min</b>. The fastest route (Dijkstra, ' + net.timeModel.interchangeMin + ' min per change) takes about <b>' + Math.round(ad.best) + ' min</b> via ' +
        ad.legs.map(function (l) { return pill(net, l.line); }).join(' → ') + '.</div><pre class="code-block">' + esc(ad.code) + '</pre><button class="btn primary sm" id="useAdvice">Load this route into the editor</button></div>';
    }
    return h;
  }

  /* ---------------- Phase 6: journey card ---------------- */
  function journey(r, net) {
    if (!r.out) return empty('🚇', 'The journey card appears here once the program compiles.<br><span style="font-size:12px">Try an example from the menu at the top.</span>');
    var s = r.out.summary;
    var h = '<div class="jc-head"><div class="lbl">From</div><div class="st">' + esc(s.from) + '</div><div class="arrow">▼ ' + s.linesUsed.join(' · ') + '</div><div class="lbl">To</div><div class="st">' + esc(s.to) + '</div>' +
      '<div class="jc-stats"><div><b>' + s.minutes + '</b><span>min</span></div><div><b>₹' + s.fare + '</b><span>fare</span></div><div><b>' + s.totalStops + '</b><span>stops</span></div><div><b>' + s.interchanges + '</b><span>changes</span></div></div></div>';
    if (!s.legs.length) return h + '<div class="msg warning"><span class="m-code">W03</span><span class="m-text">No ride — you entered and left ' + esc(s.from) + '.</span></div>';
    h += '<div class="timeline">';
    var ci = 0;
    s.legs.forEach(function (l, li) {
      if (li > 0) {
        var ch = s.changes[ci];
        if (ch && ch.at === l.from) { h += '<div class="change-box">🚶 Change at <b>' + esc(ch.at) + '</b>: ' + pill(net, ch.from) + ' → ' + pill(net, ch.to) + ' · ~' + ch.minutes + ' min</div>'; ci++; }
        else h += '<div class="change-box">🔁 Switch to a ' + pill(net, l.line) + ' train towards ' + esc(l.towards) + '</div>';
      }
      var mid = l.stations.slice(1, -1), many = mid.length > 4;
      h += '<div class="leg" style="--leg:' + l.colour + '">';
      h += '<div class="tl-stop major" data-st="' + esc(l.from) + '">' + esc(l.from) + '</div>';
      h += '<div class="leg-info">' + pill(net, l.line) + 'towards <b>' + esc(l.towards) + '</b><br><span style="color:var(--muted)">' + l.stops + ' stop' + (l.stops === 1 ? '' : 's') + ' · ' + l.km + ' km · ~' + l.minutes + ' min</span></div>';
      h += '<div class="mids' + (many ? ' collapsed' : '') + '">' + mid.map(function (m, k) {
        return '<div class="tl-stop" data-st="' + esc(m) + '"' + (many && k >= 2 && k < mid.length - 1 ? ' data-hide="1" style="display:none"' : '') + '>' + esc(m) + (net.stations[m].isInterchange ? ' <span class="badge" style="font-size:10px">interchange</span>' : '') + '</div>';
      }).join('') + (many ? '<button class="more-btn" data-more="1">Show all ' + mid.length + ' stations ▾</button>' : '') + '</div>';
      h += '<div class="tl-stop major" data-st="' + esc(l.to) + '">' + esc(l.to) + '</div></div>';
    });
    h += '</div><div class="section-title" style="margin-top:16px">Estimate details</div><div style="font-size:12px;color:var(--muted)">' + s.km + ' km · ' + net.timeModel.avgSpeedKmh + ' km/h average · ' + net.timeModel.interchangeMin + ' min per change · ' + (net.timeModel.entryMin + net.timeModel.exitMin) + ' min to enter and exit. Fare from DMRC distance slabs (estimated).</div>';
    return h;
  }

  /* ---------------- target code ---------------- */
  function target(r, net) {
    if (!r.out) return skipped(r);
    var h = explain('Phase 6 · Code generation', 'The optimized IR is turned into the final <b>target code</b>: a machine-readable <b>JSON e-ticket</b>, plain-English <b>directions</b>, and an <b>optimized MetroLang</b> program (source regenerated from the optimized IR). The map animation on the Output tab is also generated from this phase.');
    h += '<div class="section-title">Directions</div><ol class="directions">' + r.out.directions.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ol>';
    var src = regenSource(r.opt.ir, net);
    h += '<div class="section-title">Optimized MetroLang</div><pre class="code-block">' + highlightMetro(src) + '</pre>';
    h += '<div class="section-title" style="display:flex;align-items:center;gap:8px">JSON e-ticket <span style="flex:1"></span><button class="btn sm" id="copyJSON">Copy</button><button class="btn sm" id="dlJSON">Download</button></div>';
    h += '<pre class="code-block">' + highlightJSON(r.out.ticketJSON) + '</pre>';
    return h;
  }

  function regenSource(ir, net) {
    var out = [], cur = null;
    ir.forEach(function (q) {
      if (q.op === 'BOARD') out.push('board ' + q.station + ';');
      if (q.op === 'RIDE') { out.push(cur === q.line ? 'ride to ' + q.to + ';' : 'ride ' + net.lineById[q.line].name + ' to ' + q.to + ';'); cur = q.line; }
      if (q.op === 'CHANGE') { out.push('change ' + net.lineById[q.toLine].name + ';'); cur = q.toLine; }
      if (q.op === 'EXIT') out.push('exit;');
    });
    return out.join('\n');
  }
  function highlightMetro(src) {
    return esc(src).replace(/\b(board|ride|to|change|exit)\b/g, '<span class="c-op">$1</span>').replace(/\b(Yellow|Blue|Violet|Magenta|Red|Pink)\b(?= to|;)/g, '<span class="c-key">$1</span>');
  }
  function highlightJSON(json) {
    // line by line: "key": value  (so digits inside strings are never coloured as numbers)
    return esc(json).split('\n').map(function (ln) {
      return ln.replace(/^(\s*)(&quot;[^&]*?&quot;)(\s*:\s*)(.*)$/, function (m, sp, key, colon, val) {
        if (/^&quot;/.test(val)) val = '<span class="c-str">' + val.replace(/,$/, '') + '</span>' + (/,$/.test(val) ? ',' : '');
        else if (/^-?\d/.test(val)) val = '<span class="c-num">' + val.replace(/,$/, '') + '</span>' + (/,$/.test(val) ? ',' : '');
        return sp + '<span class="c-key">' + key + '</span>' + colon + val;
      }).replace(/^(\s*)(&quot;.*&quot;)(,?)$/, '$1<span class="c-str">$2</span>$3');
    }).join('\n');
  }

  /* ---------------- network explorer ---------------- */
  function network(net, filter) {
    var f = (filter || '').toLowerCase();
    var h = explain('Network', 'This is the data the compiler is loaded with: ' + net.lines.length + ' lines and ' + Object.keys(net.stations).length + ' stations, taken from the Wikipedia article for each line. <b>Bold</b> stations are interchanges. Click any station to insert it into the editor.');
    h += '<input class="search" id="netSearch" placeholder="Search stations…" value="' + esc(filter || '') + '">';
    h += '<div class="net-grid">' + net.lines.map(function (l) {
      var list = l.stations.filter(function (s) { return !f || s.toLowerCase().indexOf(f) >= 0; });
      return '<div class="net-line"><h4 style="background:' + l.colour + (l.id === 'yellow' ? ';color:#3d2e00' : '') + '">' + l.name + ' Line <span>' + l.stations.length + ' stations · ' + l.lengthKm + ' km</span></h4><ol>' +
        list.map(function (s) { return '<li class="' + (net.stations[s].isInterchange ? 'ix' : '') + '" data-ins="' + esc(s) + '" value="' + (l.stations.indexOf(s) + 1) + '">' + esc(s) + '</li>'; }).join('') + (list.length ? '' : '<li style="list-style:none;color:var(--muted)">no match</li>') + '</ol></div>';
    }).join('') + '</div>';
    return h;
  }

  /* ---------------- guide (modal) ---------------- */
  function guide(net) {
    var h = '<h4>Statements</h4><table class="grid"><tbody>' +
      '<tr><td class="lexeme">board &lt;station&gt;;</td><td>Start the journey at a station</td></tr>' +
      '<tr><td class="lexeme">ride &lt;Line&gt; to &lt;station&gt;;</td><td>Ride a line to a station (the first ride must name the line)</td></tr>' +
      '<tr><td class="lexeme">ride to &lt;station&gt;;</td><td>Keep riding the current line</td></tr>' +
      '<tr><td class="lexeme">change &lt;Line&gt;;</td><td>Change line (only at an interchange)</td></tr>' +
      '<tr><td class="lexeme">exit;</td><td>End the journey (the final ";" is optional)</td></tr>' +
      '<tr><td class="lexeme">// comment, # comment, /* block */</td><td>Comments</td></tr>' +
      '<tr><td class="lexeme">"Dilli Haat - INA"</td><td>Names may be quoted; quotes are optional</td></tr></tbody></table>';
    h += '<h4>Lines</h4><div>' + net.lines.map(function (l) { return pill(net, l.id); }).join(' ') + '</div>';
    h += '<h4>Grammar (BNF)</h4><pre class="code-block">' + esc(ML.GRAMMAR.join('\n')) + '</pre>';
    h += '<h4>Semantic rules</h4><div class="rules">' + ML.SEMANTIC_RULES.map(function (r) { return '<div class="rule-row"><span class="rc">' + r[0] + '</span><span>' + esc(r[1]) + '</span></div>'; }).join('') + '</div>';
    h += '<h4>Optimizations</h4><table class="grid"><tbody>' +
      '<tr><td><b>O1</b></td><td>Merge consecutive rides in the same direction on one line</td></tr>' +
      '<tr><td><b>O2</b></td><td>Remove back-and-forth rides and round trips</td></tr>' +
      '<tr><td><b>O3</b></td><td>Merge or cancel consecutive changes</td></tr>' +
      '<tr><td><b>O4</b></td><td>Delete a change that is followed directly by exit</td></tr>' +
      '<tr><td><b>O5</b></td><td>Route advisor: Dijkstra finds a faster route (advice only)</td></tr></tbody></table>';
    h += '<h4>Keyboard</h4><div><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> compile · <kbd>Tab</kbd> indent · click a console message to jump to the error</div>';
    return h;
  }

  root.Panels = { tokens: tokens, symbols: symbols, semantic: semantic, ir: ir, opt: opt, journey: journey, target: target, network: network, guide: guide, pill: pill, esc: esc, regenSource: regenSource };
})(window);
