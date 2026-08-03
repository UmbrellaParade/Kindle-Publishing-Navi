import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_PROJECTS_STORAGE_KEY,
  CURRENT_SELECTED_PROJECT_STORAGE_KEY,
  FORMAT_GUIDE_STORAGE_PREFIX,
  LEGACY_MIGRATION_MARKERS_STORAGE_KEY,
  LEGACY_PROJECTS_STORAGE_KEY,
  LEGACY_SELECTED_PROJECT_STORAGE_KEY,
  buildLegacyMigrationPlan,
  migrateLegacyProjects,
  transformLegacyProject,
} from './legacyMigration.js';

const NOW = '2026-08-03T03:00:00.000Z';

function makeLegacyProject(overrides = {}) {
  return {
    id: '1720000000000',
    name: '旧版プロジェクト',
    createdAt: 1_720_000_000_000,
    updatedAt: 1_720_086_400_000,
    book_title: '移行する本',
    author_name: '著者名',
    kdp_description: '<p>紹介文</p>',
    category_main: 'メインカテゴリー',
    category_sub1: 'サブカテゴリー1',
    category_sub2: 'サブカテゴリー2',
    keywords: ['キーワード1', 'キーワード2'],
    checklist_data: {
      step_0: { done: true, memo: '旧版メモ', date: '2026-07-01', date_source: 'manual' },
      step_14: { done: false, memo: '提出前に確認', date: '' },
    },
    release_target_date: '2026-09-01',
    schedule_calculated_for: '2026-09-01',
    promotion_goal: '読者へ届ける',
    strategy_memo: '発売前から案内する',
    sns_memo1_title: '発売告知',
    sns_memo1: '本文1',
    sns_memo2_title: '制作裏話',
    sns_memo2: '本文2',
    manuscript: '原稿本文',
    cover_image_url: 'https://example.com/cover.png',
    aplus_image_url: 'https://example.com/aplus.png',
    ...overrides,
  };
}

function makeStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump() { return Object.fromEntries(values); },
  };
}

test('旧版プロジェクトを現行形式へ変換し、標準タスクは未着手で開始する', () => {
  const source = makeLegacyProject();
  const original = structuredClone(source);
  const { project, formatGuideState } = transformLegacyProject(source, {
    newId: 'new-project-id',
    migratedAt: NOW,
  });

  assert.equal(project.id, 'new-project-id');
  assert.equal(project.created_date, '2024-07-03T09:46:40.000Z');
  assert.equal(project.updated_date, '2024-07-04T09:46:40.000Z');
  assert.deepEqual(JSON.parse(project.keywords), ['キーワード1', 'キーワード2']);
  assert.deepEqual(
    JSON.parse(project.categories).map(category => category.value),
    ['メインカテゴリー', 'サブカテゴリー1', 'サブカテゴリー2'],
  );
  assert.deepEqual(JSON.parse(project.sns_memo1), {
    subtitle: '発売告知',
    tags: [],
    body: '本文1',
  });
  assert.equal(project.manuscript, '原稿本文');
  assert.deepEqual(formatGuideState, { sharedText: '原稿本文' });
  assert.equal(project.release_target_date, '2026-09-01');
  assert.equal(project.schedule_calculated_for, '2026-09-01');

  const checklist = JSON.parse(project.checklist_data);
  assert.equal(checklist._data.t01.is_done, false);
  assert.equal(checklist._data.t01.due_date, '');
  assert.equal(checklist.legacy_checklist_snapshot.step_0.done, true);
  assert.equal(checklist._custom[0].state.is_done, true);
  assert.match(checklist._custom[0].title, /旧版参照/);
  assert.match(checklist._custom[0].state.note, /旧版メモ/);
  assert.deepEqual(source, original);
});

test('移行済みIDを除外し、現行IDと衝突しない新IDを採番する', () => {
  const legacyProjects = [
    makeLegacyProject({ id: 'old-a', name: 'A' }),
    makeLegacyProject({ id: 'old-b', name: 'B' }),
  ];
  const generated = ['current-id', 'new-id'];
  const plan = buildLegacyMigrationPlan({
    legacyProjects,
    currentProjects: [
      { id: 'current-id', name: '現行' },
      { id: 'already-imported', name: '移行済み' },
    ],
    markers: {
      'old-b': { newProjectId: 'already-imported', migratedAt: NOW },
    },
    legacySelectedId: 'old-a',
    now: NOW,
    idFactory: () => generated.shift(),
  });

  assert.equal(plan.count, 1);
  assert.equal(plan.skippedCount, 1);
  assert.equal(plan.migratedProjects[0].id, 'new-id');
  assert.equal(plan.selectedProjectId, 'new-id');
  assert.equal(plan.markers['old-a'].newProjectId, 'new-id');
  assert.equal(plan.markers['old-b'].newProjectId, 'already-imported');
});

