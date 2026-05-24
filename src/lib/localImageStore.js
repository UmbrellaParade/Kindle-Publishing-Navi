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

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('画像ストレージ操作に失敗しました'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('画像ストレージ操作に失敗しました'));
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
