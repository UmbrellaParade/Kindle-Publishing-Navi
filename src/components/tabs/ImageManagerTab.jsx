import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import NeonCard from '../NeonCard';
import { Button } from '@/components/ui/button';
import { Upload, Download, RefreshCw, ImageIcon, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import ProjectSelector from '../publishing/ProjectSelector';

function ImageSlot({ label, imageUrl, onUpload, onDownload, uploading, color }) {
  const fileRef = useRef(null);

  const colorCls = {
    pink: { border: 'border-neon-pink/30', bg: 'bg-neon-pink/5', text: 'text-neon-pink', btn: 'bg-neon-pink/20 text-neon-pink border-neon-pink/40 hover:bg-neon-pink/30' },
    cyan: { border: 'border-neon-cyan/30', bg: 'bg-neon-cyan/5', text: 'text-neon-cyan', btn: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/30' },
  }[color] || {};

  return (
    <div className={`rounded-xl border ${colorCls.border} ${colorCls.bg} p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        <ImageIcon className={`w-4 h-4 ${colorCls.text}`} />
        <p className={`text-sm font-bold ${colorCls.text}`}>{label}</p>
      </div>

      {/* プレビュー */}
      <div className={`relative rounded-lg overflow-hidden border ${colorCls.border} bg-secondary/30 aspect-[3/4] max-w-[180px] mx-auto flex items-center justify-center`}>
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="w-full h-full object-contain" />
        ) : (
          <div className="text-center p-4">
            <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-[10px] text-muted-foreground">画像なし</p>
          </div>
        )}
      </div>

      {/* ボタン */}
      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          className={`h-8 text-xs border ${colorCls.btn}`}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />アップロード中...</>
          ) : (
            <><Upload className="w-3 h-3 mr-1.5" />{imageUrl ? '差し替え' : 'アップロード'}</>
          )}
        </Button>
        {imageUrl && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={onDownload}
          >
            <Download className="w-3 h-3 mr-1.5" />ダウンロード
          </Button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
      </div>
    </div>
  );
}

export default function ImageManagerTab() {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAplus, setUploadingAplus] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadProjects = async () => {
    const list = await base44.entities.PublishingProject.list('-created_date', 50);
    setProjects(list);
    setLoaded(true);
    return list;
  };

  useEffect(() => {
    loadProjects().then(list => {
      if (list.length > 0) setCurrentProject(list[0]);
    });
  }, []);

  const handleSelectProject = (proj) => {
    setCurrentProject(proj);
  };

  const uploadImage = async (file, field, setUploading) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const updated = await base44.entities.PublishingProject.update(currentProject.id, { [field]: file_url });
    setCurrentProject(updated);
    setProjects(ps => ps.map(p => p.id === updated.id ? updated : p));
    toast.success('画像を保存しました');
    setUploading(false);
  };

  const downloadImage = (url, filename) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="space-y-5">
      <NeonCard glowColor="cyan">
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="w-4 h-4 text-neon-cyan" />
          <h3 className="font-bold text-sm text-neon-cyan neon-cyan-glow">画像管理</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          表紙・A+画像をプロジェクトごとに保存・管理できます。
        </p>

        <ProjectSelector
          projects={projects}
          currentProject={currentProject}
          onSelect={handleSelectProject}
          onRefresh={loadProjects}
        />
      </NeonCard>

      {!currentProject ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>プロジェクトを選択してください</p>
          <p className="text-xs mt-1">「出版チェックリスト」タブからプロジェクトを作成できます</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ImageSlot
            label="表紙画像"
            imageUrl={currentProject.cover_image_url}
            onUpload={(f) => uploadImage(f, 'cover_image_url', setUploadingCover)}
            onDownload={() => downloadImage(currentProject.cover_image_url, `${currentProject.name}_表紙.png`)}
            uploading={uploadingCover}
            color="pink"
          />
          <ImageSlot
            label="Amazon A+画像"
            imageUrl={currentProject.aplus_image_url}
            onUpload={(f) => uploadImage(f, 'aplus_image_url', setUploadingAplus)}
            onDownload={() => downloadImage(currentProject.aplus_image_url, `${currentProject.name}_Aplus.png`)}
            uploading={uploadingAplus}
            color="cyan"
          />
        </div>
      )}
    </div>
  );
}