test('移行先が削除済みなら旧版プロジェクトを再取込できる', () => {
  const plan = buildLegacyMigrationPlan({
    legacyProjects: [makeLegacyProject({ id: 'old-a', name: 'A' })],
    currentProjects: [],
    markers: {
      'old-a': { newProjectId: 'missing-project', migratedAt: NOW },
    },
    now: NOW,
    idFactory: () => 'reimported-project',
  });

  assert.equal(plan.count, 1);
  assert.equal(plan.migratedProjects[0].id, 'reimported-project');
  assert.equal(plan.markers['old-a'].newProjectId, 'reimported-project');
});

test('検証失敗時は現行・旧版のどのキーにも書き込まない', async () => {
  const invalidLegacy = makeLegacyProject({ keywords: '配列ではない' });
  const seed = {
    [LEGACY_PROJECTS_STORAGE_KEY]: JSON.stringify([invalidLegacy]),
    [LEGACY_SELECTED_PROJECT_STORAGE_KEY]: invalidLegacy.id,
    [CURRENT_PROJECTS_STORAGE_KEY]: JSON.stringify([{ id: 'current', name: '現行' }]),
    [CURRENT_SELECTED_PROJECT_STORAGE_KEY]: 'current',
  };
  const storage = makeStorage(seed);
  const before = storage.dump();
  let backupCalled = false;

  await assert.rejects(
    migrateLegacyProjects({
      storage,
      beforeMigrate: async () => { backupCalled = true; },
      now: NOW,
      idFactory: () => 'new-id',
    }),
    /keywords/,
  );

  assert.equal(backupCalled, true);
  assert.deepEqual(storage.dump(), before);
});

test('コピー移行は旧キーを保持し、原稿状態とID単位マーカーを作る', async () => {
  const legacy = makeLegacyProject();
  const oldProjectsRaw = JSON.stringify([legacy]);
  const seed = {
    [LEGACY_PROJECTS_STORAGE_KEY]: oldProjectsRaw,
    [LEGACY_SELECTED_PROJECT_STORAGE_KEY]: legacy.id,
    [CURRENT_PROJECTS_STORAGE_KEY]: '[]',
  };
  const storage = makeStorage(seed);

  const result = await migrateLegacyProjects({
    storage,
    beforeMigrate: async () => {},
    now: NOW,
    idFactory: () => 'new-id',
  });

  assert.equal(result.count, 1);
  assert.equal(storage.getItem(LEGACY_PROJECTS_STORAGE_KEY), oldProjectsRaw);
  assert.equal(storage.getItem(LEGACY_SELECTED_PROJECT_STORAGE_KEY), legacy.id);
  assert.equal(storage.getItem(CURRENT_SELECTED_PROJECT_STORAGE_KEY), 'new-id');
  assert.equal(
    JSON.parse(storage.getItem(`${FORMAT_GUIDE_STORAGE_PREFIX}new-id`)).sharedText,
    '原稿本文',
  );
  const markers = JSON.parse(storage.getItem(LEGACY_MIGRATION_MARKERS_STORAGE_KEY));
  assert.equal(markers.projects[legacy.id].newProjectId, 'new-id');
});

test('移行途中の書込み失敗では現行データをロールバックし、旧キーにも触れない', async () => {
  const legacy = makeLegacyProject();
  const seed = {
    [LEGACY_PROJECTS_STORAGE_KEY]: JSON.stringify([legacy]),
    [LEGACY_SELECTED_PROJECT_STORAGE_KEY]: legacy.id,
    [CURRENT_PROJECTS_STORAGE_KEY]: JSON.stringify([{ id: 'current', name: '現行' }]),
    [CURRENT_SELECTED_PROJECT_STORAGE_KEY]: 'current',
  };
  const storage = makeStorage(seed);
  const originalSetItem = storage.setItem.bind(storage);
  let failedOnce = false;
  storage.setItem = (key, value) => {
    if (key === LEGACY_MIGRATION_MARKERS_STORAGE_KEY && !failedOnce) {
      failedOnce = true;
      throw new Error('simulated quota error');
    }
    originalSetItem(key, value);
  };
  const before = storage.dump();

  await assert.rejects(
    migrateLegacyProjects({
      storage,
      beforeMigrate: async () => {},
      now: NOW,
      idFactory: () => 'new-id',
    }),
    error => error.name === 'LegacyMigrationWriteError' && error.rollbackSucceeded === true,
  );

  assert.deepEqual(storage.dump(), before);
  assert.equal(storage.getItem(`${FORMAT_GUIDE_STORAGE_PREFIX}new-id`), null);
});
