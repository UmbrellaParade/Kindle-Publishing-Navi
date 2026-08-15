export const VIEW_RESUME_SCHEMA_VERSION = 1;
export const VIEW_RESUME_STORAGE_KEY = 'kindle_publishing_navi_view_resume_v1';
export const LEGACY_SELECTED_PROJECT_STORAGE_KEY = 'kindle_publishing_navi_selected_project_id';

export const DEFAULT_MAIN_TAB = 'creation';
export const DEFAULT_PLANNING_SECTION = 'overview';
export const PLANNING_VIEW_SECTIONS = Object.freeze([
  'overview',
  'concept',
  'competitors',
  'chapters',
  'interviews',
  'instructionVersions',
  'decisions',
]);

const MAX_PROJECT_VIEWS = 100;
const MAX_SCROLL_POSITIONS_PER_PROJECT = 32;
const MAX_COLLAPSED_OUTLINE_CARDS_PER_PROJECT = 1000;
const MAX_TOKEN_LENGTH = 200;
const MAX_SCROLL_COORDINATE = 100_000_000;
const SAFE_TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const EXPLICIT_VIEW_QUERY_KEYS = Object.freeze([
  'project',
  'project_id',
  'projectId',
  'tab',
  'activeTab',
  'section',
  'planningSection',
  'view',
]);
const EXPLICIT_HASH_MAIN_TABS = new Set([
  'manual',
  'creation',
  'notes',
  'kdp',
  'category',
  'promo',
  'description',
  'aplus',
  'format',
  'formatter',
  'critique',
]);
const MANUAL_ANCHOR_RE = /^(?:kindle-navi-manual(?:-title|-section-[1-9]\d*)?|first-steps-heading|feature-links-heading)$/;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeToken(value) {
  if (typeof value !== 'string') return '';
  const token = value.trim();
  if (
    !token
    || token.length > MAX_TOKEN_LENGTH
    || UNSAFE_OBJECT_KEYS.has(token)
    || !SAFE_TOKEN_RE.test(token)
  ) return '';
  return token;
}

function safeCoordinate(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(Math.min(MAX_SCROLL_COORDINATE, Math.max(0, value)));
}

function normalizeScrollPosition(value) {
  const contentY = safeCoordinate(isPlainObject(value) ? value.contentY : value);
  return contentY === null ? null : { contentY };
}

function normalizeScrollPositions(value) {
  if (!isPlainObject(value)) return {};
  const positions = {};
  for (const [rawKey, rawPosition] of Object.entries(value).slice(-MAX_SCROLL_POSITIONS_PER_PROJECT)) {
    const key = safeToken(rawKey);
    const position = normalizeScrollPosition(rawPosition);
    if (key && position) positions[key] = position;
  }
  return positions;
}

function normalizeCollapsedOutlineCardKeys(value) {
  if (!Array.isArray(value)) return [];
  const keys = [];
  const seen = new Set();
  for (const rawKey of value.slice(-MAX_COLLAPSED_OUTLINE_CARDS_PER_PROJECT)) {
    const key = safeToken(rawKey);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

function normalizeProjectView(value) {
  if (!isPlainObject(value)) return null;
  const projectId = safeToken(value.projectId);
  if (!projectId) return null;
  return {
    projectId,
    planningSection: safeToken(value.planningSection) || DEFAULT_PLANNING_SECTION,
    scrollPositions: normalizeScrollPositions(value.scrollPositions),
    collapsedOutlineCardKeys: normalizeCollapsedOutlineCardKeys(value.collapsedOutlineCardKeys),
  };
}

export function createDefaultViewResumeState() {
  return {
    version: VIEW_RESUME_SCHEMA_VERSION,
    selectedProjectId: null,
    mainTab: DEFAULT_MAIN_TAB,
    projectViews: [],
  };
}

export function normalizePlanningViewSection(value) {
  return PLANNING_VIEW_SECTIONS.includes(value) ? value : DEFAULT_PLANNING_SECTION;
}

export function normalizeViewResumeState(value) {
  if (!isPlainObject(value) || value.version !== VIEW_RESUME_SCHEMA_VERSION) {
    return createDefaultViewResumeState();
  }

  const projectViews = [];
  const seenProjectIds = new Set();
  if (Array.isArray(value.projectViews)) {
    for (const rawView of value.projectViews.slice(-MAX_PROJECT_VIEWS)) {
      const view = normalizeProjectView(rawView);
      if (!view || seenProjectIds.has(view.projectId)) continue;
      seenProjectIds.add(view.projectId);
      projectViews.push(view);
    }
  }

  return {
    version: VIEW_RESUME_SCHEMA_VERSION,
    selectedProjectId: safeToken(value.selectedProjectId) || null,
    mainTab: safeToken(value.mainTab) || DEFAULT_MAIN_TAB,
    projectViews,
  };
}

function getBrowserStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    // 保存領域が使えない場合も既定画面で起動する。
  }
  return null;
}

