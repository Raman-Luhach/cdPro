/* =====================================================================
 * compiler.js — the pipeline driver
 *   source -> Lexer -> Parser -> Semantic -> IR -> Optimizer -> Codegen
 * A phase only runs if the phases before it succeeded
 * (the parser still runs after lexical errors so more errors are reported).
 * ===================================================================== */
(function (root) {
  'use strict';
  var ML = root.MetroLang = root.MetroLang || {};

  var PHASES = [
    { id: 'lexer', name: 'Lexical Analysis' },
    { id: 'parser', name: 'Syntax Analysis' },
    { id: 'semantic', name: 'Semantic Analysis' },
    { id: 'ir', name: 'IR Generation' },
    { id: 'optimizer', name: 'Optimization' },
    { id: 'codegen', name: 'Code Generation' }
  ];

  function now() { return (typeof performance !== 'undefined' ? performance : Date).now(); }

  function compile(source, net) {
    var r = { source: source, status: {}, time: {}, errors: [], warnings: [] };
    function timed(id, fn) { var t = now(); var out = fn(); r.time[id] = now() - t; return out; }
    function skip(from) { PHASES.slice(from).forEach(function (p) { r.status[p.id] = 'skipped'; }); }

    r.lex = timed('lexer', function () { return ML.lex(source); });
    r.status.lexer = r.lex.errors.length ? 'error' : 'ok';
    r.errors = r.errors.concat(r.lex.errors);

    r.parse = timed('parser', function () { return ML.parse(r.lex.tokens, net); });
    r.status.parser = r.parse.errors.length ? 'error' : 'ok';
    r.errors = r.errors.concat(r.parse.errors);
    if (r.errors.length) { skip(2); return finish(r); }

    r.sem = timed('semantic', function () { return ML.analyze(r.parse.ast, net); });
    r.status.semantic = r.sem.errors.length ? 'error' : (r.sem.warnings.length ? 'warning' : 'ok');
    r.errors = r.errors.concat(r.sem.errors);
    r.warnings = r.warnings.concat(r.sem.warnings);
    if (r.sem.errors.length) { skip(3); return finish(r); }

    r.ir = timed('ir', function () { return ML.generateIR(r.sem.events, net); });
    r.status.ir = 'ok';

    r.opt = timed('optimizer', function () { return ML.optimize(r.ir, net); });
    r.status.optimizer = 'ok';
    r.costBefore = ML.irCost(r.ir, net);
    r.costAfter = ML.irCost(r.opt.ir, net);

    r.out = timed('codegen', function () { return ML.generate(r.opt.ir, net); });
    r.status.codegen = 'ok';
    return finish(r);
  }

  function finish(r) {
    r.errors.sort(function (a, b) { return a.line - b.line || a.col - b.col; });
    r.ok = r.errors.length === 0;
    return r;
  }

  ML.PHASES = PHASES;
  ML.compile = compile;
})(typeof window !== 'undefined' ? window : globalThis);
