import React from 'react';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ALL_CREATION_IDS,
  ALL_PROMO_IDS,
  CREATION_PHASES,
  KDP_PHASES,
  PROMO_PHASES,
} from '@/lib/checklistTasks';
import { useChecklistState } from '@/hooks/useChecklistState';
import TaskChecklist, { ChecklistProgress, PhaseSection } from '@/components/shared/TaskChecklist';

const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };
const KDP_COMPLETION_TASK = KDP_PHASES[0].tasks[KDP_PHASES[0].tasks.length - 1];
const DASHBOARD_TASK_IDS = [...ALL_CREATION_IDS, ...ALL_PROMO_IDS];

function KdpPhaseSummary({ state, onChange, onNavigateTab }) {
  const current = state || { is_done: false, due_date: '', note: KDP_COMPLETION_TASK.note_default || '' };

  return (
    <section className="rounded-xl border border-neon-cyan/30 p-4" style={{ background: '#1a1a2e', borderLeft: '4px solid #00f5ff' }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-neon-cyan" />
          <div>
            <h3 className="text-sm font-bold text-neon-cyan">フェーズ4：KDP登録</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              KDPへの提出完了目標だけを表示しています。詳しい登録項目は専用欄で管理できます。
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onNavigateTab?.('kdp')}
          className="h-8 flex-shrink-0 gap-1 text-[10px] text-neon-cyan hover:bg-neon-cyan/10 hover:text-neon-cyan"
        >
          KDP登録欄を開く<ArrowRight className="h-3 w-3" />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-neon-cyan/15 bg-black/10 px-3 py-2.5">
        <label htmlFor="phase4-completion-date" className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">完了目標日</label>
        <input
          id="phase4-completion-date"
          type="date"
          value={current.due_date || ''}
          onChange={event => onChange({ ...current, due_date: event.target.value, due_date_source: 'manual' })}
          className="h-8 min-w-[132px] rounded px-2 text-xs text-foreground focus:outline-none focus:border-neon-cyan"
          style={INPUT_STYLE}
        />
        <span className={`text-[9px] whitespace-nowrap ${current.due_date ? (current.due_date_source === 'auto' ? 'text-neon-cyan' : 'text-neon-amber') : 'text-muted-foreground'}`}>
          {current.due_date ? (current.due_date_source === 'auto' ? '自動' : '手動') : '未設定'}
        </span>
      </div>
    </section>
  );
}

export default function PublishingChecklistTab({ project, onProjectUpdate, onNavigateTab }) {
  const { checklistData, customTasks, handleTaskChange, handleCustomTaskChange, handleDeleteCustomTask, handleAddCustomTask } =
    useChecklistState(project, onProjectUpdate);

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground"><span className="text-4xl">📚</span><p className="mt-3 text-sm">ヘッダーの「＋」からプロジェクトを作成してください</p></div>;
  }

  return (
    <div className="space-y-6">
      <ChecklistProgress
        allTaskIds={DASHBOARD_TASK_IDS}
        checklistData={checklistData}
        customTasks={customTasks}
        progressLabel="Kindle本 制作・プロモーション進捗"
      />

      {/* PCは制作とプロモーションを2カラム、スマホは縦並び */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <TaskChecklist
            phases={CREATION_PHASES}
            allTaskIds={ALL_CREATION_IDS}
            checklistData={checklistData}
            customTasks={customTasks}
            onTaskChange={handleTaskChange}
            onCustomTaskChange={handleCustomTaskChange}
            onDeleteCustomTask={handleDeleteCustomTask}
            onAddCustomTask={handleAddCustomTask}
            progressLabel="Kindle本制作進捗"
            showProgress={false}
            afterPhases={(
              <KdpPhaseSummary
                state={checklistData[KDP_COMPLETION_TASK.id]}
                onChange={state => handleTaskChange(KDP_COMPLETION_TASK.id, state)}
                onNavigateTab={onNavigateTab}
              />
            )}
          />
        </div>

        <div className="space-y-4">
          {PROMO_PHASES.map(phase => (
            <PhaseSection
              key={phase.id}
              phase={phase}
              checklistData={checklistData}
              onTaskChange={handleTaskChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
