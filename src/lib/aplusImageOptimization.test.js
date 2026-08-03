import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APLUS_IMAGE_KDP_MAX_BYTES,
  APLUS_IMAGE_TARGET_BYTES,
  calculateAplusImageDimensions,
  createAplusJpegFileName,
  encodeAplusImageUnderTarget,
  isSupportedAplusImageType,
  prepareAplusImageForUpload,
  reduceAplusImageDimensions,
  shouldOptimizeAplusImage,
} from './aplusImageOptimization.js';

function createSourceFile(overrides = {}) {
  return {
    name: '表紙.png',
    type: 'image/png',
    size: 900_000,
    ...overrides,
  };
}

function createDecodedImage(overrides = {}) {
  return {
    source: { id: 'decoded-image' },
    width: 1_200,
    height: 900,
    close() {},
    ...overrides,
  };
}

test('KDP提出より余裕のある180万バイトを自動軽量化の目標にする', () => {
  assert.equal(APLUS_IMAGE_TARGET_BYTES, 1_800_000);
  assert.equal(APLUS_IMAGE_KDP_MAX_BYTES, 2_000_000);
  assert.ok(APLUS_IMAGE_TARGET_BYTES < APLUS_IMAGE_KDP_MAX_BYTES);
});

test('入力形式はJPG・PNG・BMPだけを受け付ける', () => {
  assert.equal(isSupportedAplusImageType('image/jpeg'), true);
  assert.equal(isSupportedAplusImageType(' IMAGE/PNG '), true);
  assert.equal(isSupportedAplusImageType('image/bmp'), true);
  assert.equal(isSupportedAplusImageType('image/webp'), false);
  assert.equal(isSupportedAplusImageType('image/gif'), false);
});

test('180万バイトを超える画像とBMPだけを自動軽量化する', () => {
  assert.equal(shouldOptimizeAplusImage(createSourceFile({ size: 1_800_000 })), false);
  assert.equal(shouldOptimizeAplusImage(createSourceFile({ size: 1_800_001 })), true);
  assert.equal(shouldOptimizeAplusImage(createSourceFile({ type: 'image/bmp', size: 10_000 })), true);
});

test('KDP用の安全なJPEGファイル名を作る', () => {
  assert.equal(createAplusJpegFileName('my.book.final.PNG'), 'my.book.final_kdp.jpg');
  assert.equal(createAplusJpegFileName('../../bad:name.bmp'), 'bad_name_kdp.jpg');
  assert.equal(createAplusJpegFileName(''), 'aplus_image_kdp.jpg');
});

test('長辺を2400px前後へ縮小しつつ短辺300pxを守る', () => {
  assert.deepEqual(calculateAplusImageDimensions(4_000, 3_000), {
    width: 2_400,
    height: 1_800,
  });
  assert.deepEqual(calculateAplusImageDimensions(6_000, 300), {
    width: 6_000,
    height: 300,
  });
  assert.deepEqual(calculateAplusImageDimensions(800, 600), {
    width: 800,
    height: 600,
  });
});

test('追加縮小でも縦横どちらも300px未満にしない', () => {
  assert.deepEqual(reduceAplusImageDimensions(600, 400, { factor: 0.5 }), {
    width: 450,
    height: 300,
  });
  assert.deepEqual(reduceAplusImageDimensions(600, 300, { factor: 0.5 }), {
    width: 600,
    height: 300,
  });
});

test('目標容量以下のJPG・PNGは再圧縮せず元ファイルを保つ', async () => {
  const sourceFile = createSourceFile();
  let encodeCalled = false;
  let closeCalled = false;

  const result = await prepareAplusImageForUpload(sourceFile, {
    decodeImage: async () => createDecodedImage({
      close() { closeCalled = true; },
    }),
    encodeJpeg: async () => {
      encodeCalled = true;
      return null;
    },
  });

  assert.equal(result.file, sourceFile);
  assert.equal(result.optimized, false);
  assert.equal(result.width, 1_200);
  assert.equal(result.height, 900);
  assert.equal(result.originalName, '表紙.png');
  assert.equal(result.originalSize, 900_000);
  assert.equal(encodeCalled, false);
  assert.equal(closeCalled, true);
});

