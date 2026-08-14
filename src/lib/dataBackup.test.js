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
  previewDataBackupPlanningNotesConflicts,
  PROJECTS_STORAGE_KEY,
  PROJECT_RUBY_DICTIONARY_STORAGE_PREFIX,
  RUBY_DICTIONARY_STORAGE_KEY,
  SELECTED_PROJECT_STORAGE_KEY,
  serializeDataBackup,
  serializeCritiqueRecovery,
  validateDataBackup,
} from './dataBackup.js';
import { readCritiqueHistory, serializeCritiqueHistory } from './critiqueHistory.js';
import {
  assignDecisionCanonical,
  assignInstructionCanonical,
  createEmptyPlanningNotes,
  createPlanningOutlineSnapshot,
  createPlanningRecord,
  getConfirmedPlanningOutline,
  PlanningNotesMergeConflictError,
  readPlanningNotes,
  savePlanningMarketSummary,
  serializePlanningNotes,
  upsertPlanningRecord,
} from './planningNotes.js';

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

function planningNotesDecision(id, decision, overrides = {}) {
  const notes = createEmptyPlanningNotes();
  const record = createPlanningRecord('decisions', {
    decision,
    reason: '判断理由',
    decidedBy: '著者',
    ...overrides,
  }, {
    now,
    idFactory: () => id,
  });
  return serializePlanningNotes({
    ...notes,
    updatedAt: FIXED_DATE,
    decisions: [record],
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

test('企画・取材・構成ノートを厳格に正規化してバックアップし、旧バックアップも受け入れる', async () => {
  const planningRaw = planningNotesDecision('decision-1', '対象読者を初心者へ絞る');
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{
      id: 'p1',
      name: '企画ノートの本',
      planning_notes: planningRaw,
      provisional_release_date: '2026-09-14',
      release_method: 'immediate',
    }]),
  });
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => {},
  };

  const exported = await createDataBackup({ storage, imageStore, now });
  const restoredNotes = readPlanningNotes(exported.data.projects[0].planning_notes);

  assert.equal(restoredNotes.error, null);
  assert.equal(restoredNotes.data.decisions[0].decision, '対象読者を初心者へ絞る');
  assert.equal(exported.data.projects[0].provisional_release_date, '2026-09-14');
  assert.equal(exported.data.projects[0].release_method, 'immediate');
  assert.doesNotThrow(() => parseDataBackup(serializeDataBackup(exported)));
  assert.equal(
    validateDataBackup(backup({ projects: [{ id: 'legacy', name: '旧バックアップ' }] }))
      .data.projects[0].planning_notes,
    undefined,
  );

  const invalidValues = [
    '{broken-planning-notes',
    JSON.stringify({ ...JSON.parse(planningRaw), version: 999 }),
    JSON.stringify({ ...JSON.parse(planningRaw), unexpected: '未対応' }),
  ];
  for (const planning_notes of invalidValues) {
    assert.throws(
      () => validateDataBackup(backup({
        projects: [{ id: 'p1', name: '不正ノート', planning_notes }],
      })),
      error => error instanceof BackupValidationError
        && error.path === 'backup.data.projects[0].planning_notes',
    );
  }

  const emptyPlanning = createEmptyPlanningNotes();
  const oversizedPlanning = serializePlanningNotes({
    ...emptyPlanning,
    concept: {
      ...emptyPlanning.concept,
      targetReader: 'a'.repeat(450_000),
      readerProblems: 'b'.repeat(450_000),
      bookPromise: 'c'.repeat(450_000),
      theme: 'd'.repeat(450_000),
      uniqueness: 'e'.repeat(450_000),
    },
  });
  assert.throws(
    () => validateDataBackup(backup({
      projects: [{ id: 'p1', name: '容量超過ノート', planning_notes: oversizedPlanning }],
    })),
    error => error instanceof BackupValidationError
      && error.path === 'backup.data.projects[0].planning_notes'
      && /約2MB/.test(error.message),
  );
});

