import { listLocalImages, replaceLocalImages } from './localImageStore.js';
import { withProjectWriteLock } from './projectWriteLock.js';

export const BACKUP_SCHEMA_VERSION = 1;
export const PROJECTS_STORAGE_KEY = 'kindle_publishing_navi_local_projects';
export const SELECTED_PROJECT_STORAGE_KEY = 'kindle_publishing_navi_selected_project_id';
export const FORMAT_GUIDE_STORAGE_PREFIX = 'format_guide_state_';
export const RUBY_DICTIONARY_STORAGE_KEY = 'ruby_custom_dict';
export const PROJECT_RUBY_DICTIONARY_STORAGE_PREFIX = 'ruby_custom_dict_';

// AI 接続情報は別キー（kindle_navi_ai_settings）に保存されています。
// バックアップはプロジェクト一覧、各IDの原稿・ルビ辞書、旧共通ルビ辞書だけを扱い、
// localStorage 全体は走査しません。
export const PROJECT_FIELD_ALLOWLIST = Object.freeze([
  'id',
  'name',
  'book_title',
  'author_name',
  'kdp_description',
  'category_main',
  'category_sub1',
  'category_sub2',
  'keywords',
  'checklist_data',
  'categories',
  'promotion_goal',
  'strategy_memo',
  'sns_memo1',
  'sns_memo2',
  'sns_memo1_title',
  'sns_memo2_title',
  'promotion_notes',
  'manuscript',
  'cover_image_url',
  'aplus_image_url',
  'kdp_meta',
  'release_target_date',
  'release_method',
  'release_date',
  'schedule_calculated_for',
  'schedule_generated_at',
  'schedule_mode',
  'created_date',
  'updated_date',
  'created_by',
  'is_sample',
]);

const PROJECT_FIELDS = new Set(PROJECT_FIELD_ALLOWLIST);
const PROJECT_BOOLEAN_FIELDS = new Set(['is_sample']);
const ROOT_FIELDS = new Set(['schemaVersion', 'appVersion', 'exportedAt', 'data']);
const DATA_FIELDS = new Set([
  'projects',
  'selectedProjectId',
  'formatGuideStates',
  'rubyCustomDict',
  'projectRubyDictionaries',
  'images',
]);
const FORMAT_STATE_FIELDS = new Set(['projectId', 'value']);
const FORMAT_VALUE_FIELDS = new Set(['sharedText']);
const PROJECT_RUBY_FIELDS = new Set(['projectId', 'value']);
const IMAGE_FIELDS = new Set(['id', 'name', 'type', 'dataUrl', 'createdAt']);
const RESERVED_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_BACKUP_TEXT_LENGTH = 350 * 1024 * 1024;

const defaultImageStore = {
  listLocalImages,
  replaceLocalImages,
};

export class BackupValidationError extends Error {
  constructor(message, path = 'backup') {
    super(`${path}: ${message}`);
    this.name = 'BackupValidationError';
    this.path = path;
  }
}

export class BackupImportError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'BackupImportError';
    this.beforeSnapshot = options.beforeSnapshot;
    this.rollbackSucceeded = options.rollbackSucceeded;
    this.rollbackErrors = options.rollbackErrors || [];
  }
}

function fail(path, message) {
  throw new BackupValidationError(message, path);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, path) {
  if (!isPlainObject(value)) fail(path, 'オブジェクトではありません');
}

function assertExactKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (RESERVED_OBJECT_KEYS.has(key)) fail(`${path}.${key}`, '使用できないキーです');
    if (!allowed.has(key)) fail(`${path}.${key}`, '未対応の項目です');
  }
}

function assertString(value, path, { allowEmpty = true } = {}) {
  if (typeof value !== 'string') fail(path, '文字列ではありません');
  if (!allowEmpty && value.trim() === '') fail(path, '空にはできません');
  return value;
}

function assertIsoDate(value, path) {
  assertString(value, path, { allowEmpty: false });
  if (Number.isNaN(Date.parse(value))) fail(path, '日時の形式が正しくありません');
  return value;
}

