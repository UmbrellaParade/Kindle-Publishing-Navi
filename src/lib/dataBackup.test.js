import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BackupImportError,
  BackupRecoveryRequiredError,
  BackupValidationError,
  buildDataRestorePlan,
  createDataBackup,
  createDataBackupBundle,
  importDataBackup,
  parseDataBackup,
  PROJECTS_STORAGE_KEY,
  PROJECT_RUBY_DICTIONARY_STORAGE_PREFIX,
  RUBY_DICTIONARY_STORAGE_KEY,
  SELECTED_PROJECT_STORAGE_KEY,
  serializeDataBackup,
  serializeCritiqueRecovery,
  validateDataBackup,
} from './dataBackup.js';
import { readCritiqueHistory, serializeCritiqueHistory } from './critiqueHistory.js';

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

function critiqueEntry(id, overrides = {}) {
  return {
    id,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    reviewedAt: FIXED_DATE,
    manuscriptLabel: `draft-${id}`,
    summary: `review-${id}`,
    ...overrides,
  };
}

function critiqueHistory(entries) {
  return serializeCritiqueHistory(entries);
}

function critiqueContext(overrides = {}) {
  return JSON.stringify({
    version: 1,
    updatedAt: FIXED_DATE,
    targetReader: '初めてKindle出版する人',
    coreMessage: '出版工程を迷わず進める方法',
    readerOutcome: '自分で出版準備を完了できる',
    plannedPrice: '500円を検討',
    publicationPurpose: '教材を実践へつなぐ',
    manuscriptCheck: {
      manuscriptLabel: '第3稿',
      expectedFinalChapterTitle: 'おわりに',
      expectedLastSentence: 'あなたの一冊を届けてください。',
      status: 'matched',
      checkedAt: FIXED_DATE,
    },
    ...overrides,
  });
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
      critique_context: critiqueContext(),
      provisional_release_date: '2026-09-14',
      schedule_calculated_for: '2026-09-14',
      schedule_date_source: 'provisional',
      post_publication_notes: 'オーディオブック化と続編を検討',
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
  assert.equal(JSON.parse(result.data.projects[0].critique_context).plannedPrice, '500円を検討');
  assert.equal(result.data.projects[0].post_publication_notes, 'オーディオブック化と続編を検討');
  assert.equal(result.data.projects[0].provisional_release_date, '2026-09-14');
  assert.equal(result.data.projects[0].schedule_date_source, 'provisional');
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
    () => validateDataBackup(backup({ projects: [{ id: 'p1', name: '本', provisional_release_date: '2026-02-30' }] })),
    error => error instanceof BackupValidationError
      && error.path === 'backup.data.projects[0].provisional_release_date',
  );
  assert.throws(
    () => validateDataBackup(backup({ projects: [{ id: 'p1', name: '本', schedule_date_source: 'unknown' }] })),
    error => error instanceof BackupValidationError
      && error.path === 'backup.data.projects[0].schedule_date_source',
  );
  assert.throws(
    () => validateDataBackup(backup({ projects: [{ id: 'p1', name: '本', schedule_date_source: 'provisional' }] })),
    error => error instanceof BackupValidationError
      && error.path === 'backup.data.projects[0].schedule_calculated_for',
  );
  assert.throws(
    () => validateDataBackup(backup({ images: [{ ...image('img1'), dataUrl: 'https://example.com/a.png' }] })),
    BackupValidationError,
  );
  assert.throws(
    () => validateDataBackup(backup({
      projects: [{ id: 'p1', name: '本', critique_context: '{broken-context' }],
    })),
    error => error instanceof BackupValidationError
      && error.path === 'backup.data.projects[0].critique_context',
  );
  assert.throws(
    () => validateDataBackup(backup({
      projects: [{
        id: 'p1',
        name: '本',
        critique_context: JSON.stringify({ version: 999, updatedAt: FIXED_DATE }),
      }],
    })),
    error => error instanceof BackupValidationError
      && error.path === 'backup.data.projects[0].critique_context',
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
        critique_context: critiqueContext({ publicationPurpose: '現在の目的' }),
        post_publication_notes: '現在の出版後メモ',
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
  assert.equal(JSON.parse(p1.critique_context).publicationPurpose, '現在の目的');
  assert.equal(p1.post_publication_notes, '現在の出版後メモ');
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

test('本の前提はバックアップのmerge・replace・旧版互換で保持される', async () => {
  const currentRaw = critiqueContext({ publicationPurpose: '現在の出版目的' });
  const incomingRaw = critiqueContext({
    updatedAt: '2026-08-04T00:00:00.000Z',
    publicationPurpose: '復元した出版目的',
  });
  const oldBackup = backup({ projects: [{ id: 'p1', name: '旧版の本' }] });
  const current = backup({
    projects: [{ id: 'p1', name: '現在の本', critique_context: currentRaw }],
  });

  const mergedWithOld = buildDataRestorePlan(current, oldBackup, 'merge');
  assert.equal(mergedWithOld.projects[0].critique_context, currentRaw);
  const mergedWithBlank = buildDataRestorePlan(
    current,
    backup({ projects: [{ id: 'p1', name: '空欄の旧版', critique_context: '' }] }),
    'merge',
  );
  const mergedWithNull = buildDataRestorePlan(
    current,
    backup({ projects: [{ id: 'p1', name: 'nullの旧版', critique_context: null }] }),
    'merge',
  );
  assert.equal(mergedWithBlank.projects[0].critique_context, currentRaw);
  assert.equal(mergedWithNull.projects[0].critique_context, currentRaw);

  const incoming = backup({
    projects: [{ id: 'p1', name: '復元後の本', critique_context: incomingRaw }],
  });
  const merged = buildDataRestorePlan(current, incoming, 'merge');
  assert.equal(merged.projects[0].critique_context, incomingRaw);

  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{ id: 'old', name: '置換前の本', critique_context: currentRaw }]),
  });
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => {},
  };
  await importDataBackup(incoming, {
    mode: 'replace', storage, imageStore, now,
  });
  const roundTrip = await createDataBackup({ storage, imageStore, now });
  assert.equal(roundTrip.data.projects[0].critique_context, incomingRaw);
});

