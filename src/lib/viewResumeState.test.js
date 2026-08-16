import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRestoredScrollY,
  createDefaultViewResumeState,
  createViewScrollPosition,
  getProjectCollapsedOutlineCardKeys,
  getProjectCritiqueSection,
  getProjectPlanningSection,
  getSavedViewScroll,
  hasExplicitViewUrl,
  LEGACY_SELECTED_PROJECT_STORAGE_KEY,
  persistViewResumeState,
  readExplicitViewUrl,
  readViewResumeState,
  reconcileViewResumeProjects,
  rememberViewResumeState,
  resolveViewResumeState,
  VIEW_RESUME_STORAGE_KEY,
} from './viewResumeState.js';

const MAIN_TABS = ['manual', 'brainSkills', 'creation', 'notes', 'kdp', 'critique'];

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    values,
  };
}

test('保存値なし・壊れたJSON・未知versionは既定状態へ安全に戻す', () => {
  assert.deepEqual(readViewResumeState(createStorage()), createDefaultViewResumeState());
  assert.deepEqual(
    readViewResumeState(createStorage({ [VIEW_RESUME_STORAGE_KEY]: '{broken' })),
    createDefaultViewResumeState(),
  );
  assert.deepEqual(
    readViewResumeState(createStorage({
      [VIEW_RESUME_STORAGE_KEY]: JSON.stringify({ version: 999, mainTab: 'notes' }),
    })),
    createDefaultViewResumeState(),
  );
});

test('旧プロジェクト選択キーは一度だけ新しいローカルUI状態へ移し、旧キーを残さない', () => {
  const storage = createStorage({ [LEGACY_SELECTED_PROJECT_STORAGE_KEY]: 'project-b' });
  const state = readViewResumeState(storage);
  assert.equal(state.selectedProjectId, 'project-b');
  assert.equal(persistViewResumeState(state, storage), true);
  assert.equal(storage.getItem(LEGACY_SELECTED_PROJECT_STORAGE_KEY), null);
  assert.equal(JSON.parse(storage.getItem(VIEW_RESUME_STORAGE_KEY)).selectedProjectId, 'project-b');
});

test('プロジェクト別の内部タブと画面別スクロール位置を混同しない', () => {
  let state = rememberViewResumeState(createDefaultViewResumeState(), {
    selectedProjectId: 'project-b',
    mainTab: 'notes',
    projectId: 'project-a',
    planningSection: 'concept',
    scrollMainTab: 'notes',
    scrollPlanningSection: 'concept',
    scrollPosition: { contentY: 420 },
  });
  state = rememberViewResumeState(state, {
    projectId: 'project-b',
    planningSection: 'competitors',
    scrollMainTab: 'notes',
    scrollPlanningSection: 'competitors',
    scrollPosition: { contentY: 1320 },
  });
  state = rememberViewResumeState(state, {
    projectId: 'project-b',
    scrollMainTab: 'kdp',
    scrollPosition: { contentY: 640 },
  });

  assert.equal(getProjectPlanningSection(state, 'project-a'), 'concept');
  assert.equal(getProjectPlanningSection(state, 'project-b'), 'competitors');
  assert.deepEqual(getSavedViewScroll(state, 'project-a', 'notes', 'concept'), { contentY: 420 });
  assert.deepEqual(getSavedViewScroll(state, 'project-b', 'notes', 'competitors'), { contentY: 1320 });
  assert.deepEqual(getSavedViewScroll(state, 'project-b', 'kdp'), { contentY: 640 });
  assert.equal(getSavedViewScroll(state, 'project-a', 'notes', 'competitors'), null);
});

test('サポートGPT管理を企画ノートの安全な再開位置として保持する', () => {
  const state = rememberViewResumeState(createDefaultViewResumeState(), {
    selectedProjectId: 'project-gpt',
    mainTab: 'notes',
    projectId: 'project-gpt',
    planningSection: 'gptSessions',
    scrollMainTab: 'notes',
    scrollPlanningSection: 'gptSessions',
    scrollPosition: { contentY: 880 },
  });

  assert.equal(getProjectPlanningSection(state, 'project-gpt'), 'gptSessions');
  assert.deepEqual(getSavedViewScroll(state, 'project-gpt', 'notes', 'gptSessions'), { contentY: 880 });
  const restored = resolveViewResumeState(state, [{ id: 'project-gpt' }], { validMainTabs: MAIN_TABS });
  assert.equal(restored.planningSection, 'gptSessions');
  assert.deepEqual(restored.scrollPosition, { contentY: 880 });
});

