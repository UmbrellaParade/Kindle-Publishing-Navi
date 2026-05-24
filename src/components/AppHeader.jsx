import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, ChevronDown, BookOpen, Trash2 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildInitialChecklistData } from '@/lib/checklistTasks';
import { toast } from 'sonner';

export default function AppHeader({ projects, currentProject, onSelectProject, onRefresh, saving, saved }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const proj = await base44.entities.PublishingProject.create({
      name: newName.trim(),
      checklist_data: JSON.stringify(buildInitialChecklistData()),
    });
    toast.success(`「${newName}」を作成しました`);
    setNewName('');
    setCreating(false);
    await onRefresh();
    onSelectProject(proj);
  };

  const handleDelete = async (proj, e) => {
    e.stopPropagation();
    await base44.entities.PublishingProject.delete(proj.id);
    toast.success('削除しました');
    const list = await onRefresh();
    if (currentProject?.id === proj.id) onSelectProject(list?.[0] || null);
  };

  return (
    <header className="relative z-20 w-full border-b border-neon-pink/20" style={{ background: 'rgba(13,13,26,0.97)' }}>
      {/* タイトル行 */}
      <div className="text-center py-4 px-4 border-b border-border/50 relative">
        <h1 className="font-heading font-black text-xl md:text-2xl tracking-widest neon-pink-glow text-neon-pink">
          🌂 Umbrella Parade Kindle 出版ナビ
        </h1>
        <p className="text-[10px] text-muted-foreground tracking-widest mt-0.5">── ヴェル 13 世と歩む、入稿完了への道 ──</p>
        {saving && (
          <div className="absolute top-4 right-4 text-[10px] text-neon-cyan flex items-center gap-1">
            <span className="animate-spin">💾</span> 保存中...
          </div>
        )}
        {saved && !saving && (
          <div className="absolute top-4 right-4 text-[10px] text-green-500 flex items-center gap-1">
            <span>✅</span> 保存済み
          </div>
        )}
      </div>

      {/* プロジェクト選択エリア */}
      <div className="flex items-center justify-center gap-3 px-4 py-2.5 flex-wrap">
        <span className="text-xs text-muted-foreground hidden sm:block">出版プロジェクト：</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-neon-pink/30 text-xs gap-1.5 min-w-[160px] bg-secondary/50">
              <BookOpen className="w-3 h-3 text-neon-cyan flex-shrink-0" />
              <span className="truncate flex-1 text-left">{currentProject ? currentProject.name : 'プロジェクトを選択'}</span>
              <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 z-50" style={{ background: '#1a1a2e', border: '1px solid #2a2a4a' }}>
            {projects.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">プロジェクトがありません</div>
            )}
            {projects.map(proj => (
              <DropdownMenuItem
                key={proj.id}
                onClick={() => onSelectProject(proj)}
                className={`flex items-center justify-between group cursor-pointer ${currentProject?.id === proj.id ? 'text-neon-pink' : ''}`}
              >
                <span className="text-sm truncate flex-1">{proj.name}</span>
                <button
                  onClick={e => handleDelete(proj, e)}
                  className="opacity-0 group-hover:opacity-100 ml-2 text-muted-foreground hover:text-destructive p-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </DropdownMenuItem>
            ))}
            {projects.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => setCreating(true)} className="text-neon-cyan cursor-pointer">
              <Plus className="w-3.5 h-3.5 mr-1.5" />新しい本を追加
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          className="h-8 w-8 p-0 bg-neon-pink/15 text-neon-pink border border-neon-pink/35 hover:bg-neon-pink/25"
          onClick={() => setCreating(true)}
          title="新規プロジェクト作成"
        >
          <Plus className="w-4 h-4" />
        </Button>

        {currentProject && (
          <span className="text-xs text-neon-cyan font-bold truncate max-w-[200px] hidden md:block">
            選択中：{currentProject.name}
          </span>
        )}
      </div>

      {/* 新規作成インライン */}
      {creating && (
        <div className="flex items-center justify-center gap-2 px-4 pb-2.5 flex-wrap">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
            placeholder="本のタイトルを入力..."
            className="h-8 px-3 text-xs bg-secondary border border-neon-pink/40 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-pink w-56"
          />
          <Button size="sm" className="h-8 text-xs bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30" onClick={handleCreate}>作成</Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCreating(false)}>キャンセル</Button>
        </div>
      )}
    </header>
  );
}