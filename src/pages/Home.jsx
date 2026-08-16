import React, { useState, useEffect, useCallback, useRef } from 'react';
import RainEffect from '../components/RainEffect';
import AppHeader from '../components/AppHeader';
import PublishingChecklistTab from '../components/tabs/PublishingChecklistTab';
import PlanningNotesTab from '@/components/tabs/PlanningNotesTab';
import KdpChecklistTab from '../components/tabs/KdpChecklistTab';
import CategoryCheckTab from '../components/tabs/CategoryCheckTab';
import PromoChecklistTab from '../components/tabs/PromoChecklistTab';
import KdpDescriptionTab from '../components/tabs/KdpDescriptionTab';
import AplusContentTab from '../components/tabs/AplusContentTab';
import FormatGuideTab from '../components/tabs/FormatGuideTab';
import ManuscriptFormatterTab from '../components/tabs/ManuscriptFormatterTab';
import ReviewGuideTab from '../components/tabs/ReviewGuideTab';
import KindleNaviManualTab from '../components/tabs/KindleNaviManualTab';
import ReleaseScheduleCard from '../components/ReleaseScheduleCard';
import AppUpdateBanner from '../components/AppUpdateBanner';
import BrowserStorageNotice from '../components/BrowserStorageNotice';
import LegacyMigrationNotice from '../components/LegacyMigrationNotice';
import { base44, LOCAL_PROJECTS_KEY } from '@/api/base44Client';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowUp, ChevronDown, RefreshCw } from 'lucide-react';
import {
  flushPendingSaves,
  getPendingSaveCount,
  hasUnresolvedSaveErrors,
  retryFailedSaves,
} from '@/lib/saveCoordinator';
import { toast } from 'sonner';
import { CURRENT_APP_VERSION } from '@/hooks/useAppUpdate';
import {
  createBackupFileName,
  createCritiqueRecoveryFileName,
  createDataBackupBundle,
  downloadCritiqueRecovery,
  downloadDataBackup,
} from '@/lib/dataBackup';
import {
  calculateRestoredScrollY,
  createViewScrollPosition,
  CRITIQUE_VIEW_SECTIONS,
  DEFAULT_CRITIQUE_SECTION,
  DEFAULT_PLANNING_SECTION,
  getProjectCollapsedOutlineCardKeys,
  getProjectCritiqueSection,
  getProjectPlanningSection,
  getSavedViewScroll,
  normalizeCritiqueViewSection,
  normalizePlanningViewSection,
  persistViewResumeState,
  PLANNING_VIEW_SECTIONS,
  readExplicitViewUrl,
  readViewResumeState,
  reconcileViewResumeProjects,
  rememberViewResumeState,
  resolveViewResumeState,
} from '@/lib/viewResumeState';

const TABS = [
  { id: 'manual',    label: '使い方マニュアル' },
  { id: 'creation',  label: 'Kindle本制作進捗' },
  { id: 'notes',     label: '企画・取材・構成ノート' },
  { id: 'kdp',       label: 'KDP登録進捗' },
  { id: 'category',  label: 'カテゴリーチェック' },
  { id: 'promo',     label: 'プロモーション戦略メモ' },
  { id: 'description', label: 'KDP書籍説明文' },
  { id: 'aplus',     label: '表紙＆A+コンテンツ' },
  { id: 'format',    label: 'Kindle原稿作成ガイド' },
  { id: 'formatter', label: 'Kindle原稿整形ツール（テスト版）' },
  { id: 'critique',  label: '辛口論評' },
];
const MAIN_TAB_IDS = TABS.map(tab => tab.id);

