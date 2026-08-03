export const APLUS_IMAGE_SOURCE_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/bmp',
]);

export const APLUS_IMAGE_MIN_EDGE = 300;
export const APLUS_IMAGE_TARGET_BYTES = 1_800_000;
export const APLUS_IMAGE_KDP_MAX_BYTES = 2_000_000;
export const APLUS_IMAGE_MAX_LONG_EDGE = 2_400;

export const APLUS_JPEG_QUALITIES = Object.freeze([
  0.92,
  0.82,
  0.72,
  0.62,
  0.52,
  0.42,
]);

const BMP_MIME_TYPE = 'image/bmp';
const JPEG_MIME_TYPE = 'image/jpeg';
const MAX_DIMENSION_PASSES = 16;

function normalizeMimeType(type) {
  return typeof type === 'string' ? type.trim().toLowerCase() : '';
}

function toPositiveInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function validateTargetBytes(targetBytes) {
  if (
    !Number.isFinite(targetBytes)
    || targetBytes <= 0
    || targetBytes >= APLUS_IMAGE_KDP_MAX_BYTES
  ) {
    throw new Error('画像の軽量化目標は2MB未満に設定してください。');
  }
}

export function isSupportedAplusImageType(type) {
  return APLUS_IMAGE_SOURCE_TYPES.includes(normalizeMimeType(type));
}

export function shouldOptimizeAplusImage(
  file,
  targetBytes = APLUS_IMAGE_TARGET_BYTES,
) {
  validateTargetBytes(targetBytes);
  const type = normalizeMimeType(file?.type);
  return type === BMP_MIME_TYPE || Number(file?.size) > targetBytes;
}

export function createAplusJpegFileName(originalName) {
  const leafName = String(originalName || '')
    .replaceAll('\\', '/')
    .split('/')
    .pop() || '';
  const extensionIndex = leafName.lastIndexOf('.');
  const baseName = extensionIndex > 0
    ? leafName.slice(0, extensionIndex)
    : leafName;
  const safeBaseName = baseName
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/^\.+|[.\s]+$/g, '')
    .trim()
    .slice(0, 100);

  return `${safeBaseName || 'aplus_image'}_kdp.jpg`;
}

/**
 * Fits an image near the requested long edge without upscaling it or allowing
 * either edge to fall below KDP's minimum size.
 */
export function calculateAplusImageDimensions(
  width,
  height,
  {
    maxLongEdge = APLUS_IMAGE_MAX_LONG_EDGE,
    minEdge = APLUS_IMAGE_MIN_EDGE,
  } = {},
) {
  const sourceWidth = toPositiveInteger(width);
  const sourceHeight = toPositiveInteger(height);
  const safeMaxLongEdge = toPositiveInteger(maxLongEdge);
  const safeMinEdge = toPositiveInteger(minEdge);

  if (!sourceWidth || !sourceHeight) {
    throw new Error('画像の縦横サイズを確認できませんでした。');
  }
  if (!safeMaxLongEdge || !safeMinEdge) {
    throw new Error('画像の軽量化サイズ設定が正しくありません。');
  }

  const longEdge = Math.max(sourceWidth, sourceHeight);
  const shortEdge = Math.min(sourceWidth, sourceHeight);
  let scale = Math.min(1, safeMaxLongEdge / longEdge);

  if (Math.round(shortEdge * scale) < safeMinEdge) {
    scale = Math.min(1, safeMinEdge / shortEdge);
  }

  return {
    width: Math.max(safeMinEdge, Math.round(sourceWidth * scale)),
    height: Math.max(safeMinEdge, Math.round(sourceHeight * scale)),
  };
}

