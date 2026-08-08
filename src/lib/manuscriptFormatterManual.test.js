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
const manualComponent = readFileSync(
  new URL('../components/tabs/ManuscriptFormatterManual.jsx', import.meta.url),
  'utf8',
);

const EXPECTED_TITLES = [
  'このマニュアルの対象',
  'パソコンで使用してください',
  'KindleとA5・A6の違い',
  '作業前に保存方法を確認する',
  'Kindle原稿を完成させる流れ',
  '新しい原稿を作る・既存原稿を開く',
  '画面の見方',
  '本文ツールバーの記号と機能',
  '見出し・ルビ・文字サイズを設定する',
  '改ページと画像を設定する',
  'Kindle向け目次を作る',
  'Kindle原稿をDOCXで書き出す',
  'DOCXを書き出した後に確認する',
  'KDPへ登録するときの注意',
  'しまうま出版とは',
  'しまうま出版のA5・A6を選ぶ',
  'しまうま出版用PDFを作る流れ',
  '漫画・画像・QRコードを使う',
  '縦書き・横組み・カラムを使う',
  '保存と復元',
  'よくある問題と最終チェック',
];

test('利用マニュアル原文を2026年8月9日版のまま保持する', () => {
  assert.equal(MANUSCRIPT_FORMATTER_MANUAL_UPDATED_AT, '2026年8月9日');
  assert.equal(
    createHash('sha256').update(manual.replace(/\r\n/g, '\n')).digest('hex'),
    'd4c1abcfc48050866e1261e5428aff78904c0ecfb3365ca19e725f452d068b76',
  );
  assert.equal(manualComponent.includes('2026年8月6日'), false);
  assert.equal(manualComponent.includes('{MANUSCRIPT_FORMATTER_MANUAL_UPDATED_AT}更新'), true);
});

test('目次は全21章を原文と同じ順序と安定IDで案内する', () => {
  const sections = MANUSCRIPT_FORMATTER_MANUAL_GROUPS.flatMap(group => group.sections);
  const markdownHeadings = [...manual.matchAll(/^## (\d+)\. (.+)$/gm)];

  assert.equal(sections.length, 21);
  assert.deepEqual(sections.map(section => section.title), EXPECTED_TITLES);
  assert.deepEqual(sections.map(section => section.id), EXPECTED_TITLES.map((_, index) => `manual-section-${index + 1}`));
  assert.deepEqual(markdownHeadings.map(match => match[2]), EXPECTED_TITLES);
  assert.equal(getManuscriptFormatterManualSectionId('11. Kindle向け目次を作る'), 'manual-section-11');
  assert.equal(getManuscriptFormatterManualSectionId('Kindle向け目次を作る'), undefined);
});

test('PC・DOCX・判型・操作名・最終確認の注意を省略しない', () => {
  const requiredPhrases = [
    'このツールはパソコン専用です。',
    'Kindle向けの基本出力はDOCXです。',
    'Kindle電子書籍に入稿するのは、このツールから書き出したDOCXです。',
    'A5の寸法を自分で調整したり、しまうま出版用PDFを使ったりする必要はありません。',
    'KDPの「電子書籍の原稿をアップロード」へDOCXを登録する',
    '[KDPのオンラインプレビューアー](https://kdp.amazon.co.jp/ja_JP/help/topic/G200641240)で、スマートフォン、タブレット、Kindle端末の表示を確認する',
    '固定ページではないため、A5の入稿寸法の調整は不要',
    'A5: KDPペーパーバックで使用可能',
    'A6: KDPペーパーバックでは使用不可',
    'このツールから書き出したしまうま出版用PDFを、KDPペーパーバックへそのまま入稿しないでください。',
    '入力内容は現在のブラウザへ自動保存されます。ただし、別の端末や別のブラウザには自動では移りません。',
    '「新規」を実行すると、現在のブラウザ保存が新しい原稿で上書きされます。必要な原稿は先にJSONで保存してください。',
    '塗り足し込み原稿: 154mm × 216mm',
    '塗り足し込み原稿: 111mm × 154mm',
    '選択ブロックをページ中央',
    '選択段落を横組み',
    '全画像をページ内最大',
    '「ページ番号」をオフにします。',
    '「章へのリンク」をオンにします。',
    'Google Driveへ保存',
    '## 12. Kindle原稿をDOCXで書き出す',
    '## 15. しまうま出版とは',
    '## 17. しまうま出版用PDFを作る流れ',
    '## 21. よくある問題と最終チェック',
    'Kindleで出すときはDOCXとPDFのどちらを使いますか？',
    'Kindle用DOCXをWordまたはGoogleドキュメントで先頭から末尾まで確認した',
    'しまうま出版も利用する場合は、PDFのサイズと総ページ数を確認した',
    'KDPペーパーバックも作る場合は、A6を使用していない',
    'KDPのオンラインプレビューアーで全ページを確認した',
  ];

  requiredPhrases.forEach(phrase => assert.equal(manual.includes(phrase), true, `不足している原文: ${phrase}`));
  assert.equal((manual.match(/^- \[ \] /gm) || []).length, 12);
  assert.equal(manual.includes('## 17. EPUBを書き出す'), false);
  assert.equal(manual.includes('DOCXをKindle Previewerでも開いてください'), false);
  assert.equal(manual.includes('……や―を縦書き向けに配置する'), false);
  assert.equal(manual.includes('github.com/UmbrellaParade/novel-drafting-tool'), false);
});