test('辛口論評GPT管理をプロジェクト別の安全な再開位置として保持する', () => {
  const state = rememberViewResumeState(createDefaultViewResumeState(), {
    selectedProjectId: 'project-critique',
    mainTab: 'critique',
    projectId: 'project-critique',
    critiqueSection: 'gptSessions',
    scrollMainTab: 'critique',
    scrollCritiqueSection: 'gptSessions',
    scrollPosition: { contentY: 960 },
  });

  assert.equal(getProjectCritiqueSection(state, 'project-critique'), 'gptSessions');
  assert.deepEqual(
    getSavedViewScroll(state, 'project-critique', 'critique', 'overview', 'gptSessions'),
    { contentY: 960 },
  );
  const restored = resolveViewResumeState(state, [{ id: 'project-critique' }], {
    validMainTabs: MAIN_TABS,
  });
  assert.equal(restored.mainTab, 'critique');
  assert.equal(restored.critiqueSection, 'gptSessions');
  assert.deepEqual(restored.scrollPosition, { contentY: 960 });
});

test('目次カードの折りたたみはプロジェクト別に保存し、旧状態は全展開として扱う', () => {
  let state = rememberViewResumeState(createDefaultViewResumeState(), {
    projectId: 'project-a',
    collapsedOutlineCardKeys: ['draft:chapter-a', 'confirmed:snapshot-a:chapter-a'],
  });
  state = rememberViewResumeState(state, {
    projectId: 'project-b',
    collapsedOutlineCardKeys: ['draft:chapter-b'],
  });

  assert.deepEqual(getProjectCollapsedOutlineCardKeys(state, 'project-a'), [
    'draft:chapter-a',
    'confirmed:snapshot-a:chapter-a',
  ]);
  assert.deepEqual(getProjectCollapsedOutlineCardKeys(state, 'project-b'), ['draft:chapter-b']);
  assert.deepEqual(getProjectCollapsedOutlineCardKeys({
    version: 1,
    selectedProjectId: 'project-a',
    mainTab: 'notes',
    projectViews: [{
      projectId: 'project-a',
      planningSection: 'chapters',
      scrollPositions: {},
    }],
  }, 'project-a'), []);
});

test('壊れた・重複した・過剰な折りたたみキーを安全に正規化する', () => {
  const rawKeys = [
    '__proto__',
    'draft:chapter-a',
    'draft:chapter-a',
    '空白を含むキー',
    ...Array.from({ length: 1005 }, (_, index) => `draft:chapter-${index}`),
  ];
  const state = rememberViewResumeState(createDefaultViewResumeState(), {
    projectId: 'project-a',
    collapsedOutlineCardKeys: rawKeys,
  });
  const keys = getProjectCollapsedOutlineCardKeys(state, 'project-a');

  assert.equal(keys.length, 1000);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.includes('__proto__'), false);
  assert.equal(keys.includes('空白を含むキー'), false);
  assert.equal(keys.at(-1), 'draft:chapter-1004');
});

test('有効な前回位置を復元し、削除済みproject・不正tabは安全な既定画面へ戻す', () => {
  const projects = [{ id: 'project-a' }, { id: 'project-b' }];
  const saved = rememberViewResumeState(createDefaultViewResumeState(), {
    selectedProjectId: 'project-b',
    mainTab: 'notes',
    projectId: 'project-b',
    planningSection: 'competitors',
    scrollMainTab: 'notes',
    scrollPlanningSection: 'competitors',
    scrollPosition: { contentY: 1300 },
  });
  const restored = resolveViewResumeState(saved, projects, { validMainTabs: MAIN_TABS });
  assert.equal(restored.project.id, 'project-b');
  assert.equal(restored.mainTab, 'notes');
  assert.equal(restored.planningSection, 'competitors');
  assert.deepEqual(restored.scrollPosition, { contentY: 1300 });
  assert.equal(restored.resumed, true);

  const afterDelete = resolveViewResumeState(saved, [{ id: 'project-a' }], { validMainTabs: MAIN_TABS });
  assert.equal(afterDelete.project.id, 'project-a');
  assert.equal(afterDelete.mainTab, 'creation');
  assert.equal(afterDelete.planningSection, 'overview');
  assert.equal(afterDelete.scrollPosition, null);
  assert.equal(afterDelete.resumed, false);

  const invalidTab = resolveViewResumeState(
    { ...saved, mainTab: 'deleted-tab' },
    projects,
    { validMainTabs: MAIN_TABS },
  );
  assert.equal(invalidTab.mainTab, 'creation');

  const noProjects = resolveViewResumeState(saved, [], { validMainTabs: MAIN_TABS });
  assert.equal(noProjects.project, null);
  assert.equal(noProjects.mainTab, 'manual');
  assert.equal(noProjects.scrollPosition, null);

  const publicGuideWithoutProjects = resolveViewResumeState(
    { ...createDefaultViewResumeState(), mainTab: 'brainSkills' },
    [],
    { validMainTabs: MAIN_TABS },
  );
  assert.equal(publicGuideWithoutProjects.mainTab, 'brainSkills');
});