export default function Home() {
  const [activeTab, setActiveTab] = useState('creation');
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [switchingTab, setSwitchingTab] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState('');
  const [retryingSaves, setRetryingSaves] = useState(false);
  const [createRequestToken, setCreateRequestToken] = useState(0);
  const [mobileTabsOpen, setMobileTabsOpen] = useState(false);
  const [mainNavigationHeight, setMainNavigationHeight] = useState(60);
  const [planningSection, setPlanningSection] = useState(DEFAULT_PLANNING_SECTION);
  const [critiqueSection, setCritiqueSection] = useState(DEFAULT_CRITIQUE_SECTION);
  const [collapsedOutlineCardKeys, setCollapsedOutlineCardKeys] = useState([]);
  const [viewResumeReady, setViewResumeReady] = useState(false);
  const [resumeNoticeVisible, setResumeNoticeVisible] = useState(false);
  const [initialViewResumeState] = useState(() => readViewResumeState());
  const mobileTabsToggleRef = useRef(null);
  const mainNavigationRef = useRef(null);
  const viewResumeStateRef = useRef(initialViewResumeState);
  const viewResumeReadyRef = useRef(false);
  const viewContextRef = useRef({
    projectId: '',
    mainTab: 'creation',
    planningSection: DEFAULT_PLANNING_SECTION,
    critiqueSection: DEFAULT_CRITIQUE_SECTION,
  });
  const explicitViewUrlRef = useRef(readExplicitViewUrl(
    typeof window === 'undefined' ? null : window.location,
  ));
  const skipNextViewRestoreRef = useRef(false);
  const resumeNoticeShownRef = useRef(false);
  const resumeNoticeTimerRef = useRef(0);

  const getStickyViewOffset = useCallback(() => {
    const mainHeight = Math.ceil(mainNavigationRef.current?.getBoundingClientRect().height || 0);
    const planningHeight = viewContextRef.current.mainTab === 'notes'
      ? Math.ceil(document.querySelector('[data-view-resume-sticky="planning"]')?.getBoundingClientRect().height || 0)
      : 0;
    return mainHeight + planningHeight + (planningHeight > 0 ? 16 : 8);
  }, []);

  const storeViewResumeState = useCallback(nextState => {
    viewResumeStateRef.current = nextState;
    persistViewResumeState(nextState);
  }, []);

  const rememberViewContext = useCallback(context => {
    viewContextRef.current = context;
    const nextState = rememberViewResumeState(viewResumeStateRef.current, {
      selectedProjectId: context.projectId || null,
      mainTab: context.mainTab,
      projectId: context.projectId,
      planningSection: context.planningSection,
      critiqueSection: context.critiqueSection,
    });
    storeViewResumeState(nextState);
  }, [storeViewResumeState]);

  const captureCurrentViewScroll = useCallback(() => {
    if (!viewResumeReadyRef.current) return;
    const context = viewContextRef.current;
    if (!context.projectId) return;
    const nextState = rememberViewResumeState(viewResumeStateRef.current, {
      projectId: context.projectId,
      planningSection: context.planningSection,
      critiqueSection: context.critiqueSection,
      scrollMainTab: context.mainTab,
      scrollPlanningSection: context.planningSection,
      scrollCritiqueSection: context.critiqueSection,
      scrollPosition: createViewScrollPosition(window.scrollY, getStickyViewOffset()),
    });
    storeViewResumeState(nextState);
  }, [getStickyViewOffset, storeViewResumeState]);

  const loadProjects = async () => {
    const list = await base44.entities.PublishingProject.list('-created_date', 50);
    setProjects(list);
    return list;
  };

  const handleSelectProject = (project) => {
    captureCurrentViewScroll();
    const projectId = project?.id || '';
    const nextPlanningSection = projectId
      ? getProjectPlanningSection(viewResumeStateRef.current, projectId)
      : DEFAULT_PLANNING_SECTION;
    const nextCritiqueSection = projectId
      ? getProjectCritiqueSection(viewResumeStateRef.current, projectId)
      : DEFAULT_CRITIQUE_SECTION;
    const nextMainTab = projectId ? activeTab : 'manual';
    rememberViewContext({
      projectId,
      mainTab: nextMainTab,
      planningSection: nextPlanningSection,
      critiqueSection: nextCritiqueSection,
    });
    setCurrentProject(project);
    setPlanningSection(nextPlanningSection);
    setCritiqueSection(nextCritiqueSection);
    setCollapsedOutlineCardKeys(getProjectCollapsedOutlineCardKeys(
      viewResumeStateRef.current,
      projectId,
    ));
    if (!projectId) setActiveTab('manual');
  };

  useEffect(() => {
    let cancelled = false;
    loadProjects().then(list => {
      if (cancelled) return;
      const resolved = resolveViewResumeState(initialViewResumeState, list, {
        validMainTabs: MAIN_TAB_IDS,
        validPlanningSections: PLANNING_VIEW_SECTIONS,
        validCritiqueSections: CRITIQUE_VIEW_SECTIONS,
        explicitNavigation: explicitViewUrlRef.current,
      });
      let nextState = reconcileViewResumeProjects(
        initialViewResumeState,
        list.map(project => project.id),
      );
      nextState = rememberViewResumeState(nextState, {
        selectedProjectId: resolved.project?.id || null,
        mainTab: resolved.mainTab,
        projectId: resolved.project?.id || '',
        planningSection: resolved.planningSection,
        critiqueSection: resolved.critiqueSection,
      });
      storeViewResumeState(nextState);
      viewContextRef.current = {
        projectId: resolved.project?.id || '',
        mainTab: resolved.mainTab,
        planningSection: resolved.planningSection,
        critiqueSection: resolved.critiqueSection,
      };
      setCurrentProject(resolved.project);
      setActiveTab(resolved.mainTab);
      setPlanningSection(resolved.planningSection);
      setCritiqueSection(resolved.critiqueSection);
      setCollapsedOutlineCardKeys(getProjectCollapsedOutlineCardKeys(
        nextState,
        resolved.project?.id,
      ));
      viewResumeReadyRef.current = true;
      setViewResumeReady(true);
      if (resolved.resumed && !resumeNoticeShownRef.current) {
        resumeNoticeShownRef.current = true;
        setResumeNoticeVisible(true);
        resumeNoticeTimerRef.current = window.setTimeout(() => {
          setResumeNoticeVisible(false);
        }, 2600);
      }
    }).catch(error => toast.error(error?.message || 'プロジェクトを読み込めませんでした'));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    window.clearTimeout(resumeNoticeTimerRef.current);
  }, []);

  useEffect(() => {
    if (
      explicitViewUrlRef.current.hasExplicitNavigation
      || explicitViewUrlRef.current.manualAnchor
      || !('scrollRestoration' in window.history)
    ) return undefined;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    if (!viewResumeReady) return undefined;
    const context = {
      projectId: currentProject?.id || '',
      mainTab: activeTab,
      planningSection,
      critiqueSection,
    };
    rememberViewContext(context);
    if (skipNextViewRestoreRef.current) {
      skipNextViewRestoreRef.current = false;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return undefined;
    }
    if (
      explicitViewUrlRef.current.hasExplicitNavigation
      || explicitViewUrlRef.current.manualAnchor
    ) return undefined;

    const savedPosition = getSavedViewScroll(
      viewResumeStateRef.current,
      context.projectId,
      context.mainTab,
      context.planningSection,
      context.critiqueSection,
    );
    const restorePosition = () => {
      if (
        viewContextRef.current.projectId !== context.projectId
        || viewContextRef.current.mainTab !== context.mainTab
        || viewContextRef.current.planningSection !== context.planningSection
        || viewContextRef.current.critiqueSection !== context.critiqueSection
      ) return;
      const scrollHeight = Math.max(
        document.documentElement?.scrollHeight || 0,
        document.body?.scrollHeight || 0,
      );
      const top = calculateRestoredScrollY(savedPosition, {
        stickyOffset: getStickyViewOffset(),
        scrollHeight,
        viewportHeight: window.innerHeight,
      });
      window.scrollTo({ top, left: 0, behavior: 'auto' });
    };

    let secondFrame = 0;
    let settledLayoutTimer = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        restorePosition();
        // AnimatePresence(mode="wait") の退出後に本文高が変わるため、
        // 保存済み座標を保持したまま、描画が落ち着いた時点でもう一度補正する。
        settledLayoutTimer = window.setTimeout(restorePosition, 220);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settledLayoutTimer);
    };
  }, [
    activeTab,
    currentProject?.id,
    getStickyViewOffset,
    planningSection,
    critiqueSection,
    rememberViewContext,
    viewResumeReady,
  ]);

  useEffect(() => {
    const anchorId = explicitViewUrlRef.current.manualAnchor;
    if (!viewResumeReady || activeTab !== 'manual' || !anchorId) return undefined;

    const scrollToAnchor = () => {
      const target = document.getElementById(anchorId);
      if (!target) return;
      target.scrollIntoView({ block: 'start', behavior: 'auto' });
      target.focus?.({ preventScroll: true });
    };

    let secondFrame = 0;
    let settledLayoutTimer = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        scrollToAnchor();
        settledLayoutTimer = window.setTimeout(scrollToAnchor, 220);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settledLayoutTimer);
    };
  }, [activeTab, viewResumeReady]);

  useEffect(() => {
    if (!viewResumeReady) return undefined;
    let saveTimer = 0;
    const flushScrollPosition = () => {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
      captureCurrentViewScroll();
    };
    const scheduleScrollSave = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(flushScrollPosition, 160);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushScrollPosition();
    };
    window.addEventListener('scroll', scheduleScrollSave, { passive: true });
    window.addEventListener('pagehide', flushScrollPosition);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(saveTimer);
      window.removeEventListener('scroll', scheduleScrollSave);
      window.removeEventListener('pagehide', flushScrollPosition);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [captureCurrentViewScroll, viewResumeReady]);

  const prepareLegacyMigration = useCallback(async () => {
    await flushPendingSaves();
    const { backup, critiqueRecovery } = await createDataBackupBundle({
      appVersion: CURRENT_APP_VERSION,
    });
    downloadDataBackup(backup, {
      filename: createBackupFileName('kindle-navi-before-legacy-import'),
    });
    if (critiqueRecovery) {
      downloadCritiqueRecovery(critiqueRecovery, {
        filename: createCritiqueRecoveryFileName(
          'kindle-navi-before-legacy-import-critique-recovery',
        ),
      });
      toast.warning('旧版データ取込前のバックアップに加え、読み込めない辛口論評履歴／本の前提／企画・取材・構成ノートの原文を復旧用JSONとして保存しました。両方を保管してください');
    }
  }, []);

  const handleLegacyMigrationError = useCallback(error => {
    toast.error(error?.message || '旧版データを確認できませんでした');
  }, []);

  useEffect(() => {
    const handleSaveError = event => {
      const message = event.detail?.error?.message || 'データを保存できませんでした。空き容量やブラウザ設定を確認してください。';
      setSaveErrorMessage(message);
      toast.error(message);
    };
    const handleSavePending = event => {
      setSaving((event.detail?.count || 0) > 0);
      setSaveErrorMessage(current => (
        (event.detail?.errorCount || 0) > 0
          ? current || '未保存の変更があります。保存を再試行してください。'
          : ''
      ));
    };
    const flushWhenLeaving = () => {
      retryFailedSaves().catch(() => {
        // 保存エラーは kindle-save-error で通知する。
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushWhenLeaving();
    };
    const handleBeforeUnload = event => {
      if (getPendingSaveCount() < 1 && !hasUnresolvedSaveErrors()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const handleStorage = async event => {
      if (event.key !== LOCAL_PROJECTS_KEY) return;
      try {
        const list = await base44.entities.PublishingProject.list('-created_date', 50);
        const previousProjectId = viewContextRef.current.projectId;
        const retainedProject = list.find(project => project.id === previousProjectId) || null;
        setProjects(list);
        if (retainedProject) {
          setCurrentProject(retainedProject);
          let reconciledState = reconcileViewResumeProjects(
            viewResumeStateRef.current,
            list.map(project => project.id),
          );
          reconciledState = rememberViewResumeState(reconciledState, {
            selectedProjectId: retainedProject.id,
            mainTab: viewContextRef.current.mainTab,
            projectId: retainedProject.id,
            planningSection: viewContextRef.current.planningSection,
            critiqueSection: viewContextRef.current.critiqueSection,
          });
          storeViewResumeState(reconciledState);
          setCollapsedOutlineCardKeys(getProjectCollapsedOutlineCardKeys(
            reconciledState,
            retainedProject.id,
          ));
        } else {
          const fallbackProject = list[0] || null;
          const fallbackMainTab = fallbackProject ? 'creation' : 'manual';
          let nextState = reconcileViewResumeProjects(
            viewResumeStateRef.current,
            list.map(project => project.id),
          );
          nextState = rememberViewResumeState(nextState, {
            selectedProjectId: fallbackProject?.id || null,
            mainTab: fallbackMainTab,
            projectId: fallbackProject?.id || '',
            planningSection: DEFAULT_PLANNING_SECTION,
            critiqueSection: DEFAULT_CRITIQUE_SECTION,
          });
          storeViewResumeState(nextState);
          skipNextViewRestoreRef.current = (
            previousProjectId !== (fallbackProject?.id || '')
            || viewContextRef.current.mainTab !== fallbackMainTab
            || viewContextRef.current.planningSection !== DEFAULT_PLANNING_SECTION
            || viewContextRef.current.critiqueSection !== DEFAULT_CRITIQUE_SECTION
          );
          viewContextRef.current = {
            projectId: fallbackProject?.id || '',
            mainTab: fallbackMainTab,
            planningSection: DEFAULT_PLANNING_SECTION,
            critiqueSection: DEFAULT_CRITIQUE_SECTION,
          };
          setCurrentProject(fallbackProject);
          setActiveTab(fallbackMainTab);
          setPlanningSection(DEFAULT_PLANNING_SECTION);
          setCritiqueSection(DEFAULT_CRITIQUE_SECTION);
          setCollapsedOutlineCardKeys(getProjectCollapsedOutlineCardKeys(
            nextState,
            fallbackProject?.id,
          ));
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
        toast.info('別のタブでの変更を反映しました');
      } catch (error) {
        toast.error(error?.message || '別タブの変更を読み込めませんでした');
      }
    };
    window.addEventListener('kindle-save-error', handleSaveError);
    window.addEventListener('kindle-save-pending', handleSavePending);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', flushWhenLeaving);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('kindle-save-error', handleSaveError);
      window.removeEventListener('kindle-save-pending', handleSavePending);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', flushWhenLeaving);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const navigation = mainNavigationRef.current;
    if (!navigation) return undefined;

    const updateHeight = () => {
      const nextHeight = Math.ceil(navigation.getBoundingClientRect().height);
      if (nextHeight > 0) {
        setMainNavigationHeight(current => current === nextHeight ? current : nextHeight);
      }
    };
    updateHeight();

    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(updateHeight)
      : null;
    observer?.observe(navigation);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  const handleRetrySaves = async () => {
    if (retryingSaves) return;
    setRetryingSaves(true);
    try {
      await retryFailedSaves();
      setSaveErrorMessage('');
      toast.success('未保存の変更を保存しました');
    } catch (error) {
      const message = error?.message || '再保存できませんでした。空き容量やブラウザ設定を確認してください。';
      setSaveErrorMessage(message);
      toast.error(message);
    } finally {
      setRetryingSaves(false);
    }
  };

  const handleProjectUpdate = async (updated) => {
    setSaving(true);
    setCurrentProject(current => current?.id === updated.id ? updated : current);
    setProjects(ps => ps.map(p => p.id === updated.id ? updated : p));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setTimeout(() => setSaving(false), 500);
  };

  const restoreMobileTabsToggleFocus = () => {
    window.setTimeout(() => {
      mobileTabsToggleRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  const handleMobileTabsToggle = () => {
    const nextOpen = !mobileTabsOpen;
    setMobileTabsOpen(nextOpen);
    if (!nextOpen) return;

    window.setTimeout(() => {
      const navigation = mainNavigationRef.current;
      if (!navigation || navigation.getBoundingClientRect().top <= 1) return;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      navigation.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }, 0);
  };

  const handleTabChange = async (tabId, { restoreMobileFocus = false } = {}) => {
    if (!MAIN_TAB_IDS.includes(tabId)) return;
    if (tabId === activeTab) {
      setMobileTabsOpen(false);
      if (restoreMobileFocus) restoreMobileTabsToggleFocus();
      return;
    }
    if (switchingTab) return;
    captureCurrentViewScroll();
    setSwitchingTab(true);
    try {
      await flushPendingSaves();
      rememberViewContext({
        projectId: currentProject?.id || '',
        mainTab: tabId,
        planningSection,
        critiqueSection,
      });
      setActiveTab(tabId);
      setMobileTabsOpen(false);
      if (restoreMobileFocus) restoreMobileTabsToggleFocus();
    } catch (error) {
      toast.error(error?.message || '保存を完了できなかったため、タブを切り替えませんでした');
    } finally {
      setSwitchingTab(false);
    }
  };

  const handlePlanningSectionChange = useCallback(nextSection => {
    const safeSection = normalizePlanningViewSection(nextSection);
    if (safeSection === viewContextRef.current.planningSection) return;
    captureCurrentViewScroll();
    rememberViewContext({
      projectId: viewContextRef.current.projectId,
      mainTab: viewContextRef.current.mainTab,
      planningSection: safeSection,
      critiqueSection: viewContextRef.current.critiqueSection,
    });
    setPlanningSection(safeSection);
  }, [captureCurrentViewScroll, rememberViewContext]);

  const handleCritiqueSectionChange = useCallback(nextSection => {
    const safeSection = normalizeCritiqueViewSection(nextSection);
    if (safeSection === viewContextRef.current.critiqueSection) return;
    captureCurrentViewScroll();
    rememberViewContext({
      projectId: viewContextRef.current.projectId,
      mainTab: viewContextRef.current.mainTab,
      planningSection: viewContextRef.current.planningSection,
      critiqueSection: safeSection,
    });
    setCritiqueSection(safeSection);
  }, [captureCurrentViewScroll, rememberViewContext]);

  const handleCollapsedOutlineCardKeysChange = useCallback(nextKeys => {
    const projectId = viewContextRef.current.projectId;
    if (!projectId) return;
    const nextState = rememberViewResumeState(viewResumeStateRef.current, {
      projectId,
      collapsedOutlineCardKeys: nextKeys,
    });
    storeViewResumeState(nextState);
    setCollapsedOutlineCardKeys(getProjectCollapsedOutlineCardKeys(nextState, projectId));
  }, [storeViewResumeState]);

  const handleOpenManual = async () => {
    await handleTabChange('manual');
    window.setTimeout(() => {
      const title = document.getElementById('kindle-navi-manual-title');
      title?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      title?.focus({ preventScroll: true });
    }, 220);
  };

  const handleOpenSchedule = async () => {
    await handleTabChange('creation');
    window.setTimeout(() => {
      const schedule = document.getElementById('release-schedule-card');
      schedule?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      schedule?.focus({ preventScroll: true });
    }, 50);
  };

  const handleScrollToTop = () => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
    window.setTimeout(() => {
      document.getElementById('kindle-navi-page-title')?.focus({ preventScroll: true });
    }, reduceMotion ? 0 : 350);
  };

  const tabProps = {
    project: currentProject,
    onProjectUpdate: handleProjectUpdate,
    onNavigateTab: handleTabChange,
    saving,
    saved,
  };

  return (
    <div
      className="min-h-screen relative overflow-x-clip"
      style={{
        background: '#0d0d1a',
        '--kindle-main-nav-height': `${mainNavigationHeight}px`,
      }}
    >
      <RainEffect />
      <div className="fixed top-0 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(255,45,120,0.04)' }} />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(0,245,255,0.04)' }} />

      {/* ヘッダー（タイトル＋プロジェクト選択） */}
      <AppHeader
        projects={projects}
        currentProject={currentProject}
        onSelectProject={handleSelectProject}
        onRefresh={loadProjects}
        onProjectUpdate={handleProjectUpdate}
        saving={saving}
        saved={saved}
        createRequestToken={createRequestToken}
        onOpenManual={handleOpenManual}
      />

      <LegacyMigrationNotice
        beforeMigrate={prepareLegacyMigration}
        onMigrated={() => window.location.reload()}
        onError={handleLegacyMigrationError}
      />

      <ReleaseScheduleCard
        project={currentProject}
        onProjectUpdate={handleProjectUpdate}
      />

      <BrowserStorageNotice />

      {saveErrorMessage && (
        <aside
          className="relative z-40 mx-auto mt-3 flex max-w-7xl flex-col gap-3 border-y border-red-500/40 bg-red-950/80 px-4 py-3 text-sm text-red-100 sm:flex-row sm:items-center sm:justify-between sm:rounded-lg sm:border"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
            <div>
              <p className="font-bold">変更をまだ保存できていません</p>
              <p className="mt-0.5 break-words text-xs text-red-200/90">{saveErrorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetrySaves}
            disabled={retryingSaves}
            className="inline-flex min-h-10 flex-shrink-0 items-center justify-center gap-2 rounded-md border border-red-400/50 bg-red-500/15 px-4 py-2 font-bold text-red-100 transition hover:bg-red-500/25 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${retryingSaves ? 'animate-spin' : ''}`} />
            {retryingSaves ? '再保存中…' : '保存を再試行'}
          </button>
        </aside>
      )}

      <AppUpdateBanner beforeReload={flushPendingSaves} />

      {/* タブナビゲーション */}
      <nav
        ref={mainNavigationRef}
        aria-label="メイン機能"
        className="sticky top-0 z-30 border-b shadow-[0_5px_14px_rgba(0,0,0,0.28)]"
        style={{ background: 'rgba(13,13,26,0.97)', borderColor: '#2a2a4a', backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-7xl mx-auto px-2">
          <div className="py-2 md:hidden">
            <button
              ref={mobileTabsToggleRef}
              type="button"
              aria-expanded={mobileTabsOpen}
              aria-controls="mobile-main-tab-list"
              onClick={handleMobileTabsToggle}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-[#34345a] bg-[#151529] px-3 py-2 text-left transition hover:border-neon-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold text-muted-foreground">表示中の機能</span>
                <span className="block truncate text-sm font-bold text-neon-pink neon-pink-glow">
                  {TABS.find(tab => tab.id === activeTab)?.label}
                </span>
              </span>
              <span className="flex-shrink-0 text-xs font-bold text-neon-cyan">機能一覧（{TABS.length}）</span>
              <ChevronDown
                className={`h-4 w-4 flex-shrink-0 text-neon-cyan transition-transform ${mobileTabsOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {mobileTabsOpen && (
              <div id="mobile-main-tab-list" className="mt-2 grid max-h-[calc(100dvh-5.5rem)] grid-cols-2 gap-1 overflow-y-auto pb-1">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id, { restoreMobileFocus: true })}
                    disabled={switchingTab}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    data-main-tab={tab.id}
                    className={`min-h-11 w-full rounded-lg border px-2 py-2 text-center text-xs font-bold leading-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80 disabled:cursor-wait disabled:opacity-60 ${tab.id === 'notes' ? 'col-span-2' : ''} ${
                      activeTab === tab.id
                        ? 'border-neon-pink/50 bg-neon-pink/10 text-neon-pink neon-pink-glow'
                        : 'border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/5 hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden grid-cols-6 gap-1 py-2 md:grid" data-main-tab-grid="desktop">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                disabled={switchingTab}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                data-main-tab={tab.id}
                className={`min-h-11 w-full rounded-lg border px-2 py-2 text-center text-[11px] font-bold leading-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80 disabled:cursor-wait disabled:opacity-60 lg:text-sm ${
                  activeTab === tab.id
                    ? 'border-transparent text-neon-pink neon-pink-glow'
                    : 'border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/5 hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* コンテンツ */}
      <main className="relative z-10 max-w-7xl mx-auto px-2 py-6 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'manual'    && (
              <KindleNaviManualTab
                hasProject={Boolean(currentProject)}
                onCreateProject={() => setCreateRequestToken(token => token + 1)}
                onNavigateTab={handleTabChange}
                onOpenSchedule={handleOpenSchedule}
              />
            )}
            {activeTab === 'creation'  && <PublishingChecklistTab {...tabProps} />}
            {activeTab === 'notes'     && (
              <PlanningNotesTab
                {...tabProps}
                initialSection={planningSection}
                onSectionChange={handlePlanningSectionChange}
                collapsedOutlineCardKeys={collapsedOutlineCardKeys}
                onCollapsedOutlineCardKeysChange={handleCollapsedOutlineCardKeysChange}
              />
            )}
            {activeTab === 'kdp'       && <KdpChecklistTab {...tabProps} />}
            {activeTab === 'category'  && <CategoryCheckTab {...tabProps} />}
            {activeTab === 'promo'     && <PromoChecklistTab {...tabProps} />}
            {activeTab === 'description' && <KdpDescriptionTab {...tabProps} />}
            {activeTab === 'aplus'     && <AplusContentTab {...tabProps} />}
            {activeTab === 'format'    && <FormatGuideTab {...tabProps} />}
            {activeTab === 'formatter' && <ManuscriptFormatterTab />}
            {activeTab === 'critique'  && (
              <ReviewGuideTab
                {...tabProps}
                initialSection={critiqueSection}
                onSectionChange={handleCritiqueSectionChange}
              />
            )}
          </motion.div>
        </AnimatePresence>

      </main>

      <div
        data-scroll-to-top="true"
        className="pointer-events-none fixed inset-x-0 z-40"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="relative mx-auto h-11 w-full max-w-7xl">
          <button
            type="button"
            onClick={handleScrollToTop}
            aria-label="ページの上に戻る"
            className="pointer-events-auto absolute bottom-0 right-4 inline-flex min-h-11 w-max items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-neon-cyan/50 bg-[#121225]/95 px-4 py-2 text-sm font-bold text-neon-cyan shadow-[0_0_18px_rgba(0,245,255,0.16)] backdrop-blur-md transition hover:border-neon-cyan/80 hover:bg-[#171735] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d1a] min-[1600px]:left-[calc(100%+1rem)] min-[1600px]:right-auto"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
            上に戻る
          </button>
        </div>
      </div>

      {resumeNoticeVisible && (
        <div
          data-view-resume-notice="true"
          className="pointer-events-none fixed left-4 z-50 max-w-[calc(100vw-2rem)] rounded-lg border border-neon-cyan/25 bg-[#151529]/95 px-3 py-2 text-xs text-foreground shadow-lg backdrop-blur-md"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
          role="status"
          aria-live="polite"
        >
          前回の続きから再開しました
        </div>
      )}
    </div>
  );
}
