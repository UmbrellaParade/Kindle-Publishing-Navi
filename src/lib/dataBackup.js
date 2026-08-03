import { listLocalImages, replaceLocalImages } from './localImageStore.js';
import { withProjectWriteLock } from './projectWriteLock.js';
import {
  mergeCritiqueHistoryValues,
  readCritiqueHistory,
  serializeCritiqueHistory,
} from './critiqueHistory.js';

export const BACKUP_SCHEMA_VERSION = 1;
export const CRITIQUE_RECOVERY_SCHEMA_VERSION = 1;
export const CRITIQUE_RECOVERY_KIND = 'kindle-navi-critique-recovery';
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
  'post_publication_notes',
  'manuscript',
  'critique_history',
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
const CRITIQUE_RECOVERY_FIELDS = new Set([
  'kind',
  'schemaVersion',
  'appVersion',
  'exportedAt',
  'entries',
]);
const CRITIQUE_RECOVERY_ENTRY_FIELDS = new Set([
  'projectId',
  'projectName',
  'error',
  'raw',
]);
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
    this.beforeCritiqueRecovery = options.beforeCritiqueRecovery || null;
    this.rollbackSucceeded = options.rollbackSucceeded;
    this.rollbackErrors = options.rollbackErrors || [];
    this.preflightFailed = options.preflightFailed === true;
    this.writeStarted = options.writeStarted === true;
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

function normalizeCritiqueHistoryField(value, path) {
  if (typeof value !== 'string') fail(path, '文字列ではありません');
  if (!value.trim()) return '';

  let result;
  try {
    result = readCritiqueHistory(value);
  } catch (cause) {
    fail(path, cause?.message || '辛口論評履歴を読み込めません');
  }

  if (result?.error) {
    fail(path, result.error.message || '辛口論評履歴の形式が正しくありません');
  }
  if (!Array.isArray(result?.entries)) {
    fail(path, '辛口論評履歴の形式が正しくありません');
  }

  try {
    return serializeCritiqueHistory(result.entries);
  } catch (cause) {
    fail(path, cause?.message || '辛口論評履歴を正規化できません');
  }
}

export class BackupRecoveryRequiredError extends BackupValidationError {
  constructor(critiqueRecovery) {
    super(
      '壊れた辛口論評履歴が見つかりました。原文を失わないよう createDataBackupBundle を使用してください',
      'backup.data.projects.critique_history',
    );
    this.name = 'BackupRecoveryRequiredError';
    this.critiqueRecovery = critiqueRecovery;
  }
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

