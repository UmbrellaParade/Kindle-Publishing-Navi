import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeSource = readFileSync(
  new URL('../src/pages/Home.jsx', import.meta.url),
  'utf8',
);
const planningSource = readFileSync(
  new URL('../src/components/tabs/PlanningNotesTab.jsx', import.meta.url),
  'utf8',
);
const reviewSource = readFileSync(
  new URL('../src/components/tabs/ReviewGuideTab.jsx', import.meta.url),
  'utf8',
);
const manualSource = readFileSync(
  new URL('../src/components/tabs/KindleNaviManualTab.jsx', import.meta.url),
  'utf8',
);
const backupSource = readFileSync(
  new URL('../src/lib/dataBackup.js', import.meta.url),
  'utf8',
);
const planningDataSource = readFileSync(
  new URL('../src/lib/planningNotes.js', import.meta.url),
  'utf8',
);

test('前回のproject・メインタブ・企画ノート内部タブを検証後に復元する', () => {
  assert.match(homeSource, /readViewResumeState\(\)/);
  assert.match(homeSource, /resolveViewResumeState\(initialViewResumeState, list/);
  assert.match(homeSource, /validMainTabs: MAIN_TAB_IDS/);
  assert.match(homeSource, /validPlanningSections: PLANNING_VIEW_SECTIONS/);
  assert.match(homeSource, /setCurrentProject\(resolved\.project\)/);
  assert.match(homeSource, /setActiveTab\(resolved\.mainTab\)/);
  assert.match(homeSource, /setPlanningSection\(resolved\.planningSection\)/);
  assert.match(homeSource, /initialSection=\{planningSection\}/);
  assert.match(homeSource, /onSectionChange=\{handlePlanningSectionChange\}/);
  assert.match(planningSource, /normalizePlanningViewSection\(initialSection\)/);
  assert.match(planningSource, /onSectionChange\?\.\(safeSection/);
  assert.match(planningSource, /gptSessions: \{ label: 'サポートGPT管理'/);
  assert.match(planningSource, /activeSection === 'gptSessions'/);
  assert.match(planningSource, /setPendingGptSessionFocus\(managementId\)/);
});

test('辛口論評GPT管理の内部画面もプロジェクト別に再読み込み後へ復元する', () => {
  assert.match(homeSource, /DEFAULT_CRITIQUE_SECTION/);
  assert.match(homeSource, /CRITIQUE_VIEW_SECTIONS/);
  assert.match(homeSource, /getProjectCritiqueSection/);
  assert.match(homeSource, /setCritiqueSection\(resolved\.critiqueSection\)/);
  assert.match(homeSource, /scrollCritiqueSection: context\.critiqueSection/);
  assert.match(homeSource, /initialSection=\{critiqueSection\}/);
  assert.match(homeSource, /onSectionChange=\{handleCritiqueSectionChange\}/);
  assert.match(reviewSource, /normalizeCritiqueReviewSection\(initialSection\)/);
  assert.match(reviewSource, /onSectionChange\?\.\(safeSection\)/);
  assert.match(reviewSource, /activeSection === 'history'/);
  assert.match(reviewSource, /<CritiqueGptManagement/);
});

test('projectとview別のスクロールを離脱時に保存し、追従領域を補正して復元する', () => {
  assert.match(homeSource, /createViewScrollPosition\(window\.scrollY, getStickyViewOffset\(\)\)/);
  assert.match(homeSource, /scrollMainTab: context\.mainTab/);
  assert.match(homeSource, /scrollPlanningSection: context\.planningSection/);
  assert.match(homeSource, /window\.addEventListener\('scroll', scheduleScrollSave, \{ passive: true \}\)/);
  assert.match(homeSource, /window\.addEventListener\('pagehide', flushScrollPosition\)/);
  assert.match(homeSource, /calculateRestoredScrollY\(savedPosition/);
  assert.match(homeSource, /viewportHeight: window\.innerHeight/);
  assert.match(homeSource, /settledLayoutTimer = window\.setTimeout\(restorePosition, 220\)/);
  assert.match(homeSource, /window\.history\.scrollRestoration = 'manual'/);
  assert.match(planningSource, /data-view-resume-sticky="planning"/);
});

test('明示URLを優先し、通常復元時だけ控えめな通知を一度表示する', () => {
  assert.match(homeSource, /explicitNavigation: explicitViewUrlRef\.current/);
  assert.match(homeSource, /explicitViewUrlRef\.current\.hasExplicitNavigation\s+\|\| explicitViewUrlRef\.current\.manualAnchor/);
  assert.match(homeSource, /explicitViewUrlRef\.current\.manualAnchor/);
  assert.match(homeSource, /document\.getElementById\(anchorId\)/);
  assert.match(homeSource, /target\.scrollIntoView\(\{ block: 'start', behavior: 'auto' \}\)/);
  assert.match(manualSource, /scrollMarginTop: 'calc\(var\(--kindle-main-nav-height, 60px\) \+ 0\.75rem\)'/);
  assert.match(homeSource, /resumeNoticeShownRef\.current/);
  assert.match(homeSource, /前回の続きから再開しました/);
  assert.match(homeSource, /data-view-resume-notice="true"/);
  assert.match(homeSource, /role="status"/);
  assert.match(homeSource, /aria-live="polite"/);
});

test('storage反映後に閲覧中projectが消えたら日程の変更を代替projectへ持ち込まない', () => {
  assert.match(homeSource, /const previousProjectId = viewContextRef\.current\.projectId/);
  assert.match(homeSource, /const retainedProject = list\.find\(project => project\.id === previousProjectId\) \|\| null/);
  assert.match(homeSource, /const fallbackMainTab = fallbackProject \? 'creation' : 'manual'/);
  assert.match(homeSource, /planningSection: DEFAULT_PLANNING_SECTION/);
  assert.match(homeSource, /setActiveTab\(fallbackMainTab\)/);
  assert.match(homeSource, /setPlanningSection\(DEFAULT_PLANNING_SECTION\)/);
  assert.match(homeSource, /skipNextViewRestoreRef\.current = \(/);
  assert.match(homeSource, /if \(skipNextViewRestoreRef\.current\)/);
  assert.match(homeSource, /window\.scrollTo\(\{ top: 0, left: 0, behavior: 'auto' \}\)/);
});

test('閲覧状態は専用localStorageだけに置き、共有・バックアップ・本文へ混ぜない', () => {
  assert.match(homeSource, /persistViewResumeState\(nextState\)/);
  assert.match(homeSource, /collapsedOutlineCardKeys=\{collapsedOutlineCardKeys\}/);
  assert.match(homeSource, /onCollapsedOutlineCardKeysChange=\{handleCollapsedOutlineCardKeysChange\}/);
  assert.match(homeSource, /collapsedOutlineCardKeys: nextKeys/);
  assert.match(planningSource, /collapsedOutlineCardKeys = \[\]/);
  assert.match(planningSource, /onCollapsedOutlineCardKeysChange\(nextKeys\)/);
  assert.doesNotMatch(homeSource, /planning_notes[^\n]*viewResume|onProjectUpdate[^\n]*viewResume/i);
  assert.doesNotMatch(backupSource, /VIEW_RESUME_STORAGE_KEY|kindle_publishing_navi_view_resume_v1/);
  assert.doesNotMatch(planningDataSource, /VIEW_RESUME_STORAGE_KEY|kindle_publishing_navi_view_resume_v1/);
});