test('仮リリース日はバックアップのmerge・replace・旧版互換で保持される', async () => {
  const current = backup({
    projects: [{
      id: 'p1',
      name: '現在の本',
      provisional_release_date: '2026-09-14',
      schedule_calculated_for: '2026-09-14',
      schedule_date_source: 'provisional',
    }],
  });
  const oldBackup = backup({ projects: [{ id: 'p1', name: '旧版の本' }] });
  const mergedWithOld = buildDataRestorePlan(current, oldBackup, 'merge');
  assert.equal(mergedWithOld.projects[0].provisional_release_date, '2026-09-14');
  assert.equal(mergedWithOld.projects[0].schedule_date_source, 'provisional');

  const incoming = backup({
    projects: [{
      id: 'p1',
      name: '復元する本',
      provisional_release_date: '2026-10-31',
      schedule_calculated_for: '2026-10-31',
      schedule_date_source: 'release_target',
    }],
  });
  const merged = buildDataRestorePlan(current, incoming, 'merge');
  assert.equal(merged.projects[0].provisional_release_date, '2026-10-31');
  assert.equal(merged.projects[0].schedule_date_source, 'release_target');

  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify(current.data.projects),
  });
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => {},
  };
  await importDataBackup(incoming, { mode: 'replace', storage, imageStore, now });
  const roundTrip = await createDataBackup({ storage, imageStore, now });
  assert.equal(roundTrip.data.projects[0].provisional_release_date, '2026-10-31');
  assert.equal(roundTrip.data.projects[0].schedule_date_source, 'release_target');
});

test('旧バックアップの正式日程をmergeすると仮日由来の印だけを残さない', () => {
  const current = backup({
    projects: [{
      id: 'p1',
      name: '現在の本',
      provisional_release_date: '2026-09-14',
      schedule_calculated_for: '2026-09-14',
      schedule_date_source: 'provisional',
      schedule_generated_at: '2026-08-14T00:00:00.000Z',
      checklist_data: JSON.stringify({
        _data: { t01: { due_date: '2026-07-20', due_date_source: 'auto' } },
        _schedule_calculated_for: '2026-09-14',
        _schedule_date_source: 'provisional',
      }),
    }],
  });
  const legacyOfficial = backup({
    projects: [{
      id: 'p1',
      name: '旧版の正式日程',
      release_target_date: '2026-10-14',
      schedule_calculated_for: '2026-10-14',
      checklist_data: JSON.stringify({
        _data: { t01: { due_date: '2026-08-19', due_date_source: 'auto' } },
        _schedule_calculated_for: '2026-10-14',
      }),
    }],
  });

  const merged = buildDataRestorePlan(current, legacyOfficial, 'merge').projects[0];
  assert.equal(merged.schedule_calculated_for, '2026-10-14');
  assert.equal(merged.schedule_date_source, 'release_target');
  assert.equal(merged.schedule_generated_at, '');
  assert.equal(JSON.parse(merged.checklist_data)._data.t01.due_date, '2026-08-19');

  const legacyReset = backup({
    projects: [{ id: 'p1', name: '旧版のリセット済み本', schedule_calculated_for: '' }],
  });
  const resetMerged = buildDataRestorePlan(current, legacyReset, 'merge').projects[0];
  assert.equal(resetMerged.schedule_calculated_for, '');
  assert.equal(resetMerged.schedule_date_source, '');
  assert.equal(resetMerged.schedule_generated_at, '');

  const beforeScheduleFeature = backup({
    projects: [{
      id: 'p1',
      name: '逆算機能導入前の本',
      checklist_data: JSON.stringify({ t01: { due_date: '', note: '旧チェックリスト' } }),
    }],
  });
  const mergedWithoutSchedule = buildDataRestorePlan(current, beforeScheduleFeature, 'merge').projects[0];
  assert.equal(mergedWithoutSchedule.schedule_calculated_for, '');
  assert.equal(mergedWithoutSchedule.schedule_date_source, '');
  assert.equal(mergedWithoutSchedule.schedule_generated_at, '');
  assert.equal(JSON.parse(mergedWithoutSchedule.checklist_data).t01.note, '旧チェックリスト');

  const downgradedProvisional = backup({
    projects: [{
      id: 'p1',
      name: '旧版で再書き出した本',
      schedule_calculated_for: '2026-09-14',
      checklist_data: JSON.stringify({
        _data: { t01: { due_date: '2026-07-20', due_date_source: 'auto' } },
        _schedule_calculated_for: '2026-09-14',
        _schedule_date_source: 'provisional',
        _schedule_generated_at: '2026-08-14T01:00:00.000Z',
      }),
    }],
  });
  const downgradedMerged = buildDataRestorePlan(current, downgradedProvisional, 'merge').projects[0];
  assert.equal(downgradedMerged.schedule_calculated_for, '2026-09-14');
  assert.equal(downgradedMerged.schedule_date_source, 'provisional');
  assert.equal(downgradedMerged.schedule_generated_at, '2026-08-14T01:00:00.000Z');
});