function normalizeProject(project, path, { ignoreUnknown = false } = {}) {
  assertPlainObject(project, path);
  if (!ignoreUnknown) assertExactKeys(project, PROJECT_FIELDS, path);

  const normalized = {};
  for (const field of PROJECT_FIELD_ALLOWLIST) {
    if (!Object.prototype.hasOwnProperty.call(project, field) || project[field] === undefined) continue;
    const value = project[field];

    if (value === null) {
      normalized[field] = null;
      continue;
    }

    if (PROJECT_BOOLEAN_FIELDS.has(field)) {
      if (typeof value !== 'boolean') fail(`${path}.${field}`, '真偽値ではありません');
    } else if (typeof value !== 'string') {
      fail(`${path}.${field}`, '文字列ではありません');
    }

    normalized[field] = value;
  }

  assertString(normalized.id, `${path}.id`, { allowEmpty: false });
  assertString(normalized.name, `${path}.name`, { allowEmpty: false });
  return normalized;
}

function normalizeProjects(projects, path, options) {
  if (!Array.isArray(projects)) fail(path, '配列ではありません');
  const seenIds = new Set();
  return projects.map((project, index) => {
    const normalized = normalizeProject(project, `${path}[${index}]`, options);
    if (seenIds.has(normalized.id)) fail(`${path}[${index}].id`, '同じプロジェクトIDが重複しています');
    seenIds.add(normalized.id);
    return normalized;
  });
}

function normalizeFormatGuideValue(value, path, { ignoreUnknown = false } = {}) {
  assertPlainObject(value, path);
  if (!ignoreUnknown) assertExactKeys(value, FORMAT_VALUE_FIELDS, path);
  const sharedText = value.sharedText ?? '';
  assertString(sharedText, `${path}.sharedText`);
  return { sharedText };
}

function normalizeFormatGuideStates(states, projects, path, options) {
  if (!Array.isArray(states)) fail(path, '配列ではありません');
  const projectIds = new Set([...projects.map(project => project.id), 'global']);
  const seenIds = new Set();

  return states.map((state, index) => {
    const itemPath = `${path}[${index}]`;
    assertPlainObject(state, itemPath);
    if (!options?.ignoreUnknown) assertExactKeys(state, FORMAT_STATE_FIELDS, itemPath);
    const projectId = assertString(state.projectId, `${itemPath}.projectId`, { allowEmpty: false });
    if (!projectIds.has(projectId)) fail(`${itemPath}.projectId`, '対応するプロジェクトがありません');
    if (seenIds.has(projectId)) fail(`${itemPath}.projectId`, '同じプロジェクトの原稿状態が重複しています');
    seenIds.add(projectId);
    return {
      projectId,
      value: normalizeFormatGuideValue(state.value, `${itemPath}.value`, options),
    };
  });
}

function normalizeRubyDictionary(dictionary, path) {
  if (dictionary === null) return null;
  assertPlainObject(dictionary, path);

  const normalized = {};
  for (const [word, ruby] of Object.entries(dictionary)) {
    if (RESERVED_OBJECT_KEYS.has(word)) fail(`${path}.${word}`, '使用できないキーです');
    if (word === '__hiddenDefaults') {
      if (!Array.isArray(ruby) || ruby.some(item => typeof item !== 'string')) {
        fail(`${path}.__hiddenDefaults`, '文字列の配列ではありません');
      }
      normalized.__hiddenDefaults = [...new Set(ruby)];
      continue;
    }
    if (typeof ruby !== 'string') fail(`${path}.${word}`, 'ルビは文字列で指定してください');
    normalized[word] = ruby;
  }
  return normalized;
}

