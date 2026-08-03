import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowRight, CalendarDays, Download, ImageIcon, RefreshCw, Upload } from 'lucide-react';
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
import { toast } from 'sonner';
import { downloadImage, getImageDataUrl } from '@/lib/localImageStore';

const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };
const KDP_COMPLETION_TASK = KDP_PHASES[0].tasks[KDP_PHASES[0].tasks.length - 1];
const DASHBOARD_TASK_IDS = [...ALL_CREATION_IDS, ...ALL_PROMO_IDS];

function ImageSlot({ label, imageUrl, onUpload, uploading, color }) {
  const ref = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const c = color === 'pink'
    ? { border: 'border-neon-pink/30', bg: 'rgba(255,45,120,0.05)', text: 'text-neon-pink', btn: 'bg-neon-pink/20 text-neon-pink border-neon-pink/40 hover:bg-neon-pink/30' }
    : { border: 'border-neon-cyan/30', bg: 'rgba(0,245,255,0.04)', text: 'text-neon-cyan', btn: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/30' };

  useEffect(() => {
    let active = true;
    getImageDataUrl(imageUrl)
      .then(url => { if (active) setPreviewUrl(url || ''); })
      .catch(() => { if (active) setPreviewUrl(''); });
    return () => { active = false; };
  }, [imageUrl]);

  return (
    <div className={`rounded-xl border ${c.border} p-4 space-y-3`} style={{ background: c.bg }}>
      <div className="flex items-center gap-2">
        <ImageIcon className={`w-4 h-4 ${c.text}`} />
        <p className={`text-sm font-bold ${c.text}`}>{label}</p>
      </div>
      <div className={`rounded-lg overflow-hidden border ${c.border} bg-black/30 aspect-[3/4] max-w-[140px] mx-auto flex items-center justify-center`}>
        {imageUrl
          ? <img src={previewUrl} alt={label} className="w-full h-full object-contain" />
          : <div className="text-center p-4"><ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-20" /><p className="text-[10px] text-muted-foreground">画像なし</p></div>
        }
      </div>
      <div className="flex flex-col gap-1.5">
        <Button size="sm" className={`h-8 text-xs border ${c.btn}`} onClick={() => ref.current?.click()} disabled={uploading}>
          {uploading ? <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />アップロード中</> : <><Upload className="w-3 h-3 mr-1.5" />{imageUrl ? '差し替え' : 'アップロード'}</>}
        </Button>
        {imageUrl && (
          <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground"
            onClick={async () => {
              try {
                await downloadImage(imageUrl, label + '.png');
              } catch (err) {
                toast.error(err.message || '画像をダウンロードできませんでした');
              }
            }}>
            <Download className="w-3 h-3 mr-1.5" />ダウンロード
          </Button>
        )}
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
      </div>
    </div>
  );
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
  const [uploadingCover, setUploadingCover] = useState(false);
  const { checklistData, customTasks, handleTaskChange, handleCustomTaskChange, handleDeleteCustomTask, handleAddCustomTask } =
    useChecklistState(project, onProjectUpdate);

  const uploadImage = async (file, field, setUploading) => {
    if (!project) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const updated = await base44.entities.PublishingProject.update(project.id, { [field]: file_url });
      onProjectUpdate(updated);
      toast.success('画像を保存しました');
    } catch (err) {
      toast.error(err.message || '画像の保存に失敗しました');
    } finally {
      setUploading(false);
    }
  };

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground"><span className="text-4xl">📚</span><p className="mt-3 text-sm">ヘッダーの「＋」からプロジェクトを作成してください</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* 画像エリア */}
      <div className="max-w-sm">
        <ImageSlot label="表紙画像" imageUrl={project.cover_image_url} onUpload={f => uploadImage(f, 'cover_image_url', setUploadingCover)} uploading={uploadingCover} color="pink" />
      </div>

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
