import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/components/tabs/GoliathBrainSkillsTab.jsx', import.meta.url),
  'utf8',
);

test('Brain教材を新しいタブで安全に開ける', () => {
  assert.match(source, /href=\{GOLIATH_BRAIN_MATERIAL_URL\}/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /ゴリアスさんのBrain教材を開く/);
  assert.match(source, /新しいタブで開く/);
});

test('初心者が3ステップとGPT資料の準備範囲を理解できる', () => {
  for (const phrase of [
    'やることは3つだけ',
    '教材・GPTを用意する',
    '指示文をCodexへ貼る',
    '質問に答えて検品する',
    'GPTのURLだけでは、非公開の指示や知識ファイルまでは読み取れません',
    '指示、会話スターター、知識ファイル',
    '自動送信なし',
  ]) {
    assert.equal(source.includes(phrase), true, `不足している案内: ${phrase}`);
  }
});

test('指示文だけをawaitしてコピーし、失敗時は手動コピーへ安全に戻す', () => {
  assert.match(source, /await navigator\.clipboard\.writeText\(GOLIATH_SKILL_CREATION_PROMPT\)/);
  assert.match(source, /Codexへのスキル化指示文をコピーしました/);
  assert.match(source, /ブラウザのクリップボード許可を確認/);
  assert.match(source, /fallbackRef\.current\?\.select\(\)/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /readOnly/);
  assert.doesNotMatch(source, /execCommand|innerHTML/);
});

test('PCとスマホで押しやすく、教材や秘密情報を自動保存しない', () => {
  assert.match(source, /min-h-12 w-full/);
  assert.match(source, /grid grid-cols-1 gap-3 md:grid-cols-3/);
  assert.match(source, /<h2 id="goliath-brain-skills-heading"/);
  assert.doesNotMatch(source, /<h1/);
  assert.match(source, /text-sm font-black text-slate-50/);
  assert.match(source, /限定URL、ログイン情報、Cookie、APIキー/);
  assert.match(source, /教材本文を保存・転載・同期しません/);
  assert.doesNotMatch(source, /onProjectUpdate|localStorage|sessionStorage|fetch\(/);
});