test('旧版で再書き出した仮日程はreplaceでもchecklistから逆算元を復元する', async () => {
  const downgradedProvisional = backup({
    projects: [{
      id: 'p1',
      name: '旧版で再書き出した本',
      provisional_release_date: '2026-09-14',
      schedule_calculated_for: '2026-09-14',
      checklist_data: JSON.stringify({
        _data: { t01: { due_date: '2026-07-20', due_date_source: 'auto' } },
        _schedule_calculated_for: '2026-09-14',
        _schedule_date_source: 'provisional',
        _schedule_generated_at: '2026-08-14T01:00:00.000Z',
      }),
    }],
  });

  const validated = validateDataBackup(downgradedProvisional).data.projects[0];
  assert.equal(validated.schedule_calculated_for, '2026-09-14');
  assert.equal(validated.schedule_date_source, 'provisional');
  assert.equal(validated.schedule_generated_at, '2026-08-14T01:00:00.000Z');

  const current = backup({ projects: [{ id: 'old', name: '置換前の本' }] });
  const replaced = buildDataRestorePlan(current, downgradedProvisional, 'replace').projects[0];
  assert.equal(replaced.schedule_calculated_for, '2026-09-14');
  assert.equal(replaced.schedule_date_source, 'provisional');
  assert.equal(replaced.schedule_generated_at, '2026-08-14T01:00:00.000Z');

  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify(current.data.projects),
  });
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => {},
  };
  await importDataBackup(downgradedProvisional, { mode: 'replace', storage, imageStore, now });
  const roundTrip = await createDataBackup({ storage, imageStore, now });
  assert.equal(roundTrip.data.projects[0].schedule_calculated_for, '2026-09-14');
  assert.equal(roundTrip.data.projects[0].schedule_date_source, 'provisional');
  assert.equal(roundTrip.data.projects[0].schedule_generated_at, '2026-08-14T01:00:00.000Z');
});

test('checklistからの逆算元復元は旧正式日と明示リセットを誤分類しない', () => {
  const legacyOfficial = backup({
    projects: [{
      id: 'p1',
      name: '仮日機能より前の正式日程',
      release_target_date: '2026-10-14',
      schedule_calculated_for: '2026-10-14',
      checklist_data: JSON.stringify({
        _data: {},
        _schedule_calculated_for: '2026-10-14',
      }),
    }],
  });
  const legacyReplaced = buildDataRestorePlan(
    backup({ projects: [{ id: 'old', name: '置換前の本' }] }),
    legacyOfficial,
    'replace',
  ).projects[0];
  assert.equal(legacyReplaced.schedule_calculated_for, '2026-10-14');
  assert.equal(legacyReplaced.schedule_date_source, undefined);

  const explicitlyReset = validateDataBackup(backup({
    projects: [{
      id: 'p1',
      name: '明示リセット済みの本',
      schedule_calculated_for: '',
      schedule_date_source: '',
      schedule_generated_at: '',
      checklist_data: JSON.stringify({
        _data: {},
        _schedule_calculated_for: '2026-09-14',
        _schedule_date_source: 'provisional',
        _schedule_generated_at: '2026-08-14T01:00:00.000Z',
      }),
    }],
  })).data.projects[0];
  assert.equal(explicitlyReset.schedule_calculated_for, '');
  assert.equal(explicitlyReset.schedule_date_source, '');
  assert.equal(explicitlyReset.schedule_generated_at, '');

  const staleChecklist = validateDataBackup(backup({
    projects: [{
      id: 'p1',
      name: '食い違う旧メタデータの本',
      schedule_calculated_for: '2026-10-14',
      checklist_data: JSON.stringify({
        _data: {},
        _schedule_calculated_for: '2026-09-14',
        _schedule_date_source: 'provisional',
      }),
    }],
  })).data.projects[0];
  assert.equal(staleChecklist.schedule_calculated_for, '2026-10-14');
  assert.equal(staleChecklist.schedule_date_source, undefined);
});