function normalizeProjectRubyDictionaries(dictionaries, projects, path, options = {}) {
  if (!Array.isArray(dictionaries)) fail(path, '配列ではありません');
  const projectIds = new Set(projects.map(project => project.id));
  const seenIds = new Set();

  return dictionaries.map((dictionary, index) => {
    const itemPath = `${path}[${index}]`;
    assertPlainObject(dictionary, itemPath);
    if (!options.ignoreUnknown) assertExactKeys(dictionary, PROJECT_RUBY_FIELDS, itemPath);
    const projectId = assertString(dictionary.projectId, `${itemPath}.projectId`, { allowEmpty: false });
    if (!projectIds.has(projectId)) fail(`${itemPath}.projectId`, '対応するプロジェクトがありません');
    if (seenIds.has(projectId)) fail(`${itemPath}.projectId`, '同じプロジェクトのルビ辞書が重複しています');
    seenIds.add(projectId);

    const value = normalizeRubyDictionary(dictionary.value, `${itemPath}.value`);
    if (value === null) fail(`${itemPath}.value`, 'ルビ辞書がありません');
    return { projectId, value };
  });
}

function normalizeImage(image, path, { ignoreUnknown = false } = {}) {
  assertPlainObject(image, path);
  if (!ignoreUnknown) assertExactKeys(image, IMAGE_FIELDS, path);

  const normalized = {
    id: assertString(image.id, `${path}.id`, { allowEmpty: false }),
    name: assertString(image.name, `${path}.name`),
    type: assertString(image.type, `${path}.type`, { allowEmpty: false }),
    dataUrl: assertString(image.dataUrl, `${path}.dataUrl`, { allowEmpty: false }),
    createdAt: assertIsoDate(image.createdAt, `${path}.createdAt`),
  };

  if (!normalized.type.startsWith('image/')) fail(`${path}.type`, '画像のMIMEタイプではありません');
  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=\s]+$/.test(normalized.dataUrl)) {
    fail(`${path}.dataUrl`, 'base64形式の画像データではありません');
  }
  return normalized;
}

function normalizeImages(images, path, options) {
  if (!Array.isArray(images)) fail(path, '配列ではありません');
  const seenIds = new Set();
  return images.map((image, index) => {
    const normalized = normalizeImage(image, `${path}[${index}]`, options);
    if (seenIds.has(normalized.id)) fail(`${path}[${index}].id`, '同じ画像IDが重複しています');
    seenIds.add(normalized.id);
    return normalized;
  });
}

function normalizeBackupData(data, path = 'backup.data', options = {}) {
  assertPlainObject(data, path);
  if (!options.ignoreUnknown) assertExactKeys(data, DATA_FIELDS, path);

  const projects = normalizeProjects(data.projects, `${path}.projects`, options);
  const selectedProjectId = data.selectedProjectId;
  if (selectedProjectId !== null) {
    assertString(selectedProjectId, `${path}.selectedProjectId`, { allowEmpty: false });
    if (!projects.some(project => project.id === selectedProjectId)) {
      fail(`${path}.selectedProjectId`, '対応するプロジェクトがありません');
    }
  }
  return {
    projects,
    selectedProjectId,
    formatGuideStates: normalizeFormatGuideStates(
      data.formatGuideStates,
      projects,
      `${path}.formatGuideStates`,
      options,
    ),
    rubyCustomDict: normalizeRubyDictionary(data.rubyCustomDict, `${path}.rubyCustomDict`),
    projectRubyDictionaries: normalizeProjectRubyDictionaries(
      data.projectRubyDictionaries,
      projects,
      `${path}.projectRubyDictionaries`,
      options,
    ),
    images: normalizeImages(data.images, `${path}.images`, options),
  };
}

/** JSONから読み込んだバックアップを厳密に検証し、安全な新しいオブジェクトを返します。 */
export function validateDataBackup(value) {
  assertPlainObject(value, 'backup');
  assertExactKeys(value, ROOT_FIELDS, 'backup');
  if (value.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    fail('backup.schemaVersion', `対応していない形式です（対応: ${BACKUP_SCHEMA_VERSION}）`);
  }

  const appVersion = assertString(value.appVersion, 'backup.appVersion', { allowEmpty: false });
  const exportedAt = assertIsoDate(value.exportedAt, 'backup.exportedAt');
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion,
    exportedAt,
    data: normalizeBackupData(value.data),
  };
}

export function parseDataBackup(text) {
  if (typeof text !== 'string') fail('backup', 'JSON文字列ではありません');
  if (text.length > MAX_BACKUP_TEXT_LENGTH) fail('backup', 'ファイルサイズが大きすぎます');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail('backup', 'JSONを読み込めませんでした');
  }
  return validateDataBackup(parsed);
}

function getBrowserStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    // 下のエラーにまとめます。
  }
  throw new Error('この環境ではブラウザ保存データを利用できません');
}

function readJsonStorage(storage, key, fallback, label) {
  const raw = storage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    throw new BackupValidationError('保存データが壊れているため、上書きせず停止しました', label);
  }
}

function toIsoString(now) {
  const value = typeof now === 'function' ? now() : now;
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) throw new Error('バックアップ日時を作成できません');
  return date.toISOString();
}

/** 現在の許可済みデータだけを収集します。AI設定やAPIキーの保存キーは読みません。 */
export async function createDataBackup({
  appVersion = 'unknown',
  storage = getBrowserStorage(),
  imageStore = defaultImageStore,
  now = () => new Date(),
} = {}) {
  const rawProjects = readJsonStorage(storage, PROJECTS_STORAGE_KEY, [], PROJECTS_STORAGE_KEY);
  const projects = normalizeProjects(rawProjects, 'backup.data.projects', { ignoreUnknown: true });
  const rawSelectedProjectId = storage.getItem(SELECTED_PROJECT_STORAGE_KEY);
  const selectedProjectId = typeof rawSelectedProjectId === 'string'
    && projects.some(project => project.id === rawSelectedProjectId)
    ? rawSelectedProjectId
    : null;

  const formatGuideStates = [];
  const formatGuideProjectIds = [...new Set([...projects.map(project => project.id), 'global'])];
  for (const projectId of formatGuideProjectIds) {
    const key = `${FORMAT_GUIDE_STORAGE_PREFIX}${projectId}`;
    const raw = storage.getItem(key);
    if (raw === null) continue;
    const value = readJsonStorage(storage, key, null, key);
    formatGuideStates.push({
      projectId,
      value: normalizeFormatGuideValue(value, key, { ignoreUnknown: true }),
    });
  }

  const rawRubyDictionary = readJsonStorage(
    storage,
    RUBY_DICTIONARY_STORAGE_KEY,
    null,
    RUBY_DICTIONARY_STORAGE_KEY,
  );
  const rubyCustomDict = normalizeRubyDictionary(rawRubyDictionary, RUBY_DICTIONARY_STORAGE_KEY);

  const projectRubyDictionaries = [];
  for (const project of projects) {
    const key = `${PROJECT_RUBY_DICTIONARY_STORAGE_PREFIX}${project.id}`;
    const raw = storage.getItem(key);
    if (raw === null) continue;
    const value = normalizeRubyDictionary(readJsonStorage(storage, key, null, key), key);
    if (value === null) throw new BackupValidationError('ルビ辞書がありません', key);
    projectRubyDictionaries.push({ projectId: project.id, value });
  }

  const rawImages = await imageStore.listLocalImages();
  const images = normalizeImages(rawImages, 'backup.data.images', { ignoreUnknown: true });

  return validateDataBackup({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: String(appVersion || 'unknown'),
    exportedAt: toIsoString(now),
    data: {
      projects,
      selectedProjectId,
      formatGuideStates,
      rubyCustomDict,
      projectRubyDictionaries,
      images,
    },
  });
}

function mergeById(currentItems, incomingItems, mergeValue) {
  const merged = new Map(currentItems.map(item => [item.id, item]));
  for (const item of incomingItems) {
    const current = merged.get(item.id);
    merged.set(item.id, current && mergeValue ? mergeValue(current, item) : item);
  }
  return [...merged.values()];
}

function mergeRubyDictionaries(current, incoming) {
  if (incoming === null) return current;
  if (current === null) return incoming;
  const merged = { ...current, ...incoming };
  const hidden = new Set([
    ...(Array.isArray(current.__hiddenDefaults) ? current.__hiddenDefaults : []),
    ...(Array.isArray(incoming.__hiddenDefaults) ? incoming.__hiddenDefaults : []),
  ]);
  if (hidden.size > 0) merged.__hiddenDefaults = [...hidden];
  else delete merged.__hiddenDefaults;
  return merged;
}

