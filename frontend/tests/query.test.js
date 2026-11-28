import test from 'node:test';
import assert from 'node:assert/strict';
import { searchText, containsText, compareId, latestRequest } from '../src/app/query.js';
import { validCalendarDate } from '../../backend/src/query.js';
test('Calendar dates reject normalization, invalid leap days and times', () => {
  for (const date of ['2026-02-30','2026-02-29','2026-13-01','2026-00-00','not-a-date','2026-11-28T25:00:00+07:00']) assert.equal(validCalendarDate(date), false, date);
  for (const date of ['2024-02-29','2026-11-28','2026-11-28T00:00:00+07:00','2026-11-27T17:00:00.000Z']) assert.equal(validCalendarDate(date), true, date);
});
test('Vietnamese search: accents, case, whitespace, empty and literal symbols', () => {
  assert.equal(searchText('  ĐIỆN   Ảnh  '), 'dien anh');
  assert(containsText('Bí Mật Thành Phố', '  BI MAT  '));
  assert(containsText('Phim', '   '));
  assert(!containsText('Phim', '['));
  assert.equal(searchText(null), '');
});
test('Stable tie breaker is deterministic', () => {
  assert.deepEqual([{_id:'B'}, {_id:'A'}].sort(compareId).map(x=>x._id), ['A','B']);
});
test('Only latest asynchronous response may commit (including errors and retries)', async () => {
  const start = latestRequest(); let displayed;
  let release;
  const old = start();
  const slow = new Promise(resolve => { release = resolve; }).then(() => { if(old()) displayed = 'old'; });
  const current = start(); if(current()) displayed = 'new';
  release(); await slow;
  assert.equal(displayed, 'new');
  const retry = start();
  assert.equal(current(), false); assert.equal(retry(), true);
});