test('読み込めない本の前提は通常バックアップから分離し、正常データで復旧できる', async () => {
  const corruptRaw = '{broken-context';
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{
      id: 'p1', name: '現在の本', critique_context: corruptRaw,
    }]),
  });
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => {},
  };
  const bundle = await createDataBackupBundle({ storage, imageStore, now });
  const exported = bundle.backup;
  assert.equal(Object.hasOwn(exported.data.projects[0], 'critique_context'), false);
  assert.doesNotThrow(() => parseDataBackup(serializeDataBackup(exported)));
  assert.equal(bundle.critiqueRecovery.entries[0].field, 'critique_context');
  assert.equal(bundle.critiqueRecovery.entries[0].raw, corruptRaw);
  await assert.rejects(
    createDataBackup({ storage, imageStore, now }),
    error => error instanceof BackupRecoveryRequiredError
      && error.critiqueRecovery?.entries[0].raw === corruptRaw,
  );

  const validRaw = critiqueContext({ publicationPurpose: '復旧後の目的' });
  const repaired = buildDataRestorePlan(
    exported,
    backup({ projects: [{ id: 'p1', name: '復旧する本', critique_context: validRaw }] }),
    'merge',
  );
  assert.equal(repaired.projects[0].critique_context, validRaw);

  await importDataBackup(
    backup({ projects: [{ id: 'p1', name: '復旧する本', critique_context: validRaw }] }),
    {
      mode: 'merge',
      storage,
      imageStore,
      now,
      beforeApply: ({ beforeCritiqueRecovery }) => {
        assert.equal(beforeCritiqueRecovery.entries[0].field, 'critique_context');
        assert.equal(beforeCritiqueRecovery.entries[0].raw, corruptRaw);
        return { critiqueRecoverySaved: true };
      },
    },
  );
  const storedProject = JSON.parse(storage.getItem(PROJECTS_STORAGE_KEY))[0];
  assert.equal(storedProject.critique_context, validRaw);
});

test('空白文字だけの論評履歴と本の前提も原文を復旧用JSONへ分離する', async () => {
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{
      id: 'p1',
      name: '空白データの本',
      critique_history: '  \r\n ',
      critique_context: '   ',
    }]),
  });
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => {},
  };

  const bundle = await createDataBackupBundle({ storage, imageStore, now });
  const safeProject = bundle.backup.data.projects[0];
  const recoveryByField = new Map(
    bundle.critiqueRecovery.entries.map(entry => [entry.field, entry.raw]),
  );

  assert.doesNotThrow(() => parseDataBackup(serializeDataBackup(bundle.backup)));
  assert.equal(Object.hasOwn(safeProject, 'critique_history'), false);
  assert.equal(Object.hasOwn(safeProject, 'critique_context'), false);
  assert.equal(recoveryByField.get('critique_history'), '  \r\n ');
  assert.equal(recoveryByField.get('critique_context'), '   ');
});

test('壊れた・将来版の本の前提はimportの書込み前に拒否する', async () => {
  const originalProjectsRaw = JSON.stringify([{ id: 'current', name: '現在の本' }]);
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: originalProjectsRaw,
  });
  let imageWrites = 0;
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => { imageWrites += 1; },
  };
  const invalidContexts = [
    '{broken-context',
    JSON.stringify({ version: 999, updatedAt: FIXED_DATE }),
  ];

  for (const critique_context of invalidContexts) {
    const incoming = backup({
      projects: [{ id: 'p1', name: '読み込まない本', critique_context }],
    });

    assert.throws(
      () => buildDataRestorePlan(backup(), incoming, 'merge'),
      error => error instanceof BackupValidationError
        && error.path === 'backup.data.projects[0].critique_context',
    );
    await assert.rejects(
      importDataBackup(incoming, { mode: 'merge', storage, imageStore, now }),
      error => error instanceof BackupValidationError
        && error.path === 'backup.data.projects[0].critique_context',
    );
    assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), originalProjectsRaw);
    assert.equal(imageWrites, 0);
  }
});

