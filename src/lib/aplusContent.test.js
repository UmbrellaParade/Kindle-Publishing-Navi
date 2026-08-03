import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APLUS_FIELD_LIMITS,
  APLUS_IMAGES_PER_MODULE,
  APLUS_MAX_MODULES,
  collectProjectImageReferences,
  createDefaultAplusContent,
  getAplusPolicyWarnings,
  getAplusReadiness,
  normalizeAplusContent,
  readAplusContent,
  selectAplusUploadBaseContent,
  validateAplusAsinText,
  validateAplusImageMetadata,
  writeAplusContent,
} from './aplusContent.js';

test('初回のA+画像保存では画面に表示した画像枠IDをそのまま使う', () => {
  const displayed = readAplusContent('', { projectName: '初回出版' });
  const latest = readAplusContent('', { projectName: '初回出版' });

  assert.equal(displayed.hasSavedAplus, false);
  assert.equal(latest.hasSavedAplus, false);
  assert.notEqual(displayed.content.modules[0].id, latest.content.modules[0].id);

  const uploadBase = selectAplusUploadBaseContent(latest, displayed.content);
  assert.equal(uploadBase.modules[0].id, displayed.content.modules[0].id);
  assert.equal(uploadBase.modules[0].images[0].id, displayed.content.modules[0].images[0].id);
});

test('保存済みA+がある画像保存では最新の保存内容を優先する', () => {
  const displayed = createDefaultAplusContent({ projectName: '古い画面' });
  const saved = createDefaultAplusContent({ projectName: '最新データ' });
  const latest = readAplusContent(writeAplusContent('', saved));

  assert.equal(latest.hasSavedAplus, true);
  const uploadBase = selectAplusUploadBaseContent(latest, displayed);
  assert.equal(uploadBase.content_name, '最新データ A+コンテンツ');
  assert.equal(uploadBase.modules[0].id, saved.modules[0].id);
});

test('新しいA+コンテンツは標準複数画像モジュールAの4枠で始まる', () => {
  const content = createDefaultAplusContent({ projectName: 'はじめての出版' });

  assert.equal(content.content_name, 'はじめての出版 A+コンテンツ');
  assert.equal(content.language, 'ja-JP');
  assert.equal(content.marketplace, 'Amazon.co.jp');
  assert.equal(content.modules.length, 1);
  assert.equal(content.modules[0].images.length, APLUS_IMAGES_PER_MODULE);
});

test('従来のA+用画像を最初の画像枠へ読み込む', () => {
  const result = readAplusContent('', {
    legacyImageUrl: 'local-image:legacy-aplus',
    projectName: '旧プロジェクト',
  });

  assert.equal(result.migratedLegacyImage, true);
  assert.equal(result.content.modules[0].images[0].image_url, 'local-image:legacy-aplus');
});

test('保存済みの複数画像データが従来画像より優先される', () => {
  const saved = createDefaultAplusContent();
  saved.modules[0].images[0].image_url = 'local-image:new-aplus';
  const result = readAplusContent(JSON.stringify({ aplus: saved }), {
    legacyImageUrl: 'local-image:legacy-aplus',
  });

  assert.equal(result.migratedLegacyImage, false);
  assert.equal(result.content.modules[0].images[0].image_url, 'local-image:new-aplus');
});

test('A+保存時もkdp_metaの既存情報を保持する', () => {
  const content = createDefaultAplusContent();
  content.notes = '確認メモ';

  const written = JSON.parse(writeAplusContent(JSON.stringify({ description: '既存紹介文', unknown: 42 }), content));

  assert.equal(written.description, '既存紹介文');
  assert.equal(written.unknown, 42);
  assert.equal(written.aplus.notes, '確認メモ');
});

test('壊れたkdp_metaへ上書きせず、読み込みエラーを返す', () => {
  const result = readAplusContent('{broken-json');

  assert.ok(result.error instanceof Error);
  assert.throws(
    () => writeAplusContent('{broken-json', createDefaultAplusContent()),
    /KDPデータを読み込めません/,
  );
});

test('壊れたkdp_meta内でも読み取れるローカル画像参照は削除対象から守る', () => {
  const references = collectProjectImageReferences({
    cover_image_url: 'local-image:cover',
    kdp_meta: '{"aplus":{"modules":[{"images":[{"image_url":"local-image:recoverable_img"}',
  });

  assert.deepEqual(references, ['local-image:cover', 'local-image:recoverable_img']);
});

test('未対応のA+形式や将来バージョンは上書きせず保存を停止する', () => {
  const invalidShape = JSON.stringify({ aplus: 'future-data' });
  const futureVersion = JSON.stringify({ aplus: { version: 2, modules: [] } });

  assert.ok(readAplusContent(invalidShape).error);
  assert.ok(readAplusContent(futureVersion).error);
  assert.throws(() => writeAplusContent(invalidShape, createDefaultAplusContent()), /対応していません/);
  assert.throws(() => writeAplusContent(futureVersion, createDefaultAplusContent()), /未対応/);
});

test('上限外や将来フィールド内の画像参照も整理対象から守る', () => {
  const modules = Array.from({ length: APLUS_MAX_MODULES + 1 }, (_, moduleIndex) => ({
    images: Array.from({ length: APLUS_IMAGES_PER_MODULE + 1 }, (_, imageIndex) => ({
      image_url: `local-image:m${moduleIndex}_i${imageIndex}`,
    })),
  }));
  const references = collectProjectImageReferences({
    kdp_meta: JSON.stringify({ aplus: { version: 1, modules, future_image: 'local-image:future_field' } }),
  });

  assert.ok(references.includes(`local-image:m${APLUS_MAX_MODULES}_i${APLUS_IMAGES_PER_MODULE}`));
  assert.ok(references.includes('local-image:future_field'));
});

