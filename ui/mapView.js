/* =====================================================================
 * Metro map + journey animation (SVG)
 * Draws all 6 lines from the network data, then animates a train
 * along the path produced by the code generator.
 * ===================================================================== */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // rough course of the Yamuna river, for geographic context
  var YAMUNA = [[77.236, 28.76], [77.232, 28.72], [77.238, 28.69], [77.248, 28.665], [77.258, 28.64], [77.262, 28.615],
    [77.272, 28.595], [77.282, 28.575], [77.296, 28.55], [77.312, 28.52], [77.322, 28.49], [77.33, 28.45], [77.345, 28.40], [77.36, 28.34]];

  function MapView(box, net, opts) {
    this.box = box; this.net = net; this.opts = opts || {};
    this.speed = 2; this.playing = false; this.journey = null; this.raf = null;
    this.hidden = {};
    this._build();
  }

  MapView.prototype._build = function () {
    var self = this, net = this.net;
    var svg = this.svg = el('svg', { role: 'img', 'aria-label': 'Delhi Metro map' });
    this.box.appendChild(svg);
    var g = this.g = el('g', {}, svg);

    // background: river + grid
    var bg = el('g', {}, g);
    var river = YAMUNA.map(function (p) { var q = net.project(p[0], p[1]); return q.x + ',' + q.y; }).join(' ');
    el('polyline', { points: river, fill: 'none', stroke: '#60a5fa', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .16 }, bg);
    var rl = net.project(77.262, 28.70);
    el('text', { x: rl.x + 6, y: rl.y, 'class': 'm-label', 'font-size': 13, fill: '#3b9ad9', 'font-style': 'italic', opacity: .8 }, bg).textContent = 'Yamuna';

    this.linesG = el('g', {}, g);
    this.routeG = el('g', {}, g);
    this.stnG = el('g', {}, g);
    this.labelG = el('g', {}, g);
    this.trainG = el('g', {}, g);
    this.lineEls = {}; this.stnEls = {}; this.labelEls = {};

    net.lines.forEach(function (line) {
      self.lineEls[line.id] = [];
      line.routes.forEach(function (r) {
        var pts = r.stations.map(function (s) { var st = net.stations[s]; return st.x + ',' + st.y; }).join(' ');
        self.lineEls[line.id].push(el('polyline', { points: pts, 'class': 'm-line', stroke: line.colour }, self.linesG));
      });
    });

    var termini = {};
    net.lines.forEach(function (l) { l.routes.forEach(function (r) { termini[r.stations[0]] = 1; termini[r.stations[r.stations.length - 1]] = 1; }); });

    Object.keys(net.stations).forEach(function (name) {
      var st = net.stations[name], line = net.lineById[st.lines[0]];
      var c = st.isInterchange
        ? el('circle', { cx: st.x, cy: st.y, r: 5.6, 'class': 'm-ix' }, self.stnG)
        : el('circle', { cx: st.x, cy: st.y, r: 3.3, 'class': 'm-stn', stroke: line.colour }, self.stnG);
      self.stnEls[name] = c;
      c.addEventListener('mouseenter', function () { self._tip(name); });
      c.addEventListener('mouseleave', function () { self._tip(null); });
      c.addEventListener('click', function () { if (self.opts.onStationClick) self.opts.onStationClick(name); });
      var major = st.isInterchange || termini[name];
      var lb = el('text', { x: st.x + (st.isInterchange ? 8 : 6), y: st.y + 3.5, 'class': 'm-label' + (st.isInterchange ? ' ix' : '') }, self.labelG);
      lb.textContent = name;
      lb.style.display = major ? '' : 'none';
      self.labelEls[name] = { el: lb, major: !!major };
    });

    this.pz = new PanZoom(svg, g, { min: 0.35, max: 10, fitMax: 4, onChange: function (s) { self._zoomLabels(s); } });
    this.full = { x: 0, y: 0, w: net.mapWidth, h: net.mapHeight };
    requestAnimationFrame(function () { self.fitAll(); });

    var ctl = document.createElement('div');
    ctl.className = 'zoom-ctrl';
    ctl.innerHTML = '<button class="btn" title="Zoom in">+</button><button class="btn" title="Zoom out">−</button><button class="btn" title="Show whole network">⤢</button><button class="btn" title="Zoom to journey">◎</button>';
    ctl.children[0].onclick = function () { self.pz.zoomBy(1.4); };
    ctl.children[1].onclick = function () { self.pz.zoomBy(1 / 1.4); };
    ctl.children[2].onclick = function () { self.fitAll(true); };
    ctl.children[3].onclick = function () { self.fitJourney(true); };
    this.box.appendChild(ctl);
  };

  MapView.prototype.fitAll = function (animate) { this.pz.fit(this.full, 16, animate); };
  MapView.prototype.fitJourney = function (animate) {
    if (!this.journey || !this.journey.path.length) return this.fitAll(animate);
    var xs = this.journey.path.map(function (p) { return p.x; }), ys = this.journey.path.map(function (p) { return p.y; });
    var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys);
    var w = Math.max(x1 - x0, 120), h = Math.max(y1 - y0, 120);
    this.pz.fit({ x: (x0 + x1) / 2 - w / 2 - 30, y: (y0 + y1) / 2 - h / 2 - 30, w: w + 120, h: h + 60 }, 30, animate);
  };

  MapView.prototype.refit = function () { if (this.journey) this.fitJourney(); else this.fitAll(); };

  MapView.prototype._zoomLabels = function (s) {
    this.labelG.style.fontSize = (10.5 / s) + 'px';
    this.labelG.style.strokeWidth = (3 / s) + 'px';
    if (this.train && this.journey) this._renderAt(this.progress || 0);
    var all = this.showAll || s > 2.2, self = this, inJ = this.journeySet || {}, net = this.net;
    var path = this.journey ? this.journey.path : [], ends = {};
    if (path.length) { ends[path[0].station] = 1; ends[path[path.length - 1].station] = 1; }
    // candidates in priority order: journey ends > journey interchanges > journey > interchanges > termini > rest
    var cand = [];
    Object.keys(this.labelEls).forEach(function (n) {
      var L = self.labelEls[n], st = net.stations[n];
      if (!(L.major || all || inJ[n])) { L.el.style.display = 'none'; return; }
      var pr = ends[n] ? 0 : (inJ[n] && st.isInterchange) ? 1 : inJ[n] ? 2 : st.isInterchange ? 3 : L.major ? 4 : 5;
      cand.push({ n: n, L: L, st: st, pr: pr });
    });
    cand.sort(function (a, b) { return a.pr - b.pr; });
    // greedy collision avoidance in content units (font size = 10.5 / scale)
    var fs = 10.5 / s, placed = [];
    cand.forEach(function (c) {
      var em = c.pr <= 2 ? 1.12 : (c.st.isInterchange ? 1.04 : 1), w = c.n.length * fs * em * 0.56, h = fs * em * 1.05;
      var x0 = c.st.x + (c.st.isInterchange ? 8 : 6), y0 = c.st.y + 3.5 - h * 0.8;
      var box = { x0: x0, y0: y0, x1: x0 + w, y1: y0 + h };
      var hit = placed.some(function (b) { return box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0; });
      c.L.el.style.display = hit ? 'none' : '';
      if (!hit) placed.push(box);
    });
  };
  MapView.prototype.setShowAll = function (v) { this.showAll = v; this._zoomLabels(this.pz.scale()); };

  MapView.prototype.toggleLine = function (id) {
    this.hidden[id] = !this.hidden[id];
    var self = this;
    this.lineEls[id].forEach(function (p) { p.style.display = self.hidden[id] ? 'none' : ''; });
    return !this.hidden[id];
  };

  MapView.prototype._tip = function (name) {
    var tip = this.opts.tip; if (!tip) return;
    if (!name) { tip.style.display = 'none'; return; }
    var st = this.net.stations[name], net = this.net, p = this.pz.toScreen(st.x, st.y);
    tip.innerHTML = '<b>' + name + '</b><br>' + st.lines.map(function (l) { return net.lineById[l].name; }).join(' · ') + ' line' + (st.lines.length > 1 ? 's — interchange' : '') + '<br><span style="opacity:.7">click to insert</span>';
    tip.style.left = p.x + 'px'; tip.style.top = p.y + 'px'; tip.style.display = 'block';
  };

  /** Clear journey overlay and show the plain network */
  MapView.prototype.clearJourney = function () {
    this.pause(); this.journey = null; this.journeySet = {};
    this.routeG.innerHTML = ''; this.trainG.innerHTML = '';
    var self = this;
    Object.keys(this.lineEls).forEach(function (id) { self.lineEls[id].forEach(function (p) { p.classList.remove('dim'); }); });
    Object.keys(this.stnEls).forEach(function (n) { self.stnEls[n].classList.remove('dim'); self.stnEls[n].style.fill = ''; });
    Object.keys(this.labelEls).forEach(function (n) { self.labelEls[n].el.classList.remove('dim', 'journey'); });
    this._zoomLabels(this.pz.scale());
    if (this.opts.onProgress) this.opts.onProgress(0, null);
  };

  /** Show a compiled journey: highlight its route and get the train ready */
  MapView.prototype.showJourney = function (out) {
    this.clearJourney();
    if (!out || !out.path.length) return;
    var self = this, net = this.net;
    this.journey = out; this.journeySet = {};
    out.path.forEach(function (p) { self.journeySet[p.station] = 1; });

    Object.keys(this.lineEls).forEach(function (id) { self.lineEls[id].forEach(function (p) { p.classList.add('dim'); }); });
    Object.keys(this.stnEls).forEach(function (n) { if (!self.journeySet[n]) self.stnEls[n].classList.add('dim'); });
    Object.keys(this.labelEls).forEach(function (n) {
      if (self.journeySet[n]) self.labelEls[n].el.classList.add('journey'); else self.labelEls[n].el.classList.add('dim');
    });

    // route drawn per leg
    out.summary.legs.forEach(function (leg) {
      var pts = leg.stations.map(function (s) { var st = net.stations[s]; return st.x + ',' + st.y; }).join(' ');
      el('polyline', { points: pts, 'class': 'm-route-glow', stroke: leg.colour }, self.routeG);
      el('polyline', { points: pts, 'class': 'm-route', stroke: leg.colour }, self.routeG);
    });
    this.routeG.parentNode.insertBefore(this.routeG, this.stnG);

    // start / end flags
    var a = out.path[0], b = out.path[out.path.length - 1];
    [[a, 'A', '#16a34a'], [b, 'B', '#dc2626']].forEach(function (f) {
      var gg = el('g', { transform: 'translate(' + f[0].x + ',' + (f[0].y - 16) + ')' }, self.routeG.parentNode === self.g ? self.trainG : self.trainG);
      el('path', { d: 'M0,12 L-7,0 A8,8 0 1,1 7,0 Z', fill: f[2], stroke: '#fff', 'stroke-width': 1.5 }, gg);
      el('text', { x: 0, y: 2, 'text-anchor': 'middle', fill: '#fff', 'font-size': 9, 'font-weight': 800, 'font-family': 'Inter, sans-serif' }, gg).textContent = f[1];
    });

    // train
    var t = this.train = el('g', { 'class': 'train', transform: 'translate(' + a.x + ',' + a.y + ')' }, this.trainG);
    this.trainPulse = el('circle', { r: 9, fill: a.colour, 'class': 'train-pulse' }, t);
    this.trainBody = el('circle', { r: 8.5, fill: '#fff', stroke: a.colour, 'stroke-width': 3.5 }, t);
    el('path', { d: 'M-3.6,-4 h7.2 a1.6,1.6 0 0 1 1.6,1.6 v4.4 a1.6,1.6 0 0 1 -1.6,1.6 h-7.2 a1.6,1.6 0 0 1 -1.6,-1.6 v-4.4 a1.6,1.6 0 0 1 1.6,-1.6z M-3.4,4.4 l-1.2,1.8 M3.4,4.4 l1.2,1.8', fill: '#1f2937', stroke: '#1f2937', 'stroke-width': .8 }, t);

    this.progress = 0; this.lastIdx = -1;
    this._buildTimeline();
    this._renderAt(0);
    this._zoomLabels(this.pz.scale());
    var selfRef = this;
    this.fitJourney(false);
    requestAnimationFrame(function () { selfRef.fitJourney(false); });
  };

  /** timeline in "hop units": each hop = 1; a line change adds a 1.4 pause at the interchange */
  MapView.prototype._buildTimeline = function () {
    var P = this.journey.path, marks = [0], t = 0;
    for (var i = 0; i + 1 < P.length; i++) {
      t += (i > 0 && P[i + 1].colour !== P[i].colour) ? 2.4 : 1;   // P[i] is an interchange
      marks.push(t);
    }
    this.marks = marks; this.total = Math.max(t, 0.0001);
  };

  MapView.prototype._renderAt = function (t) {
    var P = this.journey.path, m = this.marks, i = 0;
    while (i + 1 < m.length && m[i + 1] <= t) i++;
    var x = P[i].x, y = P[i].y, colour = P[i].colour;
    if (i + 1 < P.length) {
      // an interval longer than 1 means: wait at P[i] (interchange) first, then move
      var interval = m[i + 1] - m[i];
      var k = Math.max(0, Math.min(1, t - m[i] - (interval - 1)));
      k = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // ease in-out
      x = P[i].x + (P[i + 1].x - P[i].x) * k; y = P[i].y + (P[i + 1].y - P[i].y) * k;
      colour = P[i + 1].colour;
    }
    this.train.setAttribute('transform', 'translate(' + x + ',' + y + ') scale(' + this._trainScale() + ')');
    this.trainBody.setAttribute('stroke', colour); this.trainPulse.setAttribute('fill', colour);
    // mark visited stations
    var reached = i;
    if (i + 1 < P.length && t >= m[i + 1] - 1e-6) reached = i + 1;
    for (var v = 0; v < P.length; v++) {
      var c = this.stnEls[P[v].station];
      if (!c) continue;
      if (v <= reached) { if (!c.classList.contains('m-ix')) c.style.fill = P[v].colour; }
      else c.style.fill = '';
    }
    if (reached !== this.lastIdx) {
      this.lastIdx = reached;
      if (this.opts.onStation) this.opts.onStation(reached, P[reached], P);
    }
    if (this.opts.onProgress) this.opts.onProgress(t / this.total, P[reached]);
  };

  MapView.prototype._trainScale = function () { return Math.min(1.2, 1.7 / this.pz.scale()); };

  MapView.prototype.play = function () {
    if (!this.journey || this.journey.path.length < 2) return;
    if (this.progress >= this.total) this.progress = 0;
    this.playing = true;
    var self = this, last = performance.now();
    if (this.opts.onPlayState) this.opts.onPlayState(true);
    function step(now) {
      if (!self.playing) return;
      var dt = (now - last) / 1000; last = now;
      self.progress = Math.min(self.total, self.progress + dt * 1.6 * self.speed);
      self._renderAt(self.progress);
      if (self.progress >= self.total) { self.playing = false; if (self.opts.onPlayState) self.opts.onPlayState(false, true); return; }
      self.raf = requestAnimationFrame(step);
    }
    this.raf = requestAnimationFrame(step);
  };
  MapView.prototype.pause = function () {
    this.playing = false; if (this.raf) cancelAnimationFrame(this.raf);
    if (this.opts.onPlayState) this.opts.onPlayState(false);
  };
  MapView.prototype.replay = function () { this.pause(); this.progress = 0; if (this.journey) { this._renderAt(0); this.play(); } };
  MapView.prototype.seek = function (frac) { if (!this.journey) return; this.progress = frac * this.total; this._renderAt(this.progress); };

  root.MapView = MapView;
})(window);
