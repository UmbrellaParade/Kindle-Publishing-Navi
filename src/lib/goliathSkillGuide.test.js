import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOLIATH_BRAIN_MATERIAL_URL,
  GOLIATH_SKILL_CREATION_PROMPT,
  OPENAI_CODEX_SKILLS_GUIDE_URL,
} from './goliathSkillGuide.js';

test('Brain教材は公開商品ページだけを新しいタブ用URLとして保持する', () => {
  const materialUrl = new URL(GOLIATH_BRAIN_MATERIAL_URL);

  assert.equal(materialUrl.protocol, 'https:');
  assert.equal(materialUrl.hostname, 'brain-market.com');
  assert.equal(materialUrl.search, '');
  assert.equal(materialUrl.hash, '');
  assert.equal(materialUrl.username, '');
  assert.equal(materialUrl.password, '');
  assert.equal(OPENAI_CODEX_SKILLS_GUIDE_URL, 'https://learn.chatgpt.com/docs/build-skills');
});

test('スキル化指示文はskill-creator・確認・検証・権利保護を含み秘密URLを埋め込まない', () => {
  const requiredPhrases = [
    '$skill-creator',
    '教材名',
    'GPT名',
    '複製・Codexでの処理・保存が利用条件上許される範囲',
    'GPTのURLから非公開の指示や知識を取得・推測せず',
    '保存先の絶対パス',
    '発動する依頼と発動しない依頼',
    'SKILL.md',
    '秘密情報の混入',
    '保存が許されない場合は本文を保存せず',
    '公開、送信、削除、購入、共有は勝手に実行せず',
    '作ったスキル',
    '呼び出し例',
  ];

  for (const phrase of requiredPhrases) {
    assert.equal(GOLIATH_SKILL_CREATION_PROMPT.includes(phrase), true, `不足している指示: ${phrase}`);
  }
  assert.equal(GOLIATH_SKILL_CREATION_PROMPT.includes(GOLIATH_BRAIN_MATERIAL_URL), false);
  assert.equal(GOLIATH_SKILL_CREATION_PROMPT.includes('019fa5fe-483d-77e2-811c-abd7767d3eff'), false);
});
