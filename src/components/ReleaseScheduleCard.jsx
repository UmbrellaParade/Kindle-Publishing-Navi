import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  RELEASE_SCHEDULE_VERSION,
  RELEASE_TASK_OFFSETS,
  applyReleaseSchedule,
  countOverdueTasks,
  getScheduleWindow,
  readChecklistEnvelope,
  writeChecklistEnvelope,
} from '@/lib/releaseSchedule';
import { flushPendingSaves } from '@/lib/saveCoordinator';
import { toast } from 'sonner';
import { CREATION_PHASES, KDP_PHASES, PROMO_PHASES } from '@/lib/checklistTasks';
import { DEFAULT_RELEASE_METHOD, getReleaseMethod, RELEASE_METHOD_OPTIONS } from '@/lib/releaseMethods';
import { mutatePublishingProject } from '@/lib/projectMutation';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };
const TASK_TITLES = Object.fromEntries(
  [...CREATION_PHASES, ...KDP_PHASES, ...PROMO_PHASES]
    .flatMap(phase => phase.tasks.map(task => [task.id, task.title])),
);

function todayLocal() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function ReleaseScheduleCard({ project, onProjectUpdate }) {
  const [releaseDate, setReleaseDate] = useState('');
  const [releaseMethod, setReleaseMethod] = useState(DEFAULT_RELEASE_METHOD);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    setReleaseDate(project?.release_target_date || '');
    setReleaseMethod(project?.release_method || project?.schedule_mode || DEFAULT_RELEASE_METHOD);
  }, [project?.id, project?.release_target_date, project?.release_method, project?.schedule_mode]);

  const { data: checklistData, error: checklistError } = useMemo(
    () => readChecklistEnvelope(project?.checklist_data),
    [project?.checklist_data],
  );
  const scheduleWindow = useMemo(() => getScheduleWindow(releaseDate), [releaseDate]);
  const overdueCount = useMemo(
    () => countOverdueTasks(checklistData, todayLocal()),
    [checklistData],
  );
  const nextTasks = useMemo(() => Object.keys(RELEASE_TASK_OFFSETS)
    .map(taskId => ({ taskId, title: TASK_TITLES[taskId] || taskId, ...checklistData[taskId] }))
    .filter(task => task.due_date && !task.is_done)
    .sort((left, right) => left.due_date.localeCompare(right.due_date))
    .slice(0, 3), [checklistData]);
  const releaseMethodInfo = getReleaseMethod(releaseMethod);
  const isCalculated = Boolean(
    project?.schedule_calculated_for
    && project.schedule_calculated_for === project.release_target_date
    && (project.schedule_mode || DEFAULT_RELEASE_METHOD) === releaseMethod
  );
  const draftChanged = releaseDate !== (project?.release_target_date || '')
    || releaseMethod !== (project?.release_method || project?.schedule_mode || DEFAULT_RELEASE_METHOD);

  const calculate = async (overwriteManual = false) => {
    if (!releaseDate) {
      toast.error('発売目標日を入力してください');
      return;
    }

    if (overwriteManual && !globalThis.window.confirm('手動で変更した日付と完了済みタスクの日付も、標準スケジュールで上書きします。よろしいですか？')) {
      return;
    }

    setCalculating(true);
    try {
      await flushPendingSaves();
      let result;
      const updated = await mutatePublishingProject(project.id, latest => {
        const { data } = readChecklistEnvelope(latest.checklist_data);
        result = applyReleaseSchedule(data, releaseDate, { overwriteManual });
        const checklist_data = writeChecklistEnvelope(latest.checklist_data, result.data, {
          _schedule_version: RELEASE_SCHEDULE_VERSION,
          _schedule_calculated_for: releaseDate,
          _schedule_mode: releaseMethod,
        });
        return {
          release_target_date: releaseDate,
          release_method: releaseMethod,
          schedule_calculated_for: releaseDate,
          schedule_mode: releaseMethod,
          checklist_data,
        };
      }, project);

      onProjectUpdate(updated);
      const preserved = result.preservedCount > 0
        ? `（手動変更・完了済み ${result.preservedCount} 件は維持）`
        : '';
      toast.success(`${result.updatedCount} 件の目標日を逆算しました${preserved}`);
    } catch (error) {
      toast.error(error?.message || 'スケジュールの保存に失敗しました');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <section className="relative z-20 px-2 py-3 border-b border-border/50" style={{ background: 'rgba(13,13,26,0.96)' }}>
      <div className="max-w-7xl mx-auto rounded-xl p-4" style={CARD_STYLE}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-start gap-2.5 lg:min-w-[245px]">
            <CalendarDays className="w-5 h-5 text-neon-pink mt-0.5 flex-shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-neon-pink neon-pink-glow">発売目標日から逆算</h2>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                標準 8 週間で制作・KDP・告知の日程をまとめて設定します。
              </p>
            </div>
          </div>

          {project ? (
            <>
              <div className="flex-1 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label htmlFor="release-target-date" className="text-xs font-bold whitespace-nowrap">発売目標日</label>
                  <input
                    id="release-target-date"
                    type="date"
                    value={releaseDate}
                    onChange={event => setReleaseDate(event.target.value)}
                    className="h-9 rounded-md px-3 text-sm text-foreground focus:outline-none focus:border-neon-pink"
                    style={INPUT_STYLE}
                  />
                  <Button
                    size="sm"
                    onClick={() => calculate(false)}
                    disabled={!releaseDate || calculating}
                    className="h-9 gap-1.5 bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {calculating ? '計算中...' : isCalculated && !draftChanged ? '自動日だけ再計算' : '逆算して設定'}
                  </Button>
                  {isCalculated && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => calculate(true)}
                      disabled={!releaseDate || calculating}
                      className="h-9 gap-1.5 text-[11px] text-muted-foreground hover:text-neon-amber"
                      title="手動変更を含む全日付を標準スケジュールに戻します"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />すべて標準に戻す
                    </Button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label htmlFor="release-method" className="text-xs font-bold whitespace-nowrap">配信方法</label>
                  <select id="release-method" value={releaseMethod} onChange={event => setReleaseMethod(event.target.value)} className="h-9 min-w-0 flex-1 rounded-md px-3 text-xs text-foreground focus:outline-none focus:border-neon-cyan" style={INPUT_STYLE}>
                    {RELEASE_METHOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground">{releaseMethodInfo.guidance}</p>
              </div>

              <div className="lg:text-right lg:min-w-[245px] text-[11px] leading-relaxed">
                {scheduleWindow ? (
                  <p className="text-muted-foreground">
                    制作開始目安 <span className="text-neon-cyan font-bold">{scheduleWindow.startDate}</span>
                    <span className="mx-1">→</span>
                    発売 <span className="text-neon-pink font-bold">{scheduleWindow.releaseDate}</span>
                  </p>
                ) : (
                  <p className="text-muted-foreground">発売日を選ぶと期間を確認できます</p>
                )}
                <p className="mt-1 text-muted-foreground">各タスクの日付はあとから手動変更でき、次回の再計算でも維持されます。</p>
                {draftChanged && project.release_target_date && (
                  <p className="mt-1 text-neon-amber">発売日が未反映です。「逆算して設定」を押してください。</p>
                )}
                {overdueCount > 0 && (
                  <p className="mt-1 text-neon-amber inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />期限超過の未完了タスク {overdueCount} 件
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">先に出版プロジェクトを作成してください。</p>
          )}
        </div>
        {project && checklistError && (
          <div role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] leading-relaxed text-destructive">
            チェックリストの保存データに異常が見つかったため、上書きを停止しています。上部の「データ管理」から先にバックアップを保存し、復元またはサポート用に保管してください。
          </div>
        )}
        {project && isCalculated && nextTasks.length > 0 && (
          <div className="mt-3 border-t border-border/60 pt-3">
            <p className="text-[10px] font-bold text-neon-cyan mb-2">次にやること</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {nextTasks.map(task => (
                <div key={task.taskId} className="rounded-lg px-3 py-2 text-[11px]" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid #2a2a4a' }}>
                  <p className={task.due_date < todayLocal() ? 'font-bold text-neon-amber' : 'font-bold text-neon-pink'}>{task.due_date}</p>
                  <p className="mt-0.5 text-muted-foreground line-clamp-2">{task.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
