import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, RefreshCw, ImageIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CREATION_PHASES, ALL_CREATION_IDS } from '@/lib/checklistTasks';
import { useChecklistState } from '@/hooks/useChecklistState';
import TaskChecklist from '@/components/shared/TaskChecklist';
import { toast } from 'sonner';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };

function ImageSlot({ label, imageUrl, onUpload, uploading, color }) {
  const ref = useRef(null);
  const c = color === 'pink'
    ? { border: 'border-neon-pink/30', bg: 'rgba(255,45,120,0.05)', text: 'text-neon-pink', btn: 'bg-neon-pink/20 text-neon-pink border-neon-pink/40 hover:bg-neon-pink/30' }
    : { border: 'border-neon-cyan/30', bg: 'rgba(0,245,255,0.04)', text: 'text-neon-cyan', btn: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/30' };

  return (
    <div className={`rounded-xl border ${c.border} p-4 space-y-3`} style={{ background: c.bg }}>
      <div className="flex items-center gap-2">
        <ImageIcon className={`w-4 h-4 ${c.text}`} />
        <p className={`text-sm font-bold ${c.text}`}>{label}</p>
      </div>
      <div className={`rounded-lg overflow-hidden border ${c.border} bg-black/30 aspect-[3/4] max-w-[140px] mx-auto flex items-center justify-center`}>
        {imageUrl
          ? <img src={imageUrl} alt={label} className="w-full h-full object-contain" />
          : <div className="text-center p-4"><ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-20" /><p className="text-[10px] text-muted-foreground">画像なし</p></div>
        }
      </div>
      <div className="flex flex-col gap-1.5">
        <Button size="sm" className={`h-8 text-xs border ${c.btn}`} onClick={() => ref.current?.click()} disabled={uploading}>
          {uploading ? <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />アップロード中</> : <><Upload className="w-3 h-3 mr-1.5" />{imageUrl ? '差し替え' : 'アップロード'}</>}
        </Button>
        {imageUrl && (
          <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground"
            onClick={() => { const a = document.createElement('a'); a.href = imageUrl; a.download = label + '.png'; a.target = '_blank'; a.click(); }}>
            <Download className="w-3 h-3 mr-1.5" />ダウンロード
          </Button>
        )}
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
      </div>
    </div>
  );
}

export default function PublishingChecklistTab({ project, onProjectUpdate, saving, saved }) {
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAplus, setUploadingAplus] = useState(false);
  const { checklistData, customTasks, handleTaskChange, handleCustomTaskChange, handleDeleteCustomTask, handleAddCustomTask } =
    useChecklistState(project, onProjectUpdate);

  const uploadImage = async (file, field, setUploading) => {
    if (!project) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const updated = await base44.entities.PublishingProject.update(project.id, { [field]: file_url });
    onProjectUpdate(updated);
    toast.success('画像を保存しました');
    setUploading(false);
  };

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground"><span className="text-4xl">📚</span><p className="mt-3 text-sm">ヘッダーの「＋」からプロジェクトを作成してください</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* 画像エリア */}
      <div className="grid grid-cols-2 gap-4">
        <ImageSlot label="表紙画像" imageUrl={project.cover_image_url} onUpload={f => uploadImage(f, 'cover_image_url', setUploadingCover)} uploading={uploadingCover} color="pink" />
        <ImageSlot label="Amazon A+ 画像" imageUrl={project.aplus_image_url} onUpload={f => uploadImage(f, 'aplus_image_url', setUploadingAplus)} uploading={uploadingAplus} color="cyan" />
      </div>

      {/* チェックリスト（フェーズ 0〜3） */}
      <TaskChecklist
        phases={CREATION_PHASES}
        allTaskIds={ALL_CREATION_IDS}
        checklistData={checklistData}
        customTasks={customTasks}
        onTaskChange={handleTaskChange}
        onCustomTaskChange={handleCustomTaskChange}
        onDeleteCustomTask={handleDeleteCustomTask}
        onAddCustomTask={handleAddCustomTask}
        progressLabel="Kindle 本制作進捗"
      />
    </div>
  );
}