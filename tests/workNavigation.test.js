import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getNextWorkTasks, getStandardProvisionalDate, getTaskNavigation, hasPastScheduleTargets } from '../src/lib/workNavigation.js';
import { applyReleaseSchedule, countOverdueTasks, getScheduleWindow } from '../src/lib/releaseSchedule.js';
import { ALL_CREATION_IDS, ALL_KDP_IDS, ALL_PROMO_IDS } from '../src/lib/checklistTasks.js';

test('今日開始の標準仮日程は8週間後を使い、開始時点で期限超過を作らない', () => {
  for (const today of ['2026-09-06', '2026-12-20', '2028-02-01']) {
    const release = getStandardProvisionalDate(today);
    assert.equal(getScheduleWindow(release).startDate, today);
    const result = applyReleaseSchedule({}, release);
    assert.equal(countOverdueTasks(result.checklistData, today), 0);
    assert.equal(hasPastScheduleTargets(release, today), false);
  }
  assert.equal(getStandardProvisionalDate('2026-09-06'), '2026-11-01');
  assert.equal(hasPastScheduleTargets('2026-10-06', '2026-09-06'), true);
  assert.equal(hasPastScheduleTargets('broken', '2026-09-06'), false);
});

test('日程未設定でも最初の未完了項目へ案内し、完了済みを除外する', () => {
  assert.equal(getNextWorkTasks()[0].taskId, 't01');
  const state = { t01: { is_done: true }, t02: { is_done: true }, t14: { due_date: '2026-09-10' } };
  assert.equal(getNextWorkTasks(state)[0].taskId, 't14');
  assert.equal(getNextWorkTasks(state).some(task => task.taskId === 't01'), false);
  assert.equal(state.t14.due_date, '2026-09-10');
  const completed = Object.fromEntries([...ALL_CREATION_IDS, ...ALL_KDP_IDS, ...ALL_PROMO_IDS].map(id => [id, { is_done: true }]));
  assert.deepEqual(getNextWorkTasks(completed), []);
});

test('全標準タスクが実在するフェーズへ対応し、不明IDは遷移しない', () => {
  for (const id of [...ALL_CREATION_IDS, ...ALL_KDP_IDS, ...ALL_PROMO_IDS]) {
    const target = getTaskNavigation(id);
    assert.equal(target.taskId, id);
    assert.ok(['creation', 'kdp'].includes(target.tabId));
  }
  assert.deepEqual(getTaskNavigation('t01'), { tabId: 'creation', phaseId: 'phase0', taskId: 't01' });
  assert.equal(getTaskNavigation('unknown'), null);
});

test('日程は初期折りたたみ、マニュアルからフェーズ0へ直接移動する', () => {
  const schedule = readFileSync(new URL('../src/components/ReleaseScheduleCard.jsx', import.meta.url), 'utf8');
  const manual = readFileSync(new URL('../src/components/tabs/KindleNaviManualTab.jsx', import.meta.url), 'utf8');
  assert.match(schedule, /\[settingsOpen, setSettingsOpen\] = useState\(false\)/);
  assert.match(schedule, /<details open=\{settingsOpen\}/);
  assert.match(schedule, /onOpenTask\(nextTasks\[0\]\.taskId\)/);
  assert.match(manual, /navigateToFeature\('creation', \{ phaseId: 'phase0', taskId: 't01' \}\)/);
});
