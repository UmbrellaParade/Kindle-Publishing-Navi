import { buildInitialChecklistData } from './checklistTasks.js';
import { withProjectWriteLock } from './projectWriteLock.js';

export const LEGACY_PROJECTS_STORAGE_KEY = 'kindleNavi_projects';
export const LEGACY_SELECTED_PROJECT_STORAGE_KEY = 'kindleNavi_selectedProject';
export const CURRENT_PROJECTS_STORAGE_KEY = 'kindle_publishing_navi_local_projects';
export const CURRENT_SELECTED_PROJECT_STORAGE_KEY = 'kindle_publishing_navi_selected_project_id';
export const LEGACY_MIGRATION_MARKERS_STORAGE_KEY = 'kindle_publishing_navi_legacy_migration_markers_v1';
export const FORMAT_GUIDE_STORAGE_PREFIX = 'format_guide_state_';
export const LEGACY_MIGRATION_VERSION = 1;

const LEGACY_STEP_LABELS = Object.freeze([
  '原稿初稿完成',
  '推敲・校正',
  'ルビ付与',
  '楽曲リンク埋め込み',
  '表紙デザイン完成',
  'A+コンテンツ作成',
  'docx形式変換',
  'Kindleプレビュー確認',
  'KDPアカウント設定',
  '書籍説明文作成',
  'キーワード設定',
  'カテゴリー設定',
  '価格設定',
  'KDPセレクト登録',
  '出版申請',
  '審査完了・公開',
  'SNS告知開始',
  'Amazon広告設定',
  'レビュー依頼',
  '旧版のランキング目標確認',
]);

const LEGACY_STRING_FIELDS = Object.freeze([
  'name',
  'book_title',
  'author_name',
  'kdp_description',
  'category_main',
  'category_sub1',
  'category_sub2',
  'release_target_date',
  'release_method',
  'schedule_calculated_for',
  'promotion_goal',
  'strategy_memo',
  'sns_memo1_title',
  'sns_memo1',
  'sns_memo2_title',
  'sns_memo2',
  'manuscript',
  'cover_image_url',
  'aplus_image_url',
]);

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const STEP_KEY_RE = /^step_(\d|1\d)$/;
const RESERVED_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export class LegacyMigrationValidationError extends Error {
  constructor(message, path = 'legacy') {
    super(`${path}: ${message}`);
    this.name = 'LegacyMigrationValidationError';
    this.path = path;
  }
}

export class LegacyMigrationWriteError extends Error {
  constructor(message, { cause, rollbackSucceeded, rollbackErrors = [] } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'LegacyMigrationWriteError';
    this.rollbackSucceeded = rollbackSucceeded;
    this.rollbackErrors = rollbackErrors;
  }
}

function fail(path, message) {
  throw new LegacyMigrationValidationError(message, path);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, path) {
  if (!isPlainObject(value)) fail(path, 'オブジェクトではありません');
}

function optionalString(value, path) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') fail(path, '文字列ではありません');
  return value;
}

function requiredString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') fail(path, '空でない文字列が必要です');
  return value;
}

function normalizeDateOnly(value, path) {
  const normalized = optionalString(value, path);
  if (!normalized) return '';
  const match = DATE_ONLY_RE.exec(normalized);
  if (!match) fail(path, '日付は YYYY-MM-DD 形式で指定してください');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    fail(path, '実在する日付ではありません');
  }
  return normalized;
}

function toIsoTimestamp(value, path, fallbackIso) {
  if (value === undefined || value === null || value === '') return fallbackIso;
  const source = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) fail(path, '有効な日時ではありません');
  return date.toISOString();
}

function normalizeNow(now) {
  const raw = typeof now === 'function' ? now() : now;
  const date = raw instanceof Date ? raw : new Date(raw ?? Date.now());
  if (Number.isNaN(date.getTime())) throw new TypeError('移行日時を作成できません');
  return date.toISOString();
}

