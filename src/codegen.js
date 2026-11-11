/* =====================================================================
 * PHASE 6 — CODE GENERATION
 * Turns the optimized IR into the final targets:
 *   1. Journey card data   (legs, stations, interchanges, time, fare)
 *   2. Animation path      (ordered stations + colours for the map)
 *   3. JSON e-ticket       (machine-readable target code)
 *   4. Plain-English directions
 * ===================================================================== */
(function (root) {
  'use strict';
  var ML = root.MetroLang = root.MetroLang || {};

  function generate(ir, net) {
    var tm = net.timeModel, legs = [], changes = [], board = null, exit = null;
    var minutes = tm.entryMin, km = 0, stops = 0;

    ir.forEach(function (q) {
      if (q.op === 'BOARD') board = q.station;
      if (q.op === 'EXIT') exit = q.station;
      if (q.op === 'RIDE') {
        var line = net.lineById[q.line];
        legs.push({
          line: line.name, lineId: line.id, colour: line.colour, from: q.from, to: q.to,
          towards: q.seg.towards, stations: q.seg.path.slice(), stops: q.seg.hops,
          km: round1(q.seg.km), minutes: Math.round(q.seg.minutes)
        });
        minutes += q.seg.minutes; km += q.seg.km; stops += q.seg.hops;
      }
      if (q.op === 'CHANGE') {
        changes.push({ at: q.at, from: net.lineById[q.fromLine].name, to: net.lineById[q.toLine].name, minutes: tm.interchangeMin });
        minutes += tm.interchangeMin;
      }
    });
    minutes += tm.exitMin;
    if (!legs.length) minutes = 0;
    var fare = legs.length ? net.fareFor(km) : 0;

    // animation path: list of points (station, colour) the train visits
    var path = [];
    legs.forEach(function (l) {
      l.stations.forEach(function (s, i) {
        if (i === 0 && path.length && path[path.length - 1].station === s) return;
        var st = net.stations[s];
        path.push({ station: s, x: st.x, y: st.y, colour: l.colour, line: l.line });
      });
    });

    // directions
    var steps = [];
    if (board) steps.push('Enter ' + board + ' metro station and go through security.');
    var ci = 0;
    legs.forEach(function (l, i) {
      if (i > 0 && changes[ci] && changes[ci].at === l.from) {
        steps.push('At ' + l.from + ', change to the ' + l.line + ' Line (follow the ' + l.line.toLowerCase() + ' signs, about ' + tm.interchangeMin + ' min).');
        ci++;
      } else if (i > 0 && legs[i - 1].lineId === l.lineId) {
        steps.push('At ' + l.from + ', switch to a ' + l.line + ' Line train towards ' + l.towards + '.');
      }
      steps.push('Take the ' + l.line + ' Line towards ' + l.towards + ' for ' + l.stops + ' stop' + (l.stops === 1 ? '' : 's') +
        ' (~' + l.minutes + ' min) and get off at ' + l.to + '.');
    });
    if (exit) steps.push('Exit at ' + exit + '. Have a nice day!');

    var uniqueStations = [];
    path.forEach(function (p) { if (uniqueStations.indexOf(p.station) < 0) uniqueStations.push(p.station); });

    var summary = {
      from: board, to: exit, legs: legs, changes: changes,
      totalStops: stops, stationsVisited: uniqueStations.length, interchanges: changes.length,
      km: round1(km), minutes: Math.round(minutes), fare: fare,
      linesUsed: legs.map(function (l) { return l.line; }).filter(function (v, i, a) { return a.indexOf(v) === i; })
    };

    var ticket = {
      ticketType: 'MetroLang Journey (estimate)',
      generatedAt: new Date().toISOString(),
      from: board, to: exit,
      fareINR: fare, distanceKm: round1(km), estimatedMinutes: Math.round(minutes),
      interchanges: changes.map(function (c) { return { station: c.at, from: c.from, to: c.to }; }),
      legs: legs.map(function (l) {
        return { line: l.line, from: l.from, to: l.to, towards: l.towards, stops: l.stops, stations: l.stations };
      })
    };

    return { summary: summary, path: path, ticket: ticket, ticketJSON: JSON.stringify(ticket, null, 2), directions: steps };
  }

  function round1(x) { return Math.round(x * 10) / 10; }

  ML.generate = generate;
})(typeof window !== 'undefined' ? window : globalThis);
