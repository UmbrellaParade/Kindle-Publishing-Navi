import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Copy,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SCHEDULE_DATE_SOURCE_PROVISIONAL,
  SCHEDULE_DATE_SOURCE_RELEASE_TARGET,
  buildReleaseDateClearUpdate,
  buildReleaseScheduleUpdate,
  buildReleaseTaskDatesResetUpdate,
  countOverdueTasks,
  getReleaseScheduleSource,
  getScheduleWindow,
  parseDateOnly,
  readChecklistEnvelope,
  syncReleaseScheduleDrafts,
} from '@/lib/releaseSchedule';
import { flushPendingSaves } from '@/lib/saveCoordinator';
import { toast } from 'sonner';
import { getNextWorkTasks, getStandardProvisionalDate, hasPastScheduleTargets } from '@/lib/workNavigation';
import { getReleaseMethod, RELEASE_METHOD_OPTIONS } from '@/lib/releaseMethods';
import { mutatePublishingProject } from '@/lib/projectMutation';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };

function todayLocal() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function getScheduleRevisionSnapshot(project) {
  return {
    checklistData: project?.checklist_data || '',
    calculatedFor: project?.schedule_calculated_for || '',
    dateSource: project?.schedule_date_source || '',
    generatedAt: project?.schedule_generated_at || '',
    releaseMethod: project?.release_method || '',
    scheduleMode: project?.schedule_mode || '',
    releaseTargetDate: project?.release_target_date || '',
    provisionalReleaseDate: project?.provisional_release_date || '',
  };
}

function getSavedScheduleInputs(project) {
  return {
    projectId: project?.id || '',
    releaseDate: project?.release_target_date || '',
    provisionalDate: project?.provisional_release_date || '',
    releaseMethod: project?.release_method || project?.schedule_mode || '',
  };
}