function normalizeLegacyChecklist(value, path) {
  if (value === undefined || value === null) return {};
  assertPlainObject(value, path);

  const snapshot = {};
  for (const [key, rawState] of Object.entries(value)) {
    if (RESERVED_OBJECT_KEYS.has(key) || !STEP_KEY_RE.test(key)) {
      fail(`${path}.${key}`, '対応していない旧版チェックリスト項目です');
    }
    assertPlainObject(rawState, `${path}.${key}`);

    const done = rawState.done ?? false;
    if (typeof done !== 'boolean') fail(`${path}.${key}.done`, '真偽値ではありません');
    const memo = optionalString(rawState.memo, `${path}.${key}.memo`);
    const date = normalizeDateOnly(rawState.date, `${path}.${key}.date`);
    const dateSource = optionalString(rawState.date_source, `${path}.${key}.date_source`);

    snapshot[key] = {
      done,
      memo,
      date,
      ...(dateSource ? { date_source: dateSource } : {}),
    };
  }
  return snapshot;
}

function normalizeKeywords(value, path) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(path, '配列ではありません');
  return value.map((keyword, index) => optionalString(keyword, `${path}[${index}]`));
}

function normalizeLegacyProject(project, index, migratedAt) {
  const path = `legacyProjects[${index}]`;
  assertPlainObject(project, path);
  const id = requiredString(project.id, `${path}.id`);

  const strings = {};
  for (const field of LEGACY_STRING_FIELDS) {
    strings[field] = optionalString(project[field], `${path}.${field}`);
  }
  if (!strings.name.trim()) {
    strings.name = strings.book_title.trim();
  }
  if (!strings.name.trim()) fail(`${path}.name`, 'プロジェクト名または本のタイトルが必要です');

  strings.release_target_date = normalizeDateOnly(
    strings.release_target_date,
    `${path}.release_target_date`,
  );
  strings.schedule_calculated_for = normalizeDateOnly(
    strings.schedule_calculated_for,
    `${path}.schedule_calculated_for`,
  );

  const createdDate = toIsoTimestamp(project.createdAt, `${path}.createdAt`, migratedAt);
  const updatedDate = toIsoTimestamp(project.updatedAt, `${path}.updatedAt`, createdDate);

  return {
    id,
    strings,
    keywords: normalizeKeywords(project.keywords, `${path}.keywords`),
    checklistSnapshot: normalizeLegacyChecklist(project.checklist_data, `${path}.checklist_data`),
    createdDate,
    updatedDate,
  };
}

/** 旧版プロジェクト一覧を検証し、移行専用の正規形へ変換します。入力値は変更しません。 */
export function normalizeLegacyProjects(projects, { now = () => new Date() } = {}) {
  if (!Array.isArray(projects)) fail('legacyProjects', '配列ではありません');
  const migratedAt = normalizeNow(now);
  const seenIds = new Set();
  return projects.map((project, index) => {
    const normalized = normalizeLegacyProject(project, index, migratedAt);
    if (seenIds.has(normalized.id)) fail(`legacyProjects[${index}].id`, '旧版IDが重複しています');
    seenIds.add(normalized.id);
    return normalized;
  });
}

function buildLegacyReferenceTasks(snapshot, newProjectId) {
  return Object.entries(snapshot)
    .sort(([left], [right]) => Number(left.slice(5)) - Number(right.slice(5)))
    .map(([stepKey, state]) => {
      const index = Number(stepKey.slice(5));
      const status = state.done ? '完了' : '未完了';
      const note = [
        `旧版での状態: ${status}（新しい標準工程とは別の参照用タスクです）`,
        state.memo,
      ].filter(Boolean).join('\n');

      return {
        id: `legacy_${newProjectId}_${stepKey}`,
        title: `【旧版参照】${index + 1}. ${LEGACY_STEP_LABELS[index]}`,
        state: {
          is_done: state.done,
          due_date: state.date,
          note,
          ...(state.date ? { due_date_source: 'manual' } : {}),
        },
        legacy_source_step: stepKey,
      };
    });
}

function buildCategorySlots(strings) {
  return [strings.category_main, strings.category_sub1, strings.category_sub2]
    .map(value => ({ value, custom: '', memo: '' }));
}

function buildSnsMemo(subtitle, body) {
  return JSON.stringify({ subtitle, tags: [], body });
}

