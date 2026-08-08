import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeSource = readFileSync(
  new URL('../src/pages/Home.jsx', import.meta.url),
  'utf8',
);
const headerSource = readFileSync(
  new URL('../src/components/AppHeader.jsx', import.meta.url),
  'utf8',
);
const updateBannerSource = readFileSync(
  new URL('../src/components/AppUpdateBanner.jsx', import.meta.url),
  'utf8',
);

test('上に戻るボタンは全タブ共通で画面右下に常駐する', () => {
  assert.equal((homeSource.match(/aria-label="ページの上に戻る"/g) || []).length, 1);
  assert.match(homeSource, /<\/main>[\s\S]*data-scroll-to-top="true"[\s\S]*aria-label="ページの上に戻る"/);
  assert.match(homeSource, /className="pointer-events-none fixed inset-x-0 z-40"/);
  assert.match(homeSource, /bottom: 'calc\(1rem \+ env\(safe-area-inset-bottom, 0px\)\)'/);
  assert.match(homeSource, /className="relative mx-auto h-11 w-full max-w-7xl"/);
  assert.match(homeSource, /min-\[1600px\]:left-\[calc\(100%\+1rem\)\] min-\[1600px\]:right-auto/);
  assert.match(homeSource, /pointer-events-auto absolute bottom-0 right-4/);
  assert.match(homeSource, /min-h-11 w-max[\s\S]*whitespace-nowrap/);
  assert.match(homeSource, /max-w-7xl mx-auto px-2 py-6 pb-24/);
  assert.doesNotMatch(homeSource, /className="mt-4 flex justify-end"/);
});

test('更新通知は常駐ボタンの上へ表示して操作を隠さない', () => {
  assert.match(updateBannerSource, /bottom: 'calc\(4\.75rem \+ env\(safe-area-inset-bottom, 0px\)\)'/);
  assert.match(updateBannerSource, /z-\[100\]/);
});

test('上に戻る操作は低モーション設定とフォーカス移動に対応する', () => {
  assert.match(homeSource, /prefers-reduced-motion: reduce/);
  assert.match(homeSource, /behavior: reduceMotion \? 'auto' : 'smooth'/);
  assert.match(homeSource, /getElementById\('kindle-navi-page-title'\).*focus/);
  assert.match(headerSource, /id="kindle-navi-page-title"/);
  assert.match(headerSource, /tabIndex=\{-1\}/);
});