test('企画ノートv4の市場サマリー・正本・意思決定参照をバックアップと結合復元で保つ', async () => {
  let notes = createEmptyPlanningNotes();
  const add = (section, record) => {
    notes = upsertPlanningRecord(notes, section, record, { expectedUpdatedAt: null, now });
  };
  const part = createPlanningRecord('chapters', {
    id: 'part-backup',
    nodeType: 'part',
    parentId: '',
    order: 0,
    title: '第一部',
  }, { now, idFactory: () => 'part-backup' });
  add('chapters', part);
  add('chapters', createPlanningRecord('chapters', {
    id: 'episode-backup',
    nodeType: 'episode',
    parentId: part.id,
    order: 0,
    title: '第一話',
  }, { now, idFactory: () => 'episode-backup' }));
  const competitor = createPlanningRecord('competitors', {
    bookTitle: '確認済み競合',
    url: 'https://example.com/competitor',
    checkedOn: '2026-08-03',
    assessmentStatus: 'verified',
    claimKind: 'hypothesis',
    recheckStatus: 'checked',
  }, { now, idFactory: () => 'competitor-v2' });
  add('competitors', competitor);
  const instructionIds = ['instruction-v2', 'document-v2'];
  let instructionIndex = 0;
  const instruction = createPlanningRecord('instructionVersions', {
    name: '正本指示書',
    role: 'writing',
    audience: 'shared',
  }, { now, idFactory: () => instructionIds[instructionIndex++] });
  add('instructionVersions', instruction);
  const decision = createPlanningRecord('decisions', { decision: '現在の判断' }, {
    now,
    idFactory: () => 'decision-v2',
  });
  add('decisions', decision);
  notes = savePlanningMarketSummary(notes, {
    versionId: 'MARKET-BACKUP',
    sourceName: 'market-research-summary.md',
    reviewedOn: '2026-08-03',
    status: 'needs_confirmation',
    readerNeeds: '迷いを一緒に考えたい',
    readerNeedsEvidenceIds: ['competitor-v2', 'MKT-BACKUP'],
    publicSources: [{
      id: 'MKT-BACKUP',
      label: '公開出典',
      url: 'https://example.com/source',
      checkedOn: '2026-08-03',
      purpose: '確認',
      verificationStatus: 'verified',
    }],
  }, { expectedUpdatedAt: '', now });
  notes = assignInstructionCanonical(notes, instruction.id, 'codex', { now });
  notes = assignInstructionCanonical(notes, instruction.id, 'author', { now });
  notes = assignDecisionCanonical(notes, decision.id, { now });
  notes = createPlanningOutlineSnapshot(notes, { kind: 'draft', label: 'バックアップする仮目次' }, {
    expectedOutlineRevision: notes.outlineRevision,
    expectedChapterOrderRevision: notes.chapterOrderRevision,
    now,
    idFactory: () => 'outline-backup-draft',
  });
  notes = createPlanningOutlineSnapshot(notes, { kind: 'confirmed', label: 'バックアップする確定目次' }, {
    expectedOutlineRevision: notes.outlineRevision,
    expectedChapterOrderRevision: notes.chapterOrderRevision,
    now,
    idFactory: () => 'outline-backup-confirmed',
  });

  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([{
      id: 'p1',
      name: 'v2企画ノートの本',
      planning_notes: serializePlanningNotes(notes),
    }]),
  });
  const imageStore = { listLocalImages: async () => [], replaceLocalImages: async () => {} };
  const exported = await createDataBackup({ storage, imageStore, now });
  const restored = readPlanningNotes(exported.data.projects[0].planning_notes).data;
  assert.equal(restored.version, 4);
  assert.equal(restored.chapters.find(record => record.id === 'episode-backup').parentId, 'part-backup');
  assert.equal(restored.marketSummary.versionId, 'MARKET-BACKUP');
  assert.deepEqual(restored.instructionVersions[0].canonicalFor, ['codex', 'author']);
  assert.equal(restored.decisions[0].isCanonical, true);
  assert.equal(restored.outlineSnapshots.length, 2);
  assert.equal(getConfirmedPlanningOutline(restored).id, 'outline-backup-confirmed');
  assert.equal(
    restored.outlineSnapshots.find(snapshot => snapshot.id === 'outline-backup-draft')
      .chapters.find(record => record.id === 'episode-backup').title,
    '第一話',
  );

  const merged = buildDataRestorePlan(
    backup({ projects: [{ id: 'p1', name: 'v2企画ノートの本' }] }),
    exported,
    'merge',
  );
  const mergedNotes = readPlanningNotes(merged.projects[0].planning_notes).data;
  assert.equal(mergedNotes.marketSummary.publicSources[0].verificationStatus, 'verified');
  assert.equal(mergedNotes.chapters.find(record => record.id === 'episode-backup').nodeType, 'episode');
  assert.equal(mergedNotes.instructionVersions[0].firstReadFor.includes('author'), true);
  assert.equal(mergedNotes.decisions[0].decisionState, 'current');
  assert.equal(mergedNotes.confirmedOutlineId, 'outline-backup-confirmed');
  assert.deepEqual(
    mergedNotes.outlineSnapshots.map(snapshot => snapshot.id),
    ['outline-backup-draft', 'outline-backup-confirmed'],
  );

  const replaced = buildDataRestorePlan(
    backup({ projects: [{ id: 'other', name: '置換前だけにある本' }] }),
    exported,
    'replace',
  );
  const replacedNotes = readPlanningNotes(replaced.projects[0].planning_notes).data;
  assert.equal(replacedNotes.confirmedOutlineId, 'outline-backup-confirmed');
  assert.deepEqual(
    replacedNotes.outlineSnapshots.map(snapshot => [snapshot.id, snapshot.kind]),
    [
      ['outline-backup-draft', 'draft'],
      ['outline-backup-confirmed', 'confirmed'],
    ],
  );
  assert.equal(replaced.projects.some(project => project.id === 'other'), false);

  const legacyV3 = clone(notes);
  legacyV3.version = 3;
  delete legacyV3.outlineRevision;
  delete legacyV3.confirmedOutlineId;
  delete legacyV3.outlineSnapshots;
  const normalizedLegacy = validateDataBackup(backup({
    projects: [{ id: 'legacy-v3', name: '旧v3企画ノート', planning_notes: JSON.stringify(legacyV3) }],
  }));
  const migratedLegacy = readPlanningNotes(normalizedLegacy.data.projects[0].planning_notes).data;
  assert.equal(migratedLegacy.version, 4);
  assert.equal(migratedLegacy.confirmedOutlineId, '');
  assert.deepEqual(migratedLegacy.outlineSnapshots, []);
  assert.equal(migratedLegacy.chapters.find(record => record.id === 'episode-backup').parentId, 'part-backup');
});

