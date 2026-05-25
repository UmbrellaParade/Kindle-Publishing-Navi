import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Progress } from '@/components/ui/progress';
import { Zap, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import KdpDescriptionEditor from '@/components/kdp/KdpDescriptionEditor';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };

// KDP 専用タスク定義（カスタムフィールドあり）
const KDP_TASKS = [
  {
    id: 't41', important: false,
    title: 'KDP にログインし「タイトルの新規作成」',
    tool: 'KDP 公式サイト',
    inlineFields: [{ key: 'book_title', label: '本のタイトル', type: 'text', placeholder: '本のタイトルを入力' }],
  },
  {
    id: 't42', important: false,
    title: '本の詳細（タイトル、著者名、内容紹介など）を入力',
    tool: 'Gem1 の出力をコピペ',
    inlineFields: [
      { key: 'book_title2', label: 'タイトル', type: 'text', placeholder: '本のタイトル' },
      { key: 'author_name', label: '著者名', type: 'text', placeholder: '著者名' },
    ],
  },
  {
    id: 't43a', important: false,
    title: 'カテゴリーを設定（最大 3 つ）',
    tool: 'Gem1 の出力をコピペ',
    inlineFields: [
      { key: 'category1', label: 'カテゴリー 1', type: 'text', placeholder: 'カテゴリー 1' },
      { key: 'category2', label: 'カテゴリー 2', type: 'text', placeholder: 'カテゴリー 2' },
      { key: 'category3', label: 'カテゴリー 3', type: 'text', placeholder: 'カテゴリー 3' },
    ],
  },
  {
    id: 't43b', important: false,
    title: 'キーワード（7 つ）を設定',
    tool: 'Gem1 の出力をコピペ',
    inlineFields: [
      { key: 'kw1', label: 'KW1', type: 'text', placeholder: 'キーワード 1' },
      { key: 'kw2', label: 'KW2', type: 'text', placeholder: 'キーワード 2' },
      { key: 'kw3', label: 'KW3', type: 'text', placeholder: 'キーワード 3' },
      { key: 'kw4', label: 'KW4', type: 'text', placeholder: 'キーワード 4' },
      { key: 'kw5', label: 'KW5', type: 'text', placeholder: 'キーワード 5' },
      { key: 'kw6', label: 'KW6', type: 'text', placeholder: 'キーワード 6' },
      { key: 'kw7', label: 'KW7', type: 'text', placeholder: 'キーワード 7' },
    ],
    inlineGrid: true,
  },
  { id: 't44', important: false, title: '原稿と表紙ファイルをアップロードする', tool: 'KDP 編集画面', inlineFields: [] },
  { id: 't45', important: false, title: 'AI 生成コンテンツの申告（「はい」→「Gemini」と入力）', tool: 'KDP 編集画面', inlineFields: [] },
  { id: 't46', important: false, title: 'プレビューアーで表示崩れがないか確認', tool: 'KDP 編集画面', inlineFields: [] },
  { id: 't47', important: true,  title: 'KDP セレクトに登録する', tool: 'KDP 価格設定画面', inlineFields: [], note_default: '必ずチェック' },
  { id: 't48', important: false, title: 'ロイヤリティ「70%」を選択し、決定した価格を入力', tool: 'KDP 価格設定画面', inlineFields: [] },
  { id: 't49', important: false, title: '「Kindle 本を出版」ボタンを押す', tool: 'KDP', inlineFields: [], note_default: '審査待ち（約 48 時間）' },
];

const ALL_KDP_IDS = KDP_TASKS.map(t => t.id);