function transformNormalizedLegacyProject(normalized, { newId, migratedAt }) {
  requiredString(newId, 'newId');
  const { strings } = normalized;
  const checklistData = {
    _data: buildInitialChecklistData(),
    _custom: buildLegacyReferenceTasks(normalized.checklistSnapshot, newId),
    legacy_checklist_snapshot: normalized.checklistSnapshot,
    legacy_migration: {
      version: LEGACY_MIGRATION_VERSION,
      source_project_id: normalized.id,
      migrated_at: migratedAt,
    },
  };

  return {
    project: {
      id: newId,
      name: strings.name,
      book_title: strings.book_title || strings.name,
      author_name: strings.author_name,
      kdp_description: strings.kdp_description,
      category_main: strings.category_main,
      category_sub1: strings.category_sub1,
      category_sub2: strings.category_sub2,
      keywords: JSON.stringify(normalized.keywords),
      checklist_data: JSON.stringify(checklistData),
      categories: JSON.stringify(buildCategorySlots(strings)),
      promotion_goal: strings.promotion_goal,
      strategy_memo: strings.strategy_memo,
      sns_memo1: buildSnsMemo(strings.sns_memo1_title, strings.sns_memo1),
      sns_memo2: buildSnsMemo(strings.sns_memo2_title, strings.sns_memo2),
      sns_memo1_title: strings.sns_memo1_title,
      sns_memo2_title: strings.sns_memo2_title,
      manuscript: strings.manuscript,
      cover_image_url: strings.cover_image_url,
      aplus_image_url: strings.aplus_image_url,
      release_target_date: strings.release_target_date,
      release_method: strings.release_method,
      schedule_calculated_for: strings.schedule_calculated_for,
      created_date: normalized.createdDate,
      updated_date: normalized.updatedDate,
    },
    formatGuideState: {
      sharedText: strings.manuscript,
    },
  };
}

/** 単一の旧版プロジェクトを、現行形式と原稿エディター形式へ純粋変換します。 */
export function transformLegacyProject(project, {
  newId,
  now = () => new Date(),
  migratedAt,
} = {}) {
  const migrationIso = migratedAt ? normalizeNow(migratedAt) : normalizeNow(now);
  const [normalized] = normalizeLegacyProjects([project], { now: migrationIso });
  return transformNormalizedLegacyProject(normalized, { newId, migratedAt: migrationIso });
}

function validateCurrentProjects(projects) {
  if (!Array.isArray(projects)) fail('currentProjects', '配列ではありません');
  const seenIds = new Set();
  for (let index = 0; index < projects.length; index += 1) {
    const project = projects[index];
    assertPlainObject(project, `currentProjects[${index}]`);
    const id = requiredString(project.id, `currentProjects[${index}].id`);
    if (seenIds.has(id)) fail(`currentProjects[${index}].id`, '現行IDが重複しています');
    seenIds.add(id);
  }
  return projects;
}

function validateMarkers(markers) {
  assertPlainObject(markers, 'markers');
  const normalized = {};
  for (const [legacyId, marker] of Object.entries(markers)) {
    if (RESERVED_OBJECT_KEYS.has(legacyId)) fail(`markers.${legacyId}`, '使用できないIDです');
    requiredString(legacyId, `markers.${legacyId}`);
    assertPlainObject(marker, `markers.${legacyId}`);
    normalized[legacyId] = {
      newProjectId: requiredString(marker.newProjectId, `markers.${legacyId}.newProjectId`),
      migratedAt: requiredString(marker.migratedAt, `markers.${legacyId}.migratedAt`),
    };
  }
  return normalized;
}