test('完全バックアップの結合前に目次保存版の同一ID異内容を表示して適用を止める', () => {
  let notes = createEmptyPlanningNotes();
  const chapter = createPlanningRecord('chapters', {
    id: 'outline-conflict-chapter', title: '競合確認の目次', order: 0,
  }, { now, idFactory: () => 'outline-conflict-chapter' });
  notes = upsertPlanningRecord(notes, 'chapters', chapter, { expectedUpdatedAt: null, now });
  notes = createPlanningOutlineSnapshot(notes, { kind: 'draft', label: '共有IDの保存版' }, {
    expectedOutlineRevision: notes.outlineRevision,
    expectedChapterOrderRevision: notes.chapterOrderRevision,
    now,
    idFactory: () => 'outline-shared',
  });
  const conflictingNotes = {
    ...notes,
    outlineSnapshots: notes.outlineSnapshots.map(snapshot => ({
      ...snapshot,
      note: 'バックアップ側だけ異なる変更メモ',
    })),
  };
  const current = backup({ projects: [{
    id: 'p1', name: '現在の本', planning_notes: serializePlanningNotes(notes),
  }] });
  const incoming = backup({ projects: [{
    id: 'p1', name: '入力側の本', planning_notes: serializePlanningNotes(conflictingNotes),
  }] });

  assert.deepEqual(previewDataBackupPlanningNotesConflicts(current, incoming), [{
    projectId: 'p1',
    projectName: '入力側の本',
    section: 'outlineSnapshots',
    id: 'outline-shared',
    reason: 'outline_snapshot_requires_review',
  }]);
  assert.throws(
    () => buildDataRestorePlan(current, incoming, 'merge'),
    error => error instanceof PlanningNotesMergeConflictError
      && error.conflicts.some(conflict => conflict.reason === 'outline_snapshot_requires_review'),
  );
});