test('Brain＆スキル化をプロジェクトがある通常起動でも前回のメインタブとして復元する', () => {
  const state = rememberViewResumeState(createDefaultViewResumeState(), {
    selectedProjectId: 'project-brain',
    mainTab: 'brainSkills',
    projectId: 'project-brain',
  });
  const restored = resolveViewResumeState(state, [{ id: 'project-brain' }], {
    validMainTabs: MAIN_TABS,
  });

  assert.equal(restored.project.id, 'project-brain');
  assert.equal(restored.mainTab, 'brainSkills');
  assert.equal(restored.resumed, true);
});

test('明示URLはローカル復元より優先し、通常起動だけを復元対象にする', () => {
  assert.equal(hasExplicitViewUrl({ search: '?tab=notes', hash: '' }), true);
  assert.equal(hasExplicitViewUrl({ search: '?access_token=secret', hash: '' }), false);
  assert.equal(hasExplicitViewUrl({ search: '', hash: '#notes/competitors' }), true);
  assert.equal(hasExplicitViewUrl({ search: '', hash: '#brainSkills' }), true);
  assert.equal(readExplicitViewUrl({ search: '?tab=brainSkills', hash: '' }).mainTab, 'brainSkills');
  assert.equal(resolveViewResumeState(createDefaultViewResumeState(), [], {
    validMainTabs: MAIN_TABS,
    explicitNavigation: readExplicitViewUrl({ search: '?tab=brainSkills', hash: '' }),
  }).mainTab, 'brainSkills');
  assert.equal(readExplicitViewUrl({ search: '?tab=notes&section=gptSessions', hash: '' }).planningSection, 'gptSessions');
  assert.equal(hasExplicitViewUrl({ search: '', hash: '#market-research' }), false);
  assert.equal(hasExplicitViewUrl({ search: '', hash: '#kindle-navi-manual-section-1' }), false);
  assert.equal(
    readExplicitViewUrl({ search: '', hash: '#first-steps-heading' }).manualAnchor,
    'first-steps-heading',
  );
  assert.equal(hasExplicitViewUrl({ search: '', hash: '' }), false);
  assert.deepEqual(
    readExplicitViewUrl({
      search: '?projectId=project-b&tab=notes&section=competitors',
      hash: '',
    }),
    {
      hasExplicitNavigation: true,
      projectId: 'project-b',
      mainTab: 'notes',
      planningSection: 'competitors',
      critiqueSection: '',
      manualAnchor: '',
    },
  );

  const manualAnchor = readExplicitViewUrl({
    search: '',
    hash: '#kindle-navi-manual-section-1',
  });
  assert.deepEqual(manualAnchor, {
    hasExplicitNavigation: false,
    projectId: '',
    mainTab: '',
    planningSection: '',
    critiqueSection: '',
    manualAnchor: 'kindle-navi-manual-section-1',
  });

  const saved = rememberViewResumeState(createDefaultViewResumeState(), {
    selectedProjectId: 'project-b',
    mainTab: 'notes',
    projectId: 'project-b',
    planningSection: 'competitors',
  });
  const manualResolved = resolveViewResumeState(
    saved,
    [{ id: 'project-a' }, { id: 'project-b' }],
    {
      validMainTabs: MAIN_TABS,
      explicitNavigation: manualAnchor,
    },
  );
  assert.equal(manualResolved.project.id, 'project-b');
  assert.equal(manualResolved.mainTab, 'manual');
  assert.equal(manualResolved.planningSection, 'competitors');
  assert.equal(manualResolved.scrollPosition, null);
  assert.equal(manualResolved.resumed, false);

  const resolved = resolveViewResumeState(saved, [{ id: 'project-a' }, { id: 'project-b' }], {
    validMainTabs: MAIN_TABS,
    explicitNavigation: readExplicitViewUrl({
      search: '?projectId=project-b&tab=notes&section=competitors',
      hash: '',
    }),
  });
  assert.equal(resolved.project.id, 'project-b');
  assert.equal(resolved.mainTab, 'notes');
  assert.equal(resolved.planningSection, 'competitors');
  assert.equal(resolved.scrollPosition, null);
  assert.equal(resolved.resumed, false);

  const tabOnly = resolveViewResumeState(saved, [{ id: 'project-a' }, { id: 'project-b' }], {
    validMainTabs: MAIN_TABS,
    explicitNavigation: readExplicitViewUrl({ search: '?tab=kdp', hash: '' }),
  });
  assert.equal(tabOnly.project.id, 'project-b');
  assert.equal(tabOnly.mainTab, 'kdp');
  assert.equal(tabOnly.planningSection, 'competitors');
  assert.equal(tabOnly.scrollPosition, null);

  const critiqueView = readExplicitViewUrl({
    search: '?projectId=project-b&tab=critique&section=gptSessions',
    hash: '',
  });
  assert.equal(critiqueView.mainTab, 'critique');
  assert.equal(critiqueView.critiqueSection, 'gptSessions');
  assert.equal(critiqueView.planningSection, '');
  assert.equal(hasExplicitViewUrl({ search: '', hash: '#critique/gptSessions' }), true);
});

