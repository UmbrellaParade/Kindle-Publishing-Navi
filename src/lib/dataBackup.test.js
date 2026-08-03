import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BackupImportError,
  BackupValidationError,
  buildDataRestorePlan,
  createDataBackup,
  importDataBackup,
  parseDataBackup,
  PROJECTS_STORAGE_KEY,
  PROJECT_RUBY_DICTIONARY_STORAGE_PREFIX,
  RUBY_DICTIONARY_STORAGE_KEY,
  SELECTED_PROJECT_STORAGE_KEY,
  validateDataBackup,
} from './dataBackup.js';

const FIXED_DATE = '2026-08-03T00:00:00.000Z';
const now = () => new Date(FIXED_DATE);

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function image(id) {
  return {
    id,
    name: `${id}.png`,
    type: 'image/png',
    dataUrl: 'data:image/png;base64,AA==',
    createdAt: FIXED_DATE,
  };
}

function backup({
  projects = [{ id: 'p1', name: '既存の本' }],
  selectedProjectId = projects[0]?.id || null,
  formatGuideStates = [],
  rubyCustomDict = null,
  projectRubyDictionaries = [],
  images = [],
  appVersion = '1.0.0',
} = {}) {
  return {
    schemaVersion: 1,
    appVersion,
    exportedAt: FIXED_DATE,
    data: {
      projects,
      selectedProjectId,
      formatGuideStates,
      rubyCustomDict,
      projectRubyDictionaries,
      images,
    },
  };
}

test('許可した保存キーとプロジェクト項目だけをバックアップする', async () => {
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{
      id: 'p1',
      name: '一般向けガイド',
      manuscript: '本文',
      categories: JSON.stringify([{ value: 'ノンフィクション', custom: '', memo: '', book_type: '実用・ビジネス', theme: '仕事術' }]),
      aplus_image_url: 'local-image:img1',
      kdp_meta: JSON.stringify({ aplus: { version: 1, modules: [{ images: [{ image_url: 'local-image:img1' }] }] } }),
      token: 'project-secret',
      apiKey: 'project-api-secret',
    }]),
    [SELECTED_PROJECT_STORAGE_KEY]: 'p1',
    format_guide_state_p1: JSON.stringify({ sharedText: '整形中の本文', unknown: '除外' }),
    [RUBY_DICTIONARY_STORAGE_KEY]: JSON.stringify({ 漢字: 'かんじ' }),
    [`${PROJECT_RUBY_DICTIONARY_STORAGE_PREFIX}p1`]: JSON.stringify({ 一般: 'いっぱん' }),
    kindle_navi_ai_settings: JSON.stringify({ apiKey: 'never-export-this' }),
    unrelated_key: 'unrelated-secret',
  });
  const imageStore = {
    listLocalImages: async () => [{ ...image('img1'), unknown: '除外' }],
    replaceLocalImages: async () => {},
  };

  const result = await createDataBackup({ appVersion: '1.2.3', storage, imageStore, now });
  const serialized = JSON.stringify(result);

  assert.equal(result.appVersion, '1.2.3');
  assert.equal(result.data.projects[0].manuscript, '本文');
  assert.equal(JSON.parse(result.data.projects[0].categories)[0].theme, '仕事術');
  assert.equal(result.data.projects[0].aplus_image_url, 'local-image:img1');
  assert.equal(JSON.parse(result.data.projects[0].kdp_meta).aplus.version, 1);
  assert.equal(result.data.selectedProjectId, 'p1');
  assert.equal(result.data.formatGuideStates[0].value.sharedText, '整形中の本文');
  assert.equal(result.data.projectRubyDictionaries[0].value.一般, 'いっぱん');
  assert.equal(result.data.images[0].id, 'img1');
  assert.doesNotMatch(serialized, /never-export-this|project-secret|project-api-secret|unrelated-secret/);
  assert.doesNotMatch(serialized, /kindle_navi_ai_settings|apiKey|token/);
});

test('不明な構造や不正な画像をimport前に拒否する', () => {
  assert.throws(
    () => validateDataBackup({ ...backup(), extra: true }),
    BackupValidationError,
  );
  assert.throws(
    () => validateDataBackup(backup({ projects: [{ id: 'p1', name: '本', token: 'secret' }] })),
    BackupValidationError,
  );
  assert.throws(
    () => validateDataBackup(backup({ selectedProjectId: '存在しないID' })),
    BackupValidationError,
  );
  assert.throws(
    () => validateDataBackup(backup({ images: [{ ...image('img1'), dataUrl: 'https://example.com/a.png' }] })),
    BackupValidationError,
  );
  assert.throws(() => parseDataBackup('{not json'), BackupValidationError);
});