test('各入力が容量内でも企画ノートの結合後が約2MBを超える場合は書込み前に停止する', async () => {
  const makeLargePlanningNotes = (prefix, character) => {
    let notes = createEmptyPlanningNotes();
    for (let index = 0; index < 3; index += 1) {
      const id = `${prefix}-${index + 1}`;
      const record = createPlanningRecord('instructionVersions', {
        id,
        documentId: `document-${id}`,
        versionNumber: 1,
        name: `容量確認${id}`,
        markdown: character.repeat(360_000),
      }, { now, idFactory: () => id });
      notes = upsertPlanningRecord(notes, 'instructionVersions', record, {
        expectedUpdatedAt: null,
        now,
      });
    }
    return serializePlanningNotes(notes, { enforceStorageBudget: true });
  };
  const currentRaw = makeLargePlanningNotes('current-large', 'a');
  const incomingRaw = makeLargePlanningNotes('incoming-large', 'b');
  const current = backup({ projects: [{
    id: 'p1', name: '結合前の本', planning_notes: currentRaw,
  }] });
  const incoming = backup({ projects: [{
    id: 'p1', name: '結合後の本', planning_notes: incomingRaw,
  }] });
  assert.doesNotThrow(() => validateDataBackup(current));
  assert.doesNotThrow(() => validateDataBackup(incoming));
  assert.throws(
    () => buildDataRestorePlan(current, incoming, 'merge'),
    /約2MB/,
  );

  const originalProjectsRaw = JSON.stringify(current.data.projects);
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: originalProjectsRaw,
  });
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => {},
  };
  await assert.rejects(
    () => importDataBackup(incoming, { mode: 'merge', storage, imageStore, now }),
    /約2MB/,
  );
  assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), originalProjectsRaw);
});

test('空白だけ・将来版の現在企画ノートも通常バックアップを妨げず原文回収する', async () => {
  const futureRaw = JSON.stringify({ ...createEmptyPlanningNotes(), version: 99 });
  for (const raw of ['   \r\n ', futureRaw]) {
    const storage = new MemoryStorage({
      [PROJECTS_STORAGE_KEY]: JSON.stringify([{ id: 'p1', name: '回収する本', planning_notes: raw }]),
    });
    const bundle = await createDataBackupBundle({
      storage,
      imageStore: {
        listLocalImages: async () => [],
        replaceLocalImages: async () => {},
      },
      now,
    });
    assert.equal(Object.hasOwn(bundle.backup.data.projects[0], 'planning_notes'), false);
    assert.equal(bundle.critiqueRecovery.entries[0].field, 'planning_notes');
    assert.equal(bundle.critiqueRecovery.entries[0].raw, raw);
    assert.doesNotThrow(() => parseDataBackup(serializeDataBackup(bundle.backup)));
  }
});

test('企画ノートはID別に結合し、旧バックアップ・同一内容・全置換を安全に扱う', () => {
  const currentRaw = planningNotesDecision('decision-current', '現在の判断');
  const incomingRaw = planningNotesDecision('decision-incoming', '追加する判断');
  const current = backup({
    projects: [{
      id: 'p1',
      name: '現在の本',
      planning_notes: currentRaw,
      provisional_release_date: '2026-09-14',
      schedule_calculated_for: '2026-09-14',
      schedule_date_source: 'provisional',
    }],
  });

  const merged = buildDataRestorePlan(current, backup({
    projects: [{ id: 'p1', name: '結合後の本', planning_notes: incomingRaw }],
  }), 'merge');
  const mergedNotes = readPlanningNotes(merged.projects[0].planning_notes);
  assert.equal(mergedNotes.error, null);
  assert.deepEqual(
    mergedNotes.data.decisions.map(record => record.id),
    ['decision-current', 'decision-incoming'],
  );
  assert.equal(merged.projects[0].provisional_release_date, '2026-09-14');
  assert.equal(merged.projects[0].schedule_date_source, 'provisional');

  const idempotent = buildDataRestorePlan(current, backup({
    projects: [{ id: 'p1', name: '同一内容', planning_notes: currentRaw }],
  }), 'merge');
  assert.equal(readPlanningNotes(idempotent.projects[0].planning_notes).data.decisions.length, 1);

  const mergedLegacy = buildDataRestorePlan(
    current,
    backup({ projects: [{ id: 'p1', name: '旧バックアップ' }] }),
    'merge',
  );
  assert.equal(mergedLegacy.projects[0].planning_notes, currentRaw);

  const mergedBlank = buildDataRestorePlan(
    current,
    backup({ projects: [{ id: 'p1', name: '空欄を持つ旧バックアップ', planning_notes: '   ' }] }),
    'merge',
  );
  assert.equal(readPlanningNotes(mergedBlank.projects[0].planning_notes).data.decisions.length, 1);

  const replaced = buildDataRestorePlan(current, backup({
    projects: [{ id: 'p1', name: '全置換', planning_notes: incomingRaw }],
  }), 'replace');
  assert.deepEqual(
    readPlanningNotes(replaced.projects[0].planning_notes).data.decisions.map(record => record.id),
    ['decision-incoming'],
  );
});

