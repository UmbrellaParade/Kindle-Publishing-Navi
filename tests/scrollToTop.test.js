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

test('上に戻るボタンは全タブ共通の内容枠直下に1つだけ表示する', () => {
  assert.equal((homeSource.match(/aria-label="ページの上に戻る"/g) || []).length, 1);
  assert.match(homeSource, /<\/AnimatePresence>[\s\S]*aria-label="ページの上に戻る"[\s\S]*<\/main>/);
  assert.match(homeSource, /className="mt-4 flex justify-end"/);
});

test('上に戻る操作は低モーション設定とフォーカス移動に対応する', () => {
  assert.match(homeSource, /prefers-reduced-motion: reduce/);
  assert.match(homeSource, /behavior: reduceMotion \? 'auto' : 'smooth'/);
  assert.match(homeSource, /getElementById\('kindle-navi-page-title'\).*focus/);
  assert.match(headerSource, /id="kindle-navi-page-title"/);
  assert.match(headerSource, /tabIndex=\{-1\}/);
});