test('storage反映後に選択中projectが消えたら代替projectを新規作成の既定画面で開く', () => {
  let before = rememberViewResumeState(createDefaultViewResumeState(), {
    projectId: 'fallback',
    planningSection: 'concept',
    scrollMainTab: 'notes',
    scrollPlanningSection: 'concept',
    scrollPosition: { contentY: 480 },
  });
  before = rememberViewResumeState(before, {
    selectedProjectId: 'deleted',
    mainTab: 'notes',
    projectId: 'deleted',
    planningSection: 'competitors',
    scrollMainTab: 'notes',
    scrollPlanningSection: 'competitors',
    scrollPosition: { contentY: 2100 },
  });
  const reconciled = reconcileViewResumeProjects(before, ['fallback']);
  const after = rememberViewResumeState(reconciled, {
    selectedProjectId: 'fallback',
    mainTab: 'creation',
    projectId: 'fallback',
    planningSection: 'overview',
  });

  assert.equal(after.selectedProjectId, 'fallback');
  assert.equal(after.mainTab, 'creation');
  assert.equal(getProjectPlanningSection(after, 'fallback'), 'overview');
  assert.equal(getSavedViewScroll(after, 'fallback', 'notes', 'competitors'), null);
  assert.deepEqual(getSavedViewScroll(after, 'fallback', 'notes', 'concept'), { contentY: 480 });
  assert.equal(getProjectPlanningSection(after, 'deleted'), 'overview');
  assert.equal(JSON.stringify(after).includes('deleted'), false);
});

test('追従メニュー込みの可視座標を、現在の高さと文書末尾で補正する', () => {
  const position = createViewScrollPosition(1000, 120);
  assert.deepEqual(position, { contentY: 1120 });
  assert.equal(calculateRestoredScrollY(position, {
    stickyOffset: 180,
    scrollHeight: 5000,
    viewportHeight: 800,
  }), 940);
  assert.equal(calculateRestoredScrollY({ contentY: 9999 }, {
    stickyOffset: 120,
    scrollHeight: 1600,
    viewportHeight: 800,
  }), 800);
});

test('削除済みprojectの閲覧状態を整理し、draftやmodal等の未許可値は保存しない', () => {
  const state = rememberViewResumeState({
    version: 1,
    selectedProjectId: 'deleted',
    mainTab: 'notes',
    projectViews: [
      { projectId: 'deleted', planningSection: 'competitors', scrollPositions: {} },
      { projectId: 'kept', planningSection: 'concept', scrollPositions: {} },
    ],
  }, {
    projectId: 'kept',
    planningSection: 'concept',
    editor: { draft: '未保存本文' },
    modal: 'delete-confirmation',
  });
  const reconciled = reconcileViewResumeProjects(state, ['kept']);
  const serialized = JSON.stringify(reconciled);
  assert.equal(reconciled.selectedProjectId, null);
  assert.deepEqual(reconciled.projectViews.map(view => view.projectId), ['kept']);
  assert.doesNotMatch(serialized, /未保存本文|editor|draft|modal|delete-confirmation/);
});
