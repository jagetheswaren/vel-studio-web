import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compilePreview, starter } from '../server/preview.js';
test('welcome screen compiles with animation tracks', () => {
  const p = compilePreview(starter);
  assert.equal(p.diagnostics.length, 0);
  assert.equal(p.tracks.length, 7);
  assert.match(p.html, /Build something beautiful/);
  assert.ok(p.duration >= 1000);
});
test('quoted labels and attributes are escaped', () => {
  const p = compilePreview('V\n  T "<script>alert(1)</script>"\n  In placeholder="Search here"');
  assert.match(p.html, /&lt;script&gt;/);
  assert.match(p.html, /placeholder="Search here"/);
  assert.doesNotMatch(p.html, /<script>alert/);
});
test('invalid component, nested leaf and malformed animation return diagnostics', () => {
  assert.equal(compilePreview('Unknown').diagnostics[0].line, 1);
  assert.ok(
    compilePreview('T "Hello"\n  T "World"').diagnostics.some((d) => d.severity === 'error'),
  );
  assert.ok(compilePreview('T "Hi" animate=what').diagnostics.some((d) => d.severity === 'error'));
});
test('timing bounds and progress bounds cannot inject CSS', () => {
  const p = compilePreview(
    'V\n  Progress value=3\n  T "Hello" animate=fade(99999) delay=99999 fg="red;position:fixed"',
  );
  assert.match(p.html, /aria-valuenow="100"/);
  assert.equal(p.duration, 60000);
  assert.doesNotMatch(p.html, /position:fixed/);
});
test('HTML source passes through for isolated preview', () => {
  assert.equal(compilePreview('<h1>Hello</h1>', 'index.html').html, '<h1>Hello</h1>');
});