test('出版後の展開メモはバックアップのmerge・replace・旧版互換で保持される', async () => {
  const oldBackup = backup({ projects: [{ id: 'p1', name: '旧版の本' }] });
  assert.equal(
    validateDataBackup(oldBackup).data.projects[0].post_publication_notes,
    undefined,
  );

  const current = backup({
    projects: [{
      id: 'p1',
      name: '現在の本',
      post_publication_notes: '読者の声を集めて続編へ反映',
    }],
  });
  const mergedWithOld = buildDataRestorePlan(current, oldBackup, 'merge');
  assert.equal(
    mergedWithOld.projects[0].post_publication_notes,
    '読者の声を集めて続編へ反映',
  );

  const incoming = backup({
    projects: [{
      id: 'p1',
      name: '復元後の本',
      post_publication_notes: '紙書籍・音声・講座へ展開',
    }],
  });
  const merged = buildDataRestorePlan(current, incoming, 'merge');
  assert.equal(merged.projects[0].post_publication_notes, '紙書籍・音声・講座へ展開');

  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{ id: 'old', name: '置換前の本' }]),
  });
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => {},
  };
  await importDataBackup(incoming, {
    mode: 'replace', storage, imageStore, now,
  });
  const roundTrip = await createDataBackup({ storage, imageStore, now });
  assert.equal(
    roundTrip.data.projects[0].post_publication_notes,
    '紙書籍・音声・講座へ展開',
  );
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

test('辛口論評履歴を正規化して書き出し、旧バックアップも引き続き検証できる', async () => {
  const rawHistory = JSON.stringify({
    version: 1,
    entries: [{
      ...critiqueEntry('critique-1'),
      unknown_nested_field: 'drop-me',
    }],
    unknown_envelope_field: 'drop-me-too',
  });
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{
      id: 'p1',
      name: '監査対象',
      critique_history: rawHistory,
    }]),
  });
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => {},
  };

  const exported = await createDataBackup({ storage, imageStore, now });
  const parsedHistory = readCritiqueHistory(exported.data.projects[0].critique_history);

  assert.equal(parsedHistory.error, null);
  assert.equal(parsedHistory.entries.length, 1);
  assert.equal(parsedHistory.entries[0].id, 'critique-1');
  assert.equal(parsedHistory.entries[0].summary, 'review-critique-1');
  assert.equal(Object.hasOwn(parsedHistory.entries[0], 'unknown_nested_field'), false);
  assert.doesNotMatch(exported.data.projects[0].critique_history, /unknown_envelope_field/);

  const oldBackup = backup({ projects: [{ id: 'old', name: '旧版の本' }] });
  assert.equal(validateDataBackup(oldBackup).data.projects[0].critique_history, undefined);
});

test('壊れた辛口論評履歴と未対応の将来バージョンを復元前に拒否する', () => {
  assert.throws(
    () => validateDataBackup(backup({
      projects: [{ id: 'p1', name: '本', critique_history: '{broken' }],
    })),
    BackupValidationError,
  );
  assert.throws(
    () => validateDataBackup(backup({
      projects: [{
        id: 'p1',
        name: '本',
        critique_history: JSON.stringify({ version: 999, entries: [] }),
      }],
    })),
    BackupValidationError,
  );
});

test('mergeでは辛口論評履歴をID単位で結合し、同じIDは入力側を優先する', () => {
  const current = backup({
    projects: [{
      id: 'p1',
      name: '現在の本',
      critique_history: critiqueHistory([
        critiqueEntry('keep-current'),
        critiqueEntry('shared', { summary: '現在の総評' }),
      ]),
    }],
  });
  const incoming = backup({
    projects: [{
      id: 'p1',
      name: '復元後の本',
      critique_history: critiqueHistory([
        critiqueEntry('shared', { summary: '入力側の総評' }),
        critiqueEntry('add-incoming'),
      ]),
    }],
  });

  const plan = buildDataRestorePlan(current, incoming, 'merge');
  const parsed = readCritiqueHistory(plan.projects[0].critique_history);

  assert.equal(parsed.error, null);
  assert.deepEqual(
    new Set(parsed.entries.map(entry => entry.id)),
    new Set(['keep-current', 'shared', 'add-incoming']),
  );
  assert.equal(
    parsed.entries.find(entry => entry.id === 'shared').summary,
    '入力側の総評',
  );
});

test('旧v1バックアップの同一論評をmergeしても現在の前提スナップショットと4分類を保つ', () => {
  const current = backup({
    projects: [{
      id: 'p1',
      name: '現在の本',
      critique_history: critiqueHistory([critiqueEntry('shared-v1', {
        summary: '現在の総評',
        briefSnapshot: { targetReader: '現在の対象読者' },
        findingCategories: { mustFix: '現在の必須修正' },
      })]),
    }],
  });
  const incomingV1History = JSON.stringify({
    version: 1,
    entries: [critiqueEntry('shared-v1', { summary: '旧バックアップの総評' })],
  });
  const incoming = backup({
    projects: [{
      id: 'p1',
      name: '復元後の本',
      critique_history: incomingV1History,
    }],
  });

  const plan = buildDataRestorePlan(current, incoming, 'merge');
  const merged = readCritiqueHistory(plan.projects[0].critique_history).entries[0];

  assert.equal(merged.summary, '旧バックアップの総評');
  assert.equal(merged.briefSnapshot.targetReader, '現在の対象読者');
  assert.equal(merged.findingCategories.mustFix, '現在の必須修正');
});

