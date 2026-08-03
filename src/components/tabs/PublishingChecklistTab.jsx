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
const VIEW_PREFERENCE_KEY = 'up-publishing-checklist-view';
const OVERVIEW_LEFT_PHASES = CREATION_PHASES.slice(0, 3);
const OVERVIEW_RIGHT_CREATION_PHASE = CREATION_PHASES[3];
const INDIVIDUAL_PHASES = [
  ...CREATION_PHASES.map(phase => ({ id: phase.id, label: phase.label, kind: 'checklist', phase })),
  { id: KDP_PHASES[0].id, label: KDP_PHASES[0].label, kind: 'kdp' },
  ...PROMO_PHASES.map(phase => ({ id: phase.id, label: phase.label, kind: 'checklist', phase })),
];
const VALID_PHASE_IDS = new Set(INDIVIDUAL_PHASES.map(phase => phase.id));

function readViewPreference() {
  const fallback = { mode: 'overview', phaseId: INDIVIDUAL_PHASES[0].id };
  try {
    const raw = localStorage.getItem(VIEW_PREFERENCE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    return {
      mode: saved?.mode === 'individual' ? 'individual' : 'overview',
      phaseId: VALID_PHASE_IDS.has(saved?.phaseId) ? saved.phaseId : fallback.phaseId,
    };
  } catch {
    return fallback;
  }
}

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
  const [viewPreference, setViewPreference] = React.useState(readViewPreference);
  const selectedPhase = INDIVIDUAL_PHASES.find(phase => phase.id === viewPreference.phaseId) || INDIVIDUAL_PHASES[0];

  const updateViewPreference = nextPreference => {
    setViewPreference(nextPreference);
    try {
      localStorage.setItem(VIEW_PREFERENCE_KEY, JSON.stringify(nextPreference));
    } catch {
      // 表示設定を保存できなくても、チェックリスト本体の操作は継続できます。
    }
  };

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

      <section className="rounded-xl border border-border/60 p-4" style={{ background: '#1a1a2e' }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground">フェーズの表示方法</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              全体の流れを見渡すか、今取り組むフェーズだけに集中できます。
            </p>
          </div>
          <div role="group" aria-label="フェーズの表示方法" className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-black/20 p-1">
            <button
              type="button"
              aria-pressed={viewPreference.mode === 'overview'}
              onClick={() => updateViewPreference({ ...viewPreference, mode: 'overview' })}
              className={`min-h-9 rounded-md px-4 text-xs font-bold transition-colors ${viewPreference.mode === 'overview' ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
            >
              全体表示
            </button>
            <button
              type="button"
              aria-pressed={viewPreference.mode === 'individual'}
              onClick={() => updateViewPreference({ ...viewPreference, mode: 'individual' })}
              className={`min-h-9 rounded-md px-4 text-xs font-bold transition-colors ${viewPreference.mode === 'individual' ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
            >
              個別表示
            </button>
          </div>
        </div>

        {viewPreference.mode === 'individual' && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" role="group" aria-label="表示するフェーズ">
            {INDIVIDUAL_PHASES.map(phase => (
              <button
                key={phase.id}
                type="button"
                aria-pressed={viewPreference.phaseId === phase.id}
                onClick={() => updateViewPreference({ mode: 'individual', phaseId: phase.id })}
                className={`min-h-10 rounded-lg border px-2 py-2 text-[10px] font-bold leading-snug transition-colors ${viewPreference.phaseId === phase.id ? 'border-neon-pink/50 bg-neon-pink/15 text-neon-pink' : 'border-border/60 bg-white/[0.03] text-muted-foreground hover:border-border hover:text-foreground'}`}
              >
                {phase.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {viewPreference.mode === 'overview' ? (
        /* PCは0〜2と3〜5を均等に分け、スマホは縦並び */
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <TaskChecklist
            phases={OVERVIEW_LEFT_PHASES}
            allTaskIds={OVERVIEW_LEFT_PHASES.flatMap(phase => phase.tasks.map(task => task.id))}
            checklistData={checklistData}
            customTasks={customTasks}
            onTaskChange={handleTaskChange}
            onCustomTaskChange={handleCustomTaskChange}
            onDeleteCustomTask={handleDeleteCustomTask}
            onAddCustomTask={handleAddCustomTask}
            progressLabel="Kindle本制作進捗"
            showProgress={false}
          />

          <div className="space-y-4">
            <PhaseSection
              phase={OVERVIEW_RIGHT_CREATION_PHASE}
              checklistData={checklistData}
              onTaskChange={handleTaskChange}
            />
            <KdpPhaseSummary
              state={checklistData[KDP_COMPLETION_TASK.id]}
              onChange={state => handleTaskChange(KDP_COMPLETION_TASK.id, state)}
              onNavigateTab={onNavigateTab}
            />
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
      ) : (
        <div className="w-full">
          <TaskChecklist
            phases={selectedPhase.kind === 'checklist' ? [selectedPhase.phase] : []}
            allTaskIds={selectedPhase.kind === 'checklist' ? selectedPhase.phase.tasks.map(task => task.id) : []}
            checklistData={checklistData}
            customTasks={customTasks}
            onTaskChange={handleTaskChange}
            onCustomTaskChange={handleCustomTaskChange}
            onDeleteCustomTask={handleDeleteCustomTask}
            onAddCustomTask={handleAddCustomTask}
            progressLabel={selectedPhase.label}
            showProgress={false}
            afterPhases={selectedPhase.kind === 'kdp' ? (
              <KdpPhaseSummary
                state={checklistData[KDP_COMPLETION_TASK.id]}
                onChange={state => handleTaskChange(KDP_COMPLETION_TASK.id, state)}
                onNavigateTab={onNavigateTab}
              />
            ) : null}
          />
        </div>
      )}
    </div>
  );
}
