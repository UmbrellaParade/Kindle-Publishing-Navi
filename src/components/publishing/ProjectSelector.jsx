import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, ChevronDown, BookOpen, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GORIAS_PRESET_ITEMS } from '@/lib/publishingPreset';

export default function ProjectSelector({ projects, currentProject, onSelect, onRefresh }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const createProject = async () => {
    if (!newName.trim()) return;
    const items = GORIAS_PRESET_ITEMS.map(i => ({ ...i }));
    const proj = await base44.entities.PublishingProject.create({
      name: newName.trim(),
      preset_name: 'ゴリアス式出版フロー',
      checklist_items: items,
    });
    toast.success(`「${newName}」を作成しました`);
    setNewName('');
    setCreating(false);
    await onRefresh();
    onSelect(proj);
  };

  const deleteProject = async (proj, e) => {
    e.stopPropagation();
    await base44.entities.PublishingProject.delete(proj.id);
    toast.success('プロジェクトを削除しました');
    await onRefresh();
    if (currentProject?.id === proj.id) onSelect(null);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-9 border-neon-pink/40 text-neon-pink bg-neon-pink/5 hover:bg-neon-pink/10 text-xs gap-1.5 max-w-[220px]">
            <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{currentProject ? currentProject.name : 'プロジェクトを選択'}</span>
            <ChevronDown className="w-3 h-3 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-card border-border w-64">
          {projects.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">プロジェクトがありません</div>
          )}
          {projects.map((proj) => (
            <DropdownMenuItem
              key={proj.id}
              onClick={() => onSelect(proj)}
              className="flex items-center justify-between group cursor-pointer"
            >
              <span className="text-sm truncate flex-1">{proj.name}</span>
              <button
                onClick={(e) => deleteProject(proj, e)}
                className="opacity-0 group-hover:opacity-100 ml-2 text-muted-foreground hover:text-neon-red transition-all"
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

      {creating && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') setCreating(false); }}
            placeholder="本のタイトルを入力..."
            className="h-9 px-3 text-xs bg-secondary border border-neon-pink/40 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-pink w-52"
          />
          <Button size="sm" className="h-9 text-xs bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30" onClick={createProject}>
            作成
          </Button>
          <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => setCreating(false)}>
            キャンセル
          </Button>
        </div>
      )}
    </div>
  );
}