/* Tiny pan & zoom helper for an <svg> with one content <g>. */
(function (root) {
  'use strict';
  function PanZoom(svg, g, opts) {
    opts = opts || {};
    var s = 1, tx = 0, ty = 0, minS = opts.min || 0.1, maxS = opts.max || 8, self = this, anim = null;
    var pointers = {}, lastDist = 0, dragging = false, last = null, moved = false;

    function apply() { g.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + s + ')'); if (opts.onChange) opts.onChange(s); }
    function rect() { return svg.getBoundingClientRect(); }
    function zoomAt(f, cx, cy) {
      var ns = Math.max(minS, Math.min(maxS, s * f)); f = ns / s;
      tx = cx - (cx - tx) * f; ty = cy - (cy - ty) * f; s = ns; apply();
    }

    svg.addEventListener('wheel', function (e) {
      e.preventDefault(); stop();
      var r = rect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    svg.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      dragging = true; moved = false; last = { x: e.clientX, y: e.clientY }; stop();
    });
    window.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y), r = rect();
        if (lastDist) zoomAt(d / lastDist, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        lastDist = d; moved = true; return;
      }
      if (!dragging) return;
      var dx = e.clientX - last.x, dy = e.clientY - last.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      tx += dx; ty += dy; last = { x: e.clientX, y: e.clientY }; apply();
    });
    function up(e) { delete pointers[e.pointerId]; lastDist = 0; if (!Object.keys(pointers).length) dragging = false; }
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    // swallow the click that ends a drag
    svg.addEventListener('click', function (e) { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);

    function stop() { if (anim) { cancelAnimationFrame(anim); anim = null; } }

    /** Fit a content-space box {x,y,w,h} into view */
    this.fit = function (box, pad, animate) {
      var r = rect(); if (!r.width || !r.height) return;
      pad = pad == null ? 30 : pad;
      var ns = Math.min((r.width - pad * 2) / Math.max(box.w, 1), (r.height - pad * 2) / Math.max(box.h, 1));
      ns = Math.max(minS, Math.min(opts.fitMax || maxS, ns));
      var ntx = r.width / 2 - (box.x + box.w / 2) * ns, nty = r.height / 2 - (box.y + box.h / 2) * ns;
      if (!animate) { s = ns; tx = ntx; ty = nty; apply(); return; }
      stop();
      var s0 = s, x0 = tx, y0 = ty, t0 = performance.now(), dur = 650;
      (function step(t) {
        var k = Math.min(1, (t - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        s = s0 + (ns - s0) * e; tx = x0 + (ntx - x0) * e; ty = y0 + (nty - y0) * e; apply();
        if (k < 1) anim = requestAnimationFrame(step); else anim = null;
      })(t0);
    };
    /** put content point (x,y) at screen position (sx,sy) with scale ns */
    this.place = function (x, y, sx, sy, ns) { stop(); s = Math.max(minS, Math.min(maxS, ns)); tx = sx - x * s; ty = sy - y * s; apply(); };
    this.fitScale = function (box, pad) { var r = rect(); pad = pad == null ? 30 : pad; return Math.min((r.width - pad * 2) / Math.max(box.w, 1), (r.height - pad * 2) / Math.max(box.h, 1)); };
    this.size = function () { var r = rect(); return { w: r.width, h: r.height }; };
    this.zoomBy = function (f) { var r = rect(); stop(); zoomAt(f, r.width / 2, r.height / 2); };
    this.scale = function () { return s; };
    this.toScreen = function (x, y) { return { x: x * s + tx, y: y * s + ty }; };
    apply();
  }
  root.PanZoom = PanZoom;
})(window);
