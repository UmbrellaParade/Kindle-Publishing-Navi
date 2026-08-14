import React, { useState, useEffect, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
import { ExternalLink, Zap, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { readChecklistEnvelope, writeChecklistEnvelope } from '@/lib/releaseSchedule';
import { KDP_PHASES } from '@/lib/checklistTasks';
import { scheduleCoordinatedSave } from '@/lib/saveCoordinator';
import { getReleaseMethod } from '@/lib/releaseMethods';
import { mutatePublishingProject } from '@/lib/projectMutation';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };
const KDP_TASK_DEFAULTS = Object.fromEntries(
  KDP_PHASES.flatMap(phase => phase.tasks.map(task => [task.id, task.note_default || ''])),
);

// KDP 専用タスク定義（カスタムフィールドあり）
const KDP_TASKS = [
  {
    id: 't40', important: true,
    title: 'KDP アカウントの本人情報・税務・支払設定と、配信方法を確認する',
    tool: 'KDP アカウント / 配信日オプション',
    inlineFields: [],
  },
  {
    id: 't41', important: false,
    title: 'KDP にログインし「タイトルの新規作成」',
    tool: 'KDP 公式サイト',
    inlineFields: [{ key: 'book_title', label: '本のタイトル', type: 'text', placeholder: '本のタイトルを入力' }],
  },
  {
    id: 't42', important: false,
    title: '本の詳細（タイトル、著者名、内容紹介など）を入力',
    tool: '企画メモ / 原稿から入力',
    inlineFields: [
      { key: 'book_title2', label: 'タイトル', type: 'text', placeholder: '本のタイトル' },
      { key: 'author_name', label: '著者名', type: 'text', placeholder: '著者名' },
    ],
  },
  {
    id: 't43a', important: false,
    title: 'カテゴリーを設定（最大 3 つ）',
    tool: 'カテゴリーチェック / KDP 公式画面',
    inlineFields: [
      { key: 'category1', label: 'カテゴリー 1', type: 'text', placeholder: 'カテゴリー 1' },
      { key: 'category2', label: 'カテゴリー 2', type: 'text', placeholder: 'カテゴリー 2' },
      { key: 'category3', label: 'カテゴリー 3', type: 'text', placeholder: 'カテゴリー 3' },
    ],
  },
  {
    id: 't43b', important: false,
    title: 'キーワード（7 つ）を設定',
    tool: '企画メモ / KDP 公式画面',
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
  { id: 't45', important: false, title: 'AI 生成コンテンツを使用した場合は、KDP の質問に正確に回答する', tool: 'KDP 編集画面', inlineFields: [] },
  { id: 't46', important: false, title: 'プレビューアーで表示崩れがないか確認', tool: 'KDP 編集画面', inlineFields: [] },
  { id: 't47', important: false, title: 'KDP セレクトへ登録するか判断する（任意）', tool: 'KDP 価格設定画面', inlineFields: [] },
  { id: 't48', important: false, title: '35% / 70% の適用条件を確認し、ロイヤリティと価格を設定する', tool: 'KDP 価格設定画面', inlineFields: [] },
  { id: 't49', important: true, title: '内容を最終確認し、選んだ配信方法に合わせて審査へ提出する', tool: 'KDP', inlineFields: [] },
].map(task => ({ ...task, note_default: KDP_TASK_DEFAULTS[task.id] || '' }));

const ALL_KDP_IDS = KDP_TASKS.map(t => t.id);

function KdpTaskRow({ task, state, onChange, fieldData, onFieldChange }) {
  const [open, setOpen] = useState(false);
  const s = state || { is_done: false, due_date: '', note: task.note_default || '' };
  const hasInline = task.inlineFields?.length > 0;

  return (
    <div className={`rounded-lg border transition-all ${s.is_done ? 'opacity-50' : task.important ? 'border-neon-pink/30' : 'border-border/60'}`}
      style={{ background: s.is_done ? 'rgba(255,255,255,0.02)' : task.important ? 'rgba(255,45,120,0.04)' : 'rgba(255,255,255,0.03)' }}>
      {/* 行 */}
      <div className="flex flex-wrap sm:flex-nowrap items-start gap-2 px-3 py-2.5">
        {/* チェック */}
        <button
          type="button"
          onClick={() => onChange({ ...s, is_done: !s.is_done })}
          aria-label={`「${task.title}」を${s.is_done ? '未完了' : '完了'}にする`}
          aria-pressed={s.is_done}
          className={`flex-shrink-0 w-7 h-7 rounded-md border-2 transition-all flex items-center justify-center ${s.is_done ? 'bg-neon-cyan border-neon-cyan' : 'border-muted-foreground/40 hover:border-neon-cyan'}`}
        >
          {s.is_done && <span className="text-black text-[10px] font-black leading-none">✓</span>}
        </button>

        {/* タスク名 */}
        <div className={`min-w-0 flex-1 ${hasInline ? 'sm:w-[30%] sm:flex-none' : ''}`}>
          <div className="flex items-center gap-1 flex-wrap">
            {task.important && <Zap className="w-3 h-3 text-neon-pink flex-shrink-0" />}
            <span className={`text-xs leading-relaxed ${s.is_done ? 'line-through text-muted-foreground' : task.important ? 'font-bold text-neon-pink' : 'text-foreground'}`}>
              {task.title}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground">{task.tool}</span>
            {s.due_date && (
              <span className={`text-[10px] rounded px-1.5 py-0.5 ${s.due_date_source === 'auto' ? 'bg-neon-cyan/10 text-neon-cyan' : 'bg-neon-amber/10 text-neon-amber'}`}>
                目標 {s.due_date}
              </span>
            )}
          </div>
          {task.note_default && (
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              <span className="font-bold text-neon-amber">手順のポイント：</span>{task.note_default}
            </p>
          )}
        </div>

        {/* インラインフィールド */}
        {hasInline && (
          task.inlineGrid ? (
            <div className="order-last w-full pl-9 pt-2 sm:order-none sm:w-auto sm:pl-0 sm:pt-0 sm:flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-1">
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
            <div className="order-last w-full pl-9 pt-2 sm:order-none sm:w-auto sm:pl-0 sm:pt-0 sm:flex-1 min-w-0 flex flex-col sm:flex-row gap-2">
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
        <button type="button" aria-label={`「${task.title}」の詳細を${open ? '閉じる' : '開く'}`} aria-expanded={open} onClick={() => setOpen(v => !v)} className="flex-shrink-0 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1.5 rounded transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {open ? '▲' : '▼'}
        </button>
      </div>

      {/* 展開後 */}
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground whitespace-nowrap">完了目標日</label>
            <input type="date" value={s.due_date || ''} onChange={e => onChange({ ...s, due_date: e.target.value, due_date_source: 'manual' })}
              className="text-xs rounded px-2 py-1 text-foreground focus:outline-none flex-1" style={INPUT_STYLE} />
            {s.due_date && (
              <span className={`text-[9px] whitespace-nowrap ${s.due_date_source === 'auto' ? 'text-neon-cyan' : 'text-neon-amber'}`}>
                {s.due_date_source === 'auto' ? '自動' : '手動'}
              </span>
            )}
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
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  // プロジェクト選択時にデータを読み込み
  useEffect(() => {
    if (!project) { setChecklistData({}); setFieldData({}); setCustomTasks([]); return; }

    try {
      const parsed = project.checklist_data ? JSON.parse(project.checklist_data) : {};
      setChecklistData(parsed._data || {});
      setCustomTasks(parsed._kdp_custom || parsed._custom || []);
      setFieldData(parsed._kdp_fields || {});
    } catch { setChecklistData({}); setFieldData({}); setCustomTasks([]); }
  }, [project?.id, project?.checklist_data]);

  // 自動保存（checklist_data）
  const scheduleSave = useCallback(({ taskId, taskState, custom, fieldKey, fieldValue }) => {
    if (!project) return;
    const hasCustom = Array.isArray(custom);
    const section = taskId ? `task:${taskId}` : hasCustom ? 'custom' : `field:${fieldKey}`;
    const key = hasCustom ? `kdp-custom-checklist:${project.id}` : `kdp-checklist:${project.id}:${section}`;
    scheduleCoordinatedSave(key, async () => {
      const updated = await mutatePublishingProject(project.id, latest => {
        const { envelope, data: latestData } = readChecklistEnvelope(latest?.checklist_data);
        const nextData = { ...latestData };
        if (taskId) nextData[taskId] = taskState;
        const nextFields = fieldKey
          ? { ...(envelope._kdp_fields || {}), [fieldKey]: fieldValue }
          : null;
        return {
          checklist_data: writeChecklistEnvelope(
            latest?.checklist_data,
            nextData,
            {
              ...(hasCustom ? { _kdp_custom: custom } : {}),
              ...(nextFields ? { _kdp_fields: nextFields } : {}),
            },
          ),
        };
      }, project);
      onProjectUpdate(updated);
    }, 1000);
  }, [project, onProjectUpdate]);

  const handleTaskChange = (taskId, newState) => {
    const next = { ...checklistData, [taskId]: newState };
    setChecklistData(next);
    scheduleSave({ taskId, taskState: newState });
  };

  const handleFieldChange = (taskId, key, val) => {
    const fieldKey = `${taskId}_${key}`;
    const next = { ...fieldData, [fieldKey]: val };
    setFieldData(next);
    scheduleSave({ fieldKey, fieldValue: val });
  };

  const handleAddCustomTask = () => {
    if (!newTaskTitle.trim()) return;
    const next = [...customTasks, { id: `c_${Date.now()}`, title: newTaskTitle.trim(), state: { is_done: false, due_date: '', note: '' } }];
    setCustomTasks(next);
    scheduleSave({ custom: next });
    setNewTaskTitle(''); setAddingTask(false);
    toast.success('タスクを追加しました');
  };

  const handleDeleteCustomTask = (idx) => {
    const next = customTasks.filter((_, i) => i !== idx);
    setCustomTasks(next);
    scheduleSave({ custom: next });
  };

  const allCustomDone = customTasks.filter(t => t.state?.is_done).length;
  const totalTasks = ALL_KDP_IDS.length + customTasks.length;
  const doneTasks = ALL_KDP_IDS.filter(id => checklistData[id]?.is_done).length + allCustomDone;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const savedReleaseMethod = project?.release_method || project?.schedule_mode || '';
  const releaseMethod = savedReleaseMethod ? getReleaseMethod(savedReleaseMethod) : null;

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground"><span className="text-4xl">📝</span><p className="mt-3 text-sm">プロジェクトを選択してください</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-4 text-xs leading-relaxed" style={CARD_STYLE}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-bold text-neon-cyan">配信方法：{releaseMethod?.shortLabel || '未設定'}</p>
            <p className="mt-1 text-muted-foreground">
              {releaseMethod?.guidance || '仮リリース日だけでは配信方法は決まりません。正式な発売目標日を設定するときに選んでください。'}
            </p>
          </div>
          <a href="https://kdp.amazon.co.jp/ja_JP/help/topic/GZUV7SNV728WT4QE" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-neon-cyan hover:text-neon-pink">
            <ExternalLink className="w-3.5 h-3.5" />KDP公式の配信日オプション
          </a>
        </div>

        <details id="ebook-release-guide" className="mt-3 border-t border-white/10 pt-3 group" data-kdp-release-guide>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-2 font-bold text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan [&::-webkit-details-marker]:hidden">
            <span>電子書籍の予約注文・ランキング・Kindle Unlimited</span>
            <span className="shrink-0 text-[11px] font-normal text-muted-foreground group-open:hidden">解説を開く</span>
            <span className="hidden shrink-0 text-[11px] font-normal text-muted-foreground group-open:inline">閉じる</span>
          </summary>

          <div className="mt-3 space-y-3" data-kdp-release-guide-content>
            <p className="text-muted-foreground">
              発売時刻・予約注文・KUは仕組みが別です。ランキングだけを目的にせず、読者へ分かりやすく案内するための基礎として確認してください。
            </p>

            <div className="grid gap-2 md:grid-cols-3">
              <section className="rounded-lg border border-white/10 bg-black/20 p-3">
                <h3 className="font-bold text-white">発売日は日本時間0:00固定ではありません</h3>
                <p className="mt-1 text-muted-foreground">
                  予約注文の発売日はGMT基準です。マーケットプレイスや処理状況で表示・計上時刻が前後するため、発売日に商品ページが購入可能になったことを確認してから案内しましょう。
                </p>
              </section>

              <section className="rounded-lg border border-white/10 bg-black/20 p-3">
                <h3 className="font-bold text-white">予約注文は発売前から反映されます</h3>
                <p className="mt-1 text-muted-foreground">
                  予約注文を設定すると商品ページが発売前に公開され、読者は発売日まで注文できます。KDP公式では、予約注文は発売前から販売ランキングやストア内表示へ影響すると説明されています。予約分が発売日にすべてまとめて加算される前提にはせず、発売後に購入できる案内も用意してください。順位は相対評価で、保証されません。
                </p>
              </section>

              <section className="rounded-lg border border-white/10 bg-black/20 p-3">
                <h3 className="font-bold text-white">KUはKENPで「読まれた量」を確認</h3>
                <p className="mt-1 text-muted-foreground">
                  Kindle Unlimitedでは、読者が初めて読んだページがKENPとして記録され、KUロイヤリティの計算に使われます。ダウンロードだけとは異なり、ランキングへの具体的な換算方法は公開されていません。
                </p>
              </section>
            </div>

            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-amber-200">
              購入・借り入れ・読書を、報酬などと引き換えに依頼してランキングを操作しないでください。誠実な案内と、読者に役立つ内容を優先します。
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <a href="https://kdp.amazon.co.jp/ja_JP/help/topic/G201575300" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-neon-cyan hover:text-neon-pink">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />KDP公式：予約注文の設定
              </a>
              <a href="https://kdp.amazon.co.jp/ja_JP/help/topic/G201499380" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-neon-cyan hover:text-neon-pink">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />KDP公式：電子書籍の予約注文
              </a>
              <a href="https://kdp.amazon.co.jp/ja_JP/help/topic/G201648140" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-neon-cyan hover:text-neon-pink">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />KDP公式：販売ランキング
              </a>
              <a href="https://kdp.amazon.co.jp/ja_JP/help/topic/G201541130" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-neon-cyan hover:text-neon-pink">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />KDP公式：KUロイヤリティ
              </a>
            </div>
          </div>
        </details>
      </div>

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
                  scheduleSave({ custom: next });
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
    </div>
  );
}
