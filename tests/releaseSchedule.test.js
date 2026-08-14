import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RELEASE_TASK_OFFSETS,
  SCHEDULE_DATE_SOURCE_PROVISIONAL,
  SCHEDULE_DATE_SOURCE_RELEASE_TARGET,
  addCalendarMonths,
  applyReleaseSchedule,
  buildReleaseDateClearUpdate,
  buildReleaseScheduleUpdate,
  buildReleaseTaskDatesResetUpdate,
  countOverdueTasks,
  getReleaseScheduleSource,
  getScheduleWindow,
  offsetDate,
  readChecklistEnvelope,
  resetReleaseScheduleDates,
  syncReleaseScheduleDrafts,
  writeChecklistEnvelope,
} from '../src/lib/releaseSchedule.js';
import { ALL_CREATION_IDS, ALL_KDP_IDS, ALL_PROMO_IDS } from '../src/lib/checklistTasks.js';

test('発売日から月や年をまたいで日付を逆算できる', () => {
  assert.equal(offsetDate('2027-01-10', -14), '2026-12-27');
  assert.deepEqual(getScheduleWindow('2027-01-10'), {
    startDate: '2026-11-15',
    releaseDate: '2027-01-10',
    followUpDate: '2027-01-13',
  });
});

test('仮リリース日は暦上1か月後へ進め、存在しない月末は最終日へ丸める', () => {
  assert.equal(addCalendarMonths('2026-08-14'), '2026-09-14');
  assert.equal(addCalendarMonths('2026-01-31'), '2026-02-28');
  assert.equal(addCalendarMonths('2028-01-31'), '2028-02-29');
  assert.equal(addCalendarMonths('2026-12-31'), '2027-01-31');
  assert.throws(() => addCalendarMonths('2026-02-30'), /正しい日付/);
});

test('同じ本の一項目だけ保存更新されても、ほかの未保存入力を保持する', () => {
  const previousSaved = {
    projectId: 'book-a',
    releaseDate: '',
    provisionalDate: '',
    releaseMethod: '',
  };
  const currentDrafts = {
    projectId: 'book-a',
    releaseDate: '2026-10-14',
    provisionalDate: '',
    releaseMethod: 'ebook_direct',
  };
  const nextSaved = {
    ...previousSaved,
    provisionalDate: '2026-09-14',
  };

  assert.deepEqual(
    syncReleaseScheduleDrafts(currentDrafts, previousSaved, nextSaved),
    {
      projectId: 'book-a',
      releaseDate: '2026-10-14',
      provisionalDate: '2026-09-14',
      releaseMethod: 'ebook_direct',
    },
  );
});

