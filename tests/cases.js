/* =====================================================================
 * Test cases — shared by `node tests/run-tests.js` and the in-app
 * "Run tests" button.
 *   expect.ok      : program compiles with no errors
 *   expect.errors  : error codes that MUST appear
 *   expect.warnings: warning codes that MUST appear
 *   expect.opt     : optimization rules that MUST fire
 *   expect.check   : extra assertion on the result (returns true/false)
 * ===================================================================== */
(function (root) {
  'use strict';
  root.METRO_TESTS = [
    // ---------- valid programs ----------
    { name: 'Brief example compiles (no final ;)', code: 'board Rajiv Chowk; ride Yellow to Hauz Khas; change Magenta; ride to Botanical Garden; exit',
      expect: { ok: true, check: function (r) { return r.out.summary.totalStops === 22 && r.out.summary.interchanges === 1; } } },
    { name: 'Correct number of stops Rajiv Chowk -> Hauz Khas (9)', code: 'board Rajiv Chowk; ride Yellow to Hauz Khas; exit;',
      expect: { ok: true, check: function (r) { return r.out.summary.totalStops === 9; } } },
    { name: 'Direction is computed (towards Samaypur Badli)', code: 'board Hauz Khas; ride Yellow to Kashmere Gate; exit;',
      expect: { ok: true, check: function (r) { return r.out.summary.legs[0].towards === 'Samaypur Badli'; } } },
    { name: 'Four lines across the city', code: 'board Dwarka Sector 21; ride Blue to Mandi House; change Violet; ride to Lajpat Nagar; change Pink; ride to Welcome; change Red; ride to Shaheed Sthal; exit;',
      expect: { ok: true, check: function (r) { return r.out.summary.interchanges === 3 && r.out.summary.linesUsed.length === 4; } } },
    { name: 'Blue branch via Yamuna Bank', code: 'board Noida City Centre; ride Blue to Yamuna Bank; ride to Vaishali; exit;', expect: { ok: true } },
    { name: 'Aliases (INA, Red Fort)', code: 'board INA; ride Yellow to Kashmere Gate; change Violet; ride to Red Fort; exit;',
      expect: { ok: true, check: function (r) { return r.out.summary.to === 'Lal Qila'; } } },
    { name: 'Quoted names and comments', code: '// hi\nboard "Dilli Haat - INA"; # c\n/* block */ ride Pink to "Sarai Kale Khan - Nizamuddin"; exit;', expect: { ok: true } },
    { name: 'Case-insensitive keywords and lines', code: 'BOARD rajiv chowk; RIDE YELLOW TO hauz khas; EXIT;', expect: { ok: true } },
    { name: 'Name with comma (Rohini Sector 18, 19)', code: 'board Rohini Sector 18, 19; ride Yellow to Azadpur; exit;', expect: { ok: true } },
    { name: 'Fare uses DMRC slabs', code: 'board Rajiv Chowk; ride Yellow to Patel Chowk; exit;',
      expect: { ok: true, check: function (r) { return r.out.summary.fare === 11; } } },
    // ---------- lexical errors ----------
    { name: 'L01 illegal character', code: 'board Rajiv Chowk @; exit;', expect: { errors: ['L01'] } },
    { name: 'L02 unterminated string', code: 'board "Rajiv Chowk; exit;', expect: { errors: ['L02'] } },
    { name: 'L03 unterminated comment', code: 'board Rajiv Chowk; /* oops', expect: { errors: ['L03'] } },
    // ---------- syntax errors ----------
    { name: 'P01 missing semicolon', code: 'board Rajiv Chowk\nride Yellow to Hauz Khas; exit;', expect: { errors: ['P01'] } },
    { name: 'P02 board without station', code: 'board ; exit;', expect: { errors: ['P02'] } },
    { name: 'P03 unknown line (did you mean)', code: 'board Rajiv Chowk; ride Yelow to Hauz Khas; exit;', expect: { errors: ['P03'] } },
    { name: 'P04 missing "to"', code: 'board Rajiv Chowk; ride Yellow Hauz Khas; exit;', expect: { errors: ['P04'] } },
    { name: 'P06 change without line', code: 'board Rajiv Chowk; ride Yellow to Hauz Khas; change; exit;', expect: { errors: ['P06'] } },
    { name: 'P07 exit with argument', code: 'board Rajiv Chowk; ride Yellow to Hauz Khas; exit now;', expect: { errors: ['P07'] } },
    { name: 'P08 unknown statement (bord)', code: 'bord Rajiv Chowk; exit;', expect: { errors: ['P08'] } },
    { name: 'P10 empty program', code: '   // nothing', expect: { errors: ['P10'] } },
    { name: 'Several syntax errors reported at once', code: 'bord X; ride Yelow to Y; change; exit;', expect: { errors: ['P08', 'P03', 'P06'] } },
    // ---------- semantic errors ----------
    { name: 'S01 unknown station', code: 'board Rajiv Chok; ride Yellow to Hauz Khas; exit;', expect: { errors: ['S01'], check: function (r) { return /Rajiv Chowk/.test(r.errors[0].message); } } },
    { name: 'S02 ride before board', code: 'ride Yellow to Hauz Khas; exit;', expect: { errors: ['S02'] } },
    { name: 'S03 board twice', code: 'board Rajiv Chowk; board Mandi House; exit;', expect: { errors: ['S03'] } },
    { name: 'S04 first ride without line', code: 'board Rajiv Chowk; ride to Hauz Khas; exit;', expect: { errors: ['S04'] } },
    { name: 'S05 boarding station not on line', code: 'board Rajiv Chowk; ride Magenta to Hauz Khas; exit;', expect: { errors: ['S05'] } },
    { name: 'S06 destination not on line', code: 'board Rajiv Chowk; ride Yellow to Botanical Garden; exit;', expect: { errors: ['S06'] } },
    { name: 'S07 change at non-interchange', code: 'board Rajiv Chowk; ride Yellow to Green Park; change Magenta; exit;', expect: { errors: ['S07'] } },
    { name: 'S08 line does not stop at interchange', code: 'board Rajiv Chowk; ride Yellow to Kashmere Gate; change Blue; exit;', expect: { errors: ['S08'] } },
    { name: 'S09 change to same line', code: 'board Rajiv Chowk; ride Yellow to Hauz Khas; change Yellow; exit;', expect: { errors: ['S09'] } },
    { name: 'S10 ride to same station', code: 'board Rajiv Chowk; ride Yellow to Rajiv Chowk; exit;', expect: { errors: ['S10'] } },
    { name: 'S11 missing exit', code: 'board Rajiv Chowk; ride Yellow to Hauz Khas;', expect: { errors: ['S11'] } },
    { name: 'S12 statement after exit', code: 'board Rajiv Chowk; ride Yellow to Hauz Khas; exit; ride to Saket;', expect: { errors: ['S12'] } },
    { name: 'S13 Blue branch no direct train', code: 'board Noida Sector 18; ride Blue to Vaishali; exit;', expect: { errors: ['S13'] } },
    { name: 'S14 ride other line without change', code: 'board Rajiv Chowk; ride Yellow to Hauz Khas; ride Magenta to IIT; exit;', expect: { errors: ['S14'] } },
    { name: 'S15 change before first ride', code: 'board Rajiv Chowk; change Blue; exit;', expect: { errors: ['S15'] } },
    { name: 'No cascade after unknown boarding station', code: 'board Xyz Nagar; ride Yellow to Hauz Khas; exit;',
      expect: { errors: ['S01'], check: function (r) { return r.errors.length === 1; } } },
    // ---------- warnings ----------
    { name: 'W01 loop warning', code: 'board Hauz Khas; ride Magenta to IIT; ride to Hauz Khas; ride to Kalkaji Mandir; exit;', expect: { ok: true, warnings: ['W01'] } },
    { name: 'W02 double change warning', code: 'board Rajiv Chowk; ride Yellow to Kashmere Gate; change Red; change Violet; ride to ITO; exit;', expect: { ok: true, warnings: ['W02'] } },
    { name: 'W03 board and exit only', code: 'board Rajiv Chowk; exit;', expect: { ok: true, warnings: ['W03'] } },
    { name: 'W04 change before exit', code: 'board Rajiv Chowk; ride Yellow to Hauz Khas; change Magenta; exit;', expect: { ok: true, warnings: ['W04'] } },
    // ---------- optimizer ----------
    { name: 'O1 merges rides on same line', code: 'board Kashmere Gate; ride Yellow to Chandni Chowk; ride to Rajiv Chowk; exit;',
      expect: { ok: true, opt: ['O1'], check: function (r) { return r.opt.ir.length === 3; } } },
    { name: 'O2 removes back-and-forth', code: 'board Kashmere Gate; ride Yellow to Rajiv Chowk; ride to New Delhi; exit;',
      expect: { ok: true, opt: ['O2'], check: function (r) { return r.opt.ir[1].to === 'New Delhi' && r.opt.ir[1].seg.hops === 3; } } },
    { name: 'O2 removes a round trip completely', code: 'board Hauz Khas; ride Magenta to Kalkaji Mandir; ride to Hauz Khas; ride to IIT; exit;',
      expect: { ok: true, opt: ['O2'], check: function (r) { return r.opt.ir.length === 3; } } },
    { name: 'O3 cancelling changes removed', code: 'board Rajiv Chowk; ride Yellow to Kashmere Gate; change Red; change Yellow; ride to Civil Lines; exit;',
      expect: { ok: true, opt: ['O3', 'O1'], check: function (r) { return r.opt.ir.length === 3; } } },
    { name: 'O4 dead change removed', code: 'board Rajiv Chowk; ride Yellow to Hauz Khas; change Magenta; exit;',
      expect: { ok: true, opt: ['O4'], check: function (r) { return r.opt.ir.filter(function (q) { return q.op === 'CHANGE'; }).length === 0; } } },
    { name: 'O5 suggests faster route', code: 'board Rajiv Chowk; ride Blue to Janakpuri West; change Magenta; ride to Botanical Garden; exit;',
      expect: { ok: true, opt: ['O5'] } },
    { name: 'Optimized journey keeps start and end', code: 'board Kashmere Gate; ride Yellow to Chandni Chowk; ride to Rajiv Chowk; ride to New Delhi; ride to Central Secretariat; change Violet; change Yellow; change Violet; ride to Lajpat Nagar; change Pink; exit;',
      expect: { ok: true, opt: ['O1', 'O2', 'O3', 'O4'], check: function (r) { return r.out.summary.from === 'Kashmere Gate' && r.out.summary.to === 'Lajpat Nagar'; } } }
  ];

  /** Data integrity checks on the network itself */
  root.METRO_DATA_CHECKS = function (net) {
    var out = [];
    function check(name, ok) { out.push({ name: name, pass: !!ok }); }
    check('6 lines loaded', net.lines.length === 6);
    check('200+ stations loaded', Object.keys(net.stations).length >= 200);
    check('Every interchange is on 2 or more lines', Object.keys(net.stations).every(function (s) { var x = net.stations[s]; return !x.isInterchange || x.lines.length >= 2; }));
    check('Kashmere Gate is on 3 lines', net.stations['Kashmere Gate'].lines.length === 3);
    check('Every alias points to a real station', Object.keys(net.data.aliases).every(function (a) { return !!net.stations[net.data.aliases[a]]; }));
    check('No duplicate station inside a route', net.lines.every(function (l) { return l.routes.every(function (r) { return r.stations.length === new Set(r.stations).size; }); }));
    check('Every station has map coordinates', Object.keys(net.stations).every(function (s) { return isFinite(net.stations[s].x) && isFinite(net.stations[s].y); }));
    check('Whole network is connected', (function () {
      var names = Object.keys(net.stations), seen = {}, stack = [names[0]];
      while (stack.length) {
        var s = stack.pop(); if (seen[s]) continue; seen[s] = true;
        net.stations[s].lines.forEach(function (l) { net.lineById[l].stations.forEach(function (x) { if (!seen[x]) stack.push(x); }); });
      }
      return Object.keys(seen).length === names.length;
    })());
    return out;
  };

  /** Run all tests against a compile function */
  root.runMetroTests = function (ML, net) {
    return root.METRO_TESTS.map(function (t) {
      var r = ML.compile(t.code, net), e = t.expect, fails = [];
      var errCodes = r.errors.map(function (x) { return x.code; });
      var warnCodes = r.warnings.map(function (x) { return x.code; });
      if (e.ok && !r.ok) fails.push('expected success, got ' + errCodes.join(', '));
      (e.errors || []).forEach(function (c) { if (errCodes.indexOf(c) < 0) fails.push('missing error ' + c + ' (got ' + (errCodes.join(', ') || 'none') + ')'); });
      (e.warnings || []).forEach(function (c) { if (warnCodes.indexOf(c) < 0) fails.push('missing warning ' + c); });
      if (e.opt) {
        var rules = r.opt ? r.opt.log.map(function (l) { return l.rule; }) : [];
        e.opt.forEach(function (c) { if (rules.indexOf(c) < 0) fails.push('optimization ' + c + ' did not fire'); });
      }
      if (e.check && !fails.length) { try { if (!e.check(r)) fails.push('output check failed'); } catch (ex) { fails.push('check threw: ' + ex.message); } }
      return { name: t.name, pass: !fails.length, detail: fails.join('; '), code: t.code };
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