test('旧バックアップのmergeでは現在の辛口論評履歴を失わない', () => {
  const current = backup({
    projects: [{
      id: 'p1',
      name: '現在の本',
      critique_history: critiqueHistory([critiqueEntry('keep-current')]),
    }],
  });
  const incoming = backup({ projects: [{ id: 'p1', name: '旧バックアップの本' }] });

  const plan = buildDataRestorePlan(current, incoming, 'merge');
  const parsed = readCritiqueHistory(plan.projects[0].critique_history);

  assert.equal(parsed.error, null);
  assert.deepEqual(parsed.entries.map(entry => entry.id), ['keep-current']);
});

test('replaceと再書き出しで大きな総評・原稿・KDP情報・画像参照を保つ', async () => {
  const largeOverallReview = '大きな総評。'.repeat(40_000);
  const incomingImage = image('critique-roundtrip-image');
  const incoming = backup({
    projects: [{
      id: 'p2',
      name: '復元する本',
      manuscript: '失ってはいけない原稿本文',
      aplus_image_url: 'local-image:critique-roundtrip-image',
      kdp_meta: JSON.stringify({
        description: '保持するKDP説明',
        aplus: { version: 1, modules: [{ images: [{ image_url: 'local-image:critique-roundtrip-image' }] }] },
      }),
      critique_history: critiqueHistory([
        critiqueEntry('large-review', { summary: largeOverallReview }),
      ]),
    }],
    images: [incomingImage],
  });
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{ id: 'p1', name: '置換前の本' }]),
    [SELECTED_PROJECT_STORAGE_KEY]: 'p1',
  });
  let storedImages = [image('old-image')];
  const imageStore = {
    listLocalImages: async () => clone(storedImages),
    replaceLocalImages: async records => { storedImages = clone(records); },
  };

  await importDataBackup(incoming, {
    mode: 'replace', storage, imageStore, now, appVersion: '2.0.0',
  });
  const roundTrip = await createDataBackup({ storage, imageStore, now, appVersion: '2.0.0' });
  const restoredProject = roundTrip.data.projects[0];
  const parsed = readCritiqueHistory(restoredProject.critique_history);

  assert.equal(roundTrip.schemaVersion, 1);
  assert.equal(restoredProject.id, 'p2');
  assert.equal(restoredProject.manuscript, '失ってはいけない原稿本文');
  assert.equal(restoredProject.aplus_image_url, 'local-image:critique-roundtrip-image');
  assert.equal(JSON.parse(restoredProject.kdp_meta).description, '保持するKDP説明');
  assert.equal(
    JSON.parse(restoredProject.kdp_meta).aplus.modules[0].images[0].image_url,
    'local-image:critique-roundtrip-image',
  );
  assert.equal(parsed.error, null);
  assert.equal(parsed.entries[0].summary, largeOverallReview);
  assert.deepEqual(roundTrip.data.images.map(record => record.id), ['critique-roundtrip-image']);
});

test('壊れた辛口論評履歴を通常バックアップから分離し、原文を復旧用JSONへ完全保持する', async () => {
  const corruptRaw = ' {\r\n  "version": 999,\r\n  "entries": [{"memo":"消さない"}]\r\n} ';
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{
      id: 'p1',
      name: '復旧対象の本',
      manuscript: '有効な原稿本文',
      critique_history: corruptRaw,
    }]),
    [SELECTED_PROJECT_STORAGE_KEY]: 'p1',
  });
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => {},
  };

  const bundle = await createDataBackupBundle({
    appVersion: '2.0.0', storage, imageStore, now,
  });
  const safeProject = bundle.backup.data.projects[0];

  assert.equal(validateDataBackup(bundle.backup).data.projects[0].manuscript, '有効な原稿本文');
  assert.equal(Object.hasOwn(safeProject, 'critique_history'), false);
  assert.equal(bundle.critiqueRecovery.entries.length, 1);
  assert.equal(bundle.critiqueRecovery.entries[0].projectId, 'p1');
  assert.equal(bundle.critiqueRecovery.entries[0].projectName, '復旧対象の本');
  assert.equal(bundle.critiqueRecovery.entries[0].field, 'critique_history');
  assert.match(bundle.critiqueRecovery.entries[0].error, /バージョン999/);
  assert.equal(bundle.critiqueRecovery.entries[0].raw, corruptRaw);
  assert.equal(
    JSON.parse(serializeCritiqueRecovery(bundle.critiqueRecovery)).entries[0].raw,
    corruptRaw,
  );

  await assert.rejects(
    createDataBackup({ appVersion: '2.0.0', storage, imageStore, now }),
    error => error instanceof BackupRecoveryRequiredError
      && error.critiqueRecovery?.entries[0].raw === corruptRaw,
  );

  const targetStorage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{ id: 'old', name: '置換前' }]),
  });
  await importDataBackup(bundle.backup, {
    mode: 'replace', storage: targetStorage, imageStore, now,
  });
  const restoredProject = JSON.parse(targetStorage.getItem(PROJECTS_STORAGE_KEY))[0];
  assert.equal(restoredProject.id, 'p1');
  assert.equal(restoredProject.manuscript, '有効な原稿本文');
  assert.equal(Object.hasOwn(restoredProject, 'critique_history'), false);
});

