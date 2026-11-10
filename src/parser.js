/* =====================================================================
 * PHASE 2 — SYNTAX ANALYSIS (Recursive-descent parser)
 *
 * Grammar (BNF)
 *   <program>   ::= <stmt>* EOF
 *   <stmt>      ::= <board> | <ride> | <change> | <exit>
 *   <board>     ::= "board" <station> ";"
 *   <ride>      ::= "ride" [ LINE ] "to" <station> ";"
 *   <change>    ::= "change" LINE ";"
 *   <exit>      ::= "exit" ";"
 *   <station>   ::= STRING | <part> { <part> }
 *   <part>      ::= WORD | NUMBER | HYPHEN | COMMA | PAREN
 *
 * Produces two trees:
 *   parseTree — concrete tree, every grammar rule + every token
 *   ast       — abstract tree, only what later phases need
 *
 * Error recovery
 *   - phrase level: a missing ";" or "to" is reported and assumed present
 *   - panic mode:   anything else skips to the next ";" or statement keyword
 * ===================================================================== */
(function (root) {
  'use strict';
  var ML = root.MetroLang = root.MetroLang || {};

  var STMT_START = ['board', 'ride', 'change', 'exit'];
  var NAME_PARTS = ['WORD', 'NUMBER', 'HYPHEN', 'COMMA', 'PAREN'];

  function parse(allTokens, network) {
    // the parser ignores comments
    var tokens = allTokens.filter(function (t) { return t.type !== 'COMMENT'; });
    var pos = 0, errors = [];

    function peek(o) { return tokens[Math.min(pos + (o || 0), tokens.length - 1)]; }
    function next() { return tokens[pos++]; }
    function isKw(t, v) { return t.type === 'KEYWORD' && (v === undefined || t.value === v); }
    function isStmtStart(t) { return t.type === 'KEYWORD' && STMT_START.indexOf(t.value) >= 0; }
    function leaf(t) { return { label: t.type, value: t.type === 'STRING' ? '"' + t.value + '"' : (t.raw || t.value), token: true, line: t.line, col: t.col }; }
    function show(t) { return t.type === 'EOF' ? 'end of input' : '"' + (t.raw || t.value) + '"'; }

    function error(code, msg, t, hint, atEndOf) {
      var e = { phase: 'syntax', severity: 'error', code: code, message: msg, hint: hint || '' };
      if (atEndOf) { e.line = atEndOf.line; e.col = atEndOf.col + atEndOf.length; e.length = 1; }
      else { e.line = t.line; e.col = t.col; e.length = Math.max(1, t.length); }
      errors.push(e);
    }

    /** panic-mode recovery: skip to just after the next ";" or to a statement keyword */
    function synchronize(node) {
      var skipped = [];
      while (peek().type !== 'EOF' && peek().type !== 'SEMICOLON' && !isStmtStart(peek())) skipped.push(next());
      if (peek().type === 'SEMICOLON') skipped.push(next());
      if (node && skipped.length) node.children.push({ label: 'error (skipped ' + skipped.length + ' token' + (skipped.length > 1 ? 's' : '') + ')', error: true, children: [] });
    }

    /** expect ";" — if missing, report it and pretend it was there */
    function semicolon(node, after) {
      if (peek().type === 'SEMICOLON') { node.children.push(leaf(next())); return true; }
      // the last statement may omit ";" (the brief writes "...; exit")
      if (peek().type === 'EOF') { node.children.push({ label: '; (optional at end)', children: [] }); return true; }
      error('P01', 'Missing ";" after ' + node.stmtName + ' statement', peek(), 'Every statement ends with a semicolon', after);
      node.children.push({ label: '; (missing)', error: true, children: [] });
      if (!isStmtStart(peek()) && peek().type !== 'EOF') synchronize(node);
      return false;
    }

    function station(node, ctxKw) {
      var t = peek();
      if (t.type === 'STRING') {
        next();
        node.children.push({ label: '<station>', children: [leaf(t)] });
        return { text: t.value, line: t.line, col: t.col, length: t.length };
      }
      // a line word can start a station name if more name follows ("Red Fort")
      var lineStartsName = t.type === 'LINE' && NAME_PARTS.indexOf(peek(1).type) >= 0;
      if (t.type !== 'WORD' && t.type !== 'NUMBER' && !lineStartsName) {
        var hint = 'Example: ' + ctxKw + ' Rajiv Chowk;';
        if (t.type === 'LINE') hint = '"' + t.raw + '" is a line name, not a station';
        error('P02', 'Expected a station name after "' + ctxKw + '" but found ' + show(t), t, hint);
        return null;
      }
      var parts = [], first = t, last = t, kids = [];
      while (NAME_PARTS.indexOf(peek().type) >= 0 || (peek().type === 'LINE' && (parts.length || lineStartsName))) {
        last = next(); parts.push(last.raw || last.value); kids.push(leaf(last));
      }
      node.children.push({ label: '<station>', children: kids });
      var text = parts.join(' ').replace(/ ,/g, ',').replace(/\( /g, '(').replace(/ \)/g, ')');
      return { text: text, line: first.line, col: first.col, length: (last.index + last.length) - first.index };
    }

    function parseBoard() {
      var kw = next(), node = { label: '<board>', stmtName: 'board', children: [leaf(kw)] };
      var st = station(node, 'board');
      if (!st) { synchronize(node); return { node: node, ast: null }; }
      semicolon(node, lastToken());
      return { node: node, ast: { type: 'Board', station: st, line: kw.line, col: kw.col } };
    }

    function parseRide() {
      var kw = next(), node = { label: '<ride>', stmtName: 'ride', children: [leaf(kw)] }, line = null;
      var t = peek();
      if (t.type === 'LINE') {
        next(); node.children.push({ label: '<line>', children: [leaf(t)] });
        line = { name: t.value, line: t.line, col: t.col, length: t.length };
      } else if (t.type === 'WORD' && isKw(peek(1), 'to')) {
        // "ride Yelow to ..." — unknown line name
        var sug = network ? network.suggestLine(t.value) : null;
        error('P03', 'Unknown line "' + t.value + '"' + (sug ? ' — did you mean ' + sug + '?' : ''), t,
          'Lines: Yellow, Blue, Violet, Magenta, Red, Pink');
        next(); synchronize(node); return { node: node, ast: null };
      }
      if (isKw(peek(), 'to')) node.children.push(leaf(next()));
      else if (peek().type === 'WORD' || peek().type === 'STRING' || peek().type === 'NUMBER') {
        // phrase-level recovery: "ride Yellow Hauz Khas;" -> assume "to"
        error('P04', 'Missing "to" before the destination station', peek(), 'Write: ride ' + (line ? t.raw + ' ' : '') + 'to <station>;');
        node.children.push({ label: 'to (missing)', error: true, children: [] });
      } else {
        error('P05', 'Expected "to" in ride statement but found ' + show(peek()), peek(), 'Write: ride Yellow to Hauz Khas;');
        synchronize(node); return { node: node, ast: null };
      }
      var st = station(node, 'to');
      if (!st) { synchronize(node); return { node: node, ast: null }; }
      semicolon(node, lastToken());
      return { node: node, ast: { type: 'Ride', lineName: line, station: st, line: kw.line, col: kw.col } };
    }

    function parseChange() {
      var kw = next(), node = { label: '<change>', stmtName: 'change', children: [leaf(kw)] };
      var t = peek();
      if (t.type !== 'LINE') {
        var sug = (t.type === 'WORD' && network) ? network.suggestLine(t.value) : null;
        error('P06', 'Expected a line name after "change" but found ' + show(t) + (sug ? ' — did you mean ' + sug + '?' : ''), t,
          'Example: change Magenta;');
        synchronize(node); return { node: node, ast: null };
      }
      next(); node.children.push({ label: '<line>', children: [leaf(t)] });
      semicolon(node, t);
      return { node: node, ast: { type: 'Change', lineName: { name: t.value, line: t.line, col: t.col, length: t.length }, line: kw.line, col: kw.col } };
    }

    function parseExit() {
      var kw = next(), node = { label: '<exit>', stmtName: 'exit', children: [leaf(kw)] };
      if (peek().type !== 'SEMICOLON' && !isStmtStart(peek()) && peek().type !== 'EOF') {
        error('P07', '"exit" takes no arguments — found ' + show(peek()), peek(), 'Write just: exit;');
        synchronize(node);
        return { node: node, ast: { type: 'Exit', line: kw.line, col: kw.col } };
      }
      semicolon(node, kw);
      return { node: node, ast: { type: 'Exit', line: kw.line, col: kw.col } };
    }

    function lastToken() { return tokens[Math.max(0, pos - 1)]; }

    function parseStatement() {
      var t = peek();
      if (isKw(t, 'board')) return parseBoard();
      if (isKw(t, 'ride')) return parseRide();
      if (isKw(t, 'change')) return parseChange();
      if (isKw(t, 'exit')) return parseExit();
      // unknown statement
      var guess = null;
      if (t.type === 'WORD') {
        STMT_START.forEach(function (k) { if (ML.editDistance(t.value.toLowerCase(), k) <= 2 && !guess) guess = k; });
      }
      var msg = t.type === 'SEMICOLON' ? 'Empty statement (stray ";")' : 'Unknown statement starting with ' + show(t) + (guess ? ' — did you mean "' + guess + '"?' : '');
      error(t.type === 'SEMICOLON' ? 'P09' : 'P08', msg, t, 'A statement starts with board, ride, change or exit');
      var node = { label: '<stmt>', children: [], error: true };
      if (t.type === 'SEMICOLON') next(); else { next(); synchronize(node); }
      return { node: node, ast: null };
    }

    var program = { label: '<program>', children: [] }, body = [];
    while (peek().type !== 'EOF') {
      var r = parseStatement();
      program.children.push({ label: '<stmt>', children: [r.node] });
      if (r.ast) body.push(r.ast);
    }
    program.children.push({ label: 'EOF', token: true, value: '$', children: [] });
    if (!body.length && !errors.length) {
      errors.push({ phase: 'syntax', severity: 'error', code: 'P10', message: 'Empty program — nothing to compile', line: 1, col: 1, length: 1, hint: 'Start with: board Rajiv Chowk;' });
    }
    return { parseTree: program, ast: { type: 'Program', body: body }, errors: errors };
  }

  ML.parse = parse;
  ML.GRAMMAR = [
    '<program> ::= <stmt>* EOF',
    '<stmt>    ::= <board> | <ride> | <change> | <exit>',
    '<board>   ::= "board" <station> ";"',
    '<ride>    ::= "ride" [ LINE ] "to" <station> ";"',
    '<change>  ::= "change" LINE ";"',
    '<exit>    ::= "exit" ";"',
    '<station> ::= STRING | <part> { <part> }',
    '<part>    ::= WORD | NUMBER | HYPHEN | COMMA | PAREN'
  ];
})(typeof window !== 'undefined' ? window : globalThis);