test('企画ノートの同一ID競合を事前表示し、mergeは書き込み前に停止する', async () => {
  const currentRaw = planningNotesDecision('decision-shared', '現在の承認内容', {
    status: 'approved',
    approvedBy: '著者',
  });
  const incomingRaw = planningNotesDecision('decision-shared', 'バックアップ側の異なる内容', {
    status: 'approved',
    approvedBy: '著者',
  });
  const current = backup({
    projects: [{ id: 'p1', name: '現在の本', planning_notes: currentRaw }],
  });
  const incoming = backup({
    projects: [{ id: 'p1', name: '入力側の本', planning_notes: incomingRaw }],
  });
  const conflicts = previewDataBackupPlanningNotesConflicts(current, incoming);

  assert.deepEqual(conflicts, [{
    projectId: 'p1',
    projectName: '入力側の本',
    section: 'decisions',
    id: 'decision-shared',
    reason: 'same_id_different_content',
  }]);
  assert.throws(
    () => buildDataRestorePlan(current, incoming, 'merge'),
    error => error instanceof PlanningNotesMergeConflictError
      && error.conflicts.length === 1,
  );

  const originalProjectsRaw = JSON.stringify(current.data.projects);
  const storage = new MemoryStorage({ [PROJECTS_STORAGE_KEY]: originalProjectsRaw });
  let imageWrites = 0;
  let beforeApplyCalled = false;
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => { imageWrites += 1; },
  };
  await assert.rejects(
    importDataBackup(incoming, {
      mode: 'merge',
      storage,
      imageStore,
      now,
      beforeApply: () => {
        beforeApplyCalled = true;
        return { critiqueRecoverySaved: true };
      },
    }),
    error => error instanceof PlanningNotesMergeConflictError,
  );
  assert.equal(beforeApplyCalled, false);
  assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), originalProjectsRaw);
  assert.equal(imageWrites, 0);
});

