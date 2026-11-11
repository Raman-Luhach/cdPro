/* =====================================================================
 * PHASE 5 — CODE OPTIMIZATION
 * Peephole passes over the IR, repeated until nothing changes
 * (fixed point). Every rewrite keeps the same start and end station.
 *
 *   O1  Merge rides     RIDE L A->B ; RIDE L B->C   (same direction)  =>  RIDE L A->C
 *   O2  Remove detour   RIDE L A->B ; RIDE L B->C   (direction flips) =>  RIDE L A->C
 *                       (and if C == A both rides are deleted)
 *   O3  Merge changes   CHANGE x->y ; CHANGE y->z  =>  CHANGE x->z   (x == z: delete both)
 *   O4  Dead change     CHANGE x->y ; EXIT         =>  EXIT
 *   O5  Route advisor   Dijkstra over the metro graph suggests a faster route
 *                       (advice only — the passenger's route is respected)
 * ===================================================================== */
(function (root) {
  'use strict';
  var ML = root.MetroLang = root.MetroLang || {};

  function optimize(irIn, net) {
    var ir = irIn.map(function (q) { var c = {}; for (var k in q) c[k] = q[k]; c.origin = [q.id]; return c; });
    var log = [], changed = true, guard = 0;

    function name(id) { return net.lineById[id].name; }
    function rideFrom(line, a, b, base) {
      var seg = net.segment(line, a, b);
      return { op: 'RIDE', line: line, from: a, to: b, arg1: name(line), arg2: a, result: b, seg: seg, origin: base, srcLine: null };
    }

    while (changed && guard++ < 50) {
      changed = false;
      for (var i = 0; i + 1 < ir.length && !changed; i++) {
        var a = ir[i], b = ir[i + 1], origin = a.origin.concat(b.origin);

        // O1 / O2 — two rides on the same line
        if (a.op === 'RIDE' && b.op === 'RIDE' && a.line === b.line) {
          if (b.to === a.from) {
            log.push({ rule: 'O2', title: 'Remove round trip', detail: 'Rode ' + a.from + ' → ' + a.to + ' and straight back on the ' + name(a.line) + ' line — both rides deleted', removed: origin, added: [] });
            ir.splice(i, 2); changed = true; break;
          }
          var seg = net.segment(a.line, a.from, b.to);
          if (seg) {
            var sameDir = seg.path.indexOf(a.to) > 0;
            var merged = rideFrom(a.line, a.from, b.to, origin);
            log.push(sameDir
              ? { rule: 'O1', title: 'Merge consecutive rides', detail: a.from + ' → ' + a.to + ' → ' + b.to + ' on the ' + name(a.line) + ' line is one ride: ' + a.from + ' → ' + b.to, removed: origin, added: [merged] }
              : { rule: 'O2', title: 'Remove back-and-forth', detail: 'Going to ' + a.to + ' and turning back is a detour — ride ' + a.from + ' → ' + b.to + ' directly (' + (a.seg.hops + b.seg.hops - seg.hops) + ' stops saved)', removed: origin, added: [merged] });
            ir.splice(i, 2, merged); changed = true; break;
          }
        }

        // O3 — two changes in a row
        if (a.op === 'CHANGE' && b.op === 'CHANGE') {
          if (a.fromLine === b.toLine) {
            log.push({ rule: 'O3', title: 'Remove cancelling changes', detail: name(a.fromLine) + ' → ' + name(a.toLine) + ' → ' + name(b.toLine) + ' at ' + a.at + ' ends on the same line — both deleted', removed: origin, added: [] });
            ir.splice(i, 2);
          } else {
            var mc = { op: 'CHANGE', fromLine: a.fromLine, toLine: b.toLine, at: a.at, arg1: name(a.fromLine), arg2: name(b.toLine), result: a.at, origin: origin };
            log.push({ rule: 'O3', title: 'Merge consecutive changes', detail: name(a.fromLine) + ' → ' + name(a.toLine) + ' → ' + name(b.toLine) + ' at ' + a.at + ' is one change: ' + name(a.fromLine) + ' → ' + name(b.toLine), removed: origin, added: [mc] });
            ir.splice(i, 2, mc);
          }
          changed = true; break;
        }

        // O4 — change that is never used
        if (a.op === 'CHANGE' && b.op === 'EXIT') {
          log.push({ rule: 'O4', title: 'Dead change elimination', detail: 'Changing to the ' + name(a.toLine) + ' line and exiting immediately has no effect — change deleted', removed: a.origin, added: [] });
          ir.splice(i, 1); changed = true; break;
        }
      }
    }
    // renumber
    ir.forEach(function (q, k) { q.id = k + 1; });

    // O5 — route advisor
    var advice = null, board = ir[0], exit = ir[ir.length - 1];
    if (board && exit && board.op === 'BOARD' && exit.op === 'EXIT' && board.station !== exit.station) {
      var mine = ML.irCost(ir, net), best = net.shortestRoute(board.station, exit.station);
      if (best && best.minutes + 1.5 < mine.minutes) {
        advice = { yours: mine.minutes, best: best.minutes, legs: best.legs, code: routeToCode(board.station, best.legs, net) };
        log.push({ rule: 'O5', title: 'Faster route found', detail: 'Dijkstra found a route of ~' + Math.round(best.minutes) + ' min vs your ~' + Math.round(mine.minutes) + ' min (advice only)', removed: [], added: [], advisory: true });
      }
    }
    return { ir: ir, log: log, advice: advice };
  }

  /** Generate MetroLang source for a list of legs (used by O5 advice) */
  function routeToCode(start, legs, net) {
    var out = ['board ' + start + ';'], prev = null;
    legs.forEach(function (l, i) {
      var nm = net.lineById[l.line].name;
      if (prev && prev !== l.line) out.push('change ' + nm + ';');
      out.push(prev === l.line && i > 0 ? 'ride to ' + l.to + ';' : (prev ? 'ride to ' + l.to + ';' : 'ride ' + nm + ' to ' + l.to + ';'));
      prev = l.line;
    });
    out.push('exit;');
    return out.join('\n');
  }

  ML.optimize = optimize;
  ML.routeToCode = routeToCode;
})(typeof window !== 'undefined' ? window : globalThis);
