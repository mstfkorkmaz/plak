import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRange } from '../src/range.ts';
import { fold, likePattern, sortBy } from '../src/text.ts';

test('fold makes Turkish text searchable without special characters', () => {
  assert.equal(fold('ŞARKI'), 'sarki');
  assert.equal(fold('Işıklar'), 'isiklar');
  assert.equal(fold('İstanbul'), 'istanbul');
  assert.equal(fold('  Çınar   Altında '), 'cinar altinda');
  assert.equal(fold('Göğüs Üstü'), 'gogus ustu');
});

test('likePattern escapes wildcards', () => {
  assert.equal(likePattern('100%'), '%100\\%%');
  assert.equal(likePattern('a_b'), '%a\\_b%');
});

test('sortBy uses Turkish alphabet order', () => {
  const sorted = sortBy(['Zeytin', 'Çay', 'Cam', 'Ilık', 'İnce', 'Dut'], (s) => s);
  assert.deepEqual(sorted, ['Cam', 'Çay', 'Dut', 'Ilık', 'İnce', 'Zeytin']);
});

test('parseRange', () => {
  assert.equal(parseRange(undefined, 100), null);
  assert.deepEqual(parseRange('bytes=0-9', 100), { start: 0, end: 9 });
  assert.deepEqual(parseRange('bytes=90-', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=50-500', 100), { start: 50, end: 99 });
  assert.equal(parseRange('bytes=100-', 100), 'invalid');
  assert.equal(parseRange('bytes=20-10', 100), 'invalid');
  assert.equal(parseRange('bytes=0-1,5-6', 100), null);
  assert.equal(parseRange('items=0-1', 100), null);
});
