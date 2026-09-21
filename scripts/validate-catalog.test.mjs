import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portablePath, validateCatalog } from './validate-catalog.mjs';

const catalog = () => ({ schema_version: 1, examples: [{ name: 'demo', title: 'Demo', description: 'Example app', path: 'examples/demo', next_steps: [{ directory: '.', instruction: 'Read README.md' }] }] });
const files = () => new Map([['examples/demo/README.md', { mode: '100644', size: 4 }]]);

test('valid catalog and executable files', () => {
  const tree = files();
  tree.set('examples/demo/run.sh', { mode: '100755', size: 5 });
  assert.doesNotThrow(() => validateCatalog(catalog(), tree));
});
test('rejects invalid metadata and missing directories', () => {
  for (const mutate of [
    c => c.schema_version = 2,
    c => c.examples.push(c.examples[0]),
    c => c.examples[0].path = 'other/demo',
    c => c.examples[0].next_steps[0].directory = 'missing',
    c => c.examples[0].title = '\u001b[31mDemo',
    c => c.examples[0].next_steps = [],
  ]) {
    const c = catalog(); mutate(c);
    assert.throws(() => validateCatalog(c, files()));
  }
  assert.throws(() => validateCatalog(catalog(), new Map()));
});
test('portable paths', () => {
  for (const path of ['../x', '/x', 'a//b', 'a/./b', 'a/../b', 'a\\b', 'C:/x', 'a/NUL.txt', 'x.', '.git/config', 'x\u0000', 'a/COM1', 'é']) {
    assert.equal(portablePath(path), false, path);
  }
  for (const path of ['.gitignore', 'app/$metric.tsx', 'a/b', 'app/Info.plist']) assert.equal(portablePath(path), true, path);
});
test('rejects links, case collisions, unlisted apps, and oversized files', () => {
  for (const [name, entry] of [
    ['examples/demo/link', { mode: '120000', size: 4 }],
    ['examples/Demo/file', { mode: '100644', size: 4 }],
    ['examples/other/README.md', { mode: '100644', size: 4 }],
    ['examples/demo/large', { mode: '100644', size: 129 * 1024 * 1024 }],
  ]) {
    const tree = files(); tree.set(name, entry);
    assert.throws(() => validateCatalog(catalog(), tree));
  }
});