/** 検証済みスナップショット同士から、merge / replace 後のデータを純粋関数で計算します。 */
export function buildDataRestorePlan(currentBackup, incomingBackup, mode = 'merge') {
  if (mode !== 'merge' && mode !== 'replace') {
    throw new TypeError('復元モードは merge または replace を指定してください');
  }
  const current = validateDataBackup(currentBackup);
  const incoming = validateDataBackup(incomingBackup);
  if (mode === 'replace') return incoming.data;

  const projects = mergeById(
    current.data.projects,
    incoming.data.projects,
    (left, right) => ({ ...left, ...right }),
  );
  const formatGuideStates = mergeById(
    current.data.formatGuideStates.map(item => ({ ...item, id: item.projectId })),
    incoming.data.formatGuideStates.map(item => ({ ...item, id: item.projectId })),
  ).map(({ id: _id, ...item }) => item);
  const images = mergeById(current.data.images, incoming.data.images);
  const projectRubyDictionaries = mergeById(
    current.data.projectRubyDictionaries.map(item => ({ ...item, id: item.projectId })),
    incoming.data.projectRubyDictionaries.map(item => ({ ...item, id: item.projectId })),
    (left, right) => ({
      ...right,
      value: mergeRubyDictionaries(left.value, right.value),
    }),
  ).map(({ id: _id, ...item }) => item);

  return {
    projects,
    selectedProjectId: incoming.data.selectedProjectId || current.data.selectedProjectId,
    formatGuideStates,
    rubyCustomDict: mergeRubyDictionaries(current.data.rubyCustomDict, incoming.data.rubyCustomDict),
    projectRubyDictionaries,
    images,
  };
}

function captureRawStorage(storage, keys) {
  return new Map([...keys].map(key => [key, storage.getItem(key)]));
}

function listStorageIdsByPrefix(storage, prefix) {
  const ids = [];
  if (!Number.isInteger(storage.length) || typeof storage.key !== 'function') return ids;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key === 'string' && key.startsWith(prefix)) ids.push(key.slice(prefix.length));
  }
  return ids;
}

function restoreRawStorage(storage, snapshot) {
  // 先に今回の対象だけを消すと、容量超過から戻す場合にも元データを書き戻しやすくなります。
  for (const key of snapshot.keys()) storage.removeItem(key);
  for (const [key, value] of snapshot.entries()) {
    if (value !== null) storage.setItem(key, value);
  }
}

function applyStoragePlan(storage, plan, affectedProjectIds, affectedFormatGuideIds) {
  storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(plan.projects));
  if (plan.selectedProjectId === null) storage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
  else storage.setItem(SELECTED_PROJECT_STORAGE_KEY, plan.selectedProjectId);

  const formatMap = new Map(plan.formatGuideStates.map(item => [item.projectId, item.value]));
  for (const projectId of affectedFormatGuideIds) {
    const key = `${FORMAT_GUIDE_STORAGE_PREFIX}${projectId}`;
    if (formatMap.has(projectId)) storage.setItem(key, JSON.stringify(formatMap.get(projectId)));
    else storage.removeItem(key);
  }

  if (plan.rubyCustomDict === null) storage.removeItem(RUBY_DICTIONARY_STORAGE_KEY);
  else storage.setItem(RUBY_DICTIONARY_STORAGE_KEY, JSON.stringify(plan.rubyCustomDict));

  const projectRubyMap = new Map(plan.projectRubyDictionaries.map(item => [item.projectId, item.value]));
  for (const projectId of affectedProjectIds) {
    const key = `${PROJECT_RUBY_DICTIONARY_STORAGE_PREFIX}${projectId}`;
    if (projectRubyMap.has(projectId)) storage.setItem(key, JSON.stringify(projectRubyMap.get(projectId)));
    else storage.removeItem(key);
  }
}

/**
 * バックアップを復元します。成功時は復元直前の完全なスナップショットを返します。
 * localStorage または IndexedDB の書き込みに失敗した場合は、両方を復元前へ戻します。
 */