    normalized[field] = field === 'critique_history'
      ? normalizeCritiqueHistoryField(value, `${path}.${field}`)
      : value;
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

/** 壊れた辛口論評履歴の原文を、通常バックアップとは別に安全に保存する形式です。 */
export function validateCritiqueRecovery(value) {
  assertPlainObject(value, 'recovery');
  assertExactKeys(value, CRITIQUE_RECOVERY_FIELDS, 'recovery');
  if (value.kind !== CRITIQUE_RECOVERY_KIND) {
    fail('recovery.kind', '辛口論評の復旧用ファイルではありません');
  }
  if (value.schemaVersion !== CRITIQUE_RECOVERY_SCHEMA_VERSION) {
    fail(
      'recovery.schemaVersion',
      `対応していない形式です（対応: ${CRITIQUE_RECOVERY_SCHEMA_VERSION}）`,
    );
  }

  const appVersion = assertString(value.appVersion, 'recovery.appVersion', { allowEmpty: false });
  const exportedAt = assertIsoDate(value.exportedAt, 'recovery.exportedAt');
  if (!Array.isArray(value.entries)) fail('recovery.entries', '配列ではありません');

  const seenProjectIds = new Set();
  const entries = value.entries.map((entry, index) => {
    const path = `recovery.entries[${index}]`;
    assertPlainObject(entry, path);
    assertExactKeys(entry, CRITIQUE_RECOVERY_ENTRY_FIELDS, path);
    const projectId = assertString(entry.projectId, `${path}.projectId`, { allowEmpty: false });
    if (seenProjectIds.has(projectId)) fail(`${path}.projectId`, '同じプロジェクトIDが重複しています');
    seenProjectIds.add(projectId);
    return {
      projectId,
      projectName: assertString(entry.projectName, `${path}.projectName`, { allowEmpty: false }),
      error: assertString(entry.error, `${path}.error`, { allowEmpty: false }),
      raw: assertString(entry.raw, `${path}.raw`),
    };
  });

  return {
    kind: CRITIQUE_RECOVERY_KIND,
    schemaVersion: CRITIQUE_RECOVERY_SCHEMA_VERSION,
    appVersion,
    exportedAt,
    entries,
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

/**
 * 現在の許可済みデータだけを収集します。AI設定やAPIキーの保存キーは読みません。
 * 壊れた辛口論評履歴は通常バックアップから分離し、原文を復旧用ファイルへ残します。
 */
export async function createDataBackupBundle({
  appVersion = 'unknown',
  storage = getBrowserStorage(),
  imageStore = defaultImageStore,
  now = () => new Date(),
} = {}) {
  const exportedAt = toIsoString(now);
  const rawProjects = readJsonStorage(storage, PROJECTS_STORAGE_KEY, [], PROJECTS_STORAGE_KEY);
  const { projects, recoveryEntries } = normalizeProjectsForBackup(
    rawProjects,
    'backup.data.projects',
    { ignoreUnknown: true },
  );
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

  const backup = validateDataBackup({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: String(appVersion || 'unknown'),
    exportedAt,
    data: {
      projects,
      selectedProjectId,
      formatGuideStates,
      rubyCustomDict,
      projectRubyDictionaries,
      images,
    },
  });

  const critiqueRecovery = recoveryEntries.length > 0
    ? validateCritiqueRecovery({
      kind: CRITIQUE_RECOVERY_KIND,
      schemaVersion: CRITIQUE_RECOVERY_SCHEMA_VERSION,
      appVersion: String(appVersion || 'unknown'),
      exportedAt,
      entries: recoveryEntries,
    })
    : null;

  return { backup, critiqueRecovery };
}

/** 従来API。通常復元できる検証済みバックアップだけを返します。 */
export async function createDataBackup(options) {
  const { backup, critiqueRecovery } = await createDataBackupBundle(options);
  if (critiqueRecovery) {
    throw new BackupRecoveryRequiredError(critiqueRecovery);
  }
  return backup;
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

function parsePlainJsonObject(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function mergeProjectKdpMeta(currentValue, incomingValue) {
  const current = parsePlainJsonObject(currentValue);
  const incoming = parsePlainJsonObject(incomingValue);
  if (!incoming) return current ? currentValue : incomingValue;
  if (!current) return incomingValue;
  return JSON.stringify({ ...current, ...incoming });
}

function mergeProject(left, right) {
  const merged = { ...left, ...right };
  if (Object.prototype.hasOwnProperty.call(right, 'kdp_meta')) {
    merged.kdp_meta = mergeProjectKdpMeta(left.kdp_meta, right.kdp_meta);
  }
  if (Object.prototype.hasOwnProperty.call(right, 'critique_history')) {
    merged.critique_history = mergeCritiqueHistoryValues(
      left.critique_history,
      right.critique_history,
    );
  }
  return merged;
}

function recoveryRawText(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeProjectsForBackup(projects, path, options) {
  if (!Array.isArray(projects)) fail(path, '配列ではありません');
  const recoveryEntries = [];
  const safeProjects = projects.map((project) => {
    if (!isPlainObject(project)) return project;
    if (!Object.prototype.hasOwnProperty.call(project, 'critique_history')) return project;
    const rawValue = project.critique_history;
    if (rawValue === null || rawValue === undefined || rawValue === '') return project;
    if (typeof rawValue === 'string' && !rawValue.trim()) return project;

    let errorMessage = '';
    try {
      const result = readCritiqueHistory(rawValue);
      if (!result.error) return project;
      errorMessage = result.error.message;
    } catch (cause) {
      errorMessage = cause?.message || '';
    }

    recoveryEntries.push({
      projectId: typeof project.id === 'string' ? project.id : '',
      projectName: typeof project.name === 'string' ? project.name : '',
      error: errorMessage || '辛口論評履歴を読み込めません',
      raw: recoveryRawText(rawValue),
    });
    const safeProject = { ...project };
    delete safeProject.critique_history;
    return safeProject;
  });

  return {
    projects: normalizeProjects(safeProjects, path, options),
    recoveryEntries,
  };
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
    mergeProject,
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

function preserveCorruptCritiqueHistories(plan, incoming, critiqueRecovery) {
  if (!critiqueRecovery) return plan;
  const incomingById = new Map(incoming.data.projects.map(project => [project.id, project]));
  const recoveryById = new Map(critiqueRecovery.entries.map(entry => [entry.projectId, entry]));

  return {
    ...plan,
    projects: plan.projects.map((project) => {
      const recovery = recoveryById.get(project.id);
      if (!recovery) return project;
      const incomingProject = incomingById.get(project.id);
      const explicitlyRepairs = incomingProject
        && Object.prototype.hasOwnProperty.call(incomingProject, 'critique_history');
      return explicitlyRepairs
        ? project
        : { ...project, critique_history: recovery.raw };
    }),
  };
}

function listCorruptCritiqueRepairProjectIds(incoming, critiqueRecovery) {
  if (!critiqueRecovery) return [];
  const corruptProjectIds = new Set(
    critiqueRecovery.entries.map(entry => entry.projectId),
  );
  return incoming.data.projects
    .filter(project => corruptProjectIds.has(project.id)
      && Object.prototype.hasOwnProperty.call(project, 'critique_history'))
    .map(project => project.id);
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
 * beforeApply は書き込みロック内・データ変更前に実行し、例外時は変更せず停止します。
 * 壊れた論評履歴を修復する場合は { critiqueRecoverySaved: true } の返却も必須です。
 * @param {*} input
 * @param {{
 *   mode?: string,
 *   appVersion?: string,
 *   storage?: Storage,
 *   imageStore?: {listLocalImages: () => Promise<any[]>, replaceLocalImages: (records: any[]) => Promise<void>},
 *   now?: () => Date,
 *   beforeApply?: (context: any) => any,
 * }} [options]
 */
async function importDataBackupUnlocked(input, {
  mode = 'merge',
  appVersion = 'unknown',
  storage = getBrowserStorage(),
  imageStore = defaultImageStore,
  now = () => new Date(),
  beforeApply,
} = {}) {
  const incoming = typeof input === 'string' ? parseDataBackup(input) : validateDataBackup(input);
  const beforeBundle = await createDataBackupBundle({ appVersion, storage, imageStore, now });
  const { backup: beforeSnapshot, critiqueRecovery: beforeCritiqueRecovery } = beforeBundle;
  const basePlan = buildDataRestorePlan(beforeSnapshot, incoming, mode);
  const plan = mode === 'merge'
    ? preserveCorruptCritiqueHistories(basePlan, incoming, beforeCritiqueRecovery)
    : basePlan;
  const critiqueRepairProjectIds = mode === 'merge'
    ? listCorruptCritiqueRepairProjectIds(incoming, beforeCritiqueRecovery)
    : [];

  if (critiqueRepairProjectIds.length > 0 && typeof beforeApply !== 'function') {
    throw new BackupImportError(
      '壊れた辛口論評履歴を置き換える前に、復旧用JSONを保存する処理が必要です。データは変更していません',
      {
        beforeSnapshot,
        beforeCritiqueRecovery,
        rollbackSucceeded: true,
        preflightFailed: true,
        writeStarted: false,
      },
    );
  }
  if (beforeApply !== undefined && typeof beforeApply !== 'function') {
    throw new TypeError('beforeApply は関数で指定してください');
  }
  if (typeof beforeApply === 'function') {
    try {
      const preflightResult = await beforeApply({
        mode,
        beforeSnapshot,
        beforeCritiqueRecovery,
        incomingSnapshot: incoming,
        critiqueRepairProjectIds,
      });
      if (critiqueRepairProjectIds.length > 0
        && preflightResult?.critiqueRecoverySaved !== true) {
        throw new Error('辛口論評履歴の復旧用JSONを保存できたことを確認できませんでした');
      }
    } catch (cause) {
      throw new BackupImportError(
        '復元前の安全バックアップを保存できなかったため、データを変更せず停止しました',
        {
          cause,
          beforeSnapshot,
          beforeCritiqueRecovery,
          rollbackSucceeded: true,
          preflightFailed: true,
          writeStarted: false,
        },
      );
    }
  }

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
        beforeCritiqueRecovery,
        rollbackSucceeded: rollbackErrors.length === 0,
        rollbackErrors,
        writeStarted: true,
      },
    );
  }

  return {
    mode,
    beforeSnapshot,
    beforeCritiqueRecovery,
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

export function serializeCritiqueRecovery(recovery) {
  return JSON.stringify(validateCritiqueRecovery(recovery), null, 2);
}

export function createBackupFileName(prefix = 'kindle-navi-backup', date = new Date()) {
  const timestamp = toIsoString(date).replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.json`;
}

export function createCritiqueRecoveryFileName(
  prefix = 'kindle-navi-critique-recovery',
  date = new Date(),
) {
  return createBackupFileName(prefix, date);
}

export function downloadDataBackup(backup, { filename = '' } = { filename: '' }) {
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

export function downloadCritiqueRecovery(recovery, { filename = '' } = { filename: '' }) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('この環境では辛口論評の復旧用ファイルをダウンロードできません');
  }
  const json = serializeCritiqueRecovery(recovery);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || createCritiqueRecoveryFileName();
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
