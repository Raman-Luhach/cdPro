/* =====================================================================
 * Tree renderer for the Parse Tree and the AST (pure SVG, tidy layout)
 * Node format: { label, sub?, attrs?[], cls, loc?{line,col,length}, children[] }
 * ===================================================================== */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var CW = 7.25, GAP_X = 14, GAP_Y = 46;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function size(n) {
    var lines = [n.label].concat(n.sub ? [n.sub] : []).concat(n.attrs || []);
    var maxLen = lines.reduce(function (m, s) { return Math.max(m, String(s).length); }, 0);
    n._w = Math.max(40, maxLen * CW + 22);
    n._h = n.attrs && n.attrs.length ? 26 + n.attrs.length * 16 : (n.sub ? 40 : 30);
  }

  function measure(n, depth, levels) {
    size(n); n._d = depth;
    levels[depth] = Math.max(levels[depth] || 0, n._h);
    var kids = n.children || [], sum = 0;
    kids.forEach(function (c) { measure(c, depth + 1, levels); sum += c._tw; });
    sum += Math.max(0, kids.length - 1) * GAP_X;
    n._tw = Math.max(n._w, sum); n._kw = sum;
  }

  function place(n, x0, ys) {
    n._x = x0 + n._tw / 2; n._y = ys[n._d];
    var cx = x0 + (n._tw - n._kw) / 2;
    (n.children || []).forEach(function (c) { place(c, cx, ys); cx += c._tw + GAP_X; });
  }

  function render(container, tree, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!tree) {
      container.innerHTML = '<div class="empty"><div><div class="big">🌳</div>' + (opts.emptyText || 'Nothing to show yet') + '</div></div>';
      return null;
    }
    var levels = []; measure(tree, 0, levels);
    var ys = [0]; for (var i = 1; i < levels.length; i++) ys[i] = ys[i - 1] + levels[i - 1] + GAP_Y;
    place(tree, 0, ys);

    var svg = el('svg', { role: 'img', 'aria-label': opts.title || 'tree' });
    container.appendChild(svg);
    var g = el('g', {}, svg), edges = el('g', {}, g), nodes = el('g', {}, g);
    var selected = null;

    (function draw(n) {
      (n.children || []).forEach(function (c) {
        var y1 = n._y + n._h, y2 = c._y, my = (y1 + y2) / 2;
        el('path', { 'class': 'tedge', d: 'M' + n._x + ',' + y1 + ' C' + n._x + ',' + my + ' ' + c._x + ',' + my + ' ' + c._x + ',' + y2 }, edges);
        draw(c);
      });
      var gr = el('g', { 'class': 'tnode ' + (n.cls || 'nt'), transform: 'translate(' + (n._x - n._w / 2) + ',' + n._y + ')' }, nodes);
      gr.style.animation = 'treeIn .35s ease both';
      gr.style.animationDelay = Math.min(n._d * 45, 900) + 'ms';
      el('rect', { width: n._w, height: n._h, rx: 8 }, gr);
      if (n.attrs && n.attrs.length) {
        el('text', { x: n._w / 2, y: 18, 'text-anchor': 'middle', 'class': 'ttitle' }, gr).textContent = n.label;
        n.attrs.forEach(function (a, k) { el('text', { x: 11, y: 36 + k * 16, 'class': 'tattr' }, gr).textContent = a; });
      } else {
        el('text', { x: n._w / 2, y: n.sub ? 17 : 19.5, 'text-anchor': 'middle' }, gr).textContent = n.label;
        if (n.sub) el('text', { x: n._w / 2, y: 32, 'text-anchor': 'middle', 'class': 'tsub' }, gr).textContent = n.sub;
      }
      var tip = el('title', {}, gr); tip.textContent = n.tip || (n.loc ? 'line ' + n.loc.line + ', col ' + n.loc.col : n.label);
      gr.addEventListener('click', function () {
        if (selected) selected.querySelector('rect').style.strokeWidth = '';
        selected = gr; gr.querySelector('rect').style.strokeWidth = '3';
        if (opts.onSelect) opts.onSelect(n);
      });
    })(tree);

    var pz = new PanZoom(svg, g, { min: 0.08, max: 3, fitMax: 1.15 });
    var box = { x: -10, y: -10, w: tree._tw + 20, h: ys[ys.length - 1] + levels[levels.length - 1] + 20 };
    // fit the whole tree if it stays readable, otherwise start zoomed on the root
    function initial() {
      var sz = pz.size(); if (!sz.w) return;
      if (pz.fitScale(box, 24) >= 0.62) pz.fit(box, 24);
      else pz.place(tree._x, -10, sz.w / 2, 24, 0.85);
    }
    requestAnimationFrame(initial);
    var ctl = document.createElement('div');
    ctl.className = 'zoom-ctrl';
    ctl.innerHTML = '<button class="btn" title="Zoom in">+</button><button class="btn" title="Zoom out">−</button><button class="btn" title="Fit">⤢</button>';
    ctl.children[0].onclick = function () { pz.zoomBy(1.3); };
    ctl.children[1].onclick = function () { pz.zoomBy(1 / 1.3); };
    ctl.children[2].onclick = function () { pz.fit(box, 24, true); };
    container.appendChild(ctl);
    return { fit: initial, panzoom: pz, box: box };
  }

  /* ---------- converters from compiler output to display trees ---------- */

  function fromParseTree(pt) {
    function conv(n) {
      var out = { label: n.label, children: [], cls: n.error ? 'err' : (n.token ? 'leaf' : 'nt') };
      if (n.token) { out.label = n.value === undefined ? n.label : n.value; out.sub = n.label; out.loc = n.line ? { line: n.line, col: n.col, length: String(n.value).length } : null; }
      (n.children || []).forEach(function (c) { out.children.push(conv(c)); });
      // collapse the wrapper <stmt> -> <board> chain into one level for readability
      if (out.label === '<stmt>' && out.children.length === 1 && !n.error) {
        var only = out.children[0]; only.label = only.label; return only;
      }
      return out;
    }
    return conv(pt);
  }

  function fromAST(ast, sem, net) {
    var symbolOf = {};
    if (sem) sem.symbols.forEach(function (s) { symbolOf[s.kind + ':' + s.written] = s; });
    function stationNode(st) {
      var attrs = ['name: "' + st.text + '"'], s = symbolOf['station:' + st.text];
      if (s && s.valid && s.name !== st.text) attrs.push('resolved: "' + s.name + '"');
      if (s && s.valid) attrs.push('type: ' + s.type);
      if (s && !s.valid) attrs.push('type: ✖ unknown');
      return { label: 'Station', attrs: attrs, cls: 'ast' + (s && !s.valid ? ' err' : ''), loc: st, children: [] };
    }
    function lineNode(l) {
      var line = net.lineById[l.name];
      return { label: 'Line', attrs: ['name: ' + (line ? line.name : l.name)], cls: 'ast', loc: l, children: [] };
    }
    var rootN = { label: 'Program', attrs: ['statements: ' + ast.body.length], cls: 'ast', children: [] };
    ast.body.forEach(function (s, i) {
      var n = { label: s.type, attrs: ['#' + (i + 1) + '  line ' + s.line], cls: 'ast', loc: { line: s.line, col: s.col, length: s.type.length }, children: [] };
      if (s.type === 'Board') n.children.push(stationNode(s.station));
      if (s.type === 'Ride') {
        if (s.lineName) n.children.push(lineNode(s.lineName));
        else n.attrs.push('line: (current)');
        n.children.push(stationNode(s.station));
      }
      if (s.type === 'Change') n.children.push(lineNode(s.lineName));
      rootN.children.push(n);
    });
    return rootN;
  }

  root.TreeView = { render: render, fromParseTree: fromParseTree, fromAST: fromAST };
})(window);