async function importDataBackupUnlocked(input, {
  mode = 'merge',
  appVersion = 'unknown',
  storage = getBrowserStorage(),
  imageStore = defaultImageStore,
  now = () => new Date(),
} = {}) {
  const incoming = typeof input === 'string' ? parseDataBackup(input) : validateDataBackup(input);
  const beforeSnapshot = await createDataBackup({ appVersion, storage, imageStore, now });
  const plan = buildDataRestorePlan(beforeSnapshot, incoming, mode);

  const affectedProjectIds = new Set([
    ...beforeSnapshot.data.projects.map(project => project.id),
    ...incoming.data.projects.map(project => project.id),
  ]);
  const affectedFormatGuideIds = new Set([
    ...beforeSnapshot.data.formatGuideStates.map(item => item.projectId),
    ...incoming.data.formatGuideStates.map(item => item.projectId),
  ]);
  if (mode === 'replace') {
    listStorageIdsByPrefix(storage, FORMAT_GUIDE_STORAGE_PREFIX)
      .forEach(id => affectedFormatGuideIds.add(id));
    listStorageIdsByPrefix(storage, PROJECT_RUBY_DICTIONARY_STORAGE_PREFIX)
      .forEach(id => affectedProjectIds.add(id));
  }
  const affectedKeys = new Set([
    PROJECTS_STORAGE_KEY,
    SELECTED_PROJECT_STORAGE_KEY,
    RUBY_DICTIONARY_STORAGE_KEY,
    ...[...affectedFormatGuideIds].map(id => `${FORMAT_GUIDE_STORAGE_PREFIX}${id}`),
    ...[...affectedProjectIds].map(id => `${PROJECT_RUBY_DICTIONARY_STORAGE_PREFIX}${id}`),
  ]);
  const rawStorageSnapshot = captureRawStorage(storage, affectedKeys);

  try {
    applyStoragePlan(storage, plan, affectedProjectIds, affectedFormatGuideIds);
    // 常に完成済み plan で置換することで、画像も merge / replace と同じ結果になります。
    await imageStore.replaceLocalImages(plan.images);
  } catch (cause) {
    const rollbackErrors = [];
    try {
      restoreRawStorage(storage, rawStorageSnapshot);
    } catch (error) {
      rollbackErrors.push(error);
    }
    try {
      await imageStore.replaceLocalImages(beforeSnapshot.data.images);
    } catch (error) {
      rollbackErrors.push(error);
    }

    throw new BackupImportError(
      rollbackErrors.length === 0
        ? '復元に失敗したため、元のデータへ戻しました'
        : '復元に失敗し、元データの自動復旧も完了できませんでした',
      {
        cause,
        beforeSnapshot,
        rollbackSucceeded: rollbackErrors.length === 0,
        rollbackErrors,
      },
    );
  }

  return {
    mode,
    beforeSnapshot,
    restoredSnapshot: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: String(appVersion || 'unknown'),
      exportedAt: toIsoString(now),
      data: plan,
    },
    counts: {
      projects: plan.projects.length,
      manuscripts: plan.formatGuideStates.length,
      rubyDictionaries: plan.projectRubyDictionaries.length,
      images: plan.images.length,
    },
  };
}

export function importDataBackup(input, options) {
  return withProjectWriteLock(() => importDataBackupUnlocked(input, options));
}

export function serializeDataBackup(backup) {
  return JSON.stringify(validateDataBackup(backup), null, 2);
}

export function createBackupFileName(prefix = 'kindle-navi-backup', date = new Date()) {
  const timestamp = toIsoString(date).replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.json`;
}

export function downloadDataBackup(backup, { filename } = {}) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('この環境ではバックアップをダウンロードできません');
  }
  const json = serializeDataBackup(backup);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || createBackupFileName();
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function readDataBackupFile(file) {
  if (!file || typeof file.text !== 'function') {
    throw new BackupValidationError('バックアップファイルを選択してください', 'backup');
  }
  if (typeof file.size === 'number' && file.size > MAX_BACKUP_TEXT_LENGTH) {
    throw new BackupValidationError('ファイルサイズが大きすぎます', 'backup');
  }
  return parseDataBackup(await file.text());
}
