import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { PROMO_PHASES, ALL_PROMO_IDS } from '@/lib/checklistTasks';
import { Progress } from '@/components/ui/progress';
import { Zap, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };

const SNS_OPTIONS = ['X', 'Instagram', 'TikTok', 'その他'];
const SNS_COLORS = {
  'X': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Instagram': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'TikTok': 'bg-red-500/20 text-red-400 border-red-500/30',
  'その他': 'bg-secondary text-muted-foreground border-border',
};

// ─ タスク行 ─
function TaskRow({ task, state, onChange }) {
  const [open, setOpen] = useState(false);
  const s = state || { is_done: false, due_date: '', note: '' };
  return (
    <div className={`rounded-lg border transition-all ${s.is_done ? 'opacity-50' : task.important ? 'border-neon-pink/30' : 'border-border/60'}`}
      style={{ background: s.is_done ? 'rgba(255,255,255,0.02)' : task.important ? 'rgba(255,45,120,0.04)' : 'rgba(255,255,255,0.03)' }}>
      <div className="flex items-start gap-2 px-3 py-2.5">
        <button onClick={() => onChange({ ...s, is_done: !s.is_done })}
          className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${s.is_done ? 'bg-neon-cyan border-neon-cyan' : 'border-muted-foreground/40 hover:border-neon-cyan'}`}>
          {s.is_done && <span className="text-black text-[10px] font-black leading-none">✓</span>}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            {task.important && <Zap className="w-3 h-3 text-neon-pink flex-shrink-0" />}
            <span className={`text-xs leading-relaxed ${s.is_done ? 'line-through text-muted-foreground' : task.important ? 'font-bold text-neon-pink' : 'text-foreground'}`}>{task.title}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{task.tool}</span>
        </div>
        <button onClick={() => setOpen(v => !v)} className="flex-shrink-0 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {open ? '▲' : '▼'}
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground whitespace-nowrap">完了目標日</label>
            <input type="date" value={s.due_date || ''} onChange={e => onChange({ ...s, due_date: e.target.value })}
              className="text-xs rounded px-2 py-1 text-foreground focus:outline-none flex-1" style={INPUT_STYLE} />
          </div>
          <textarea value={s.note || ''} onChange={e => onChange({ ...s, note: e.target.value })} rows={2}
            placeholder="メモ..." className="w-full text-xs rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none resize-none" style={INPUT_STYLE} />
        </div>
      )}
    </div>
  );
}

// ─ SNS 投稿文カラム ─
function SnsPostColumn({ title, data, onChange, color }) {
  const [copied, setCopied] = useState(false);
  const c = color === 'cyan'
    ? { border: 'border-neon-cyan/30', text: 'text-neon-cyan', bg: 'rgba(0,245,255,0.04)', btn: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/30' }
    : { border: 'border-neon-amber/30', text: 'text-neon-amber', bg: 'rgba(255,179,0,0.04)', btn: 'bg-neon-amber/20 text-neon-amber border-neon-amber/40 hover:bg-neon-amber/30' };

  const handleCopy = () => {
    navigator.clipboard.writeText(data.body || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('コピーしました');
  };

  return (
    <div className={`rounded-xl border ${c.border} p-3 flex flex-col gap-3`} style={{ background: c.bg, minHeight: '600px' }}>
      <h3 className={`text-sm font-bold ${c.text}`}>{title}</h3>
      <input value={data.subtitle || ''} onChange={e => onChange({ ...data, subtitle: e.target.value })}
        placeholder="例：発売告知ツイート"
        className="h-8 px-2 text-xs rounded text-foreground placeholder:text-muted-foreground focus:outline-none"
        style={INPUT_STYLE} />
      <div className="flex flex-wrap gap-1">
        {SNS_OPTIONS.map(sns => (
          <button key={sns} onClick={() => {
            const tags = data.tags || [];
            onChange({ ...data, tags: tags.includes(sns) ? tags.filter(t => t !== sns) : [...tags, sns] });
          }} className={`text-[10px] px-2 py-0.5 rounded-full border font-bold transition-all ${(data.tags || []).includes(sns) ? SNS_COLORS[sns] : 'bg-secondary/50 text-muted-foreground border-border hover:border-muted-foreground'}`}>
            {sns}
          </button>
        ))}
      </div>
      <textarea value={data.body || ''} onChange={e => onChange({ ...data, body: e.target.value })}
        placeholder="投稿文を入力..."
        className="flex-1 text-xs rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
        style={{ ...INPUT_STYLE, minHeight: '450px' }} />
      <Button size="sm" onClick={handleCopy} className={`h-7 text-xs gap-1.5 border ${c.btn}`}>
        {copied ? <><Check className="w-3 h-3" />コピー済み</> : <><Copy className="w-3 h-3" />📋 コピー</>}
      </Button>
    </div>
  );
}

export default function PromoChecklistTab({ project, onProjectUpdate, saving, saved }) {
  const [checklistData, setChecklistData] = useState({});
  const [goal, setGoal] = useState('');
  const [strategyMemo, setStrategyMemo] = useState('');
  const [snsPost1, setSnsPost1] = useState({ subtitle: '', tags: [], body: '' });
  const [snsPost2, setSnsPost2] = useState({ subtitle: '', tags: [], body: '' });
  const saveTimer = useRef(null);

  // プロジェクト選択時にデータを読み込み
  useEffect(() => {
    if (!project) { setChecklistData({}); setGoal(''); setStrategyMemo(''); setSnsPost1({ subtitle: '', tags: [], body: '' }); setSnsPost2({ subtitle: '', tags: [], body: '' }); return; }
    
    // checklist_data から読み込み
    try {
      const parsed = project.checklist_data ? JSON.parse(project.checklist_data) : {};
      setChecklistData(parsed._data || {});
    } catch { setChecklistData({}); }

    // promotion_goal, strategy_memo, sns_memo1, sns_memo2 から読み込み
    setGoal(project.promotion_goal || '');
    setStrategyMemo(project.strategy_memo || '');
    
    try {
      const memo1 = project.sns_memo1 ? JSON.parse(project.sns_memo1) : { subtitle: '', tags: [], body: '' };
      setSnsPost1(memo1);
    } catch { setSnsPost1({ subtitle: '', tags: [], body: '' }); }
    
    try {
      const memo2 = project.sns_memo2 ? JSON.parse(project.sns_memo2) : { subtitle: '', tags: [], body: '' };
      setSnsPost2(memo2);
    } catch { setSnsPost2({ subtitle: '', tags: [], body: '' }); }
  }, [project?.id]);

  // 自動保存（checklist_data）
  const scheduleSaveChecklist = (data) => {
    if (!project) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const updated = await base44.entities.PublishingProject.update(project.id, {
        checklist_data: JSON.stringify({ _data: data }),
      });
      onProjectUpdate(updated);
    }, 1000);
  };

  // 自動保存（promotion_goal, strategy_memo, sns_memo）
  const scheduleSavePromo = (updates) => {
    if (!project) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const updated = await base44.entities.PublishingProject.update(project.id, updates);
      onProjectUpdate(updated);
    }, 1000);
  };

  const handleTaskChange = (taskId, newState) => {
    const next = { ...checklistData, [taskId]: newState };
    setChecklistData(next);
    scheduleSaveChecklist(next);
  };

  const allTasks = PROMO_PHASES.flatMap(p => p.tasks);
  const doneTasks = ALL_PROMO_IDS.filter(id => checklistData[id]?.is_done).length;
  const pct = ALL_PROMO_IDS.length > 0 ? Math.round((doneTasks / ALL_PROMO_IDS.length) * 100) : 0;

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground"><span className="text-4xl">📣</span><p className="mt-3 text-sm">プロジェクトを選択してください</p></div>;
  }

  return (
    <div className="space-y-5">
      {/* 進捗バー */}
      <div className="rounded-xl p-4 space-y-2" style={CARD_STYLE}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-neon-pink" />プロモーション進捗</span>
          <span className="font-bold text-neon-pink">{doneTasks} / {ALL_PROMO_IDS.length} 完了（{pct}%）</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      {/* 出版目標 */}
      <div className="rounded-xl p-4 space-y-2" style={CARD_STYLE}>
        <p className="text-sm font-bold text-neon-pink neon-pink-glow">🎯 出版目標</p>
        <textarea value={goal} onChange={e => { setGoal(e.target.value); scheduleSavePromo({ promotion_goal: e.target.value }); }} rows={3}
          placeholder="例：6/26 発売 99 円スタートダッシュで 3 冠獲得！"
          className="w-full text-sm rounded px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
          style={INPUT_STYLE} />
      </div>

      {/* 4 カラムレイアウト */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1 列：戦略メモ */}
        <div className="rounded-xl border border-neon-pink/25 p-3 flex flex-col gap-3" style={{ background: 'rgba(255,45,120,0.04)', minHeight: '600px' }}>
          <h3 className="text-sm font-bold text-neon-pink neon-pink-glow">📊 戦略メモ</h3>
          <p className="text-[10px] text-muted-foreground leading-relaxed">Kindle 辛口論評 Gem の結果、戦略などを貼り付けて保存</p>
          <textarea value={strategyMemo} onChange={e => { setStrategyMemo(e.target.value); scheduleSavePromo({ strategy_memo: e.target.value }); }}
            placeholder="戦略メモ、Gem の分析結果などをここに貼り付けてください..."
            className="flex-1 text-xs rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
            style={{ ...INPUT_STYLE, minHeight: '500px' }} />
        </div>

        {/* 2 列：プロモーションチェックリスト */}
        <div className="rounded-xl border border-neon-amber/25 p-3 flex flex-col gap-2" style={{ background: 'rgba(255,179,0,0.04)', minHeight: '600px' }}>
          <h3 className="text-sm font-bold text-neon-amber neon-amber-glow">📋 フェーズ 5:プロモーション</h3>
          <div className="flex-1 space-y-2">
            {allTasks.map(task => (
              <TaskRow key={task.id} task={task} state={checklistData[task.id]} onChange={s => handleTaskChange(task.id, s)} />
            ))}
          </div>
        </div>

        {/* 3 列：SNS 投稿文 1 */}
        <SnsPostColumn
          title="✍️ SNS 投稿文章メモ 1"
          data={snsPost1}
          onChange={d => { setSnsPost1(d); scheduleSavePromo({ sns_memo1: JSON.stringify(d) }); }}
          color="cyan"
        />

        {/* 4 列：SNS 投稿文 2 */}
        <SnsPostColumn
          title="✍️ SNS 投稿文章メモ 2"
          data={snsPost2}
          onChange={d => { setSnsPost2(d); scheduleSavePromo({ sns_memo2: JSON.stringify(d) }); }}
          color="amber"
        />
      </div>
    </div>
  );
}