test('mergeは未修復の壊れた原文を保ち、入力側に有効な履歴がある時だけ修復する', async () => {
  const corruptRaw = '{ "version": 999, "entries": [], "future": "そのまま" }';
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => {},
  };
  const storageWithoutRepair = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{
      id: 'p1', name: '現在の本', critique_history: corruptRaw,
    }]),
  });

  const preservedResult = await importDataBackup(backup({
    projects: [{ id: 'p1', name: '旧バックアップからの更新', manuscript: '更新原稿' }],
  }), {
    mode: 'merge', storage: storageWithoutRepair, imageStore, now,
  });
  const preservedProject = JSON.parse(storageWithoutRepair.getItem(PROJECTS_STORAGE_KEY))[0];

  assert.equal(preservedProject.critique_history, corruptRaw);
  assert.equal(preservedProject.manuscript, '更新原稿');
  assert.equal(preservedResult.beforeCritiqueRecovery.entries[0].raw, corruptRaw);

  const storageWithRepair = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{
      id: 'p1', name: '現在の本', critique_history: corruptRaw,
    }]),
  });
  let repairImageWrites = 0;
  let repairPreflightCalled = false;
  const repairImageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => { repairImageWrites += 1; },
  };
  const validIncomingHistory = critiqueHistory([critiqueEntry('repaired')]);
  const repairedResult = await importDataBackup(backup({
    projects: [{
      id: 'p1',
      name: '修復済みの本',
      critique_history: validIncomingHistory,
    }],
  }), {
    mode: 'merge',
    storage: storageWithRepair,
    imageStore: repairImageStore,
    now,
    beforeApply: ({ beforeCritiqueRecovery, critiqueRepairProjectIds }) => {
      repairPreflightCalled = true;
      assert.equal(
        JSON.parse(storageWithRepair.getItem(PROJECTS_STORAGE_KEY))[0].critique_history,
        corruptRaw,
      );
      assert.equal(repairImageWrites, 0);
      assert.equal(beforeCritiqueRecovery.entries[0].raw, corruptRaw);
      assert.deepEqual(critiqueRepairProjectIds, ['p1']);
      return { critiqueRecoverySaved: true };
    },
  });
  const repairedProject = JSON.parse(storageWithRepair.getItem(PROJECTS_STORAGE_KEY))[0];
  const repairedHistory = readCritiqueHistory(repairedProject.critique_history);

  assert.equal(repairedResult.beforeCritiqueRecovery.entries[0].raw, corruptRaw);
  assert.equal(repairPreflightCalled, true);
  assert.equal(repairImageWrites, 1);
  assert.equal(repairedHistory.error, null);
  assert.deepEqual(repairedHistory.entries.map(entry => entry.id), ['repaired']);
  assert.notEqual(repairedProject.critique_history, corruptRaw);
});

test('壊れた履歴を修復するmergeは適用前保存なしでは停止し、現在データへ触れない', async () => {
  const corruptRaw = '{"version":999,"entries":[]}';
  const originalProjectsRaw = JSON.stringify([{
    id: 'p1', name: '現在の本', critique_history: corruptRaw,
  }]);
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: originalProjectsRaw,
  });
  let imageWrites = 0;
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => { imageWrites += 1; },
  };
  const incoming = backup({
    projects: [{
      id: 'p1',
      name: '修復する本',
      critique_history: critiqueHistory([critiqueEntry('repair-required')]),
    }],
  });

  await assert.rejects(
    importDataBackup(incoming, { mode: 'merge', storage, imageStore, now }),
    error => error instanceof BackupImportError
      && error.preflightFailed === true
      && error.writeStarted === false
      && error.beforeCritiqueRecovery?.entries[0].raw === corruptRaw,
  );
  assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), originalProjectsRaw);
  assert.equal(imageWrites, 0);

  await assert.rejects(
    importDataBackup(incoming, {
      mode: 'merge',
      storage,
      imageStore,
      now,
      beforeApply: () => ({ critiqueRecoverySaved: false }),
    }),
    error => error instanceof BackupImportError
      && error.preflightFailed === true
      && error.writeStarted === false,
  );
  assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), originalProjectsRaw);
  assert.equal(imageWrites, 0);
});

