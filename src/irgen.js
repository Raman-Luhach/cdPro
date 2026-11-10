/* =====================================================================
 * PHASE 4 — INTERMEDIATE CODE GENERATION
 * Translates the checked journey into a flat list of quadruples
 *        ( op , arg1 , arg2 , result )
 *
 *   BOARD   station   -        -
 *   RIDE    line      from     to        (+ stops, direction, stations in between)
 *   CHANGE  fromLine  toLine   station
 *   EXIT    station   -        -
 *
 * The IR fills in what the source code leaves out: the direction of
 * travel, the number of stops and every intermediate station.
 * ===================================================================== */
(function (root) {
  'use strict';
  var ML = root.MetroLang = root.MetroLang || {};

  function generateIR(events, net) {
    var ir = [];
    events.forEach(function (ev) {
      var q = { id: ir.length + 1, op: ev.type.toUpperCase(), srcLine: ev.srcLine || ev.line };
      if (ev.type === 'board') { q.arg1 = ev.station; q.station = ev.station; }
      if (ev.type === 'exit') { q.arg1 = ev.station; q.station = ev.station; }
      if (ev.type === 'ride') {
        q.line = ev.line; q.from = ev.from; q.to = ev.to;
        q.arg1 = net.lineById[ev.line].name; q.arg2 = ev.from; q.result = ev.to;
        q.seg = ev.segment;
      }
      if (ev.type === 'change') {
        q.fromLine = ev.from; q.toLine = ev.to; q.at = ev.at;
        q.arg1 = net.lineById[ev.from].name; q.arg2 = net.lineById[ev.to].name; q.result = ev.at;
      }
      ir.push(q);
    });
    return ir;
  }

  /** Human-readable form of one instruction */
  function irText(q, net) {
    function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
    var head = 'L' + q.id + ': ' + pad(q.op, 7);
    if (q.op === 'BOARD' || q.op === 'EXIT') return head + ' "' + q.station + '"';
    if (q.op === 'RIDE') return head + ' ' + pad(net.lineById[q.line].name, 8) + ' "' + q.from + '" -> "' + q.to + '"' +
      '    ; ' + q.seg.hops + ' stop' + (q.seg.hops === 1 ? '' : 's') + ', towards ' + q.seg.towards;
    if (q.op === 'CHANGE') return head + ' ' + net.lineById[q.fromLine].name + ' -> ' + net.lineById[q.toLine].name + '  @ "' + q.at + '"';
    return head;
  }

  /** Minutes + km + stops for an IR program (used to compare before/after optimization) */
  function irCost(ir, net) {
    var tm = net.timeModel, min = 0, km = 0, stops = 0, changes = 0;
    ir.forEach(function (q) {
      if (q.op === 'RIDE') { min += q.seg.minutes; km += q.seg.km; stops += q.seg.hops; }
      if (q.op === 'CHANGE') { min += tm.interchangeMin; changes++; }
    });
    if (ir.length) min += tm.entryMin + tm.exitMin;
    return { minutes: min, km: km, stops: stops, changes: changes, instructions: ir.length };
  }

  ML.generateIR = generateIR;
  ML.irText = irText;
  ML.irCost = irCost;
})(typeof window !== 'undefined' ? window : globalThis);
