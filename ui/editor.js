/* =====================================================================
 * Code editor: a <textarea> with a syntax-highlighted <pre> behind it.
 * Colours come straight from the LEXER's tokens, so what you see in
 * the editor is exactly how the compiler tokenised your code.
 * ===================================================================== */
(function (root) {
  'use strict';

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function Editor(opts) {
    var self = this;
    this.ta = opts.textarea; this.pre = opts.pre; this.gutter = opts.gutter;
    this.lineColours = opts.lineColours || {};
    this.onChange = opts.onChange || function () {};
    this.onCursor = opts.onCursor || function () {};
    this.onRun = opts.onRun || function () {};
    this.tokens = []; this.diags = []; this.mark = null;

    this.ta.addEventListener('input', function () { self.mark = null; self.render(); self.onChange(self.getValue()); });
    this.ta.addEventListener('scroll', function () { self.syncScroll(); });
    ['keyup', 'click', 'select'].forEach(function (ev) { self.ta.addEventListener(ev, function () { self.reportCursor(); }); });
    this.ta.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); self.onRun(); return; }
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); self.insert('  '); }
    });
  }

  Editor.prototype.getValue = function () { return this.ta.value; };
  Editor.prototype.setValue = function (v) { this.ta.value = v; this.mark = null; this.render(); this.ta.scrollTop = 0; this.syncScroll(); };

  Editor.prototype.insert = function (text) {
    var ta = this.ta, a = ta.selectionStart, b = ta.selectionEnd;
    ta.setRangeText(text, a, b, 'end');
    ta.dispatchEvent(new Event('input'));
    ta.focus();
  };

  Editor.prototype.syncScroll = function () {
    this.pre.scrollTop = this.ta.scrollTop; this.pre.scrollLeft = this.ta.scrollLeft;
    this.gutter.scrollTop = this.ta.scrollTop;
  };

  Editor.prototype.reportCursor = function () {
    var v = this.ta.value.slice(0, this.ta.selectionStart).split('\n');
    this.onCursor(v.length, v[v.length - 1].length + 1);
  };

  /** convert line/col (1-based) to a character index */
  Editor.prototype.indexOf = function (line, col) {
    var lines = this.ta.value.split('\n'), idx = 0;
    for (var i = 0; i < line - 1 && i < lines.length; i++) idx += lines[i].length + 1;
    return idx + col - 1;
  };

  Editor.prototype.goTo = function (line, col, length) {
    var a = this.indexOf(line, col);
    this.ta.focus();
    this.ta.setSelectionRange(a, a + (length || 0));
    // scroll the line into view
    var lh = 22, top = (line - 1) * lh;
    if (top < this.ta.scrollTop || top > this.ta.scrollTop + this.ta.clientHeight - lh * 2) this.ta.scrollTop = Math.max(0, top - lh * 3);
    this.syncScroll();
    this.reportCursor();
  };

  /** highlight a range (from clicking a token / tree node) */
  Editor.prototype.highlight = function (line, col, length) {
    this.mark = line ? { start: this.indexOf(line, col), end: this.indexOf(line, col) + Math.max(1, length || 1) } : null;
    this.render();
    if (line) {
      var lh = 22, top = (line - 1) * lh;
      if (top < this.ta.scrollTop || top > this.ta.scrollTop + this.ta.clientHeight - lh * 2) { this.ta.scrollTop = Math.max(0, top - lh * 3); this.syncScroll(); }
    }
  };

  Editor.prototype.setAnalysis = function (tokens, diags) { this.tokens = tokens || []; this.diags = diags || []; this.render(); };

  Editor.prototype.render = function () {
    var src = this.ta.value, n = src.length, self = this;
    var cls = new Array(n), style = new Array(n), sq = new Array(n);
    // token classes (only valid if tokens match current text)
    this.tokens.forEach(function (t) {
      if (t.type === 'EOF') return;
      for (var i = t.index; i < t.index + t.length && i < n; i++) {
        cls[i] = 'tk-' + t.type;
        if (t.type === 'LINE' && self.lineColours[t.value]) style[i] = 'color:' + self.lineColours[t.value];
      }
    });
    this.diags.forEach(function (d) {
      var a = self.indexOf(d.line, d.col), b = a + Math.max(1, d.length || 1);
      if (a >= n) a = Math.max(0, n - 1), b = n; // errors at end of input
      for (var i = a; i < b && i < n; i++) if (src.charAt(i) !== '\n') { if (sq[i] !== 'sq-error') sq[i] = 'sq-' + d.severity; }
    });
    var html = '', i = 0;
    while (i < n) {
      var j = i, inMark = this.mark && i >= this.mark.start && i < this.mark.end;
      while (j < n && cls[j] === cls[i] && style[j] === style[i] && sq[j] === sq[i] &&
        (this.mark ? (j >= this.mark.start && j < this.mark.end) === inMark : true)) j++;
      var text = esc(src.slice(i, j)), c = [cls[i], sq[i], inMark ? 'hl' : ''].filter(Boolean).join(' ');
      html += c || style[i] ? '<span class="' + c + '"' + (style[i] ? ' style="' + style[i] + '"' : '') + '>' + text + '</span>' : text;
      i = j;
    }
    this.pre.innerHTML = html + '\n\n';
    // gutter
    var lines = src.split('\n').length, errLines = {}, g = '';
    this.diags.forEach(function (d) { if (d.severity === 'error') errLines[d.line] = 'err'; else if (!errLines[d.line]) errLines[d.line] = 'warn'; });
    for (var k = 1; k <= lines; k++) g += '<div class="' + (errLines[k] || '') + '">' + k + '</div>';
    this.gutter.innerHTML = g + '<div></div><div></div>';
    this.syncScroll();
  };

  root.Editor = Editor;
})(window);