export default function ReleaseScheduleCard({ project, onProjectUpdate, onOpenTask, openRequest = 0 }) {
  const initialSavedInputs = getSavedScheduleInputs(project);
  const [releaseDate, setReleaseDate] = useState(initialSavedInputs.releaseDate);
  const [provisionalDate, setProvisionalDate] = useState(initialSavedInputs.provisionalDate);
  const [releaseMethod, setReleaseMethod] = useState(initialSavedInputs.releaseMethod);
  const [workingAction, setWorkingAction] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const activeProjectIdRef = useRef(project?.id || '');
  const operationGenerationRef = useRef(0);
  const savedInputsRef = useRef(initialSavedInputs);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { setSettingsOpen(false); }, [project?.id]);
  useEffect(() => { if (openRequest) setSettingsOpen(true); }, [openRequest]);

  useEffect(() => {
    activeProjectIdRef.current = project?.id || '';
    operationGenerationRef.current += 1;
    setWorkingAction('');
    setStatusMessage('');
  }, [project?.id]);

  useEffect(() => {
    const nextSaved = getSavedScheduleInputs(project);
    const previousSaved = savedInputsRef.current;
    const nextDrafts = syncReleaseScheduleDrafts({
      projectId: previousSaved.projectId,
      releaseDate,
      provisionalDate,
      releaseMethod,
    }, previousSaved, nextSaved);

    setReleaseDate(nextDrafts.releaseDate);
    setProvisionalDate(nextDrafts.provisionalDate);
    setReleaseMethod(nextDrafts.releaseMethod);
    savedInputsRef.current = nextSaved;
  }, [
    project?.id,
    project?.release_target_date,
    project?.provisional_release_date,
    project?.release_method,
    project?.schedule_mode,
  ]);

  const {
    envelope: checklistEnvelope,
    data: checklistData,
    error: checklistError,
  } = useMemo(
    () => readChecklistEnvelope(project?.checklist_data),
    [project?.checklist_data],
  );
  const storedScheduleSource = getReleaseScheduleSource(project);
  const currentScheduleWindow = useMemo(
    () => getScheduleWindow(project?.schedule_calculated_for || ''),
    [project?.schedule_calculated_for],
  );
  const overdueCount = useMemo(
    () => countOverdueTasks(checklistData, todayLocal()),
    [checklistData],
  );
  const nextTasks = useMemo(() => getNextWorkTasks(checklistData), [checklistData]);
  const releaseMethodInfo = releaseMethod ? getReleaseMethod(releaseMethod) : null;
  const isWorking = Boolean(workingAction);
  const officialDraftChanged = releaseDate !== (project?.release_target_date || '')
    || releaseMethod !== (project?.release_method || project?.schedule_mode || '');
  const provisionalDraftChanged = provisionalDate !== (project?.provisional_release_date || '');
  const officialScheduleIsCurrent = Boolean(
    storedScheduleSource === SCHEDULE_DATE_SOURCE_RELEASE_TARGET
    && project?.schedule_calculated_for
    && project.schedule_calculated_for === project.release_target_date,
  );
  const provisionalScheduleIsCurrent = Boolean(
    storedScheduleSource === SCHEDULE_DATE_SOURCE_PROVISIONAL
    && project?.schedule_calculated_for
    && project.schedule_calculated_for === project.provisional_release_date,
  );
  const currentScheduleDraftChanged = storedScheduleSource === SCHEDULE_DATE_SOURCE_PROVISIONAL
    ? provisionalDraftChanged
    : officialDraftChanged;
  const customTaskStates = ['_creation_custom', '_kdp_custom', '_custom']
    .flatMap(key => Array.isArray(checklistEnvelope?.[key]) ? checklistEnvelope[key] : [])
    .map(task => task?.state)
    .filter(Boolean);
  const allTaskStates = [...Object.values(checklistData), ...customTaskStates]
    .filter(state => state && typeof state === 'object' && !Array.isArray(state));
  const hasAnyTaskDateMetadata = allTaskStates.some(state => (
    Boolean(state.due_date)
    || Object.hasOwn(state, 'due_date_source')
    || Object.hasOwn(state, 'due_date_offset')
  ));
  const hasAnyAutoTaskDateMetadata = allTaskStates.some(state => (
    state.due_date_source === 'auto'
    || (!state.due_date_source && Number.isInteger(state.due_date_offset))
  ));

  const updateProject = async (targetProjectId, buildUpdates) => {
    await flushPendingSaves();
    const updated = await mutatePublishingProject(targetProjectId, buildUpdates, project);
    await onProjectUpdate(updated);
    return updated;
  };

  const beginOperation = (action) => {
    operationGenerationRef.current += 1;
    const generation = operationGenerationRef.current;
    setWorkingAction(action);
    return generation;
  };

  const canApplyOperationResult = (targetProjectId, generation) => (
    activeProjectIdRef.current === targetProjectId
    && operationGenerationRef.current === generation
  );

  const applySchedule = async (source, overwriteManual = false, dateOverride = '') => {
    const targetProjectId = project?.id;
    const targetDate = dateOverride || (source === SCHEDULE_DATE_SOURCE_PROVISIONAL ? provisionalDate : releaseDate);
    if (!targetProjectId || !parseDateOnly(targetDate)) {
      toast.error(source === SCHEDULE_DATE_SOURCE_PROVISIONAL
        ? '仮リリース日を正しく入力してください'
        : '発売目標日を正しく入力してください');
      return;
    }
    if (source === SCHEDULE_DATE_SOURCE_RELEASE_TARGET && !releaseMethod) {
      toast.error('正式な発売目標日で逆算する前に、配信方法を選んでください');
      return;
    }
    if (checklistError) {
      toast.error(checklistError.message);
      return;
    }
    if (
      overwriteManual
      && !globalThis.window.confirm(
        '手動で変更した日付と完了済みタスクの日付も、標準スケジュールで上書きします。\n\n進捗チェックとメモは残ります。よろしいですか？',
      )
    ) {
      return;
    }
    const expectedOverwriteSnapshot = overwriteManual
      ? getScheduleRevisionSnapshot(project)
      : null;

    const operationGeneration = beginOperation(
      source === SCHEDULE_DATE_SOURCE_PROVISIONAL ? 'calculate-provisional' : 'calculate-official',
    );
    try {
      let result;
      const generatedAt = new Date().toISOString();
      await updateProject(targetProjectId, latest => {
        if (
          expectedOverwriteSnapshot
          && JSON.stringify(getScheduleRevisionSnapshot(latest))
            !== JSON.stringify(expectedOverwriteSnapshot)
        ) {
          throw new Error('確認後に別の画面で日程が変更されました。最新の表示を確認して、もう一度操作してください。');
        }
        const built = buildReleaseScheduleUpdate(latest, {
          date: targetDate,
          source,
          releaseMethod,
          overwriteManual,
          generatedAt,
        });
        result = built.result;
        return built.updates;
      });

      const preserved = result.preservedCount > 0
        ? `（手動変更・完了済み ${result.preservedCount} 件は維持）`
        : '';
      const message = source === SCHEDULE_DATE_SOURCE_PROVISIONAL
        ? `仮日を基準に ${result.updatedCount} 件を逆算しました。正式な発売目標日・KDP設定・配信方法は変更していません${preserved}`
        : `正式な発売目標日を基準に ${result.updatedCount} 件を逆算しました${preserved}`;
      if (canApplyOperationResult(targetProjectId, operationGeneration)) {
        if (dateOverride && source === SCHEDULE_DATE_SOURCE_PROVISIONAL) setProvisionalDate(targetDate);
        toast.success(message);
        setStatusMessage(message);
      }
    } catch (error) {
      if (canApplyOperationResult(targetProjectId, operationGeneration)) {
        toast.error(error?.message || 'スケジュールの保存に失敗しました');
      }
    } finally {
      if (canApplyOperationResult(targetProjectId, operationGeneration)) setWorkingAction('');
    }
  };

  const saveProvisionalDate = async (dateValue, action, successMessage) => {
    const targetProjectId = project?.id;
    if (!targetProjectId || !parseDateOnly(dateValue)) {
      toast.error('仮リリース日を正しく入力してください');
      return;
    }

    const operationGeneration = beginOperation(action);
    try {
      await updateProject(targetProjectId, () => ({ provisional_release_date: dateValue }));
      if (canApplyOperationResult(targetProjectId, operationGeneration)) {
        toast.success(successMessage);
        setProvisionalDate(dateValue);
        setStatusMessage(`${successMessage} 日程はまだ変更していません。`);
      }
    } catch (error) {
      if (canApplyOperationResult(targetProjectId, operationGeneration)) {
        toast.error(error?.message || '仮リリース日を保存できませんでした');
      }
    } finally {
      if (canApplyOperationResult(targetProjectId, operationGeneration)) setWorkingAction('');
    }
  };

  const startStandardSchedule = () => applySchedule(
    SCHEDULE_DATE_SOURCE_PROVISIONAL, false, getStandardProvisionalDate(todayLocal()),
  );

  const copyProvisionalToOfficialDraft = () => {
    if (!parseDateOnly(provisionalDate)) {
      toast.error('先に仮リリース日を入力してください');
      return;
    }
    setReleaseDate(provisionalDate);
    setStatusMessage('仮日を正式な発売目標日の入力欄へコピーしました。まだ保存・逆算していません。');
  };

  const clearSavedDate = async (kind) => {
    const targetProjectId = project?.id;
    if (!targetProjectId) return;

    const isProvisional = kind === 'provisional';
    const expectedValue = isProvisional
      ? (project?.provisional_release_date || '')
      : (project?.release_target_date || '');
    const confirmation = isProvisional
      ? '消えるもの：仮リリース日だけ\n\n残るもの：逆算済みの日程、正式な発売目標日、配信方法、完了チェック、進捗、メモ、原稿、書誌情報、画像、論評\n\n日程も消す場合は「自動入力した日程だけ消す」を使ってください。実行しますか？'
      : '消えるもの：正式な発売目標日だけ\n\n残るもの：逆算済みの日程、仮リリース日、配信方法、完了チェック、進捗、メモ、原稿、書誌情報、画像、論評\n\n日程も消す場合は「自動入力した日程だけ消す」を使ってください。実行しますか？';
    if (!globalThis.window.confirm(confirmation)) return;

    const operationGeneration = beginOperation(`clear-${kind}`);
    try {
      await updateProject(targetProjectId, latest => {
        const latestValue = isProvisional
          ? (latest?.provisional_release_date || '')
          : (latest?.release_target_date || '');
        if (latestValue !== expectedValue) {
          throw new Error('確認後に別の画面で日付が変更されました。最新の表示を確認して、もう一度操作してください。');
        }
        const built = buildReleaseDateClearUpdate({ kind });
        return built.updates;
      });

      const message = isProvisional
        ? '仮リリース日だけを未設定へ戻しました。逆算済みの日程は残しています。'
        : '正式な発売目標日だけを未設定へ戻しました。逆算済みの日程と配信方法は残しています。';
      if (canApplyOperationResult(targetProjectId, operationGeneration)) {
        toast.success(message);
        setStatusMessage(message);
      }
    } catch (error) {
      if (canApplyOperationResult(targetProjectId, operationGeneration)) {
        toast.error(error?.message || '日付設定をリセットできませんでした');
      }
    } finally {
      if (canApplyOperationResult(targetProjectId, operationGeneration)) setWorkingAction('');
    }
  };

  const resetTaskDates = async (clearAll = false) => {
    const targetProjectId = project?.id;
    if (!targetProjectId) return;

    const expectedSnapshot = getScheduleRevisionSnapshot(project);
    const confirmation = clearAll
      ? '消えるもの：標準・追加タスクに入力したすべての目標日（手動日を含む）\n\n残るもの：仮リリース日、正式な発売目標日、配信方法、完了チェック、進捗、メモ、原稿、書誌情報、画像、論評、タスク本体\n\nこの操作は元に戻せません。実行しますか？'
      : '消えるもの：仮日・正式日を問わず、逆算で自動入力した目標日だけ\n\n残るもの：手動で変更した日付、仮リリース日、正式な発売目標日、配信方法、完了チェック、進捗、メモ、原稿、書誌情報、画像、論評\n\n実行しますか？';
    if (!globalThis.window.confirm(confirmation)) return;
    if (
      clearAll
      && !globalThis.window.confirm(
        '最終確認です。手動で入力した日付も含め、すべての目標日を削除します。日付以外は残ります。続けますか？',
      )
    ) return;

    const operationGeneration = beginOperation(
      clearAll ? 'reset-all-task-dates' : 'reset-auto-task-dates',
    );
    try {
      let result = { clearedCount: 0, preservedCount: 0 };
      await updateProject(targetProjectId, latest => {
        const latestSnapshot = getScheduleRevisionSnapshot(latest);
        if (JSON.stringify(latestSnapshot) !== JSON.stringify(expectedSnapshot)) {
          throw new Error('確認後に別の画面で日程が変更されました。最新の表示を確認して、もう一度操作してください。');
        }
        const built = buildReleaseTaskDatesResetUpdate(latest, { clearAll });
        result = built.result;
        return built.updates;
      });

      const message = clearAll
        ? `手動日を含む目標日 ${result.clearedCount} 件を消しました。仮日・正式な発売目標日・配信方法・進捗・メモは残しています。`
        : `自動入力した目標日 ${result.clearedCount} 件を消しました。手動日・仮日・正式な発売目標日・配信方法は残しています。`;
      if (canApplyOperationResult(targetProjectId, operationGeneration)) {
        toast.success(message);
        setStatusMessage(message);
      }
    } catch (error) {
      if (canApplyOperationResult(targetProjectId, operationGeneration)) {
        const message = error?.message || '日程をリセットできませんでした';
        toast.error(message);
        setStatusMessage(message);
      }
    } finally {
      if (canApplyOperationResult(targetProjectId, operationGeneration)) setWorkingAction('');
    }
  };

  return (
    <section
      id="release-schedule-card"
      tabIndex={-1}
      aria-busy={isWorking}
      className="relative z-20 scroll-mt-4 border-b border-border/50 px-2 py-3 outline-none"
      style={{ background: 'rgba(13,13,26,0.96)' }}
    >
      <div className="mx-auto max-w-7xl rounded-xl p-4" style={CARD_STYLE}>
        {project && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-current-work-summary>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-neon-cyan">次に進める作業</h2>
              <p className="mt-1 break-words text-sm text-foreground">
                {checklistError ? '保存データを確認してください' : nextTasks[0]?.title || '標準の作業はすべて完了しています'}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {project.release_target_date ? `発売目標日（正式）：${project.release_target_date}` : project.provisional_release_date ? `仮リリース日：${project.provisional_release_date}` : '目標日は未設定。日程を決める前でも作業を始められます。'}
                {nextTasks[0]?.due_date && ` ／ 次の作業の目標日：${nextTasks[0].due_date}`}
              </p>
            </div>
            {nextTasks[0] && !checklistError && onOpenTask && (
              <Button type="button" onClick={() => onOpenTask(nextTasks[0].taskId)} className="min-h-11 shrink-0 bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30">
                この作業を開く
              </Button>
            )}
          </div>
        )}
        <details open={settingsOpen} onToggle={event => setSettingsOpen(event.currentTarget.open)} className="mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-neon-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink">
            日程設定を{settingsOpen ? '閉じる' : '開く'}{(officialDraftChanged || provisionalDraftChanged) ? '（入力中・未保存）' : ''}
          </summary>
        <div className="flex items-start gap-2.5">
          <CalendarDays className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-pink" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-neon-pink neon-pink-glow">発売目標日から逆算</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              今日から標準8週間で始めるか、決めた発売日から逆算できます。手動変更・完了済みの日程は維持します。
            </p>
          </div>
        </div>

        {project ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-2">
              <div
                data-release-date-row="official"
                className="rounded-lg border border-neon-pink/25 bg-neon-pink/5 px-3 py-2.5"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <div className="min-w-0 md:w-52 md:flex-none">
                    <label htmlFor="release-target-date" className="text-xs font-black text-neon-pink">
                      発売目標日（正式）
                    </label>
                    <p id="release-target-date-help" className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                      ナビ内の正式な目標日です。KDPへ自動送信されません。
                    </p>
                  </div>
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
                    <input
                      id="release-target-date"
                      type="date"
                      value={releaseDate}
                      disabled={isWorking}
                      aria-describedby="release-target-date-help"
                      onChange={event => setReleaseDate(event.target.value)}
                      className="col-span-2 min-h-11 w-full min-w-0 rounded-md px-3 text-sm text-foreground focus:outline-none focus:border-neon-pink disabled:opacity-60 sm:h-9 sm:min-h-9 sm:w-44"
                      style={INPUT_STYLE}
                    />
                    {provisionalDate && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={copyProvisionalToOfficialDraft}
                        disabled={isWorking}
                        aria-label="仮日を正式欄へコピー"
                        className="min-h-11 gap-1.5 border-neon-pink/35 text-xs text-neon-pink sm:h-9 sm:min-h-9"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />仮日をコピー
                      </Button>
                    )}
                    <select
                      id="release-method"
                      value={releaseMethod}
                      disabled={isWorking}
                      aria-label="配信方法（正式日で逆算するときに選択）"
                      aria-describedby="release-method-help"
                      title={releaseMethodInfo?.guidance || '配信方法は正式な発売計画を決めるときに選びます。'}
                      onChange={event => setReleaseMethod(event.target.value)}
                      className="order-3 col-span-2 min-h-11 min-w-0 flex-1 rounded-md px-3 text-xs text-foreground focus:outline-none focus:border-neon-cyan disabled:opacity-60 sm:order-none sm:h-9 sm:min-h-9 sm:min-w-56"
                      style={INPUT_STYLE}
                    >
                      <option value="">配信方法：未設定</option>
                      {RELEASE_METHOD_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>配信方法：{option.shortLabel}</option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => applySchedule(SCHEDULE_DATE_SOURCE_RELEASE_TARGET, false)}
                      disabled={!releaseDate || !releaseMethod || isWorking || Boolean(checklistError)}
                      className="order-2 min-h-11 gap-1.5 border border-neon-pink/40 bg-neon-pink/20 text-xs text-neon-pink hover:bg-neon-pink/30 sm:order-none sm:h-9 sm:min-h-9"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {officialScheduleIsCurrent && !officialDraftChanged ? '正式日を再計算' : '正式日で逆算'}
                    </Button>
                  </div>
                </div>
                <p id="release-method-help" className="sr-only">
                  {releaseMethodInfo?.guidance || '配信方法は仮リリース日とは別です。正式な発売計画を決めるときに選んでください。'}
                </p>
                {hasPastScheduleTargets(releaseDate, todayLocal()) && <p className="mt-2 text-xs leading-5 text-neon-amber">この正式日で標準8週間を逆算すると、一部の予定が過去の日付になります。制作が進んでいる方向けです。</p>}
              </div>

              <div
                data-release-date-row="provisional"
                className="rounded-lg border border-neon-cyan/25 bg-neon-cyan/5 px-3 py-2.5"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <div className="flex min-w-0 items-start gap-2 md:w-52 md:flex-none">
                    <CalendarClock className="mt-0.5 hidden h-4 w-4 flex-shrink-0 text-neon-cyan md:block" aria-hidden="true" />
                    <div>
                      <label htmlFor="provisional-release-date" className="text-xs font-black text-neon-cyan">
                        仮リリース日（計画用）
                      </label>
                      <p id="provisional-release-date-help" className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                        初めてなら「今日から8週間」で始められます。あとで変更でき、KDPには反映しません。
                        <span className="sr-only">仮日を設定しても、KDPの発売日・予約注文・配信方法は決まりません。</span>
                      </p>
                    </div>
                  </div>
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
                    <input
                      id="provisional-release-date"
                      type="date"
                      value={provisionalDate}
                      disabled={isWorking}
                      aria-describedby="provisional-release-date-help"
                      onChange={event => setProvisionalDate(event.target.value)}
                      className="col-span-2 min-h-11 w-full min-w-0 rounded-md px-3 text-sm text-foreground focus:outline-none focus:border-neon-cyan disabled:opacity-60 sm:h-9 sm:min-h-9 sm:w-44"
                      style={INPUT_STYLE}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={startStandardSchedule}
                      disabled={isWorking || Boolean(checklistError)}
                      className="col-span-2 min-h-11 h-auto whitespace-normal gap-1.5 border border-neon-cyan/40 bg-neon-cyan/15 text-xs text-neon-cyan hover:bg-neon-cyan/25 sm:col-span-1"
                    >
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />今日から8週間で日程を作る
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => saveProvisionalDate(
                        provisionalDate,
                        'save-provisional',
                        `${provisionalDate} を仮リリース日に保存しました`,
                      )}
                      disabled={!provisionalDate || isWorking || !provisionalDraftChanged}
                      className="min-h-11 gap-1.5 border-neon-cyan/35 text-xs text-neon-cyan sm:h-9 sm:min-h-9"
                    >
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />仮日だけ保存
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => applySchedule(SCHEDULE_DATE_SOURCE_PROVISIONAL, false)}
                      disabled={!provisionalDate || isWorking || Boolean(checklistError)}
                      className="col-span-2 min-h-11 gap-1.5 border border-neon-cyan/50 bg-neon-cyan/20 text-xs text-neon-cyan hover:bg-neon-cyan/30 sm:col-span-1 sm:h-9 sm:min-h-9"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />この仮日で逆算
                    </Button>
                  </div>
                </div>
                {hasPastScheduleTargets(provisionalDate, todayLocal()) && <p className="mt-2 text-xs leading-5 text-neon-amber">この仮日で標準8週間を逆算すると、一部の予定が過去の日付になります。初めてなら「今日から8週間」を選べます。</p>}
              </div>

              {(officialDraftChanged || provisionalDraftChanged || currentScheduleDraftChanged) && (
                <div data-release-schedule-notices className="space-y-1 px-1 text-[11px] leading-5 text-neon-amber">
                  {officialDraftChanged && project.release_target_date && (
                    <p>正式日または配信方法が未反映です。「正式日で逆算」を押してください。</p>
                  )}
                  {provisionalDraftChanged && project.provisional_release_date && (
                    <p>入力中の仮日はまだ保存・逆算されていません。</p>
                  )}
                  {currentScheduleDraftChanged && (officialScheduleIsCurrent || provisionalScheduleIsCurrent) && (
                    <p>入力中の日付・配信方法が未保存のため、「すべて標準に戻す」は使えません。先に対応する逆算ボタンを押すか、入力を元へ戻してください。</p>
                  )}
                </div>
              )}

              <p
                className={statusMessage ? 'px-1 text-[11px] leading-5 text-neon-cyan' : 'sr-only'}
                aria-live="polite"
              >
                {statusMessage}
              </p>

              {checklistError && (
                <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] leading-relaxed text-destructive">
                  チェックリストの保存データに異常が見つかったため、日程の逆算とリセットを停止しています。上部の「データ管理」から先にバックアップを保存し、復元またはサポート用に保管してください。仮リリース日だけの保存は利用できます。
                </div>
              )}

              {!checklistError && nextTasks.length > 0 && (
                <div data-release-next-tasks className="border-t border-border/60 pt-2">
                  <p className="mb-1.5 text-[10px] font-bold text-neon-cyan">次にやること</p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                    {nextTasks.map(task => (
                      <button type="button" key={task.taskId} onClick={() => onOpenTask?.(task.taskId)} className="min-h-11 rounded-lg px-2.5 py-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid #2a2a4a' }}>
                        <p className={task.due_date && task.due_date < todayLocal() ? 'font-bold text-neon-amber' : 'font-bold text-neon-pink'}>{task.due_date || '日付未設定'}</p>
                        <p className="mt-1 text-foreground">{task.title}</p>
                        <span className="mt-1 block text-neon-cyan">この作業を開く</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div data-release-schedule-rail className="space-y-2 lg:self-start">
              <aside className="rounded-lg border border-[#323252] bg-[#111122] p-2.5 text-[11px] leading-4">
                <p className="text-[11px] font-black text-foreground">現在、各項目へ反映されている日程</p>
                {currentScheduleWindow ? (
                  <div className="mt-1.5 space-y-0.5 text-muted-foreground">
                    <p>
                      基準：{' '}
                      <span className={storedScheduleSource === SCHEDULE_DATE_SOURCE_PROVISIONAL ? 'font-bold text-neon-cyan' : 'font-bold text-neon-pink'}>
                        {storedScheduleSource === SCHEDULE_DATE_SOURCE_PROVISIONAL
                          ? `仮リリース日 ${currentScheduleWindow.releaseDate}`
                          : `発売目標日（正式） ${currentScheduleWindow.releaseDate}`}
                      </span>
                    </p>
                    {storedScheduleSource === SCHEDULE_DATE_SOURCE_PROVISIONAL && (
                      <p className="font-bold text-neon-amber">
                        計画用です。KDPの発売日・予約注文・配信方法は変わりません。
                        <span className="sr-only">正式な発売目標日ではありません。</span>
                      </p>
                    )}
                    {storedScheduleSource === SCHEDULE_DATE_SOURCE_PROVISIONAL && !project.provisional_release_date && (
                      <p className="font-bold text-neon-amber">基準にした仮日は削除済みですが、この逆算日程は残っています。不要なら「自動入力した日程だけ消す」を使ってください。</p>
                    )}
                    {storedScheduleSource === SCHEDULE_DATE_SOURCE_RELEASE_TARGET && !project.release_target_date && (
                      <p className="font-bold text-neon-amber">基準にした発売目標日は削除済みですが、この逆算日程は残っています。不要なら「自動入力した日程だけ消す」を使ってください。</p>
                    )}
                    <p>
                      制作開始目安 <span className="font-bold text-neon-cyan">{currentScheduleWindow.startDate}</span>
                      <span className="mx-1">→</span>
                      基準日 <span className="font-bold text-foreground">{currentScheduleWindow.releaseDate}</span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-1.5 text-muted-foreground">まだ逆算日程は設定されていません。</p>
                )}
                <p className="mt-1.5 text-muted-foreground">手動変更した日は通常の再計算でも維持します。</p>
                {overdueCount > 0 && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-neon-amber">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />期限超過の未完了タスク {overdueCount} 件
                  </p>
                )}
                {(officialScheduleIsCurrent || provisionalScheduleIsCurrent) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => applySchedule(storedScheduleSource, true)}
                    disabled={isWorking || Boolean(checklistError) || currentScheduleDraftChanged}
                    className="mt-1.5 min-h-11 w-full gap-1.5 text-[11px] text-muted-foreground hover:text-neon-amber lg:h-9 lg:min-h-9"
                    title="手動変更を含む全日付を現在の基準日から再設定します"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />すべて標準に戻す
                  </Button>
                )}
              </aside>

              <details className="rounded-lg border border-neon-amber/25 bg-neon-amber/5 px-3 py-1">
                <summary className="flex min-h-11 cursor-pointer items-center font-black text-xs text-neon-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber/70 lg:min-h-9">
                  日付設定を整理・リセットする
                </summary>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  日付ごとに独立して戻せます。通常は「自動入力した日程だけ」を選ぶと安全です。
                </p>
                <div className="mt-2 grid gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => clearSavedDate('official')}
                    disabled={isWorking || !project.release_target_date}
                    className="min-h-11 h-auto whitespace-normal border-neon-amber/35 px-3 py-2 text-xs text-neon-amber"
                  >
                    発売目標日だけ未設定に戻す
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => clearSavedDate('provisional')}
                    disabled={isWorking || !project.provisional_release_date}
                    className="min-h-11 h-auto whitespace-normal border-neon-amber/35 px-3 py-2 text-xs text-neon-amber"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />仮日だけ未設定に戻す
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => resetTaskDates(false)}
                    disabled={isWorking || Boolean(checklistError) || !hasAnyAutoTaskDateMetadata}
                    className="min-h-11 h-auto whitespace-normal border-neon-amber/35 px-3 py-2 text-xs text-neon-amber"
                  >
                    自動入力した日程だけ消す
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => resetTaskDates(true)}
                    disabled={isWorking || Boolean(checklistError) || !hasAnyTaskDateMetadata}
                    className="min-h-11 h-auto whitespace-normal border-destructive/50 px-3 py-2 text-xs text-destructive hover:bg-destructive/10"
                  >
                    手動日を含むすべての日程を消す
                  </Button>
                </div>
              </details>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">先に出版プロジェクトを作成してください。</p>
        )}
        </details>
        {!settingsOpen && statusMessage && <p role="status" className="mt-2 text-xs leading-5 text-neon-cyan">{statusMessage}</p>}

      </div>
    </section>
  );
}