test('mergeでは既存を残し、同じIDだけ入力側の項目で更新する', () => {
  const current = backup({
    projects: [
      {
        id: 'p1',
        name: '既存名',
        author_name: '既存著者',
        strategy_memo: '残す',
        kdp_meta: JSON.stringify({ description: '現在の紹介文', aplus: { version: 1, modules: [{ id: 'keep' }] } }),
      },
      { id: 'p2', name: '現在だけ' },
    ],
    formatGuideStates: [{ projectId: 'p1', value: { sharedText: '現在本文' } }],
    rubyCustomDict: { 現在: 'げんざい', __hiddenDefaults: ['既定A'] },
    projectRubyDictionaries: [{ projectId: 'p1', value: { 現在語: 'げんざいご' } }],
    images: [image('img-current'), image('img-shared')],
  });
  const incoming = backup({
    projects: [
      { id: 'p1', name: '復元名', author_name: '復元著者', kdp_meta: JSON.stringify({ description: '復元した紹介文' }) },
      { id: 'p3', name: '追加本' },
    ],
    formatGuideStates: [
      { projectId: 'p1', value: { sharedText: '復元本文' } },
      { projectId: 'p3', value: { sharedText: '追加本文' } },
    ],
    rubyCustomDict: { 復元: 'ふくげん', __hiddenDefaults: ['既定B'] },
    projectRubyDictionaries: [
      { projectId: 'p1', value: { 復元語: 'ふくげんご' } },
      { projectId: 'p3', value: { 追加語: 'ついかご' } },
    ],
    images: [image('img-shared'), image('img-import')],
  });

  const plan = buildDataRestorePlan(current, incoming, 'merge');
  const p1 = plan.projects.find(project => project.id === 'p1');

  assert.equal(plan.projects.length, 3);
  assert.equal(p1.name, '復元名');
  assert.equal(p1.strategy_memo, '残す');
  assert.equal(JSON.parse(p1.kdp_meta).description, '復元した紹介文');
  assert.equal(JSON.parse(p1.kdp_meta).aplus.modules[0].id, 'keep');
  assert.equal(plan.formatGuideStates.find(state => state.projectId === 'p1').value.sharedText, '復元本文');
  assert.deepEqual(plan.rubyCustomDict.__hiddenDefaults, ['既定A', '既定B']);
  assert.deepEqual(
    plan.projectRubyDictionaries.find(item => item.projectId === 'p1').value,
    { 現在語: 'げんざいご', 復元語: 'ふくげんご' },
  );
  assert.equal(plan.images.length, 3);
});

test('merge元にもA+データがある場合だけ入力側のA+内容へ置き換える', () => {
  const current = backup({
    projects: [{ id: 'p1', name: '本', kdp_meta: JSON.stringify({ aplus: { version: 1, notes: '現在' } }) }],
  });
  const incoming = backup({
    projects: [{ id: 'p1', name: '本', kdp_meta: JSON.stringify({ aplus: { version: 1, notes: '復元' } }) }],
  });

  const plan = buildDataRestorePlan(current, incoming, 'merge');

  assert.equal(JSON.parse(plan.projects[0].kdp_meta).aplus.notes, '復元');
});

test('import成功時に復元直前スナップショットを返す', async () => {
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{ id: 'p1', name: '現在の本' }]),
    [SELECTED_PROJECT_STORAGE_KEY]: 'p1',
    format_guide_state_p1: JSON.stringify({ sharedText: '現在本文' }),
    [RUBY_DICTIONARY_STORAGE_KEY]: JSON.stringify({ 現在: 'げんざい' }),
    [`${PROJECT_RUBY_DICTIONARY_STORAGE_PREFIX}p1`]: JSON.stringify({ 現在語: 'げんざいご' }),
  });
  let storedImages = [image('img-current')];
  const imageStore = {
    listLocalImages: async () => clone(storedImages),
    replaceLocalImages: async records => { storedImages = clone(records); },
  };
  const incoming = backup({
    projects: [{ id: 'p2', name: '復元する本' }],
    formatGuideStates: [{ projectId: 'p2', value: { sharedText: '復元本文' } }],
    projectRubyDictionaries: [{ projectId: 'p2', value: { 復元語: 'ふくげんご' } }],
    images: [image('img-import')],
  });

  const result = await importDataBackup(incoming, {
    mode: 'merge', appVersion: '2.0.0', storage, imageStore, now,
  });
  const storedProjects = JSON.parse(storage.getItem(PROJECTS_STORAGE_KEY));

  assert.equal(result.beforeSnapshot.data.projects[0].name, '現在の本');
  assert.equal(result.beforeSnapshot.data.images[0].id, 'img-current');
  assert.equal(result.counts.projects, 2);
  assert.deepEqual(storedProjects.map(project => project.id), ['p1', 'p2']);
  assert.equal(storage.getItem(SELECTED_PROJECT_STORAGE_KEY), 'p2');
  assert.equal(JSON.parse(storage.getItem('format_guide_state_p2')).sharedText, '復元本文');
  assert.equal(
    JSON.parse(storage.getItem(`${PROJECT_RUBY_DICTIONARY_STORAGE_PREFIX}p2`)).復元語,
    'ふくげんご',
  );
  assert.deepEqual(storedImages.map(record => record.id), ['img-current', 'img-import']);
});

