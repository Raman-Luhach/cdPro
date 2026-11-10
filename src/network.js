/* =====================================================================
 * network.js — builds the metro graph from METRO_DATA
 * Used by the semantic analyser (symbol lookup), the IR generator
 * (paths between stations) and the optimizer (shortest route).
 * ===================================================================== */
(function (root) {
  'use strict';
  var ML = root.MetroLang = root.MetroLang || {};

  /** "Dilli Haat - INA" -> "dilli haat ina" (case/punctuation-insensitive matching) */
  function normalize(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /** Classic Levenshtein edit distance (used for "Did you mean ...?") */
  function editDistance(a, b) {
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  function Network(data) {
    var self = this;
    this.data = data;
    this.lines = [];          // line objects
    this.lineById = {};
    this.stations = {};       // official name -> station record
    this.index = {};          // normalized name/alias -> official name
    this.timeModel = data.timeModel;

    data.lines.forEach(function (raw) {
      var line = { id: raw.id, name: raw.name, colour: raw.colour, lengthKm: raw.lengthKm, routes: [], routeNames: raw.routeNames || [] };
      raw.routes.forEach(function (r, ri) {
        var stations = [];
        r.forEach(function (s) {
          var m = /^@main\.\.(.+)$/.exec(s);
          if (m) {
            var main = line.routes[0].stations;
            stations = stations.concat(main.slice(0, main.indexOf(m[1]) + 1));
          } else stations.push(s);
        });
        var hopKm = raw.hopKm ? raw.hopKm[ri] : raw.lengthKm / (stations.length - 1);
        line.routes.push({ stations: stations, hopKm: hopKm, hopMin: hopKm / data.timeModel.avgSpeedKmh * 60 });
      });
      // every distinct station on the line, in order of first appearance
      var all = [];
      line.routes.forEach(function (r) { r.stations.forEach(function (s) { if (all.indexOf(s) < 0) all.push(s); }); });
      line.stations = all;
      self.lines.push(line);
      self.lineById[line.id] = line;
      all.forEach(function (s) {
        if (!self.stations[s]) self.stations[s] = { name: s, lines: [] };
        self.stations[s].lines.push(line.id);
      });
    });

    Object.keys(this.stations).forEach(function (s) {
      var st = self.stations[s];
      st.isInterchange = st.lines.length > 1;
      self.index[normalize(s)] = s;
    });
    Object.keys(data.aliases).forEach(function (a) {
      if (self.stations[data.aliases[a]]) self.index[normalize(a)] = data.aliases[a];
    });
    this._layout();
  }

  /** Resolve a user-written station name to its official name (or null) */
  Network.prototype.findStation = function (text) {
    return this.index[normalize(text)] || null;
  };

  Network.prototype.findLine = function (text) {
    var n = normalize(text);
    for (var i = 0; i < this.lines.length; i++) if (this.lines[i].id === n) return this.lines[i];
    return null;
  };

  /** Up to 3 closest station names for a misspelt name */
  Network.prototype.suggestStations = function (text, max) {
    var n = normalize(text), self = this, scored = [];
    Object.keys(this.index).forEach(function (key) {
      var d = editDistance(n, key);
      // also reward prefix matches ("rajiv" -> "rajiv chowk")
      if (key.indexOf(n) === 0 && n.length >= 3) d = Math.min(d, 1);
      scored.push({ name: self.index[key], d: d });
    });
    scored.sort(function (a, b) { return a.d - b.d; });
    var out = [], limit = Math.max(2, Math.round(n.length * 0.4));
    for (var i = 0; i < scored.length && out.length < (max || 3); i++) {
      if (scored[i].d <= limit && out.indexOf(scored[i].name) < 0) out.push(scored[i].name);
    }
    return out;
  };

  Network.prototype.suggestLine = function (text) {
    var n = normalize(text), best = null, bd = 99;
    this.lines.forEach(function (l) { var d = editDistance(n, l.id); if (d < bd) { bd = d; best = l; } });
    return bd <= 2 ? best.name : null;
  };

  Network.prototype.isOnLine = function (station, lineId) {
    var st = this.stations[station];
    return !!st && st.lines.indexOf(lineId) >= 0;
  };

  /**
   * Find a single-train path between two stations on one line.
   * Returns { path:[stations], routeIndex, towards, hops, km, minutes } or null
   * (null happens e.g. Noida Sector 18 -> Vaishali: no direct Blue train).
   */
  Network.prototype.segment = function (lineId, from, to) {
    var line = this.lineById[lineId];
    if (!line) return null;
    var best = null, termini = [];
    line.routes.forEach(function (r, ri) {
      var a = r.stations.indexOf(from), b = r.stations.indexOf(to);
      if (a < 0 || b < 0 || a === b) return;
      var path = a < b ? r.stations.slice(a, b + 1) : r.stations.slice(b, a + 1).reverse();
      var towards = a < b ? r.stations[r.stations.length - 1] : r.stations[0];
      if (termini.indexOf(towards) < 0) termini.push(towards);
      if (!best || path.length < best.path.length) {
        best = { path: path, routeIndex: ri, hops: path.length - 1, km: (path.length - 1) * r.hopKm, minutes: (path.length - 1) * r.hopMin };
      }
    });
    if (best) best.towards = termini.join(' / ');
    return best;
  };

  /** Lines that serve both stations, i.e. you could ride directly. */
  Network.prototype.commonLines = function (a, b) {
    var A = this.stations[a], B = this.stations[b];
    if (!A || !B) return [];
    return A.lines.filter(function (l) { return B.lines.indexOf(l) >= 0; });
  };

  /**
   * Fastest route (Dijkstra) over (station, line) states.
   * Changing line costs interchangeMin. Returns list of legs.
   */
  Network.prototype.shortestRoute = function (from, to) {
    var self = this, tm = this.timeModel;
    if (!this.stations[from] || !this.stations[to] || from === to) return null;
    var adj = this._adj || (this._adj = this._buildAdjacency());
    var dist = {}, prev = {}, done = {}, queue = [];
    this.stations[from].lines.forEach(function (l) { var k = from + '|' + l; dist[k] = 0; queue.push(k); });
    while (queue.length) {
      queue.sort(function (a, b) { return dist[a] - dist[b]; });
      var u = queue.shift();
      if (done[u]) continue;
      done[u] = true;
      if (u.split('|')[0] === to) { var endKey = u; break; }
      (adj[u] || []).forEach(function (e) {
        var nd = dist[u] + e.w;
        if (dist[e.to] === undefined || nd < dist[e.to] - 1e-9) { dist[e.to] = nd; prev[e.to] = u; queue.push(e.to); }
      });
    }
    if (!endKey) return null;
    var states = [];
    for (var k = endKey; k; k = prev[k]) states.unshift(k);
    // turn state sequence into legs (split at line changes and route breaks)
    var legs = [], cur = null;
    states.forEach(function (sk) {
      var p = sk.split('|'), st = p[0], ln = p[1];
      if (!cur) { cur = { line: ln, from: st, to: st, last: st }; return; }
      if (ln !== cur.line) { legs.push(cur); cur = { line: ln, from: st, to: st, last: st }; return; }
      if (st === cur.to) return;
      if (!self.segment(ln, cur.from, st)) { legs.push(cur); cur = { line: ln, from: cur.to, to: st }; return; }
      cur.to = st;
    });
    legs.push(cur);
    legs = legs.filter(function (l) { return l.from !== l.to; });
    var minutes = tm.entryMin + tm.exitMin, prevLine = null;
    legs.forEach(function (l) {
      var seg = self.segment(l.line, l.from, l.to);
      l.minutes = seg.minutes; l.hops = seg.hops; minutes += seg.minutes;
      if (prevLine && prevLine !== l.line) minutes += tm.interchangeMin;
      prevLine = l.line;
      delete l.last;
    });
    return { legs: legs, minutes: minutes };
  };

  Network.prototype._buildAdjacency = function () {
    var adj = {}, self = this;
    function add(a, b, w) { (adj[a] = adj[a] || []).push({ to: b, w: w }); }
    this.lines.forEach(function (line) {
      line.routes.forEach(function (r) {
        for (var i = 0; i + 1 < r.stations.length; i++) {
          var a = r.stations[i] + '|' + line.id, b = r.stations[i + 1] + '|' + line.id;
          add(a, b, r.hopMin); add(b, a, r.hopMin);
        }
      });
    });
    Object.keys(this.stations).forEach(function (s) {
      var ls = self.stations[s].lines;
      ls.forEach(function (l1) { ls.forEach(function (l2) {
        if (l1 !== l2) add(s + '|' + l1, s + '|' + l2, self.timeModel.interchangeMin);
      }); });
    });
    return adj;
  };

  /** Fare from DMRC distance slabs */
  Network.prototype.fareFor = function (km) {
    var slabs = this.data.fareSlabs;
    for (var i = 0; i < slabs.length; i++) if (km <= slabs[i].upto) return slabs[i].fare;
    return slabs[slabs.length - 1].fare;
  };

  /** Give every station an x,y for the map (interpolating missing coords). */
  Network.prototype._layout = function () {
    var self = this, coords = this.data.coords, pos = {};
    Object.keys(coords).forEach(function (s) { pos[s] = coords[s].slice(); });
    this.lines.forEach(function (line) {
      line.routes.forEach(function (r) {
        var st = r.stations, i = 0;
        while (i < st.length) {
          if (pos[st[i]]) { i++; continue; }
          var a = i - 1, b = i;
          while (b < st.length && !pos[st[b]]) b++;
          var pa = pos[st[a]], pb = pos[st[b]];
          for (var k = a + 1; k < b; k++) {
            var t = (k - a) / (b - a);
            pos[st[k]] = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t];
          }
          i = b;
        }
      });
    });
    // project lon/lat -> SVG units (equirectangular, Delhi latitude)
    var minLon = 99, maxLat = -99, maxLon = -99, minLat = 99;
    Object.keys(pos).forEach(function (s) {
      minLon = Math.min(minLon, pos[s][0]); maxLon = Math.max(maxLon, pos[s][0]);
      minLat = Math.min(minLat, pos[s][1]); maxLat = Math.max(maxLat, pos[s][1]);
    });
    var k = 2600, c = Math.cos(28.6 * Math.PI / 180), pad = 40;
    this.project = function (lon, lat) { return { x: pad + (lon - minLon) * c * k, y: pad + (maxLat - lat) * k }; };
    Object.keys(this.stations).forEach(function (s) {
      var p = pos[s];
      self.stations[s].x = pad + (p[0] - minLon) * c * k;
      self.stations[s].y = pad + (maxLat - p[1]) * k;
    });
    this.mapWidth = pad * 2 + (maxLon - minLon) * c * k;
    this.mapHeight = pad * 2 + (maxLat - minLat) * k;
  };

  ML.normalize = normalize;
  ML.editDistance = editDistance;
  ML.Network = Network;
})(typeof window !== 'undefined' ? window : globalThis);
