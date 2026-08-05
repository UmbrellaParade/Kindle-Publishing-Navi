import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  getManuscriptFormatterManualSectionId,
  MANUSCRIPT_FORMATTER_MANUAL_GROUPS,
  MANUSCRIPT_FORMATTER_MANUAL_UPDATED_AT,
} from './manuscriptFormatterManual.js';

const manual = readFileSync(
  new URL('../content/manuscriptFormatterManual.md', import.meta.url),
  'utf8',
);

const EXPECTED_TITLES = [
  'このツールでできること',
  '最初に知っておきたいこと',
  '画面の見方',
  '新しい原稿を作る',
  '既存の原稿を開く',
  'ページ設定を選ぶ',
  '本文を編集する',
  '改ページを入れる',
  '画像を使う',
  '1ページ内を2列・3列にする',
  '縦書きを使う',
  '目次を作る',
  'QRコードカードを作る',
  '原稿を保存する',
  'PDFを書き出す',
  'DOCXを書き出す',
  'EPUBを書き出す',
  '右側の「確認」を使う',
  'おすすめの制作手順',
  'よくある質問と対処',
  '最終チェックリスト',
];

test('公開マニュアル原文を2026年8月6日版のまま保持する', () => {
  assert.equal(MANUSCRIPT_FORMATTER_MANUAL_UPDATED_AT, '2026年8月6日');
  assert.equal(
    createHash('sha256').update(manual).digest('hex'),
    'debde6edbd79a177ce2a37a88f86f3b8e6147b7a27f163063fec92c0f568451d',
  );
});

test('目次は全21章を原文と同じ順序と安定IDで案内する', () => {
  const sections = MANUSCRIPT_FORMATTER_MANUAL_GROUPS.flatMap(group => group.sections);
  const markdownHeadings = [...manual.matchAll(/^## (\d+)\. (.+)$/gm)];

  assert.equal(sections.length, 21);
  assert.deepEqual(sections.map(section => section.title), EXPECTED_TITLES);
  assert.deepEqual(sections.map(section => section.id), EXPECTED_TITLES.map((_, index) => `manual-section-${index + 1}`));
  assert.deepEqual(markdownHeadings.map(match => match[2]), EXPECTED_TITLES);
  assert.equal(getManuscriptFormatterManualSectionId('11. 縦書きを使う'), 'manual-section-11');
  assert.equal(getManuscriptFormatterManualSectionId('縦書きを使う'), undefined);
});

test('重要な寸法・操作名・保存注意・出力確認・最終チェックを省略しない', () => {
  const requiredPhrases = [
    '入力内容は現在のブラウザへ自動保存されます。ただし、別の端末や別のブラウザには自動では移りません。',
    '「新規」を実行すると、現在のブラウザ保存が新しい原稿で上書きされます。必要な原稿は先にJSONで保存してください。',
    '原稿サイズ: 154mm × 216mm',
    '原稿サイズ: 111mm × 154mm',
    '選択ブロックをページ中央',
    '選択段落を横組み',
    '全画像をページ内最大',
    '目次の「ページ番号」をオフにし、「章へのリンク」をオンにする設定がおすすめです。',
    '公開前に、PDFまたは印刷物を実際のスマートフォンで読み取り、URLが正しいことを確認してください。',
    'Google Driveへ保存',
    'Kindle Previewer',
    '## 15. PDFを書き出す',
    '## 16. DOCXを書き出す',
    '## 17. EPUBを書き出す',
    '### スマートフォン表示',
    '## 20. よくある質問と対処',
    '## 21. 最終チェックリスト',
  ];

  requiredPhrases.forEach(phrase => assert.equal(manual.includes(phrase), true, `不足している原文: ${phrase}`));
  assert.equal((manual.match(/^- \[ \] /gm) || []).length, 16);
});