test('元画像が300×300px未満なら圧縮前に分かりやすく止める', async () => {
  let closeCalled = false;

  await assert.rejects(
    prepareAplusImageForUpload(createSourceFile(), {
      decodeImage: async () => createDecodedImage({
        width: 299,
        height: 500,
        close() { closeCalled = true; },
      }),
    }),
    /300×300px以上/,
  );
  assert.equal(closeCalled, true);
});

test('非対応形式はデコードする前に止める', async () => {
  let decodeCalled = false;

  await assert.rejects(
    prepareAplusImageForUpload(createSourceFile({ type: 'image/webp' }), {
      decodeImage: async () => {
        decodeCalled = true;
        return createDecodedImage();
      },
    }),
    /JPG、PNG、BMP/,
  );
  assert.equal(decodeCalled, false);
});

test('大きい画像は品質と寸法を反復し180万バイト以下のJPEGにする', async () => {
  const attempts = [];
  const sourceFile = createSourceFile({
    name: 'large image.png',
    size: 4_500_000,
  });

  const result = await prepareAplusImageForUpload(sourceFile, {
    decodeImage: async () => createDecodedImage({ width: 4_000, height: 3_000 }),
    encodeJpeg: async attempt => {
      attempts.push(attempt);
      const fits = attempt.width <= 2_040;
      return {
        name: attempt.fileName,
        type: 'image/jpeg',
        size: fits ? 1_700_000 : 1_900_000,
      };
    },
  });

  assert.equal(result.optimized, true);
  assert.equal(result.file.name, 'large image_kdp.jpg');
  assert.equal(result.file.type, 'image/jpeg');
  assert.equal(result.file.size, 1_700_000);
  assert.equal(result.width, 2_040);
  assert.equal(result.height, 1_530);
  assert.equal(result.originalName, 'large image.png');
  assert.equal(result.originalSize, 4_500_000);
  assert.deepEqual(
    { width: attempts[0].width, height: attempts[0].height },
    { width: 2_400, height: 1_800 },
  );
  assert.ok(attempts.length > 1);
});

test('小さいBMPも白背景JPEG化の対象にする', async () => {
  const sourceFile = createSourceFile({
    name: 'sample.bmp',
    type: 'image/bmp',
    size: 500_000,
  });
  let encodeAttempt;

  const result = await prepareAplusImageForUpload(sourceFile, {
    decodeImage: async () => createDecodedImage(),
    encodeJpeg: async attempt => {
      encodeAttempt = attempt;
      return {
        name: attempt.fileName,
        type: 'image/jpeg',
        size: 250_000,
      };
    },
  });

  assert.equal(result.optimized, true);
  assert.equal(result.file.name, 'sample_kdp.jpg');
  assert.equal(result.file.type, 'image/jpeg');
  assert.equal(encodeAttempt.quality, 0.92);
});

test('エンコーダーがWebPを返しても採用しない', async () => {
  await assert.rejects(
    encodeAplusImageUnderTarget({
      source: {},
      width: 1_000,
      height: 1_000,
      fileName: 'image_kdp.jpg',
      encodeJpeg: async () => ({ type: 'image/webp', size: 100_000 }),
    }),
    /JPEG形式/,
  );
});

test('300pxを守ったまま目標容量へ収まらない場合は明確に案内する', async () => {
  await assert.rejects(
    encodeAplusImageUnderTarget({
      source: {},
      width: 300,
      height: 300,
      fileName: 'image_kdp.jpg',
      encodeJpeg: async attempt => ({
        name: attempt.fileName,
        type: 'image/jpeg',
        size: 1_900_000,
      }),
    }),
    /1.8MB以下/,
  );
});
