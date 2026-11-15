#!/usr/bin/env node
/* Run:  node tests/run-tests.js   — prints a pass/fail table */
'use strict';
var vm = require('vm'), fs = require('fs'), path = require('path');
var rootDir = path.join(__dirname, '..');
['data/metro-data.js', 'src/network.js', 'src/lexer.js', 'src/parser.js', 'src/semantic.js',
  'src/irgen.js', 'src/optimizer.js', 'src/codegen.js', 'src/compiler.js', 'examples/examples.js', 'tests/cases.js']
  .forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(rootDir, f), 'utf8'), { filename: f }); });

var ML = globalThis.MetroLang, net = new ML.Network(globalThis.METRO_DATA);
var G = '\x1b[32m', R = '\x1b[31m', D = '\x1b[2m', X = '\x1b[0m';
var pass = 0, fail = 0;

console.log('\nMetroLang test suite\n====================\n');
console.log('Data integrity');
globalThis.METRO_DATA_CHECKS(net).forEach(function (c) {
  c.pass ? pass++ : fail++;
  console.log('  ' + (c.pass ? G + '✔' : R + '✖') + X + ' ' + c.name);
});

console.log('\nCompiler tests');
globalThis.runMetroTests(ML, net).forEach(function (t) {
  t.pass ? pass++ : fail++;
  console.log('  ' + (t.pass ? G + '✔' : R + '✖') + X + ' ' + t.name + (t.pass ? '' : '\n      ' + R + t.detail + X));
});

console.log('\nExample programs (each must behave as its group says)');
globalThis.METRO_EXAMPLES.forEach(function (ex) {
  var r = ML.compile(ex.code, net);
  var shouldFail = /error/i.test(ex.group);
  var ok = shouldFail ? !r.ok : r.ok;
  ok ? pass++ : fail++;
  console.log('  ' + (ok ? G + '✔' : R + '✖') + X + ' ' + ex.group + ' › ' + ex.title +
    D + '  (' + (r.ok ? 'compiled' : r.errors.map(function (e) { return e.code; }).join(', ')) + ')' + X);
});

console.log('\n' + (fail ? R : G) + pass + ' passed, ' + fail + ' failed' + X + '\n');
process.exit(fail ? 1 : 0);
