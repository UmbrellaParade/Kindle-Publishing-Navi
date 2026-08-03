import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATION_PHASES, KDP_PHASES, PROMO_PHASES } from '../src/lib/checklistTasks.js';

const tasks = [...CREATION_PHASES, ...KDP_PHASES, ...PROMO_PHASES]
  .flatMap(phase => phase.tasks);
const taskById = Object.fromEntries(tasks.map(task => [task.id, task]));

test('元の進捗表30項目を、分割項目と一般向け追加項目を含めて網羅する', () => {
  assert.equal(tasks.length, 32);
  assert.equal(new Set(tasks.map(task => task.id)).size, tasks.length);
  assert.ok(taskById.t43a);
  assert.ok(taskById.t43b);
  assert.ok(taskById.t40);
});

test('元の備考15件の要点を各工程の手順ポイントとして保持する', () => {
  const expectedGuidance = {
    t01: '全体像を把握',
    t02: 'リンクを開いて保存',
    t11: 'ブログやnote',
    t12: '競合の不満点',
    t14: 'エピソードを箇条書き',
    t16: 'KDP登録時に使用',
    t22: '過大評価なら修正',
    t23: '499〜800円',
    t32: '何度か試行',
    t33: '1.5倍',
    t34: '素人感を出さない',
    t47: '販売方針に合う場合に選ぶ',
    t49: '期限より余裕を持って提出',
    t51: '普段から',
    t55: '発売直後の認知',
  };

  Object.entries(expectedGuidance).forEach(([taskId, phrase]) => {
    assert.ok(taskById[taskId], `${taskId} がありません`);
    assert.match(taskById[taskId].note_default, new RegExp(phrase));
  });
});
