import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeSource = readFileSync(
  new URL('../src/pages/Home.jsx', import.meta.url),
  'utf8',
);
const manualSource = readFileSync(
  new URL('../src/components/tabs/KindleNaviManualTab.jsx', import.meta.url),
  'utf8',
);
const formatterManualSource = readFileSync(
  new URL('../src/components/tabs/ManuscriptFormatterManual.jsx', import.meta.url),
  'utf8',
);

const expectedTabs = [
  ['manual', '使い方マニュアル'],
  ['creation', 'Kindle本制作進捗'],
  ['notes', '企画・取材・構成ノート'],
  ['kdp', 'KDP登録進捗'],
  ['category', 'カテゴリーチェック'],
  ['promo', 'プロモーション戦略メモ'],
  ['description', 'KDP書籍説明文'],
  ['aplus', '表紙＆A+コンテンツ'],
  ['format', 'Kindle原稿作成ガイド'],
  ['formatter', 'Kindle原稿整形ツール（テスト版）'],
  ['critique', '辛口論評'],
];

test('メインナビは全11項目の正式名と順序を保つ', () => {
  const tabBlock = homeSource.match(/const TABS = \[([\s\S]*?)\];/)?.[1] || '';
  const actualTabs = [...tabBlock.matchAll(/\{ id: '([^']+)',\s+label: '([^']+)' \}/g)]
    .map(match => [match[1], match[2]]);

  assert.deepEqual(actualTabs, expectedTabs);
  assert.match(homeSource, /aria-current=\{activeTab === tab\.id \? 'page' : undefined\}/);
  assert.match(homeSource, /focus-visible:ring-2 focus-visible:ring-neon-cyan\/80/);
});

test('PCとタブレットは6列2段で全項目を横スクロールなしに表示する', () => {
  const navigationBlock = homeSource.match(/\{\/\* タブナビゲーション \*\/\}([\s\S]*?)\{\/\* コンテンツ \*\/\}/)?.[1] || '';

  assert.match(navigationBlock, /data-main-tab-grid="desktop"/);
  assert.match(navigationBlock, /hidden grid-cols-6 gap-1 py-2 md:grid/);
  assert.match(navigationBlock, /min-h-11 w-full[\s\S]*text-center[\s\S]*leading-tight/);
  assert.doesNotMatch(navigationBlock, /overflow-x-auto|overscroll-x-contain/);
  assert.doesNotMatch(homeSource, /tabButtonRefs|inline: 'center'/);
});

test('スマホは現在地と全11項目を開閉でき、企画ノートを2列幅で表示する', () => {
  assert.match(homeSource, /aria-controls="mobile-main-tab-list"/);
  assert.match(homeSource, /aria-expanded=\{mobileTabsOpen\}/);
  assert.match(homeSource, /表示中の機能/);
  assert.match(homeSource, /機能一覧（\{TABS\.length\}）/);
  assert.match(homeSource, /id="mobile-main-tab-list" className="mt-2 grid max-h-\[calc\(100dvh-5\.5rem\)\] grid-cols-2 gap-1 overflow-y-auto/);
  assert.match(homeSource, /tab\.id === 'notes' \? 'col-span-2' : ''/);
  assert.match(homeSource, /setMobileTabsOpen\(false\)/);
  assert.match(homeSource, /ref=\{mobileTabsToggleRef\}/);
  assert.match(homeSource, /mobileTabsToggleRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(homeSource, /handleTabChange\(tab\.id, \{ restoreMobileFocus: true \}\)/);
  assert.match(homeSource, /ref=\{mainNavigationRef\}/);
  assert.match(homeSource, /getBoundingClientRect\(\)\.top <= 1/);
  assert.match(homeSource, /navigation\.scrollIntoView\(\{[\s\S]*behavior: reduceMotion \? 'auto' : 'smooth',[\s\S]*block: 'start'/);
});

test('企画・取材・構成ノートをcreation直後に描画できる', () => {
  assert.match(homeSource, /import PlanningNotesTab from '@\/components\/tabs\/PlanningNotesTab';/);
  assert.match(homeSource, /activeTab === 'creation'[\s\S]*activeTab === 'notes'[\s\S]*activeTab === 'kdp'/);
  assert.match(homeSource, /activeTab === 'notes'[\s\S]*?<PlanningNotesTab[\s\S]*?\{\.\.\.tabProps\}[\s\S]*?initialSection=\{planningSection\}/);
});

test('2段ナビの下でもマニュアル目次が隠れない', () => {
  for (const source of [manualSource, formatterManualSource]) {
    assert.match(source, /sticky top-32 hidden max-h-\[calc\(100vh-9rem\)\]/);
    assert.doesNotMatch(source, /sticky top-20 hidden max-h-\[calc\(100vh-6rem\)\]/);
  }
});

test('内側の追従メニューが使えるよう、外側ナビの実測高さをCSS変数で共有する', () => {
  assert.match(homeSource, /const \[mainNavigationHeight, setMainNavigationHeight\] = useState\(60\)/);
  assert.match(homeSource, /new ResizeObserver\(updateHeight\)/);
  assert.match(homeSource, /navigation\.getBoundingClientRect\(\)\.height/);
  assert.match(homeSource, /'--kindle-main-nav-height': `\$\{mainNavigationHeight\}px`/);
});
