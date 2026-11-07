/* =====================================================================
 * PHASE 1 — LEXICAL ANALYSIS
 * Turns the source string into a list of tokens.
 *
 * Token types
 *   KEYWORD    board | ride | to | change | exit          (case-insensitive)
 *   LINE       yellow | blue | violet | magenta | red | pink
 *   WORD       a piece of a station name   e.g. Rajiv, Vihar-I, Dr.
 *   NUMBER     digits                      e.g. 21 (Dwarka Sector 21)
 *   STRING     "quoted station name"
 *   HYPHEN     a lone "-" inside a name    e.g. Dilli Haat - INA
 *   COMMA      ","  (only inside names like "Rohini Sector 18, 19")
 *   SEMICOLON  ;
 *   COMMENT    // ... or # ...  (kept for display, ignored by the parser)
 *   EOF        end of input
 * ===================================================================== */
(function (root) {
  'use strict';
  var ML = root.MetroLang = root.MetroLang || {};

  var KEYWORDS = ['board', 'ride', 'to', 'change', 'exit'];
  var LINES = ['yellow', 'blue', 'violet', 'magenta', 'red', 'pink'];

  // Regular definitions (shown in the UI / report)
  var PATTERNS = {
    WORD: /^[A-Za-z][A-Za-z0-9.'\-]*/,
    NUMBER: /^[0-9]+(?:-?[A-Za-z][A-Za-z0-9.'\-]*)?/,   // 21, 1-IGI
    WHITESPACE: /^[ \t\r]+/
  };

  function lex(source) {
    var tokens = [], errors = [];
    var i = 0, line = 1, col = 1, n = source.length;

    function push(type, value, len, extra) {
      var t = { type: type, value: value, line: line, col: col, length: len, index: i };
      if (extra) for (var k in extra) t[k] = extra[k];
      tokens.push(t);
    }
    function advance(len) {
      for (var k = 0; k < len; k++) {
        if (source.charAt(i) === '\n') { line++; col = 1; } else col++;
        i++;
      }
    }

    while (i < n) {
      var ch = source.charAt(i), rest = source.slice(i), m;

      if (ch === '\n') { advance(1); continue; }
      if ((m = PATTERNS.WHITESPACE.exec(rest))) { advance(m[0].length); continue; }

      // comments
      if (ch === '#' || (ch === '/' && source.charAt(i + 1) === '/')) {
        var end = source.indexOf('\n', i); if (end < 0) end = n;
        push('COMMENT', source.slice(i, end), end - i);
        advance(end - i); continue;
      }
      if (ch === '/' && source.charAt(i + 1) === '*') {
        var close = source.indexOf('*/', i + 2);
        if (close < 0) {
          errors.push(err('L03', 'Unterminated block comment — missing "*/"', line, col, n - i));
          advance(n - i); continue;
        }
        push('COMMENT', source.slice(i, close + 2), close + 2 - i);
        advance(close + 2 - i); continue;
      }

      if (ch === ';') { push('SEMICOLON', ';', 1); advance(1); continue; }
      if (ch === ',') { push('COMMA', ',', 1); advance(1); continue; }
      if (ch === '-') { push('HYPHEN', '-', 1); advance(1); continue; }

      // quoted station names
      if (ch === '"') {
        var q = i + 1;
        while (q < n && source.charAt(q) !== '"' && source.charAt(q) !== '\n') q++;
        if (q >= n || source.charAt(q) !== '"') {
          errors.push(err('L02', 'Unterminated string — missing closing quote (")', line, col, q - i,
            'Close the station name with a quote, e.g. "Rajiv Chowk"'));
          advance(q - i); continue;
        }
        var text = source.slice(i + 1, q);
        if (!text.trim()) {
          errors.push(err('L04', 'Empty station name ""', line, col, q - i + 1));
          advance(q - i + 1); continue;
        }
        push('STRING', text, q - i + 1);
        advance(q - i + 1); continue;
      }

      if ((m = PATTERNS.NUMBER.exec(rest))) {
        push(/^[0-9]+$/.test(m[0]) ? 'NUMBER' : 'WORD', m[0], m[0].length);
        advance(m[0].length); continue;
      }

      if ((m = PATTERNS.WORD.exec(rest))) {
        var word = m[0], lower = word.toLowerCase();
        // a trailing "-" or "." glued to a keyword is still just that word
        if (KEYWORDS.indexOf(lower) >= 0) push('KEYWORD', lower, word.length, { raw: word });
        else if (LINES.indexOf(lower) >= 0) push('LINE', lower, word.length, { raw: word });
        else push('WORD', word, word.length);
        advance(word.length); continue;
      }

      // parentheses are allowed inside station names: Shaheed Sthal (New Bus Adda)
      if (ch === '(' || ch === ')') { push('PAREN', ch, 1); advance(1); continue; }

      // anything else is illegal
      var bad = ch, start = col;
      errors.push(err('L01', 'Illegal character "' + bad + '"', line, start, 1,
        'Only letters, digits, spaces, ";", "-", "," and quotes are allowed'));
      advance(1);
    }
    tokens.push({ type: 'EOF', value: '', line: line, col: col, length: 0, index: n });
    return { tokens: tokens, errors: errors };
  }

  function err(code, message, line, col, length, hint) {
    return { phase: 'lexical', severity: 'error', code: code, message: message, line: line, col: col, length: length || 1, hint: hint || '' };
  }

  ML.lex = lex;
  ML.KEYWORDS = KEYWORDS;
  ML.LINE_WORDS = LINES;
  ML.LEX_PATTERNS = {
    KEYWORD: 'board | ride | to | change | exit',
    LINE: 'yellow | blue | violet | magenta | red | pink',
    WORD: "[A-Za-z][A-Za-z0-9.'-]*",
    NUMBER: '[0-9]+',
    STRING: '"[^"\\n]*"',
    SEMICOLON: ';',
    COMMENT: '//.*  |  #.*  |  /* ... */'
  };
})(typeof window !== 'undefined' ? window : globalThis);
