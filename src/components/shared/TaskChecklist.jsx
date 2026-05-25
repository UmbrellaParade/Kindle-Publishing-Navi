import React, { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Zap, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };

const PHASE_COLORS = {
  pink:  { header: 'text-neon-pink', badge: 'bg-neon-pink/20 text-neon-pink border-neon-pink/30', left: '4px solid #ff2d78' },
  cyan:  { header: 'text-neon-cyan', badge: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30', left: '4px solid #00f5ff' },
  amber: { header: 'text-neon-amber', badge: 'bg-neon-amber/20 text-neon-amber border-neon-amber/30', left: '4px solid #ffb300' },
};

function TaskRow({ task, state, onChange }) {
  const [open, setOpen] = useState(false);
  const s = state || { is_done: false, due_date: '', note: '' };

  return (
    <div className={`rounded-lg border transition-all ${s.is_done ? 'opacity-50' : task.important ? 'border-neon-pink/30' : 'border-border/60 hover:border-border'}`}
      style={{ background: s.is_done ? 'rgba(255,255,255,0.02)' : task.important ? 'rgba(255,45,120,0.04)' : 'rgba(255,255,255,0.03)' }}>
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <button
          onClick={() => onChange({ ...s, is_done: !s.is_done })}
          className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${s.is_done ? 'bg-neon-cyan border-neon-cyan' : 'border-muted-foreground/40 hover:border-neon-cyan'}`}
        >
          {s.is_done && <span className="text-black text-[10px] font-black leading-none">✓</span>}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.important && <Zap className="w-3 h-3 text-neon-pink flex-shrink-0" />}
            <span className={`text-xs leading-relaxed ${s.is_done ? 'line-through text-muted-foreground' : task.important ? 'font-bold text-neon-pink' : 'text-foreground'}`}>
              {task.title}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5 inline-block">{task.tool}</span>
        </div>
        <button onClick={() => setOpen(v => !v)} className="text-[10px] text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {open ? '▲' : '▼'}
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground whitespace-nowrap">完了目標日</label>
            <input type="date" value={s.due_date || ''} onChange={e => onChange({ ...s, due_date: e.target.value })}
              className="text-xs rounded px-2 py-1 text-foreground focus:outline-none flex-1"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' }} />
          </div>
          <textarea value={s.note || ''} onChange={e => onChange({ ...s, note: e.target.value })} rows={2}
            placeholder="メモ・備考..."
            className="w-full text-xs rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' }} />
        </div>
      )}
    </div>
  );
}

function PhaseSection({ phase, checklistData, onTaskChange }) {
  const [open, setOpen] = useState(true);
  const c = PHASE_COLORS[phase.color] || PHASE_COLORS.cyan;
  const done = phase.tasks.filter(t => checklistData[t.id]?.is_done).length;

  return (
    <div className="rounded-xl overflow-hidden" style={{ ...CARD_STYLE, borderLeft: c.left }}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors">
        <h3 className={`text-sm font-bold flex-1 ${c.header}`}>{phase.label}</h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${c.badge}`}>{done}/{phase.tasks.length}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-2">
              {phase.tasks.map(task => (
                <TaskRow key={task.id} task={task} state={checklistData[task.id]} onChange={s => onTaskChange(task.id, s)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 汎用チェックリストコンポーネント
 * phases: PhaseオブジェクトArray
 * allTaskIds: 全タスクID配列（進捗計算用）
 * checklistData / customTasks / onTaskChange / onCustomTaskChange / onDeleteCustomTask / onAddCustomTask: 親から渡す
 */
export default function TaskChecklist({ phases, allTaskIds, checklistData, customTasks, onTaskChange, onCustomTaskChange, onDeleteCustomTask, onAddCustomTask, progressLabel }) {
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const customDone = customTasks.filter(t => t.state?.is_done).length;
  const totalTasks = allTaskIds.length + customTasks.length;
  const doneTasks = allTaskIds.filter(id => checklistData[id]?.is_done).length + customDone;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const handleAdd = () => {
    if (!newTaskTitle.trim()) return;
    onAddCustomTask(newTaskTitle.trim());
    setNewTaskTitle('');
    setAddingTask(false);
    toast.success('タスクを追加しました');
  };

  return (
    <div className="space-y-4">
      {/* 進捗バー */}
      <div className="rounded-xl p-4 space-y-2" style={CARD_STYLE}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-foreground">{progressLabel || '進捗'}</span>
          <span className="font-bold text-neon-pink">{doneTasks} / {totalTasks} 完了（{pct}%）</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      {/* フェーズ別 */}
      {phases.map(phase => (
        <PhaseSection key={phase.id} phase={phase} checklistData={checklistData} onTaskChange={onTaskChange} />
      ))}

      {/* カスタムタスク */}
      {customTasks.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ ...CARD_STYLE, borderLeft: '4px solid #ffb300' }}>
          <div className="px-4 py-3"><h3 className="text-sm font-bold text-neon-amber">追加タスク</h3></div>
          <div className="px-4 pb-4 space-y-2">
            {customTasks.map((t, idx) => (
              <div key={t.id} className="relative">
                <TaskRow task={{ ...t, important: false }} state={t.state} onChange={s => onCustomTaskChange(idx, s)} />
                <button onClick={() => onDeleteCustomTask(idx)} className="absolute top-2 right-10 text-muted-foreground hover:text-destructive transition-colors p-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* タスク追加 */}
      <div className="rounded-xl p-4" style={CARD_STYLE}>
        {addingTask ? (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              autoFocus
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddingTask(false); }}
              placeholder="タスク名を入力..."
              className="flex-1 h-8 px-3 text-xs rounded text-foreground placeholder:text-muted-foreground focus:outline-none min-w-[200px]"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' }}
            />
            <Button size="sm" className="h-8 text-xs bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30" onClick={handleAdd}>追加</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddingTask(false)}>キャンセル</Button>
          </div>
        ) : (
          <button onClick={() => setAddingTask(true)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-neon-cyan transition-colors w-full">
            <Plus className="w-4 h-4" />タスクを追加
          </button>
        )}
      </div>
    </div>
  );
}