test('削除時の画像整理用に表紙・従来A+・全モジュール画像を重複なく集める', () => {
  const content = createDefaultAplusContent();
  content.modules[0].images[0].image_url = 'local-image:shared';
  content.modules[0].images[1].image_url = 'local-image:second';

  const references = collectProjectImageReferences({
    name: '画像テスト',
    cover_image_url: 'local-image:cover',
    aplus_image_url: 'local-image:shared',
    kdp_meta: JSON.stringify({ aplus: content }),
  });

  assert.deepEqual(references, [
    'local-image:cover',
    'local-image:shared',
    'local-image:second',
  ]);
});

test('読み込み時に最大5モジュール・各4画像・公式文字数上限へ正規化する', () => {
  const oversizedModule = {
    images: Array.from({ length: 7 }, (_, index) => ({
      image_url: `local-image:${index}`,
      alt_text: 'a'.repeat(APLUS_FIELD_LIMITS.altText + 10),
      headline: 'h'.repeat(APLUS_FIELD_LIMITS.headline + 10),
      body: 'b'.repeat(APLUS_FIELD_LIMITS.body + 10),
      caption: 'c'.repeat(APLUS_FIELD_LIMITS.caption + 10),
    })),
  };
  const content = normalizeAplusContent({
    content_name: 'n'.repeat(APLUS_FIELD_LIMITS.contentName + 10),
    modules: Array.from({ length: APLUS_MAX_MODULES + 3 }, () => oversizedModule),
  });

  assert.equal(content.modules.length, APLUS_MAX_MODULES);
  assert.equal(content.content_name.length, APLUS_FIELD_LIMITS.contentName);
  assert.ok(content.modules.every(module => module.images.length === APLUS_IMAGES_PER_MODULE));
  assert.equal(content.modules[0].images[0].alt_text.length, APLUS_FIELD_LIMITS.altText);
  assert.equal(content.modules[0].images[0].headline.length, APLUS_FIELD_LIMITS.headline);
  assert.equal(content.modules[0].images[0].body.length, APLUS_FIELD_LIMITS.body);
  assert.equal(content.modules[0].images[0].caption.length, APLUS_FIELD_LIMITS.caption);
});

test('A+画像の形式・容量・寸法を安全側の条件で検証する', () => {
  const valid = validateAplusImageMetadata({
    type: 'image/png',
    size: 1_000_000,
    width: 600,
    height: 600,
  });
  const invalid = validateAplusImageMetadata({
    type: 'image/gif',
    size: 2_000_000,
    width: 299,
    height: 300,
  });

  assert.equal(valid.valid, true);
  assert.equal(valid.warnings.length, 0);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length, 3);
});

test('自動軽量化したA+画像の元容量と加工後情報を保持する', () => {
  const content = createDefaultAplusContent();
  Object.assign(content.modules[0].images[0], {
    image_url: 'local-image:optimized',
    file_name: 'large_kdp.jpg',
    file_size: 1_750_000,
    original_file_name: 'large.png',
    original_file_size: 5_200_000,
    optimized: true,
    width: 1200,
    height: 1200,
  });

  const normalized = normalizeAplusContent(content);
  const image = normalized.modules[0].images[0];

  assert.equal(image.optimized, true);
  assert.equal(image.original_file_name, 'large.png');
  assert.equal(image.original_file_size, 5_200_000);
  assert.equal(image.file_size, 1_750_000);
});

test('対象ASINは10文字英数字・重複なしの場合だけ有効にする', () => {
  assert.equal(validateAplusAsinText('b0abc12345').valid, true);
  assert.deepEqual(validateAplusAsinText('B0ABC12345\nb0abc12345').duplicates, ['B0ABC12345']);
  assert.deepEqual(validateAplusAsinText('B0SHORT').invalid, ['B0SHORT']);
});

test('任意の見出し・説明・キャプションが空でも必須準備は完了できる', () => {
  const content = createDefaultAplusContent({ projectName: '準備確認' });
  content.asin_text = 'B0ABC12345';
  content.modules[0].images.forEach((image, index) => {
    image.image_url = `local-image:${index}`;
    image.alt_text = `画像${index + 1}の説明`;
  });
  Object.keys(content.checklist).forEach(key => { content.checklist[key] = true; });

  const readiness = getAplusReadiness(content);

  assert.equal(readiness.percentage, 100);
  assert.equal(readiness.missing.length, 0);
});

test('審査で避けたい表現を入力中に警告する', () => {
  const content = createDefaultAplusContent();
  content.modules[0].images[0].headline = '今だけ無料、No.1の決定版';
  content.modules[0].images[0].body = '詳しくは https://example.com へ';

  const warningIds = getAplusPolicyWarnings(content).map(warning => warning.id);

  assert.ok(warningIds.includes('promotion'));
  assert.ok(warningIds.includes('external'));
  assert.ok(warningIds.includes('claims'));
});

test('公開されない作業メモは警告対象外にし、治療・予防表現は警告する', () => {
  const content = createDefaultAplusContent();
  content.notes = '修正資料：https://example.com';
  assert.equal(getAplusPolicyWarnings(content).length, 0);

  content.modules[0].images[0].body = '病気を治療する効果があります';
  assert.ok(getAplusPolicyWarnings(content).some(warning => warning.id === 'health'));
});