function defaultIdFactory({ legacyId }) {
  const readableId = legacyId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36) || 'project';
  if (globalThis.crypto?.randomUUID) return `legacy_${readableId}_${globalThis.crypto.randomUUID()}`;
  return `legacy_${readableId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function createUniqueId({ legacyId, index, existingIds, idFactory }) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = idFactory({ legacyId, index, attempt });
    if (typeof candidate !== 'string' || candidate.trim() === '') {
      throw new TypeError('idFactory は空でない文字列を返す必要があります');
    }
    if (!existingIds.has(candidate)) {
      existingIds.add(candidate);
      return candidate;
    }
  }
  throw new Error('衝突しない移行先IDを作成できませんでした');
}

/**
 * 検証済みの入力だけから、localStorageへ適用する移行計画を作ります。
 * 旧版の完了状態は現行の標準タスクへ割り当てません。
 */
export function buildLegacyMigrationPlan({
  legacyProjects,
  currentProjects = [],
  markers = {},
  legacySelectedId = null,
  currentSelectedId = null,
  reservedIds = [],
  now = () => new Date(),
  idFactory = defaultIdFactory,
} = {}) {
  const migratedAt = normalizeNow(now);
  const normalizedLegacy = normalizeLegacyProjects(legacyProjects, { now: migratedAt });
  const validatedCurrent = validateCurrentProjects(currentProjects);
  const validatedMarkers = validateMarkers(markers);
  const selectedLegacy = legacySelectedId === null || legacySelectedId === ''
    ? null
    : requiredString(legacySelectedId, 'legacySelectedId');
  const selectedCurrent = currentSelectedId === null || currentSelectedId === ''
    ? null
    : requiredString(currentSelectedId, 'currentSelectedId');
  if (!Array.isArray(reservedIds) || reservedIds.some(id => typeof id !== 'string')) {
    fail('reservedIds', '文字列の配列ではありません');
  }

  const currentIds = new Set(validatedCurrent.map(project => project.id));
  const candidates = normalizedLegacy.filter(project => (
    !validatedMarkers[project.id]
    || !currentIds.has(validatedMarkers[project.id].newProjectId)
  ));
  const existingIds = new Set([
    ...validatedCurrent.map(project => project.id),
    ...reservedIds,
  ]);
  const converted = [];
  const mapping = [];
  const nextMarkers = { ...validatedMarkers };
  const formatGuideStates = [];

  candidates.forEach((legacyProject, index) => {
    const newProjectId = createUniqueId({
      legacyId: legacyProject.id,
      index,
      existingIds,
      idFactory,
    });
    const transformed = transformNormalizedLegacyProject(legacyProject, {
      newId: newProjectId,
      migratedAt,
    });
    converted.push(transformed.project);
    formatGuideStates.push({ projectId: newProjectId, value: transformed.formatGuideState });
    mapping.push({ legacyProjectId: legacyProject.id, newProjectId });
    nextMarkers[legacyProject.id] = { newProjectId, migratedAt };
  });

  const selectedMapping = mapping.find(item => item.legacyProjectId === selectedLegacy);
  const currentSelectionIsValid = validatedCurrent.some(project => project.id === selectedCurrent);
  const selectedProjectId = selectedMapping?.newProjectId
    || (currentSelectionIsValid ? selectedCurrent : null)
    || converted[0]?.id
    || validatedCurrent[0]?.id
    || null;

  return {
    migratedAt,
    projects: [...converted, ...validatedCurrent],
    migratedProjects: converted,
    formatGuideStates,
    markers: nextMarkers,
    mapping,
    selectedProjectId,
    count: converted.length,
    skippedCount: normalizedLegacy.length - converted.length,
  };
}

function getBrowserStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    // 下の統一エラーへまとめます。
  }
  throw new Error('この環境ではブラウザ保存データを利用できません');
}

function readJson(storage, key, fallback, path) {
  const raw = storage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    fail(path, 'JSONを読み込めませんでした');
  }
}

function readMarkerDocument(storage) {
  const document = readJson(
    storage,
    LEGACY_MIGRATION_MARKERS_STORAGE_KEY,
    { version: LEGACY_MIGRATION_VERSION, projects: {} },
    LEGACY_MIGRATION_MARKERS_STORAGE_KEY,
  );
  assertPlainObject(document, LEGACY_MIGRATION_MARKERS_STORAGE_KEY);
  if (document.version !== LEGACY_MIGRATION_VERSION) {
    fail(`${LEGACY_MIGRATION_MARKERS_STORAGE_KEY}.version`, '対応していない移行マーカーです');
  }
  return validateMarkers(document.projects);
}

function listReservedProjectIds(storage) {
  const ids = [];
  if (!Number.isInteger(storage.length) || typeof storage.key !== 'function') return ids;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key === 'string' && key.startsWith(FORMAT_GUIDE_STORAGE_PREFIX)) {
      ids.push(key.slice(FORMAT_GUIDE_STORAGE_PREFIX.length));
    }
  }
  return ids;
}

/** まだ移行していない、有効な旧版プロジェクトの件数だけを調べます。書き込みは行いません。 */
export function inspectLegacyMigration({ storage = getBrowserStorage() } = {}) {
  const legacyProjects = readJson(storage, LEGACY_PROJECTS_STORAGE_KEY, [], LEGACY_PROJECTS_STORAGE_KEY);
  const normalized = normalizeLegacyProjects(legacyProjects);
  const markers = readMarkerDocument(storage);
  const currentProjects = validateCurrentProjects(readJson(
    storage,
    CURRENT_PROJECTS_STORAGE_KEY,
    [],
    CURRENT_PROJECTS_STORAGE_KEY,
  ));
  const currentIds = new Set(currentProjects.map(project => project.id));
  const candidateIds = normalized
    .filter(project => !markers[project.id] || !currentIds.has(markers[project.id].newProjectId))
    .map(project => project.id);
  return {
    count: candidateIds.length,
    totalLegacyCount: normalized.length,
    candidateIds,
  };
}

function captureRawStorage(storage, keys) {
  return new Map([...keys].map(key => [key, storage.getItem(key)]));
}

function restoreRawStorage(storage, snapshot) {
  const errors = [];
  for (const [key, value] of snapshot.entries()) {
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

/**
 * 旧版データを現行キーへコピーします。旧版キーは読み取り専用で、削除・更新しません。
 * beforeMigrate は保存待ちと完全バックアップのダウンロードを行う親側コールバックです。
 */
export async function migrateLegacyProjects({
  storage = getBrowserStorage(),
  beforeMigrate,
  now = () => new Date(),
  idFactory = defaultIdFactory,
} = {}) {
  if (typeof beforeMigrate !== 'function') {
    throw new TypeError('移行前の保存とバックアップを行う beforeMigrate が必要です');
  }

  await beforeMigrate();

  return withProjectWriteLock(async () => {

  const legacyProjects = readJson(storage, LEGACY_PROJECTS_STORAGE_KEY, [], LEGACY_PROJECTS_STORAGE_KEY);
  const currentProjects = readJson(storage, CURRENT_PROJECTS_STORAGE_KEY, [], CURRENT_PROJECTS_STORAGE_KEY);
  const markers = readMarkerDocument(storage);
  const legacySelectedId = storage.getItem(LEGACY_SELECTED_PROJECT_STORAGE_KEY);
  const currentSelectedId = storage.getItem(CURRENT_SELECTED_PROJECT_STORAGE_KEY);
  const plan = buildLegacyMigrationPlan({
    legacyProjects,
    currentProjects,
    markers,
    legacySelectedId,
    currentSelectedId,
    reservedIds: listReservedProjectIds(storage),
    now,
    idFactory,
  });

  if (plan.count === 0) return plan;

  const markerDocument = JSON.stringify({
    version: LEGACY_MIGRATION_VERSION,
    projects: plan.markers,
  });
  const serializedProjects = JSON.stringify(plan.projects);
  const serializedFormatStates = new Map(
    plan.formatGuideStates.map(item => [
      `${FORMAT_GUIDE_STORAGE_PREFIX}${item.projectId}`,
      JSON.stringify(item.value),
    ]),
  );
  const affectedKeys = new Set([
    CURRENT_PROJECTS_STORAGE_KEY,
    CURRENT_SELECTED_PROJECT_STORAGE_KEY,
    LEGACY_MIGRATION_MARKERS_STORAGE_KEY,
    ...serializedFormatStates.keys(),
  ]);
  const beforeWrite = captureRawStorage(storage, affectedKeys);

  try {
    storage.setItem(CURRENT_PROJECTS_STORAGE_KEY, serializedProjects);
    for (const [key, value] of serializedFormatStates.entries()) storage.setItem(key, value);
    if (plan.selectedProjectId) storage.setItem(CURRENT_SELECTED_PROJECT_STORAGE_KEY, plan.selectedProjectId);
    else storage.removeItem(CURRENT_SELECTED_PROJECT_STORAGE_KEY);
    // マーカーは最後に書き、途中までの移行を完了扱いにしません。
    storage.setItem(LEGACY_MIGRATION_MARKERS_STORAGE_KEY, markerDocument);
  } catch (cause) {
    const rollbackErrors = restoreRawStorage(storage, beforeWrite);
    throw new LegacyMigrationWriteError(
      rollbackErrors.length === 0
        ? '旧版データのコピーに失敗したため、移行前の状態へ戻しました'
        : '旧版データのコピーと自動ロールバックの両方に失敗しました',
      {
        cause,
        rollbackSucceeded: rollbackErrors.length === 0,
        rollbackErrors,
      },
    );
  }

  return plan;
  });
}