function KdpTaskRow({ task, state, onChange, fieldData, onFieldChange }) {
  const [open, setOpen] = useState(false);
  const s = state || { is_done: false, due_date: '', note: task.note_default || '' };
  const hasInline = task.inlineFields?.length > 0;

  return (
    <div className={`rounded-lg border transition-all ${s.is_done ? 'opacity-50' : task.important ? 'border-neon-pink/30' : 'border-border/60'}`}
      style={{ background: s.is_done ? 'rgba(255,255,255,0.02)' : task.important ? 'rgba(255,45,120,0.04)' : 'rgba(255,255,255,0.03)' }}>
      {/* 行 */}
      <div className="flex items-start gap-2 px-3 py-2.5">
        {/* チェック */}
        <button
          onClick={() => onChange({ ...s, is_done: !s.is_done })}
          className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${s.is_done ? 'bg-neon-cyan border-neon-cyan' : 'border-muted-foreground/40 hover:border-neon-cyan'}`}
        >
          {s.is_done && <span className="text-black text-[10px] font-black leading-none">✓</span>}
        </button>

        {/* タスク名 */}
        <div className="flex-shrink-0 min-w-0" style={{ width: hasInline ? '30%' : 'auto', flex: hasInline ? 'none' : '1' }}>
          <div className="flex items-center gap-1 flex-wrap">
            {task.important && <Zap className="w-3 h-3 text-neon-pink flex-shrink-0" />}
            <span className={`text-xs leading-relaxed ${s.is_done ? 'line-through text-muted-foreground' : task.important ? 'font-bold text-neon-pink' : 'text-foreground'}`}>
              {task.title}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">{task.tool}</span>
        </div>

        {/* インラインフィールド */}
        {hasInline && (
          task.inlineGrid ? (
            <div className="flex-1 min-w-0 grid grid-cols-4 gap-1">
              {task.inlineFields.map(f => (
                <input
                  key={f.key}
                  value={fieldData?.[f.key] || ''}
                  onChange={e => onFieldChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="h-7 px-2 text-xs rounded text-foreground placeholder:text-muted-foreground focus:outline-none w-full"
                  style={INPUT_STYLE}
                />
              ))}
            </div>
          ) : (
            <div className={`flex-1 min-w-0 flex gap-2`}>
              {task.inlineFields.map(f => (
                <input
                  key={f.key}
                  value={fieldData?.[f.key] || ''}
                  onChange={e => onFieldChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="h-7 px-2 text-xs rounded text-foreground placeholder:text-muted-foreground focus:outline-none flex-1 min-w-0"
                  style={INPUT_STYLE}
                />
              ))}
            </div>
          )
        )}

        {/* 展開ボタン */}
        <button onClick={() => setOpen(v => !v)} className="flex-shrink-0 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {open ? '▲' : '▼'}
        </button>
      </div>

      {/* 展開後 */}
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground whitespace-nowrap">完了目標日</label>
            <input type="date" value={s.due_date || ''} onChange={e => onChange({ ...s, due_date: e.target.value })}
              className="text-xs rounded px-2 py-1 text-foreground focus:outline-none flex-1" style={INPUT_STYLE} />
          </div>
          <textarea value={s.note || ''} onChange={e => onChange({ ...s, note: e.target.value })} rows={2}
            placeholder="メモ・備考..."
            className="w-full text-xs rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
            style={INPUT_STYLE} />
        </div>
      )}
    </div>
  );
}

export default function KdpChecklistTab({ project, onProjectUpdate, saving, saved }) {
  const [checklistData, setChecklistData] = useState({});
  const [fieldData, setFieldData] = useState({});
  const [customTasks, setCustomTasks] = useState([]);
  const [description, setDescription] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const checklistSaveTimer = useRef(null);
  const descriptionSaveTimer = useRef(null);

  // プロジェクト選択時にデータを読み込み
  useEffect(() => {
    if (!project) { setChecklistData({}); setFieldData({}); setCustomTasks([]); setDescription(''); return; }

    try {
      const parsed = project.checklist_data ? JSON.parse(project.checklist_data) : {};
      setChecklistData(parsed._data || {});
      setCustomTasks(parsed._custom || []);
      setFieldData(parsed._kdp_fields || {});
    } catch { setChecklistData({}); setFieldData({}); setCustomTasks([]); }
    
    try {
      const kdpMeta = project.kdp_meta ? JSON.parse(project.kdp_meta) : {};
      setDescription(project.kdp_description || kdpMeta.description || '');
    } catch {
      setDescription(project.kdp_description || '');
    }
  }, [project?.id]);

  // 自動保存（checklist_data）
  const scheduleSave = useCallback((data, custom, fields) => {
    if (!project) return;
    clearTimeout(checklistSaveTimer.current);
    checklistSaveTimer.current = setTimeout(async () => {
      const existing = (() => {
        try { return project.checklist_data ? JSON.parse(project.checklist_data) : {}; }
        catch { return {}; }
      })();
      const updated = await base44.entities.PublishingProject.update(project.id, {
        checklist_data: JSON.stringify({ ...existing, _data: data, _custom: custom, _kdp_fields: fields }),
      });
      onProjectUpdate(updated);
    }, 1000);
  }, [project, onProjectUpdate]);

  // KDP 説明文の保存（kdp_description フィールドを使用）
  const saveDescription = useCallback((val, immediate = false) => {
    if (!project) return;
    clearTimeout(descriptionSaveTimer.current);
    const persist = async () => {
      const currentMeta = (() => {
        try { return project.kdp_meta ? JSON.parse(project.kdp_meta) : {}; }
        catch { return {}; }
      })();
      const updated = await base44.entities.PublishingProject.update(project.id, {
        kdp_description: val,
        kdp_meta: JSON.stringify({ ...currentMeta, description: val }),
      });
      onProjectUpdate(updated);
    };

    if (immediate) {
      persist();
      return;
    }

    descriptionSaveTimer.current = setTimeout(persist, 1000);
  }, [project, onProjectUpdate]);

  const handleTaskChange = (taskId, newState) => {
    const next = { ...checklistData, [taskId]: newState };
    setChecklistData(next);
    scheduleSave(next, customTasks, fieldData);
  };

  const handleFieldChange = (taskId, key, val) => {
    const next = { ...fieldData, [`${taskId}_${key}`]: val };
    setFieldData(next);
    scheduleSave(checklistData, customTasks, next);
  };

  const handleAddCustomTask = () => {
    if (!newTaskTitle.trim()) return;
    const next = [...customTasks, { id: `c_${Date.now()}`, title: newTaskTitle.trim(), state: { is_done: false, due_date: '', note: '' } }];
    setCustomTasks(next);
    scheduleSave(checklistData, next, fieldData);
    setNewTaskTitle(''); setAddingTask(false);
    toast.success('タスクを追加しました');
  };

  const handleDeleteCustomTask = (idx) => {
    const next = customTasks.filter((_, i) => i !== idx);
    setCustomTasks(next);
    scheduleSave(checklistData, next, fieldData);
  };

  const allCustomDone = customTasks.filter(t => t.state?.is_done).length;
  const totalTasks = ALL_KDP_IDS.length + customTasks.length;
  const doneTasks = ALL_KDP_IDS.filter(id => checklistData[id]?.is_done).length + allCustomDone;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground"><span className="text-4xl">📝</span><p className="mt-3 text-sm">プロジェクトを選択してください</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* 進捗バー */}
      <div className="rounded-xl p-4 space-y-2" style={CARD_STYLE}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold">KDP 登録進捗</span>
          <span className="font-bold text-neon-pink">{doneTasks} / {totalTasks} 完了（{pct}%）</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      {/* KDP タスクリスト */}
      <div className="rounded-xl overflow-hidden" style={{ ...CARD_STYLE, borderLeft: '4px solid #00f5ff' }}>
        <div className="px-4 py-3"><h3 className="text-sm font-bold text-neon-cyan">フェーズ 4:KDP 登録</h3></div>
        <div className="px-4 pb-4 space-y-2">
          {KDP_TASKS.map(task => (
            <KdpTaskRow
              key={task.id}
              task={task}
              state={checklistData[task.id]}
              onChange={s => handleTaskChange(task.id, s)}
              fieldData={Object.fromEntries(
                (task.inlineFields || []).map(f => [`${f.key}`, fieldData[`${task.id}_${f.key}`] || ''])
              )}
              onFieldChange={(key, val) => handleFieldChange(task.id, key, val)}
            />
          ))}

          {/* カスタムタスク */}
          {customTasks.map((t, idx) => (
            <div key={t.id} className="relative">
              <KdpTaskRow
                task={{ ...t, inlineFields: [], important: false }}
                state={t.state}
                onChange={s => {
                  const next = customTasks.map((ct, i) => i === idx ? { ...ct, state: s } : ct);
                  setCustomTasks(next);
                  scheduleSave(checklistData, next, fieldData);
                }}
                fieldData={{}}
                onFieldChange={() => {}}
              />
              <button onClick={() => handleDeleteCustomTask(idx)} className="absolute top-2 right-10 text-muted-foreground hover:text-destructive p-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* タスク追加 */}
        <div className="px-4 pb-4">
          {addingTask ? (
            <div className="flex gap-2 flex-wrap">
              <input autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCustomTask(); if (e.key === 'Escape') setAddingTask(false); }}
                placeholder="タスク名を入力..."
                className="flex-1 h-8 px-3 text-xs rounded text-foreground placeholder:text-muted-foreground focus:outline-none min-w-[200px]"
                style={INPUT_STYLE} />
              <Button size="sm" className="h-8 text-xs bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30" onClick={handleAddCustomTask}>追加</Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddingTask(false)}>キャンセル</Button>
            </div>
          ) : (
            <button onClick={() => setAddingTask(true)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-neon-cyan transition-colors">
              <Plus className="w-4 h-4" />タスクを追加
            </button>
          )}
        </div>
      </div>

      {/* KDP 書籍説明文 */}
      <div className="rounded-xl p-4" style={CARD_STYLE}>
        <KdpDescriptionEditor
          description={description}
          onSave={val => { setDescription(val); saveDescription(val); }}
          onFlush={val => { setDescription(val); saveDescription(val, true); }}
        />
      </div>
    </div>
  );
}