test('merge適用前の復旧用JSON保存に失敗したらlocalStorageと画像を一切変更しない', async () => {
  const corruptRaw = '{broken-history\r\n原文';
  const originalProjectsRaw = JSON.stringify([{
    id: 'p1',
    name: '現在の本',
    manuscript: '変更前原稿',
    critique_history: corruptRaw,
  }]);
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: originalProjectsRaw,
    untouched_key: '変更しない',
  });
  let imageWrites = 0;
  const imageStore = {
    listLocalImages: async () => [image('current-image')],
    replaceLocalImages: async () => { imageWrites += 1; },
  };
  const incoming = backup({
    projects: [{
      id: 'p1',
      name: '修復する本',
      manuscript: '変更後原稿',
      critique_history: critiqueHistory([critiqueEntry('repair-after-save')]),
    }],
    images: [image('incoming-image')],
  });
  let callbackObservedRaw = '';

  await assert.rejects(
    importDataBackup(incoming, {
      mode: 'merge',
      storage,
      imageStore,
      now,
      beforeApply: ({ beforeCritiqueRecovery }) => {
        callbackObservedRaw = beforeCritiqueRecovery.entries[0].raw;
        throw new Error('download blocked');
      },
    }),
    error => error instanceof BackupImportError
      && error.preflightFailed === true
      && error.writeStarted === false
      && error.rollbackSucceeded === true,
  );

  assert.equal(callbackObservedRaw, corruptRaw);
  assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), originalProjectsRaw);
  assert.equal(storage.getItem('untouched_key'), '変更しない');
  assert.equal(imageWrites, 0);
});

test('現在の論評履歴が壊れていても、正常バックアップから全置換復元できる', async () => {
  const corruptRaw = '{"version":999,"entries":[],"raw":"保持"}';
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{
      id: 'broken-current',
      name: '壊れた現行データ',
      manuscript: '復元前原稿',
      critique_history: corruptRaw,
    }]),
    [SELECTED_PROJECT_STORAGE_KEY]: 'broken-current',
  });
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => {},
  };
  const incoming = backup({
    projects: [{ id: 'restored', name: '正常バックアップ', manuscript: '復元後原稿' }],
    selectedProjectId: 'restored',
  });

  const result = await importDataBackup(incoming, {
    mode: 'replace',
    storage,
    imageStore,
    now,
    beforeApply: ({ beforeCritiqueRecovery }) => {
      assert.equal(beforeCritiqueRecovery.entries[0].raw, corruptRaw);
      return { critiqueRecoverySaved: true };
    },
  });
  const restoredProjects = JSON.parse(storage.getItem(PROJECTS_STORAGE_KEY));

  assert.deepEqual(restoredProjects.map(project => project.id), ['restored']);
  assert.equal(restoredProjects[0].manuscript, '復元後原稿');
  assert.equal(result.beforeCritiqueRecovery.entries[0].raw, corruptRaw);
  assert.equal(Object.hasOwn(result.beforeSnapshot.data.projects[0], 'critique_history'), false);
});

test('復元失敗時は壊れた辛口論評原文を含むlocalStorageを完全に戻し、呼出元へ復旧情報を返す', async () => {
  const corruptRaw = '{not-json\r\n元の文字列を維持する';
  const originalProjectsRaw = JSON.stringify([{
    id: 'p1',
    name: '現在の本',
    manuscript: '現在の原稿',
    critique_history: corruptRaw,
    future_field: '未知の項目も含む元保存値',
  }]);
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: originalProjectsRaw,
  });
  let storedImages = [image('current-image')];
  let replaceCalls = 0;
  const imageStore = {
    listLocalImages: async () => clone(storedImages),
    replaceLocalImages: async (records) => {
      replaceCalls += 1;
      if (replaceCalls === 1) throw new Error('quota error');
      storedImages = clone(records);
    },
  };
  const incoming = backup({
    projects: [{ id: 'p2', name: '追加する本' }],
    images: [image('incoming-image')],
  });

  let caught;
  try {
    await importDataBackup(incoming, { mode: 'merge', storage, imageStore, now });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof BackupImportError);
  assert.equal(caught.rollbackSucceeded, true);
  assert.equal(caught.beforeCritiqueRecovery.entries[0].raw, corruptRaw);
  assert.equal(Object.hasOwn(caught.beforeSnapshot.data.projects[0], 'critique_history'), false);
  assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), originalProjectsRaw);
  assert.deepEqual(storedImages.map(record => record.id), ['current-image']);
});
