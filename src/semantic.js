/* =====================================================================
 * PHASE 3 — SEMANTIC ANALYSIS
 * Walks the AST while tracking the passenger's state
 *   (current station, current line, boarded?, exited?)
 * and checks every statement against the real metro network
 * (the network acts as our pre-loaded symbol table).
 *
 * Errors
 *   S01 unknown station (+ "did you mean")      S09 change to the same line
 *   S02 statement before "board"                S10 ride to the station you are at
 *   S03 boarding twice                          S11 journey never exits
 *   S04 first ride does not name a line         S12 statement after exit
 *   S05 boarding station not on that line       S13 no direct train (Blue branch)
 *   S06 destination not on current line         S14 riding another line without "change"
 *   S07 change at a non-interchange station     S15 change before the first ride
 *   S08 new line does not serve this station
 * Warnings
 *   W01 journey revisits a station (loop)       W03 board and exit without riding
 *   W02 two changes with no ride in between     W04 change right before exit (useless)
 * ===================================================================== */
(function (root) {
  'use strict';
  var ML = root.MetroLang = root.MetroLang || {};

  function analyze(ast, net) {
    var errors = [], warnings = [], events = [], trace = [];
    var symbols = {};      // name -> symbol table entry
    var st = { boarded: false, exited: false, station: null, line: null, lost: false, stops: 0, lastWasChange: false, rodeAny: false };
    var visited = [];

    function E(code, msg, node, hint) { errors.push(mk('error', code, msg, node, hint)); }
    function W(code, msg, node, hint) { warnings.push(mk('warning', code, msg, node, hint)); }
    function mk(sev, code, msg, node, hint) {
      return { phase: 'semantic', severity: sev, code: code, message: msg, hint: hint || '', line: node.line, col: node.col, length: node.length || 4 };
    }
    function lineName(id) { var l = net.lineById[id]; return l ? l.name : id; }
    function lineList(ids) { return ids.map(lineName).join(', '); }

    function addSymbol(kind, written, official, node) {
      var key = kind + ':' + (official || written);
      if (!symbols[key]) {
        var entry = { name: official || written, written: written, kind: kind, declaredAt: node.line, refs: [], valid: !!official };
        if (kind === 'station' && official) {
          var s = net.stations[official];
          entry.type = s.isInterchange ? 'Interchange' : 'Station';
          entry.lines = s.lines.map(lineName);
        }
        if (kind === 'line' && official) {
          var l = net.lineById[official];
          entry.type = 'Line'; entry.colour = l.colour; entry.lines = [l.stations.length + ' stations'];
          entry.name = l.name;
        }
        symbols[key] = entry;
      }
      if (symbols[key].refs.indexOf(node.line) < 0) symbols[key].refs.push(node.line);
    }

    function resolveStation(stNode) {
      var official = net.findStation(stNode.text);
      addSymbol('station', stNode.text, official, stNode);
      if (!official) {
        var sug = net.suggestStations(stNode.text);
        E('S01', 'Unknown station "' + stNode.text + '"' + (sug.length ? ' — did you mean "' + sug[0] + '"?' : ''), stNode,
          sug.length > 1 ? 'Other close matches: ' + sug.slice(1).join(', ') : 'Check the Network tab for all station names');
      }
      return official;
    }

    function snapshot(node, text, status) {
      trace.push({
        step: trace.length + 1, line: node.line, statement: text,
        station: st.station || '—', currentLine: st.line ? lineName(st.line) : '—',
        stops: st.stops, status: status
      });
    }

    ast.body.forEach(function (node) {
      var before = errors.length, text = '';

      if (st.exited && !(node.type === 'Exit')) {
        E('S12', 'Statement after "exit" — the journey has already ended', node, 'Remove everything after exit;');
      }

      if (node.type === 'Board') {
        text = 'board ' + node.station.text;
        var s = resolveStation(node.station);
        if (st.boarded && !st.exited) E('S03', 'Already boarded at ' + st.station + ' — you can only board once', node, 'Use ride/change to move, or exit first');
        else if (s && !st.exited) {
          st.boarded = true; st.station = s; st.line = null; st.lost = false; visited = [s];
          events.push({ type: 'board', station: s, line: node.line });
        }
        // unknown boarding station: remember we boarded (avoids cascading S02 errors)
        if (!s && !st.exited) { st.boarded = true; st.lost = true; }
      }

      else if (node.type === 'Ride') {
        text = 'ride ' + (node.lineName ? lineName(node.lineName.name) + ' ' : '') + 'to ' + node.station.text;
        var dest = resolveStation(node.station);
        var wantLine = node.lineName ? node.lineName.name : null;
        if (node.lineName) addSymbol('line', node.lineName.name, node.lineName.name, node.lineName);

        if (!st.boarded && !st.exited) {
          E('S02', 'Cannot ride before boarding — the journey must start with "board"', node, 'Add: board <station>; at the top');
          st.lost = true;
        } else if (!st.lost && dest && !st.exited) {
          var cur = st.station, line = st.line, ok = true;
          if (wantLine && line && wantLine !== line) {
            E('S14', 'You are on the ' + lineName(line) + ' line — write "change ' + lineName(wantLine) + ';" at an interchange before riding ' + lineName(wantLine), node.lineName,
              'Lines are switched with the change statement');
            ok = false;
          } else if (!line && !wantLine) {
            var common = net.commonLines(cur, dest);
            E('S04', 'Which line? The first ride must name a line', node,
              common.length ? 'Try: ride ' + lineName(common[0]) + ' to ' + dest + ';' : cur + ' is on: ' + lineList(net.stations[cur].lines));
            ok = false;
          } else {
            line = wantLine || line;
            if (!st.line && !net.isOnLine(cur, line)) {
              E('S05', cur + ' is not on the ' + lineName(line) + ' line (it is on: ' + lineList(net.stations[cur].lines) + ')', node.lineName || node,
                'Board at a ' + lineName(line) + ' line station, or ride a line that stops at ' + cur);
              ok = false;
            }
          }
          if (ok && !net.isOnLine(dest, line)) {
            E('S06', dest + ' is not on the ' + lineName(line) + ' line (it is on: ' + lineList(net.stations[dest].lines) + ')', node.station,
              'Change to one of those lines at an interchange first');
            ok = false;
          }
          if (ok && dest === cur) {
            E('S10', 'You are already at ' + dest + ' — this ride goes nowhere', node.station);
            ok = false;
          }
          var seg = ok ? net.segment(line, cur, dest) : null;
          if (ok && !seg) {
            E('S13', 'No direct ' + lineName(line) + ' line train from ' + cur + ' to ' + dest, node.station,
              'They are on different branches — ride to Yamuna Bank first, then continue');
            ok = false;
          }
          if (ok) {
            if (visited.indexOf(dest) >= 0) W('W01', 'Loop: the journey comes back to ' + dest, node.station, 'The optimizer can remove back-and-forth rides');
            seg.path.slice(1).forEach(function (p) { if (visited.indexOf(p) < 0) visited.push(p); });
            events.push({ type: 'ride', line: line, from: cur, to: dest, segment: seg, srcLine: node.line });
            st.station = dest; st.line = line; st.stops += seg.hops; st.rodeAny = true; st.lastWasChange = false;
          } else st.lost = true;
        }
      }

      else if (node.type === 'Change') {
        var to = node.lineName.name;
        text = 'change ' + lineName(to);
        addSymbol('line', to, to, node.lineName);
        if (!st.boarded && !st.exited) { E('S02', 'Cannot change lines before boarding', node, 'Add: board <station>; at the top'); st.lost = true; }
        else if (!st.lost && !st.exited) {
          var here = net.stations[st.station];
          if (!st.line) {
            E('S15', 'Nothing to change from — you have not ridden any line yet', node,
              'Name the line in your first ride instead: ride ' + lineName(to) + ' to <station>;');
            st.lost = true;
          } else if (to === st.line) {
            E('S09', 'You are already on the ' + lineName(to) + ' line', node.lineName, 'Remove this change statement');
          } else if (!here.isInterchange) {
            var ix = net.lineById[st.line].stations.filter(function (s) { return net.stations[s].isInterchange; });
            E('S07', st.station + ' is not an interchange — you cannot change lines here', node,
              'Interchanges on the ' + lineName(st.line) + ' line: ' + ix.join(', '));
            st.lost = true;
          } else if (here.lines.indexOf(to) < 0) {
            E('S08', 'The ' + lineName(to) + ' line does not stop at ' + st.station, node.lineName,
              'At ' + st.station + ' you can change to: ' + lineList(here.lines.filter(function (l) { return l !== st.line; })));
            st.lost = true;
          } else {
            if (st.lastWasChange) W('W02', 'Two changes in a row at ' + st.station + ' with no ride in between', node, 'Only the last change matters — the optimizer merges them');
            events.push({ type: 'change', from: st.line, to: to, at: st.station, srcLine: node.line });
            st.line = to; st.lastWasChange = true;
          }
        }
      }

      else if (node.type === 'Exit') {
        text = 'exit';
        if (st.exited) E('S12', 'The journey has already ended — duplicate "exit"', node);
        else if (!st.boarded) { E('S02', 'Cannot exit before boarding', node, 'Add: board <station>; at the top'); }
        else {
          if (!st.rodeAny && !st.lost) W('W03', 'You boarded and exited at ' + st.station + ' without riding anywhere', node);
          if (st.lastWasChange && !st.lost) W('W04', 'The last change is never used — you exit right after it', node, 'The optimizer removes it');
          if (!st.lost) events.push({ type: 'exit', station: st.station, srcLine: node.line });
          st.exited = true;
        }
      }

      snapshot(node, text, errors.length > before ? 'error' : 'ok');
    });

    if (st.boarded && !st.exited) {
      var lastNode = ast.body[ast.body.length - 1] || { line: 1, col: 1 };
      E('S11', 'The journey never ends — add "exit;" as the last statement', { line: lastNode.line, col: 1, length: 4 }, 'Every journey must finish with exit;');
    }

    var symList = Object.keys(symbols).map(function (k) { return symbols[k]; });
    symList.sort(function (a, b) { return a.declaredAt - b.declaredAt; });
    return { errors: errors, warnings: warnings, events: events, trace: trace, symbols: symList };
  }

  ML.analyze = analyze;
  ML.SEMANTIC_RULES = [
    ['S01', 'Station must exist in the network'],
    ['S02', 'The journey must start with board'],
    ['S03', 'You can board only once'],
    ['S04', 'The first ride must name a line'],
    ['S05', 'The boarding station must be on the line you ride'],
    ['S06', 'The destination must be on the current line'],
    ['S07', 'You can change only at an interchange'],
    ['S08', 'The new line must stop at that interchange'],
    ['S09', 'You cannot change to the line you are on'],
    ['S10', 'You cannot ride to the station you are at'],
    ['S11', 'The journey must end with exit'],
    ['S12', 'Nothing may follow exit'],
    ['S13', 'Both stations must be on the same branch (Blue line)'],
    ['S14', 'Use change before riding a different line'],
    ['S15', 'change needs a line you are already riding'],
    ['W01', 'Warning: the journey revisits a station'],
    ['W02', 'Warning: two changes with no ride in between'],
    ['W03', 'Warning: board and exit without riding'],
    ['W04', 'Warning: a change just before exit is never used']
  ];
})(typeof window !== 'undefined' ? window : globalThis);
