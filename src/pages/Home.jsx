import React, { useState, useEffect, useCallback, useRef } from 'react';
import RainEffect from '../components/RainEffect';
import AppHeader from '../components/AppHeader';
import PublishingChecklistTab from '../components/tabs/PublishingChecklistTab';
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

const SELECTED_PROJECT_KEY = 'kindle_publishing_navi_selected_project_id';

const TABS = [
  { id: 'manual',    label: '使い方マニュアル' },
  { id: 'creation',  label: 'Kindle本制作進捗' },
  { id: 'kdp',       label: 'KDP登録進捗' },
  { id: 'category',  label: 'カテゴリーチェック' },
  { id: 'promo',     label: 'プロモーション戦略メモ' },
  { id: 'description', label: 'KDP書籍説明文' },
  { id: 'aplus',     label: '表紙＆A+コンテンツ' },
  { id: 'format',    label: 'Kindle原稿作成ガイド' },
  { id: 'formatter', label: 'Kindle原稿整形ツール（テスト版）' },
  { id: 'critique',  label: '辛口論評' },
];

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
  const mobileTabsToggleRef = useRef(null);
  const mainNavigationRef = useRef(null);

  const loadProjects = async () => {
    const list = await base44.entities.PublishingProject.list('-created_date', 50);
    setProjects(list);
    return list;
  };

  const handleSelectProject = (project) => {
    setCurrentProject(project);
    try {
      if (project?.id) localStorage.setItem(SELECTED_PROJECT_KEY, project.id);
      else localStorage.removeItem(SELECTED_PROJECT_KEY);
    } catch {
      // 保存領域が利用できない場合も、そのセッション中の選択は維持する。
    }
  };

  useEffect(() => {
    loadProjects().then(list => {
      let selectedId = '';
      try {
        selectedId = localStorage.getItem(SELECTED_PROJECT_KEY) || '';
      } catch {
        // 保存領域を読めない場合は先頭のプロジェクトを表示する。
      }
      if (list.length > 0) {
        handleSelectProject(list.find(project => project.id === selectedId) || list[0]);
      } else {
        setActiveTab('manual');
      }
    }).catch(error => toast.error(error?.message || 'プロジェクトを読み込めませんでした'));
  }, []);

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
      toast.warning('旧版データ取込前のバックアップに加え、読み込めない辛口論評履歴／本の前提の原文を復旧用JSONとして保存しました。両方を保管してください');
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
        setProjects(list);
        setCurrentProject(current => list.find(project => project.id === current?.id) || list[0] || null);
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
    if (tabId === activeTab) {
      setMobileTabsOpen(false);
      if (restoreMobileFocus) restoreMobileTabsToggleFocus();
      return;
    }
    if (switchingTab) return;
    setSwitchingTab(true);
    try {
      await flushPendingSaves();
      setActiveTab(tabId);
      setMobileTabsOpen(false);
      if (restoreMobileFocus) restoreMobileTabsToggleFocus();
    } catch (error) {
      toast.error(error?.message || '保存を完了できなかったため、タブを切り替えませんでした');
    } finally {
      setSwitchingTab(false);
    }
  };

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
    <div className="min-h-screen relative overflow-x-clip" style={{ background: '#0d0d1a' }}>
      <RainEffect />
      <div className="fixed top-0 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(255,45,120,0.04)' }} />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(0,245,255,0.04)' }} />

      {/* ヘッダー（タイトル＋プロジェクト選択） */}
      <AppHeader
        projects={projects}
        currentProject={currentProject}
        onSelectProject={handleSelectProject}
        onRefresh={loadProjects}
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
                    className={`min-h-11 w-full rounded-lg border px-2 py-2 text-center text-xs font-bold leading-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80 disabled:cursor-wait disabled:opacity-60 ${
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

          <div className="hidden grid-cols-5 gap-1 py-2 md:grid" data-main-tab-grid="desktop">
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
            {activeTab === 'kdp'       && <KdpChecklistTab {...tabProps} />}
            {activeTab === 'category'  && <CategoryCheckTab {...tabProps} />}
            {activeTab === 'promo'     && <PromoChecklistTab {...tabProps} />}
            {activeTab === 'description' && <KdpDescriptionTab {...tabProps} />}
            {activeTab === 'aplus'     && <AplusContentTab {...tabProps} />}
            {activeTab === 'format'    && <FormatGuideTab {...tabProps} />}
            {activeTab === 'formatter' && <ManuscriptFormatterTab />}
            {activeTab === 'critique'  && <ReviewGuideTab {...tabProps} />}
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
    </div>
  );
}
