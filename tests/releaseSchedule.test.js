import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReleaseSchedule,
  countOverdueTasks,
  getScheduleWindow,
  offsetDate,
  readChecklistEnvelope,
  writeChecklistEnvelope,
} from '../src/lib/releaseSchedule.js';

test('発売日から月や年をまたいで日付を逆算できる', () => {
  assert.equal(offsetDate('2027-01-10', -14), '2026-12-27');
  assert.deepEqual(getScheduleWindow('2027-01-10'), {
    startDate: '2026-11-15',
    releaseDate: '2027-01-10',
    followUpDate: '2027-01-13',
  });
});

test('標準逆算は空欄と自動日を更新し、手動日・完了済み・旧形式の日付を守る', () => {
  const current = {
    t01: { is_done: false, due_date: '', note: '空欄' },
    t02: { is_done: false, due_date: '2026-09-01', due_date_source: 'auto', note: '自動' },
    t11: { is_done: false, due_date: '2026-09-02', due_date_source: 'manual', note: '手動' },
    t12: { is_done: true, due_date: '2026-09-03', due_date_source: 'auto', note: '完了' },
    t13: { is_done: false, due_date: '2026-09-04', note: '旧形式' },
  };

  const result = applyReleaseSchedule(current, '2026-12-01');
  assert.equal(result.data.t01.due_date, '2026-10-06');
  assert.equal(result.data.t01.due_date_source, 'auto');
  assert.equal(result.data.t02.due_date, '2026-10-07');
  assert.equal(result.data.t11.due_date, '2026-09-02');
  assert.equal(result.data.t12.due_date, '2026-09-03');
  assert.equal(result.data.t13.due_date, '2026-09-04');
  assert.equal(result.data.t11.note, '手動');
});

test('全再設定では手動日と完了済みの日付も更新する', () => {
  const current = {
    t01: { is_done: true, due_date: '2026-01-01', due_date_source: 'manual' },
  };
  const result = applyReleaseSchedule(current, '2026-12-01', { overwriteManual: true });
  assert.equal(result.data.t01.due_date, '2026-10-06');
  assert.equal(result.data.t01.due_date_source, 'auto');
  assert.equal(result.data.t01.is_done, true);
});

test('チェックリストの付随データを維持して新形式へ保存する', () => {
  const raw = JSON.stringify({
    _data: { t01: { is_done: false } },
    _custom: [{ id: 'custom-1' }],
    _kdp_fields: { title: '本' },
  });
  const saved = JSON.parse(writeChecklistEnvelope(raw, { t01: { is_done: true } }, { _schedule_version: 1 }));
  assert.deepEqual(saved._custom, [{ id: 'custom-1' }]);
  assert.deepEqual(saved._kdp_fields, { title: '本' });
  assert.equal(saved._data.t01.is_done, true);
  assert.equal(saved._schedule_version, 1);

  const legacy = readChecklistEnvelope(JSON.stringify({ t01: { is_done: false } }));
  assert.deepEqual(legacy.envelope, {});
  assert.equal(legacy.data.t01.is_done, false);
});

test('破損したチェックリストは空データで上書きせず保存を停止する', () => {
  const malformed = '{"_data":';
  const parsed = readChecklistEnvelope(malformed);
  assert.equal(parsed.corruptRaw, malformed);
  assert.match(parsed.error.message, /上書きを停止/);
  assert.throws(
    () => writeChecklistEnvelope(malformed, { t01: { is_done: true } }),
    /上書きを停止/,
  );

  const invalidEnvelope = JSON.stringify({ _data: [] });
  assert.throws(
    () => writeChecklistEnvelope(invalidEnvelope, {}),
    /上書きを停止/,
  );
});

test('期限超過は未完了だけを数える', () => {
  assert.equal(countOverdueTasks({
    t01: { due_date: '2026-08-01', is_done: false },
    t02: { due_date: '2026-08-01', is_done: true },
    t11: { due_date: '2026-08-03', is_done: false },
    t12: { due_date: '2026-08-04', is_done: false },
  }, '2026-08-03'), 1);
});