export function readViewResumeState(storage = getBrowserStorage()) {
  const fallback = createDefaultViewResumeState();
  if (!storage || typeof storage.getItem !== 'function') return fallback;

  try {
    const raw = storage.getItem(VIEW_RESUME_STORAGE_KEY);
    if (raw !== null) return normalizeViewResumeState(JSON.parse(raw));

    // 旧版は選択中プロジェクトだけを別キーへ保存していました。
    // 新形式へ書き込む際に旧キーを削除し、以後バックアップ対象へ混ぜません。
    const legacyProjectId = safeToken(storage.getItem(LEGACY_SELECTED_PROJECT_STORAGE_KEY));
    return legacyProjectId ? { ...fallback, selectedProjectId: legacyProjectId } : fallback;
  } catch {
    return fallback;
  }
}

export function persistViewResumeState(value, storage = getBrowserStorage()) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    const normalized = normalizeViewResumeState(value);
    storage.setItem(VIEW_RESUME_STORAGE_KEY, JSON.stringify(normalized));
    storage.removeItem?.(LEGACY_SELECTED_PROJECT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function createViewKey(mainTab, planningSection = DEFAULT_PLANNING_SECTION) {
  const safeMainTab = safeToken(mainTab) || DEFAULT_MAIN_TAB;
  return safeMainTab === 'notes'
    ? `notes/${normalizePlanningViewSection(planningSection)}`
    : safeMainTab;
}

export function getProjectView(value, projectId) {
  const state = normalizeViewResumeState(value);
  const safeProjectId = safeToken(projectId);
  return state.projectViews.find(view => view.projectId === safeProjectId) || null;
}

export function getProjectPlanningSection(value, projectId) {
  return normalizePlanningViewSection(getProjectView(value, projectId)?.planningSection);
}

export function getProjectCollapsedOutlineCardKeys(value, projectId) {
  return [...(getProjectView(value, projectId)?.collapsedOutlineCardKeys || [])];
}

export function getSavedViewScroll(value, projectId, mainTab, planningSection) {
  const projectView = getProjectView(value, projectId);
  if (!projectView) return null;
  return projectView.scrollPositions[createViewKey(mainTab, planningSection)] || null;
}

export function rememberViewResumeState(value, update = {}) {
  const state = normalizeViewResumeState(value);
  const next = {
    ...state,
    projectViews: state.projectViews.map(view => ({
      ...view,
      scrollPositions: { ...view.scrollPositions },
      collapsedOutlineCardKeys: [...view.collapsedOutlineCardKeys],
    })),
  };

  if (Object.prototype.hasOwnProperty.call(update, 'selectedProjectId')) {
    next.selectedProjectId = safeToken(update.selectedProjectId) || null;
  }
  if (safeToken(update.mainTab)) next.mainTab = safeToken(update.mainTab);

  const projectId = safeToken(update.projectId);
  if (!projectId) return next;

  let projectView = next.projectViews.find(view => view.projectId === projectId);
  if (!projectView) {
    projectView = {
      projectId,
      planningSection: DEFAULT_PLANNING_SECTION,
      scrollPositions: {},
      collapsedOutlineCardKeys: [],
    };
    next.projectViews.push(projectView);
    if (next.projectViews.length > MAX_PROJECT_VIEWS) next.projectViews.shift();
  }

  if (Object.prototype.hasOwnProperty.call(update, 'planningSection')) {
    projectView.planningSection = normalizePlanningViewSection(update.planningSection);
  }

  if (Object.prototype.hasOwnProperty.call(update, 'collapsedOutlineCardKeys')) {
    projectView.collapsedOutlineCardKeys = normalizeCollapsedOutlineCardKeys(
      update.collapsedOutlineCardKeys,
    );
  }

  if (update.scrollPosition) {
    const position = normalizeScrollPosition(update.scrollPosition);
    if (position) {
      const key = createViewKey(update.scrollMainTab || next.mainTab, update.scrollPlanningSection);
      delete projectView.scrollPositions[key];
      projectView.scrollPositions[key] = position;
      const keys = Object.keys(projectView.scrollPositions);
      for (const staleKey of keys.slice(0, -MAX_SCROLL_POSITIONS_PER_PROJECT)) {
        delete projectView.scrollPositions[staleKey];
      }
    }
  }

  return next;
}

export function reconcileViewResumeProjects(value, projectIds) {
  const state = normalizeViewResumeState(value);
  const validIds = new Set((projectIds || []).map(safeToken).filter(Boolean));
  return {
    ...state,
    selectedProjectId: validIds.has(state.selectedProjectId) ? state.selectedProjectId : null,
    projectViews: state.projectViews.filter(view => validIds.has(view.projectId)),
  };
}

export function createViewScrollPosition(scrollY, stickyOffset = 0) {
  const safeScrollY = safeCoordinate(scrollY) || 0;
  const safeStickyOffset = safeCoordinate(stickyOffset) || 0;
  return {
    contentY: safeCoordinate(safeScrollY + safeStickyOffset) || 0,
  };
}

export function calculateRestoredScrollY(position, {
  stickyOffset = 0,
  scrollHeight = 0,
  viewportHeight = 0,
} = {}) {
  const normalized = normalizeScrollPosition(position);
  if (!normalized) return 0;
  const safeStickyOffset = safeCoordinate(stickyOffset) || 0;
  const safeScrollHeight = safeCoordinate(scrollHeight) || 0;
  const safeViewportHeight = safeCoordinate(viewportHeight) || 0;
  const maximum = Math.max(0, safeScrollHeight - safeViewportHeight);
  return Math.min(maximum, Math.max(0, normalized.contentY - safeStickyOffset));
}

function firstParam(params, keys) {
  for (const key of keys) {
    const value = safeToken(params.get(key));
    if (value) return value;
  }
  return '';
}

export function readExplicitViewUrl(locationLike) {
  const none = {
    hasExplicitNavigation: false,
    projectId: '',
    mainTab: '',
    planningSection: '',
    manualAnchor: '',
  };
  if (!locationLike) return none;
  try {
    const searchParams = new URLSearchParams(locationLike.search || '');
    const rawHash = typeof locationLike.hash === 'string'
      ? locationLike.hash.replace(/^#\??/, '')
      : '';
    const hashParams = rawHash.includes('=') ? new URLSearchParams(rawHash) : new URLSearchParams();
    const hashSegments = rawHash && !rawHash.includes('=')
      ? rawHash.replace(/^\//, '').split('/').map(safeToken).filter(Boolean)
      : [];
    const hasQueryView = EXPLICIT_VIEW_QUERY_KEYS.some(key => searchParams.has(key));
    const projectId = firstParam(searchParams, ['projectId', 'project_id', 'project'])
      || firstParam(hashParams, ['projectId', 'project_id', 'project']);
    const planningSection = firstParam(searchParams, ['planningSection', 'section'])
      || firstParam(hashParams, ['planningSection', 'section'])
      || hashSegments[1]
      || '';
    const mainTab = firstParam(searchParams, ['activeTab', 'tab', 'view'])
      || firstParam(hashParams, ['activeTab', 'tab', 'view'])
      || hashSegments[0]
      || (planningSection ? 'notes' : '');
    const hasHashProject = ['projectId', 'project_id', 'project']
      .some(key => hashParams.has(key) && Boolean(firstParam(hashParams, [key])));
    const hasKnownHashParams = rawHash.includes('=') && (
      hasHashProject
      || EXPLICIT_HASH_MAIN_TABS.has(mainTab)
      || PLANNING_VIEW_SECTIONS.includes(planningSection)
    );
    const hasKnownHashPath = (
      hashSegments.length === 1
      && EXPLICIT_HASH_MAIN_TABS.has(hashSegments[0])
    ) || (
      hashSegments.length === 2
      && hashSegments[0] === 'notes'
      && PLANNING_VIEW_SECTIONS.includes(hashSegments[1])
    );
    const manualAnchor = MANUAL_ANCHOR_RE.test(rawHash) ? rawHash : '';
    const hasExplicitNavigation = hasQueryView || hasKnownHashParams || hasKnownHashPath;
    return {
      hasExplicitNavigation,
      projectId: hasExplicitNavigation ? projectId : '',
      mainTab: hasExplicitNavigation ? mainTab : '',
      planningSection: hasExplicitNavigation ? planningSection : '',
      manualAnchor,
    };
  } catch {
    return none;
  }
}

export function hasExplicitViewUrl(locationLike) {
  return readExplicitViewUrl(locationLike).hasExplicitNavigation;
}

export function resolveViewResumeState(value, projects, {
  validMainTabs = [],
  validPlanningSections = PLANNING_VIEW_SECTIONS,
  explicitNavigation = false,
} = {}) {
  const state = normalizeViewResumeState(value);
  const safeProjects = Array.isArray(projects)
    ? projects.filter(project => project && safeToken(project.id))
    : [];
  const fallbackProject = safeProjects[0] || null;

  const explicitView = isPlainObject(explicitNavigation)
    ? explicitNavigation
    : { hasExplicitNavigation: Boolean(explicitNavigation) };
  const manualAnchor = safeToken(explicitView.manualAnchor);
  if (
    !explicitView.hasExplicitNavigation
    && manualAnchor
    && MANUAL_ANCHOR_RE.test(manualAnchor)
  ) {
    const savedProject = safeProjects.find(project => project.id === state.selectedProjectId);
    const project = savedProject || fallbackProject;
    const savedPlanningSection = getProjectView(state, project?.id)?.planningSection;
    return {
      project,
      mainTab: 'manual',
      planningSection: validPlanningSections.includes(savedPlanningSection)
        ? savedPlanningSection
        : DEFAULT_PLANNING_SECTION,
      scrollPosition: null,
      resumed: false,
    };
  }
  if (explicitView.hasExplicitNavigation || !fallbackProject) {
    const explicitProjectId = safeToken(explicitView.projectId);
    const explicitProject = safeProjects.find(project => project.id === explicitProjectId);
    const savedProject = safeProjects.find(project => project.id === state.selectedProjectId);
    const project = explicitProjectId
      ? explicitProject || fallbackProject
      : savedProject || fallbackProject;
    const allowedMainTabs = new Set(validMainTabs);
    const allowedPlanningSections = new Set(validPlanningSections);
    const explicitPlanningSection = safeToken(explicitView.planningSection);
    const savedPlanningSection = getProjectView(state, project?.id)?.planningSection;
    const planningSection = explicitPlanningSection
      ? allowedPlanningSections.has(explicitPlanningSection)
        ? explicitPlanningSection
        : DEFAULT_PLANNING_SECTION
      : allowedPlanningSections.has(savedPlanningSection)
        ? savedPlanningSection
        : DEFAULT_PLANNING_SECTION;
    const explicitMainTab = safeToken(explicitView.mainTab);
    const mainTab = explicitMainTab
      ? allowedMainTabs.has(explicitMainTab) ? explicitMainTab : DEFAULT_MAIN_TAB
      : allowedMainTabs.has(state.mainTab) ? state.mainTab : DEFAULT_MAIN_TAB;
    return {
      project,
      mainTab: project ? mainTab : 'manual',
      planningSection,
      scrollPosition: null,
      resumed: false,
    };
  }

  const savedProject = safeProjects.find(project => project.id === state.selectedProjectId);
  if (!savedProject) {
    return {
      project: fallbackProject,
      mainTab: DEFAULT_MAIN_TAB,
      planningSection: DEFAULT_PLANNING_SECTION,
      scrollPosition: null,
      resumed: false,
    };
  }

  const allowedMainTabs = new Set(validMainTabs);
  const allowedPlanningSections = new Set(validPlanningSections);
  const mainTab = allowedMainTabs.has(state.mainTab) ? state.mainTab : DEFAULT_MAIN_TAB;
  const rawPlanningSection = getProjectView(state, savedProject.id)?.planningSection;
  const planningSection = allowedPlanningSections.has(rawPlanningSection)
    ? rawPlanningSection
    : DEFAULT_PLANNING_SECTION;
  const scrollPosition = getSavedViewScroll(
    state,
    savedProject.id,
    mainTab,
    planningSection,
  );
  const resumed = (
    savedProject.id !== fallbackProject.id
    || mainTab !== DEFAULT_MAIN_TAB
    || planningSection !== DEFAULT_PLANNING_SECTION
    || (scrollPosition?.contentY || 0) > 128
  );

  return {
    project: savedProject,
    mainTab,
    planningSection,
    scrollPosition,
    resumed,
  };
}