export function reduceAplusImageDimensions(
  width,
  height,
  {
    factor = 0.85,
    minEdge = APLUS_IMAGE_MIN_EDGE,
  } = {},
) {
  const currentWidth = toPositiveInteger(width);
  const currentHeight = toPositiveInteger(height);
  const safeMinEdge = toPositiveInteger(minEdge);
  const numericFactor = Number(factor);

  if (!currentWidth || !currentHeight || !safeMinEdge) {
    throw new Error('画像の縦横サイズを確認できませんでした。');
  }
  if (!Number.isFinite(numericFactor) || numericFactor <= 0 || numericFactor >= 1) {
    throw new Error('画像の縮小率設定が正しくありません。');
  }

  const shortEdge = Math.min(currentWidth, currentHeight);
  if (shortEdge <= safeMinEdge) {
    return { width: currentWidth, height: currentHeight };
  }

  const scale = Math.max(numericFactor, safeMinEdge / shortEdge);
  return {
    width: Math.max(safeMinEdge, Math.round(currentWidth * scale)),
    height: Math.max(safeMinEdge, Math.round(currentHeight * scale)),
  };
}

function dimensionsAreEqual(first, second) {
  return first.width === second.width && first.height === second.height;
}

function getNextReductionFactor(smallestEncodedSize, targetBytes) {
  if (!Number.isFinite(smallestEncodedSize) || smallestEncodedSize <= 0) {
    return 0.8;
  }

  const estimatedScale = Math.sqrt(targetBytes / smallestEncodedSize) * 0.96;
  return Math.max(0.55, Math.min(0.85, estimatedScale));
}

function assertJpegResult(file) {
  if (!file || !Number.isFinite(Number(file.size)) || Number(file.size) <= 0) {
    throw new Error('JPEG画像を作成できませんでした。別の画像で試してください。');
  }
  if (normalizeMimeType(file.type) !== JPEG_MIME_TYPE) {
    throw new Error('軽量化後の画像をJPEG形式で作成できませんでした。');
  }
}

export async function decodeAplusImage(file) {
  if (typeof globalThis.createImageBitmap === 'function') {
    let bitmap;
    try {
      bitmap = await globalThis.createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      try {
        bitmap = await globalThis.createImageBitmap(file);
      } catch {
        bitmap = null;
      }
    }

    if (bitmap) {
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close?.(),
      };
    }
  }

  if (
    typeof globalThis.Image !== 'function'
    || typeof globalThis.URL?.createObjectURL !== 'function'
  ) {
    throw new Error('このブラウザでは画像を読み込めません。');
  }

  const objectUrl = globalThis.URL.createObjectURL(file);
  const image = new globalThis.Image();

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
      image.src = objectUrl;
    });
  } catch (error) {
    globalThis.URL.revokeObjectURL(objectUrl);
    throw error;
  }

  return {
    source: image,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    close: () => globalThis.URL.revokeObjectURL(objectUrl),
  };
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('JPEG画像を作成できませんでした。'));
    }, JPEG_MIME_TYPE, quality);
  });
}

/**
 * Encodes on an opaque white canvas so transparent PNG pixels never become
 * black in the KDP-ready JPEG.
 */
