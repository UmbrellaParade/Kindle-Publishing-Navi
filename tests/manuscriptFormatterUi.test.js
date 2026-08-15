import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/components/tabs/ManuscriptFormatterTab.jsx', import.meta.url),
  'utf8',
);

test('完成原稿を仕上げる用途と、文章作成には不向きなことを最初に示す', () => {
  assert.match(source, /完成原稿の仕上げ用/);
  assert.match(source, /完成した文章を、本の形へ整えるツール/);
  assert.match(source, /このツール内で文章をゼロから書く用途には向きません/);
  assert.match(source, /GoogleドキュメントやWordなどで文章を完成させてから/);
  assert.match(source, /PCで完成した原稿を整形する/);
});

test('Kindle・しまうまA5／A6・QRコードの違いを一画面で説明する', () => {
  for (const phrase of [
    'Kindle電子書籍',
    'KDPへ登録するDOCX',
    '電子書籍の表示はA5固定ではありません',
    'しまうま出版の紙の本',
    'A5とA6の印刷用PDF',
    'A6は一般的な文庫本サイズ',
    'QRコード付き案内',
    'URLからQRコード付きカードをツール内で作り、本文へ配置できます',
  ]) assert.match(source, new RegExp(phrase));
  assert.match(source, /grid grid-cols-1 gap-3 md:grid-cols-3/);
});

test('しまうま出版を初心者向けの選択肢として案内し、非提携を明記する', () => {
  assert.match(source, /紙の本なら、しまうま出版もおすすめです/);
  assert.match(source, /紙の本を1冊から作りたい初心者/);
  assert.match(source, /しまうま出版の公式・提携ツールではありません/);
  assert.match(source, /SHIMAUMA_PUBLISH_NOVEL_URL/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
});

test('PC・テスト版・バックアップ・非同期の注意とキーボード操作域を維持する', () => {
  for (const phrase of [
    'PC専用',
    'テスト版',
    '元原稿を残してから試してください',
    '複製・バックアップ',
    '自動同期されません',
    'Kindle Previewer',
  ]) assert.match(source, new RegExp(phrase));
  assert.match(source, /min-h-12/);
  assert.match(source, /min-h-11/);
  assert.match(source, /focus-visible:ring-2/);
});