test('壊れた企画ノートは原文を復旧用JSONへ分離し、保存確認後だけmergeで修復する', async () => {
  const corruptRaw = '{broken-planning\r\n消してはいけない原文';
  const initialProject = {
    id: 'p1',
    name: '現在の本',
    planning_notes: corruptRaw,
    manuscript: '修復前原稿',
    provisional_release_date: '2026-09-14',
    release_target_date: '2026-10-14',
    release_method: 'preorder',
    schedule_calculated_for: '2026-09-14',
    schedule_date_source: 'provisional',
    checklist_data: JSON.stringify({ t01: { done: true, note: '残すメモ' } }),
  };
  const storage = new MemoryStorage({
    [PROJECTS_STORAGE_KEY]: JSON.stringify([initialProject]),
  });
  let imageWrites = 0;
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => { imageWrites += 1; },
  };

  const bundle = await createDataBackupBundle({ storage, imageStore, now });
  assert.equal(Object.hasOwn(bundle.backup.data.projects[0], 'planning_notes'), false);
  assert.equal(bundle.critiqueRecovery.entries.length, 1);
  assert.deepEqual(bundle.critiqueRecovery.entries[0], {
    projectId: 'p1',
    projectName: '現在の本',
    field: 'planning_notes',
    error: bundle.critiqueRecovery.entries[0].error,
    raw: corruptRaw,
  });
  assert.match(bundle.critiqueRecovery.entries[0].error, /企画・取材ノート/);
  assert.equal(
    JSON.parse(serializeCritiqueRecovery(bundle.critiqueRecovery)).entries[0].raw,
    corruptRaw,
  );

  await importDataBackup(backup({
    projects: [{ id: 'p1', name: '通常結合', manuscript: '修復後原稿' }],
  }), {
    mode: 'merge', storage, imageStore, now,
  });
  const preserved = JSON.parse(storage.getItem(PROJECTS_STORAGE_KEY))[0];
  assert.equal(preserved.planning_notes, corruptRaw);
  assert.equal(preserved.manuscript, '修復後原稿');
  assert.equal(preserved.provisional_release_date, '2026-09-14');
  assert.equal(preserved.release_target_date, '2026-10-14');
  assert.equal(preserved.release_method, 'preorder');
  assert.equal(preserved.schedule_date_source, 'provisional');
  assert.deepEqual(JSON.parse(preserved.checklist_data).t01, { done: true, note: '残すメモ' });

  const validRaw = planningNotesDecision('decision-repaired', '復旧後の判断');
  const incoming = backup({
    projects: [{ id: 'p1', name: '修復する本', planning_notes: validRaw }],
  });
  const beforeRepairRaw = storage.getItem(PROJECTS_STORAGE_KEY);
  const writesBeforeRepair = imageWrites;
  await assert.rejects(
    importDataBackup(incoming, { mode: 'merge', storage, imageStore, now }),
    error => error instanceof BackupImportError
      && error.preflightFailed === true
      && error.beforeCritiqueRecovery?.entries[0].field === 'planning_notes'
      && error.beforeCritiqueRecovery.entries[0].raw === corruptRaw,
  );
  assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), beforeRepairRaw);
  assert.equal(imageWrites, writesBeforeRepair);

  let recoveryObserved = null;
  await importDataBackup(incoming, {
    mode: 'merge',
    storage,
    imageStore,
    now,
    beforeApply: ({ beforeCritiqueRecovery, critiqueRepairProjectIds }) => {
      recoveryObserved = beforeCritiqueRecovery;
      assert.deepEqual(critiqueRepairProjectIds, ['p1']);
      assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), beforeRepairRaw);
      return { critiqueRecoverySaved: true };
    },
  });
  const repaired = JSON.parse(storage.getItem(PROJECTS_STORAGE_KEY))[0];
  assert.equal(recoveryObserved.entries[0].raw, corruptRaw);
  assert.equal(readPlanningNotes(repaired.planning_notes).error, null);
  assert.equal(
    readPlanningNotes(repaired.planning_notes).data.decisions[0].decision,
    '復旧後の判断',
  );
  assert.equal(repaired.provisional_release_date, '2026-09-14');
  assert.equal(repaired.release_method, 'preorder');
});

test('壊れた企画ノートがある全置換は復旧用JSON保存を必須にし、旧バックアップへ復元できる', async () => {
  const corruptRaw = '{future-planning-notes';
  const originalProjectsRaw = JSON.stringify([{
    id: 'p1', name: '壊れた現在の本', planning_notes: corruptRaw,
  }]);
  const storage = new MemoryStorage({ [PROJECTS_STORAGE_KEY]: originalProjectsRaw });
  const imageStore = {
    listLocalImages: async () => [],
    replaceLocalImages: async () => {},
  };
  const legacyIncoming = backup({
    projects: [{ id: 'legacy', name: '企画ノート機能より前の本' }],
    selectedProjectId: 'legacy',
  });

  await assert.rejects(
    importDataBackup(legacyIncoming, { mode: 'replace', storage, imageStore, now }),
    error => error instanceof BackupImportError
      && error.preflightFailed === true
      && error.beforeCritiqueRecovery?.entries[0].raw === corruptRaw,
  );
  assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), originalProjectsRaw);

  await importDataBackup(legacyIncoming, {
    mode: 'replace',
    storage,
    imageStore,
    now,
    beforeApply: ({ beforeCritiqueRecovery }) => {
      assert.equal(beforeCritiqueRecovery.entries[0].field, 'planning_notes');
      assert.equal(beforeCritiqueRecovery.entries[0].raw, corruptRaw);
      return { critiqueRecoverySaved: true };
    },
  });
  assert.deepEqual(
    JSON.parse(storage.getItem(PROJECTS_STORAGE_KEY)),
    [{ id: 'legacy', name: '企画ノート機能より前の本' }],
  );
});