export async function encodeAplusJpeg({
  source,
  width,
  height,
  quality,
  fileName,
}) {
  if (
    typeof globalThis.document?.createElement !== 'function'
    || typeof globalThis.File !== 'function'
  ) {
    throw new Error('このブラウザでは画像を軽量化できません。');
  }

  const canvas = globalThis.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  try {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('画像を軽量化する準備ができませんでした。');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);

    const blob = await canvasToJpegBlob(canvas, quality);
    return new globalThis.File([blob], fileName, {
      type: JPEG_MIME_TYPE,
      lastModified: Date.now(),
    });
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

/**
 * Tries progressively lower JPEG qualities, then reduces dimensions while
 * preserving aspect ratio. Dependencies are injectable for deterministic Node
 * tests; production callers use the browser canvas encoder by default.
 */
export async function encodeAplusImageUnderTarget({
  source,
  width,
  height,
  fileName,
  targetBytes = APLUS_IMAGE_TARGET_BYTES,
  maxLongEdge = APLUS_IMAGE_MAX_LONG_EDGE,
  minEdge = APLUS_IMAGE_MIN_EDGE,
  qualities = APLUS_JPEG_QUALITIES,
  encodeJpeg = encodeAplusJpeg,
}) {
  validateTargetBytes(targetBytes);
  if (typeof encodeJpeg !== 'function') {
    throw new Error('画像の軽量化機能を利用できません。');
  }

  let dimensions = calculateAplusImageDimensions(width, height, {
    maxLongEdge,
    minEdge,
  });

  for (let pass = 0; pass < MAX_DIMENSION_PASSES; pass += 1) {
    let smallestEncodedSize = Number.POSITIVE_INFINITY;

    for (const quality of qualities) {
      let encodedFile;
      try {
        encodedFile = await encodeJpeg({
          source,
          width: dimensions.width,
          height: dimensions.height,
          quality,
          fileName,
        });
      } catch (error) {
        throw new Error(
          '画像の軽量化に失敗しました。別のJPG、PNG、BMP画像で試してください。',
          { cause: error },
        );
      }

      assertJpegResult(encodedFile);
      smallestEncodedSize = Math.min(smallestEncodedSize, Number(encodedFile.size));

      if (Number(encodedFile.size) <= targetBytes) {
        return {
          file: encodedFile,
          width: dimensions.width,
          height: dimensions.height,
        };
      }
    }

    const nextDimensions = reduceAplusImageDimensions(
      dimensions.width,
      dimensions.height,
      {
        factor: getNextReductionFactor(smallestEncodedSize, targetBytes),
        minEdge,
      },
    );

    if (dimensionsAreEqual(dimensions, nextDimensions)) {
      break;
    }
    dimensions = nextDimensions;
  }

  throw new Error(
    '画像を1.8MB以下に軽量化できませんでした。画像編集ソフトで小さくしてから、もう一度お試しください。',
  );
}

export async function prepareAplusImageForUpload(
  file,
  {
    decodeImage = decodeAplusImage,
    encodeJpeg = encodeAplusJpeg,
    targetBytes = APLUS_IMAGE_TARGET_BYTES,
    maxLongEdge = APLUS_IMAGE_MAX_LONG_EDGE,
    minEdge = APLUS_IMAGE_MIN_EDGE,
    qualities = APLUS_JPEG_QUALITIES,
  } = {},
) {
  if (!file) {
    throw new Error('画像ファイルを選択してください。');
  }
  if (!isSupportedAplusImageType(file.type)) {
    throw new Error('画像はJPG、PNG、BMP形式を選択してください。');
  }
  if (!Number.isFinite(Number(file.size)) || Number(file.size) < 0) {
    throw new Error('画像のファイルサイズを確認できませんでした。');
  }
  validateTargetBytes(targetBytes);
  if (typeof decodeImage !== 'function') {
    throw new Error('画像の読み込み機能を利用できません。');
  }

  const originalName = String(file.name || '画像');
  const originalSize = Number(file.size);
  let decoded;

  try {
    try {
      decoded = await decodeImage(file);
    } catch (error) {
      throw new Error(
        '画像を読み込めませんでした。JPG、PNG、BMP形式の画像か確認してください。',
        { cause: error },
      );
    }

    const width = toPositiveInteger(decoded?.width);
    const height = toPositiveInteger(decoded?.height);
    if (!width || !height) {
      throw new Error('画像の縦横サイズを確認できませんでした。');
    }
    if (width < minEdge || height < minEdge) {
      throw new Error(`画像は${minEdge}×${minEdge}px以上にしてください。`);
    }

    if (!shouldOptimizeAplusImage(file, targetBytes)) {
      return {
        file,
        width,
        height,
        optimized: false,
        originalName,
        originalSize,
      };
    }

    const optimized = await encodeAplusImageUnderTarget({
      source: decoded.source,
      width,
      height,
      fileName: createAplusJpegFileName(originalName),
      targetBytes,
      maxLongEdge,
      minEdge,
      qualities,
      encodeJpeg,
    });

    return {
      ...optimized,
      optimized: true,
      originalName,
      originalSize,
    };
  } finally {
    try {
      decoded?.close?.();
    } catch {
      // Releasing a decoded browser image must not mask a successful result.
    }
  }
}
