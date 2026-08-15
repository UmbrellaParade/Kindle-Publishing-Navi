import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/components/tabs/FormatGuideTab.jsx', import.meta.url), 'utf8');

test('Googleドキュメントのページ形式でA5を執筆用の目安として案内する', () => {
  assert.match(source, /Google ドキュメントで作る手順/);
  assert.match(source, /title: 'ページ形式にする'/);
  assert.match(source, /A5（14\.8×21\.0cm）/);
  assert.match(source, /本らしいページ感覚でKindle向け原稿の分量や改ページを確認しやすく/);
  assert.match(source, /A5判の紙の本へ展開するときの下準備にも便利/);
});

test('A5をKindle電子書籍の固定サイズと誤解させない', () => {
  assert.match(source, /これはKDP電子書籍の指定ではなく/);
  assert.match(source, /電子書籍の表示は端末や文字サイズで変わるためA5固定ではありません/);
  assert.match(source, /紙版は入稿先の余白・裁ち落とし仕様へ別途調整/);
  assert.doesNotMatch(source, /Kindle(?:電子書籍)?のサイズはA5/);
  assert.doesNotMatch(source, /A5の見た目がそのまま反映/);
});
