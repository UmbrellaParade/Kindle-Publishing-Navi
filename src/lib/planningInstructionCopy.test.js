import test from 'node:test';
import assert from 'node:assert/strict';

import {
  copyPlanningInstructionText,
  getPlanningInstructionCopyText,
} from './planningInstructionCopy.js';

test('指示書は名前・版・状態・所在メモを含めず本文だけをそのままコピーする', () => {
  const record = {
    name: '質問01：本を書く理由',
    versionNumber: 2,
    documentId: 'instruction-series-01',
    status: 'approved',
    changeSummary: '質問文を短く調整',
    nextHandoff: '新しいChatGPT',
    externalFileLocation: 'https://example.com/internal-file',
    markdown: 'あなたがこの本を書こうと思った理由を、\n最初の出来事から教えてください。',
  };

  const copied = getPlanningInstructionCopyText(record);
  assert.equal(copied, record.markdown);
  assert.doesNotMatch(copied, /質問01|instruction-series-01|approved|内部ファイル|internal-file|新しいChatGPT/);
});

test('指示書本文が文字列でない場合は安全に空文字として扱う', () => {
  assert.equal(getPlanningInstructionCopyText(null), '');
  assert.equal(getPlanningInstructionCopyText({ markdown: null }), '');
  assert.equal(getPlanningInstructionCopyText({ markdown: 123 }), '');
});

test('クリップボードへ先頭末尾の空白・改行・Markdownを変えずに1回だけ渡す', async () => {
  const calls = [];
  const markdown = '  ## 質問01\n\n```text\n今日の質問です\n```\n  ';
  const record = { name: '管理名', markdown };
  const before = structuredClone(record);
  const copied = await copyPlanningInstructionText(
    record,
    async value => { calls.push(value); },
  );

  assert.equal(copied, markdown);
  assert.deepEqual(calls, [markdown]);
  assert.deepEqual(record, before, 'コピーは保存済みデータを変更しない');
});

test('空本文・Clipboard未対応・書込み拒否では成功扱いにしない', async () => {
  let callCount = 0;
  await assert.rejects(
    copyPlanningInstructionText({ markdown: '   \n' }, async () => { callCount += 1; }),
    /コピーする指示書本文がありません/,
  );
  assert.equal(callCount, 0);

  await assert.rejects(
    copyPlanningInstructionText({ markdown: '質問です' }, undefined),
    /クリップボードを利用できません/,
  );
  await assert.rejects(
    copyPlanningInstructionText({ markdown: '質問です' }, async () => { throw new Error('permission denied'); }),
    /permission denied/,
  );
});