test('画像書込みに失敗したらlocalStorageと画像を復元前へロールバックする', async () => {
  const originalProjectsRaw = JSON.stringify([{ id: 'p1', name: '現在の本', future_field: 'そのまま戻す' }]);
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: originalProjectsRaw,
    format_guide_state_p1: JSON.stringify({ sharedText: '現在本文' }),
  });
  let storedImages = [image('img-current')];
  let replaceCalls = 0;
  const imageStore = {
    listLocalImages: async () => clone(storedImages),
    replaceLocalImages: async records => {
      replaceCalls += 1;
      if (replaceCalls === 1) throw new Error('quota error');
      storedImages = clone(records);
    },
  };
  const incoming = backup({ projects: [{ id: 'p2', name: '復元する本' }], images: [image('img-import')] });

  await assert.rejects(
    importDataBackup(incoming, { storage, imageStore, now }),
    error => error instanceof BackupImportError && error.rollbackSucceeded === true,
  );
  assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), originalProjectsRaw);
  assert.equal(JSON.parse(storage.getItem('format_guide_state_p1')).sharedText, '現在本文');
  assert.deepEqual(storedImages.map(record => record.id), ['img-current']);
});

test('localStorage書込みに失敗しても途中状態を残さない', async () => {
  const originalProjectsRaw = JSON.stringify([{ id: 'p1', name: '現在の本' }]);
  const originalRubyRaw = JSON.stringify({ 現在: 'げんざい' });
  class FailOnceStorage extends MemoryStorage {
    setItem(key, value) {
      if (key === RUBY_DICTIONARY_STORAGE_KEY && !this.failedOnce) {
        this.failedOnce = true;
        throw new Error('quota error');
      }
      super.setItem(key, value);
    }
  }
  const storage = new FailOnceStorage({
    [PROJECTS_STORAGE_KEY]: originalProjectsRaw,
    [RUBY_DICTIONARY_STORAGE_KEY]: originalRubyRaw,
  });
  let imageReplaceCalls = 0;
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => { imageReplaceCalls += 1; },
  };
  const incoming = backup({
    projects: [{ id: 'p2', name: '復元する本' }],
    rubyCustomDict: { 復元: 'ふくげん' },
  });

  await assert.rejects(
    importDataBackup(incoming, { storage, imageStore, now }),
    error => error instanceof BackupImportError && error.rollbackSucceeded === true,
  );
  assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), originalProjectsRaw);
  assert.equal(storage.getItem(RUBY_DICTIONARY_STORAGE_KEY), originalRubyRaw);
  assert.equal(storage.getItem(SELECTED_PROJECT_STORAGE_KEY), null);
  assert.equal(imageReplaceCalls, 1, 'ロールバック時の画像復元だけが呼ばれる');
});

test('replaceでは現在だけにある許可済みデータを削除する', async () => {
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{ id: 'p1', name: '現在の本' }]),
    [SELECTED_PROJECT_STORAGE_KEY]: 'p1',
    format_guide_state_p1: JSON.stringify({ sharedText: '削除対象' }),
    [RUBY_DICTIONARY_STORAGE_KEY]: JSON.stringify({ 現在: 'げんざい' }),
    [`${PROJECT_RUBY_DICTIONARY_STORAGE_PREFIX}p1`]: JSON.stringify({ 現在語: 'げんざいご' }),
    kindle_navi_ai_settings: JSON.stringify({ apiKey: 'touch-no-secret' }),
  });
  let storedImages = [image('img-current')];
  const imageStore = {
    listLocalImages: async () => clone(storedImages),
    replaceLocalImages: async records => { storedImages = clone(records); },
  };
  const incoming = backup({
    projects: [{ id: 'p2', name: '置換後の本' }],
    images: [image('img-import')],
  });

  await importDataBackup(incoming, { mode: 'replace', storage, imageStore, now });

  assert.deepEqual(JSON.parse(storage.getItem(PROJECTS_STORAGE_KEY)).map(project => project.id), ['p2']);
  assert.equal(storage.getItem(SELECTED_PROJECT_STORAGE_KEY), 'p2');
  assert.equal(storage.getItem('format_guide_state_p1'), null);
  assert.equal(storage.getItem(RUBY_DICTIONARY_STORAGE_KEY), null);
  assert.equal(storage.getItem(`${PROJECT_RUBY_DICTIONARY_STORAGE_PREFIX}p1`), null);
  assert.equal(JSON.parse(storage.getItem('kindle_navi_ai_settings')).apiKey, 'touch-no-secret');
  assert.deepEqual(storedImages.map(record => record.id), ['img-import']);
});
