const DB_NAME = 'kindle_navi_image_store';
const STORE_NAME = 'images';
const IMAGE_REF_PREFIX = 'local-image:';

function canUseIndexedDb() {
  return typeof window !== 'undefined' && Boolean(window.indexedDB);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => reject(reader.error || new Error('画像を読み込めませんでした'));
    reader.readAsDataURL(file);
  });
}

function openImageDb() {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB が使えません'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('画像ストレージを開けませんでした'));
  });
}

function withStore(mode, action) {
  return openImageDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = action(store);
    let requestResult;

    request.onsuccess = () => { requestResult = request.result; };
    request.onerror = () => reject(request.error || new Error('画像ストレージ操作に失敗しました'));
    tx.oncomplete = () => {
      db.close();
      resolve(requestResult);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error('画像ストレージ操作を完了できませんでした'));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('画像ストレージ操作に失敗しました'));
    };
  }));
}

function runImageTransaction(mode, action) {
  return openImageDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let result;

    try {
      result = action(store);
    } catch (error) {
      tx.abort();
      db.close();
      reject(error);
      return;
    }

    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error('画像ストレージ操作を取り消しました'));
    };
    tx.onerror = () => {
      // onabort で、トランザクション全体の失敗として処理します。
    };
  }));
}

export function isLocalImageRef(url) {
  return typeof url === 'string' && url.startsWith(IMAGE_REF_PREFIX);
}

function getImageId(ref) {
  return String(ref || '').slice(IMAGE_REF_PREFIX.length);
}

export async function saveImageFile(file) {
  const dataUrl = await readFileAsDataUrl(file);

  if (!canUseIndexedDb()) {
    return dataUrl;
  }

  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await withStore('readwrite', store => store.put({
    id,
    name: file.name || 'image',
    type: file.type || 'image/png',
    dataUrl,
    createdAt: new Date().toISOString(),
  }));

  return `${IMAGE_REF_PREFIX}${id}`;
}

export async function getImageDataUrl(refOrUrl) {
  if (!refOrUrl || !isLocalImageRef(refOrUrl)) {
    return refOrUrl || '';
  }

  const record = await withStore('readonly', store => store.get(getImageId(refOrUrl)));
  return record?.dataUrl || '';
}

/**
 * バックアップ用に、IndexedDB 内の画像レコードをすべて取得します。
 * IndexedDB が利用できない環境では、保存済みレコードも存在しないため空配列を返します。
 */
export async function listLocalImages() {
  if (!canUseIndexedDb()) return [];
  const records = await withStore('readonly', store => store.getAll());
  return Array.isArray(records) ? records : [];
}

/**
 * 画像レコードを単一トランザクションで置き換えます。
 * clear と put は同じトランザクションに入るため、途中で失敗した場合は変更されません。
 */
export async function replaceLocalImages(records) {
  if (!Array.isArray(records)) {
    throw new TypeError('画像レコードは配列で指定してください');
  }

  if (!canUseIndexedDb()) {
    if (records.length === 0) return;
    throw new Error('このブラウザでは画像ストレージを復元できません');
  }

  await runImageTransaction('readwrite', store => {
    store.clear();
    records.forEach(record => store.put(record));
  });
}

/**
 * 既存画像を残したまま、同じ id のレコードだけ上書きします。
 */
export async function mergeLocalImages(records) {
  if (!Array.isArray(records)) {
    throw new TypeError('画像レコードは配列で指定してください');
  }

  if (!canUseIndexedDb()) {
    if (records.length === 0) return;
    throw new Error('このブラウザでは画像ストレージを復元できません');
  }

  await runImageTransaction('readwrite', store => {
    records.forEach(record => store.put(record));
  });
}

/** 現行プロジェクトから参照されていない保存画像を削除します。 */
export async function removeUnreferencedLocalImages(references) {
  if (!canUseIndexedDb()) return 0;
  const referencedIds = new Set(
    (Array.isArray(references) ? references : [])
      .filter(isLocalImageRef)
      .map(getImageId),
  );
  const records = await listLocalImages();
  const orphanIds = records
    .map(record => record.id)
    .filter(id => !referencedIds.has(id));
  if (orphanIds.length === 0) return 0;

  await runImageTransaction('readwrite', store => {
    orphanIds.forEach(id => store.delete(id));
  });
  return orphanIds.length;
}

export async function downloadImage(refOrUrl, filename) {
  const href = await getImageDataUrl(refOrUrl);
  if (!href) {
    throw new Error('画像が見つかりませんでした');
  }

  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.target = '_blank';
  a.click();
}