test('保存値が同じ別の本へ切り替えても、前の本の未保存入力を持ち込まない', () => {
  const previousSaved = {
    projectId: 'book-a',
    releaseDate: '',
    provisionalDate: '',
    releaseMethod: '',
  };
  const currentDrafts = {
    projectId: 'book-a',
    releaseDate: '2026-10-14',
    provisionalDate: '2026-09-14',
    releaseMethod: 'ebook_direct',
  };
  const nextSaved = {
    projectId: 'book-b',
    releaseDate: '',
    provisionalDate: '',
    releaseMethod: '',
  };

  assert.deepEqual(
    syncReleaseScheduleDrafts(currentDrafts, previousSaved, nextSaved),
    nextSaved,
  );
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
  assert.equal(result.data.t01.due_date_schedule_source, SCHEDULE_DATE_SOURCE_RELEASE_TARGET);
  assert.equal(result.data.t01.due_date_schedule_for, '2026-12-01');
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

test('安全なリセットは自動逆算日だけを消し、手動日・完了・メモ・独自項目を守る', () => {
  const current = {
    t01: { is_done: true, due_date: '2026-08-20', due_date_source: 'auto', due_date_offset: -56, note: '完了メモ' },
    t02: { is_done: false, due_date: '2026-08-21', due_date_source: 'manual', note: '手動メモ' },
    t11: { is_done: false, due_date: '2026-08-22', note: '旧形式の手動日' },
    t12: { is_done: false, due_date: '', due_date_source: 'auto', due_date_offset: -52, note: '日付だけ消えた旧状態' },
  };

  const customTaskLists = {
    _creation_custom: [{ id: 'custom-1', title: '自動カスタム', state: { is_done: false, due_date: '2026-08-23', due_date_source: 'auto', note: '標準外' } }],
    _kdp_custom: [{ id: 'custom-2', title: '手動カスタム', state: { is_done: true, due_date: '2026-08-24', due_date_source: 'manual', note: '残す' } }],
  };
  const result = resetReleaseScheduleDates(current, { customTaskLists });
  assert.equal(result.clearedCount, 2);
  assert.equal(result.preservedCount, 3);
  assert.deepEqual(result.data.t01, { is_done: true, due_date: '', note: '完了メモ' });
  assert.deepEqual(result.data.t02, current.t02);
  assert.deepEqual(result.data.t11, current.t11);
  assert.deepEqual(result.data.t12, { is_done: false, due_date: '', note: '日付だけ消えた旧状態' });
  assert.deepEqual(result.customTaskLists._creation_custom[0].state, { is_done: false, due_date: '', note: '標準外' });
  assert.deepEqual(result.customTaskLists._kdp_custom, customTaskLists._kdp_custom);
});

test('仮日リセットは正式日由来の自動日を消さず、同じ仮日由来だけを消す', () => {
  const current = {
    t01: {
      is_done: true,
      due_date: '2026-08-20',
      due_date_source: 'auto',
      due_date_offset: -56,
      due_date_schedule_source: SCHEDULE_DATE_SOURCE_RELEASE_TARGET,
      due_date_schedule_for: '2026-10-15',
      note: '正式日由来',
    },
    t02: {
      is_done: false,
      due_date: '2026-07-21',
      due_date_source: 'auto',
      due_date_offset: -55,
      due_date_schedule_source: SCHEDULE_DATE_SOURCE_PROVISIONAL,
      due_date_schedule_for: '2026-09-14',
      note: '仮日由来',
    },
  };

  const result = resetReleaseScheduleDates(current, {
    scheduleSource: SCHEDULE_DATE_SOURCE_PROVISIONAL,
  });
  assert.deepEqual(result.data.t01, current.t01);
  assert.deepEqual(result.data.t02, {
    is_done: false,
    due_date: '',
    note: '仮日由来',
  });
  assert.equal(result.clearedCount, 1);
  assert.equal(result.preservedCount, 1);
});

test('強いリセットは標準・カスタムの全日程を消し、状態・メモ・タスク本体を残す', () => {
  const current = {
    t01: { is_done: true, due_date: '2026-08-20', due_date_source: 'auto', note: '完了メモ' },
    t02: { is_done: false, due_date: '2026-08-21', due_date_source: 'manual', note: '手動メモ' },
  };
  const customTaskLists = {
    _creation_custom: [{ id: 'custom-1', title: '制作追加', state: { is_done: false, due_date: '2026-08-23', due_date_source: 'manual', note: '標準外' } }],
    _kdp_custom: [{ id: 'custom-2', title: 'KDP追加', state: { is_done: true, due_date: '2026-08-24', note: '完了済み' } }],
    _custom: [{ id: 'legacy-1', title: '旧版追加', state: { is_done: false, due_date: '2026-08-25', due_date_offset: -1, note: '旧版' } }],
  };

  const result = resetReleaseScheduleDates(current, { clearAll: true, customTaskLists });
  assert.equal(result.clearedCount, 5);
  assert.equal(result.preservedCount, 0);
  assert.deepEqual(result.data.t01, { is_done: true, due_date: '', note: '完了メモ' });
  assert.deepEqual(result.data.t02, { is_done: false, due_date: '', note: '手動メモ' });
  assert.deepEqual(result.customTaskLists._creation_custom[0], {
    id: 'custom-1', title: '制作追加', state: { is_done: false, due_date: '', note: '標準外' },
  });
  assert.deepEqual(result.customTaskLists._kdp_custom[0], {
    id: 'custom-2', title: 'KDP追加', state: { is_done: true, due_date: '', note: '完了済み' },
  });
  assert.deepEqual(result.customTaskLists._custom[0], {
    id: 'legacy-1', title: '旧版追加', state: { is_done: false, due_date: '', note: '旧版' },
  });
});

test('仮日からの逆算は正式日・KDP日付・配信方法を変更せず出所を記録する', () => {
  const original = {
    id: 'project-1',
    name: '仮日テスト',
    release_target_date: '2026-10-10',
    release_date: '2026-10-12',
    release_method: 'ebook_immediate',
    schedule_mode: 'ebook_immediate',
    kdp_meta: '{"keep":true}',
    book_title: '正式書名',
    checklist_data: JSON.stringify({
      _data: { t01: { is_done: false, due_date: '', note: '保持' } },
      _kdp_fields: { t41_book_title: '正式書名' },
    }),
  };
  const { updates, result } = buildReleaseScheduleUpdate(original, {
    date: '2026-09-14',
    source: SCHEDULE_DATE_SOURCE_PROVISIONAL,
    generatedAt: '2026-08-14T00:00:00.000Z',
  });

  assert.equal(updates.provisional_release_date, '2026-09-14');
  assert.equal(updates.schedule_date_source, SCHEDULE_DATE_SOURCE_PROVISIONAL);
  assert.equal(updates.schedule_calculated_for, '2026-09-14');
  assert.equal(Object.hasOwn(updates, 'release_target_date'), false);
  assert.equal(Object.hasOwn(updates, 'release_date'), false);
  assert.equal(Object.hasOwn(updates, 'release_method'), false);
  assert.equal(Object.hasOwn(updates, 'schedule_mode'), false);
  assert.equal(Object.hasOwn(updates, 'kdp_meta'), false);
  assert.equal(result.data.t01.note, '保持');
  const saved = JSON.parse(updates.checklist_data);
  assert.equal(saved._schedule_date_source, SCHEDULE_DATE_SOURCE_PROVISIONAL);
  assert.equal(saved._schedule_mode, undefined);
  assert.equal(saved._kdp_fields.t41_book_title, '正式書名');
  assert.equal(saved._data.t01.due_date_schedule_source, SCHEDULE_DATE_SOURCE_PROVISIONAL);
  assert.equal(saved._data.t01.due_date_schedule_for, '2026-09-14');
});

test('正式日からの逆算だけが配信方法と正式な発売目標日を保存する', () => {
  const { updates } = buildReleaseScheduleUpdate({ checklist_data: '' }, {
    date: '2026-10-14',
    source: SCHEDULE_DATE_SOURCE_RELEASE_TARGET,
    releaseMethod: 'ebook_preorder',
    generatedAt: '2026-08-14T00:00:00.000Z',
  });

  assert.equal(updates.release_target_date, '2026-10-14');
  assert.equal(updates.release_method, 'ebook_preorder');
  assert.equal(updates.schedule_mode, 'ebook_preorder');
  assert.equal(updates.schedule_date_source, SCHEDULE_DATE_SOURCE_RELEASE_TARGET);
  assert.equal(Object.hasOwn(updates, 'provisional_release_date'), false);
  assert.equal(JSON.parse(updates.checklist_data)._schedule_mode, 'ebook_preorder');
});

test('仮日と正式な発売目標日が同じ日でも逆算元を区別する', () => {
  const provisional = buildReleaseScheduleUpdate({ checklist_data: '' }, {
    date: '2026-09-14',
    source: SCHEDULE_DATE_SOURCE_PROVISIONAL,
  });
  const official = buildReleaseScheduleUpdate({ checklist_data: '' }, {
    date: '2026-09-14',
    source: SCHEDULE_DATE_SOURCE_RELEASE_TARGET,
    releaseMethod: 'ebook_preorder',
  });

  assert.equal(provisional.updates.schedule_date_source, SCHEDULE_DATE_SOURCE_PROVISIONAL);
  assert.equal(official.updates.schedule_date_source, SCHEDULE_DATE_SOURCE_RELEASE_TARGET);
  assert.equal(
    JSON.parse(provisional.updates.checklist_data)._data.t01.due_date_schedule_source,
    SCHEDULE_DATE_SOURCE_PROVISIONAL,
  );
  assert.equal(
    JSON.parse(official.updates.checklist_data)._data.t01.due_date_schedule_source,
    SCHEDULE_DATE_SOURCE_RELEASE_TARGET,
  );
});

test('正式日と仮日の消去は各日付だけを独立して未設定へ戻す', () => {
  const base = {
    release_target_date: '2026-10-14',
    provisional_release_date: '2026-09-14',
    release_method: 'ebook_preorder',
    schedule_mode: 'ebook_preorder',
    schedule_calculated_for: '2026-09-14',
    schedule_date_source: SCHEDULE_DATE_SOURCE_PROVISIONAL,
    checklist_data: JSON.stringify({
      _data: { t01: { is_done: false, due_date: '2026-07-20', due_date_source: 'auto', note: '保持' } },
    }),
  };

  const officialReset = buildReleaseDateClearUpdate({ kind: 'official' });
  assert.deepEqual(officialReset.updates, { release_target_date: '' });

  const provisionalReset = buildReleaseDateClearUpdate({ kind: 'provisional' });
  assert.deepEqual(provisionalReset.updates, { provisional_release_date: '' });

  const officialMerged = { ...base, ...officialReset.updates };
  const provisionalMerged = { ...base, ...provisionalReset.updates };
  assert.equal(officialMerged.provisional_release_date, '2026-09-14');
  assert.equal(provisionalMerged.release_target_date, '2026-10-14');
  assert.equal(officialMerged.checklist_data, base.checklist_data);
  assert.equal(provisionalMerged.checklist_data, base.checklist_data);
  assert.equal(officialMerged.release_method, 'ebook_preorder');
  assert.equal(provisionalMerged.release_method, 'ebook_preorder');
});

test('旧版の逆算日程も正式な発売目標日を残して自動日だけリセットできる', () => {
  const legacy = {
    release_target_date: '2026-10-14',
    schedule_calculated_for: '2026-10-14',
    checklist_data: JSON.stringify({
      _data: { t01: { is_done: true, due_date: '2026-08-19', due_date_source: 'auto', note: '完了は維持' } },
    }),
  };
  assert.equal(getReleaseScheduleSource(legacy), SCHEDULE_DATE_SOURCE_RELEASE_TARGET);
  const reset = buildReleaseTaskDatesResetUpdate(legacy);
  assert.equal(Object.hasOwn(reset.updates, 'release_target_date'), false);
  assert.equal(reset.updates.schedule_calculated_for, '');
  assert.deepEqual(JSON.parse(reset.updates.checklist_data)._data.t01, {
    is_done: true,
    due_date: '',
    note: '完了は維持',
  });
});

test('全日程リセットでも日付以外のプロジェクト情報を更新対象に含めない', () => {
  const project = {
    release_target_date: '2026-10-14',
    provisional_release_date: '2026-09-14',
    release_method: 'ebook_preorder',
    schedule_mode: 'ebook_preorder',
    schedule_calculated_for: '2026-10-14',
    schedule_date_source: SCHEDULE_DATE_SOURCE_RELEASE_TARGET,
    manuscript: '原稿',
    kdp_meta: '{"keep":true}',
    cover_image_url: 'local-image:cover',
    critique_history: '[{"keep":true}]',
    checklist_data: JSON.stringify({
      _data: { t01: { is_done: true, due_date: '2026-08-19', due_date_source: 'manual', note: '残る' } },
      _creation_custom: [{ id: 'custom', title: '追加', state: { is_done: true, due_date: '2026-08-20', note: '残る' } }],
      _kdp_fields: { t41_book_title: '書名' },
    }),
  };
  const reset = buildReleaseTaskDatesResetUpdate(project, { clearAll: true });
  const merged = { ...project, ...reset.updates };
  assert.equal(merged.release_target_date, '2026-10-14');
  assert.equal(merged.provisional_release_date, '2026-09-14');
  assert.equal(merged.release_method, 'ebook_preorder');
  assert.equal(merged.schedule_mode, 'ebook_preorder');
  assert.equal(merged.manuscript, '原稿');
  assert.equal(merged.kdp_meta, '{"keep":true}');
  assert.equal(merged.cover_image_url, 'local-image:cover');
  assert.equal(merged.critique_history, '[{"keep":true}]');
  const saved = JSON.parse(merged.checklist_data);
  assert.deepEqual(saved._data.t01, { is_done: true, due_date: '', note: '残る' });
  assert.deepEqual(saved._creation_custom[0], {
    id: 'custom', title: '追加', state: { is_done: true, due_date: '', note: '残る' },
  });
  assert.equal(saved._kdp_fields.t41_book_title, '書名');
});

test('制作・KDP・プロモーションの全項目へ目標日を自動設定する', () => {
  const allTaskIds = [...ALL_CREATION_IDS, ...ALL_KDP_IDS, ...ALL_PROMO_IDS];
  assert.deepEqual(Object.keys(RELEASE_TASK_OFFSETS).sort(), [...allTaskIds].sort());

  const result = applyReleaseSchedule({}, '2026-12-01');
  allTaskIds.forEach(taskId => {
    assert.match(result.data[taskId].due_date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(result.data[taskId].due_date_source, 'auto');
  });
  assert.equal(result.data.t49.due_date, '2026-11-17');
  assert.equal(result.data.t55.due_date, '2026-12-01');
  assert.equal(result.data.t56.due_date, '2026-12-04');
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
