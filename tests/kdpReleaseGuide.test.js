import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const kdpChecklistSource = readFileSync(
  new URL('../src/components/tabs/KdpChecklistTab.jsx', import.meta.url),
  'utf8',
);
const manual = readFileSync(
  new URL('../src/content/kindleNaviManual.md', import.meta.url),
  'utf8',
);
const checklistTasksSource = readFileSync(
  new URL('../src/lib/checklistTasks.js', import.meta.url),
  'utf8',
);

test('KDP登録進捗に省スペースの初心者向け発売解説を置く', () => {
  const guide = kdpChecklistSource.match(
    /<details id="ebook-release-guide"([\s\S]*?)<\/details>/,
  )?.[0] || '';

  assert.notEqual(guide, '', '電子書籍の発売解説がありません');
  assert.doesNotMatch(guide, /<details[^>]*\sopen(?:=|\s|>)/, '解説は初期状態で閉じてください');
  assert.match(guide, /min-h-11/);
  assert.match(guide, /focus-visible:ring-2/);
  assert.match(guide, /md:grid-cols-3/);
  assert.match(guide, /発売日は日本時間0:00固定ではありません/);
  assert.match(guide, /予約注文は発売前から反映されます/);
  assert.match(guide, /KUはKENPで「読まれた量」を確認/);
});

test('予約注文・ランキング・KUをKDP公式の範囲で説明する', () => {
  const requiredPhrases = [
    '発売日はGMT基準',
    '商品ページが発売前に公開され、読者は発売日まで注文できます',
    '予約注文は発売前から販売ランキング',
    '発売日にすべてまとめて加算される前提にはせず',
    '順位は相対評価で、保証されません',
    '初めて読んだページがKENPとして記録',
    'KUロイヤリティの計算に使われます',
    'ランキングへの具体的な換算方法は公開されていません',
  ];

  requiredPhrases.forEach(phrase => {
    assert.equal(kdpChecklistSource.includes(phrase), true, `画面の解説不足: ${phrase}`);
  });

  assert.doesNotMatch(kdpChecklistSource, /日本時間の午前0時から販売開始します/);
  assert.doesNotMatch(kdpChecklistSource, /読んだページ数がランキングに加算されます/);
  assert.match(checklistTasksSource, /発売日に一括加算される前提ではない/);
});

test('マニュアルとFAQでレポートとの差・発売後案内・KENPを説明する', () => {
  const requiredPhrases = [
    '電子書籍の予約注文・ランキング・Kindle Unlimited',
    '商品ページが発売前に公開され、読者は発売日まで注文できます',
    '日本時間の午前0時ちょうどに必ず販売開始するとは限りません',
    '販売レポートでは、予約分は配信されるまで通常の注文レポートに現れず',
    '発売後に購入できる案内も用意する',
    '借りられた、またはダウンロードされたことだけでKENPになるわけではありません',
    'KENP何ページが順位へどう換算されるかは公開していません',
    '予約注文した電子書籍は、日本時間の午前0時から販売されますか？',
    'ランキングを重視するなら、予約注文を使わない方がよいですか？',
    'Kindle Unlimitedは、借りられただけで収益やランキングに加算されますか？',
  ];

  requiredPhrases.forEach(phrase => {
    assert.equal(manual.includes(phrase), true, `マニュアルの解説不足: ${phrase}`);
  });
});

test('公式リンクは安全な別タブリンクとして掲載する', () => {
  const topics = ['G201575300', 'G201499380', 'G201648140', 'G201541130'];

  topics.forEach(topic => {
    const pattern = new RegExp(
      `href="https://kdp\\.amazon\\.co\\.jp/ja_JP/help/topic/${topic}"[\\s\\S]*?target="_blank"[\\s\\S]*?rel="noopener noreferrer"`,
    );
    assert.match(kdpChecklistSource, pattern, `${topic} の安全な公式リンクがありません`);
  });

  ['G201575300', 'G201499380', 'G201499400', 'G201648140', 'G201541130'].forEach(topic => {
    assert.equal(manual.includes(`https://kdp.amazon.co.jp/ja_JP/help/topic/${topic}`), true);
  });
});
