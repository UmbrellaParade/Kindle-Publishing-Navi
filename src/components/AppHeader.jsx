import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, ChevronDown, BookOpen, Trash2, CircleHelp, Pencil } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildInitialChecklistData } from '@/lib/checklistTasks';
import { toast } from 'sonner';
import DataBackupDialog from '@/components/DataBackupDialog';
import { flushPendingSaves } from '@/lib/saveCoordinator';
import { mutatePublishingProject } from '@/lib/projectMutation';
import {
  buildProjectDisplayNameUpdate,
  normalizeProjectDisplayName,
  ProjectDisplayNameConflictError,
  PROJECT_DISPLAY_NAME_MAX_LENGTH,
} from '@/lib/projectDisplayName';

export default function AppHeader({
  projects,
  currentProject,
  onSelectProject,
  onRefresh,
  onProjectUpdate,
  saving,
  saved,
  createRequestToken = 0,
  onOpenManual,
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameExpectedName, setRenameExpectedName] = useState('');
  const [renamingProjectId, setRenamingProjectId] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const renameSessionRef = useRef(0);
  const renameSavingRef = useRef(false);
  const createSavingRef = useRef(false);
  const renameButtonRef = useRef(null);
  const [createSaving, setCreateSaving] = useState(false);

  useEffect(() => {
    if (createRequestToken > 0 && !renameSavingRef.current && !createSavingRef.current) {
      renameSessionRef.current += 1;
      setRenaming(false);
      setCreating(true);
    }
  }, [createRequestToken]);

  useEffect(() => {
    if (!renamingProjectId || renamingProjectId === currentProject?.id) return;
    renameSessionRef.current += 1;
    setRenaming(false);
    setRenameName('');
    setRenameExpectedName('');
    setRenamingProjectId('');
    setRenameSaving(false);
  }, [currentProject?.id, renamingProjectId]);

  const openCreate = () => {
    if (renameSavingRef.current || createSavingRef.current) return;
    renameSessionRef.current += 1;
    setRenaming(false);
    setRenameName('');
    setRenameExpectedName('');
    setRenamingProjectId('');
    setRenameSaving(false);
    setCreating(true);
  };

  const openRename = () => {
    if (!currentProject || renameSavingRef.current || createSavingRef.current) return;
    renameSessionRef.current += 1;
    setCreating(false);
    setRenameName(currentProject.name || '');
    setRenameExpectedName(currentProject.name || '');
    setRenamingProjectId(currentProject.id);
    setRenaming(true);
  };

  const closeRename = () => {
    renameSessionRef.current += 1;
    setRenaming(false);
    setRenameName('');
    setRenameExpectedName('');
    setRenamingProjectId('');
    setRenameSaving(false);
    window.setTimeout(() => renameButtonRef.current?.focus({ preventScroll: true }), 0);
  };

  const handleCreate = async () => {
    if (createSavingRef.current) return;
    try {
      const normalizedName = normalizeProjectDisplayName(newName);
      createSavingRef.current = true;
      setCreateSaving(true);
      const proj = await base44.entities.PublishingProject.create({
        name: normalizedName,
        checklist_data: JSON.stringify({ _data: buildInitialChecklistData() }),
      });
      toast.success(`「${normalizedName}」を作成しました`);
      setNewName('');
      setCreating(false);
      await onRefresh();
      onSelectProject(proj);
    } catch (error) {
      toast.error(error?.message || 'プロジェクトを作成できませんでした');
    } finally {
      createSavingRef.current = false;
      setCreateSaving(false);
    }
  };

  const handleRename = async () => {
    if (!renamingProjectId || renameSavingRef.current) return;
    const targetProjectId = renamingProjectId;
    const targetSession = renameSessionRef.current;
    const expectedName = renameExpectedName;

    try {
      normalizeProjectDisplayName(renameName);
      renameSavingRef.current = true;
      setRenameSaving(true);
      await flushPendingSaves();
      const updated = await mutatePublishingProject(targetProjectId, latest => (
        buildProjectDisplayNameUpdate(latest, {
          expectedName,
          nextName: renameName,
        })
      ), currentProject);
      await onProjectUpdate?.(updated);
      toast.success(`本の管理名を「${updated.name}」に変更しました`);
      if (renameSessionRef.current === targetSession) closeRename();
    } catch (error) {
      if (error instanceof ProjectDisplayNameConflictError) {
        await onProjectUpdate?.(error.latestProject);
        if (renameSessionRef.current === targetSession) closeRename();
      }
      toast.error(error?.message || '本の管理名を変更できませんでした');
    } finally {
      renameSavingRef.current = false;
      if (renameSessionRef.current === targetSession) setRenameSaving(false);
    }
  };

  const handleDelete = async (proj, e) => {
    e.stopPropagation();
    if (!window.confirm(`「${proj.name}」を削除しますか？\nプロジェクトと旧版で保存した原稿調整データ・ルビ辞書は元に戻せません。保存画像は他の本で使っている可能性があるためブラウザ内に残します。必要なら先に「データ管理」からバックアップしてください。`)) return;

    try {
      await flushPendingSaves();
      await base44.entities.PublishingProject.delete(proj.id);
      const list = await onRefresh();
      try {
        localStorage.removeItem(`format_guide_state_${proj.id}`);
        localStorage.removeItem(`ruby_custom_dict_${proj.id}`);
      } catch (cleanupError) {
        toast.warning(cleanupError?.message || 'プロジェクトは削除しましたが、関連ファイルの整理を完了できませんでした');
      }
      toast.success('プロジェクトと関連データを削除しました');
      if (currentProject?.id === proj.id) onSelectProject(list?.[0] || null);
    } catch (error) {
      toast.error(error?.message || 'プロジェクトを削除できませんでした');
    }
  };

  return (
    <header className="relative z-20 w-full border-b border-neon-pink/20" style={{ background: 'rgba(13,13,26,0.97)' }}>
      {/* タイトル行 */}
      <div className="text-center py-4 px-4 border-b border-border/50 relative">
        <h1
          id="kindle-navi-page-title"
          tabIndex={-1}
          className="rounded-sm font-heading font-black text-xl md:text-2xl tracking-widest neon-pink-glow text-neon-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"
        >
          🌂 Umbrella Parade Kindle 出版ナビ
        </h1>
        <p className="text-[10px] text-muted-foreground tracking-widest mt-0.5">── 企画から出版・告知まで、迷わず進める ──</p>
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
            <Button disabled={renameSaving || createSaving} variant="outline" size="sm" className="h-8 border-neon-pink/30 text-xs gap-1.5 min-w-[160px] bg-secondary/50">
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
            <DropdownMenuItem onClick={openCreate} className="text-neon-cyan cursor-pointer">
              <Plus className="w-3.5 h-3.5 mr-1.5" />新しい本を追加
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          className="h-8 w-8 p-0 bg-neon-pink/15 text-neon-pink border border-neon-pink/35 hover:bg-neon-pink/25"
          onClick={openCreate}
          disabled={renameSaving || createSaving}
          title="新規プロジェクト作成"
          aria-label="新規プロジェクト作成"
        >
          <Plus className="w-4 h-4" />
        </Button>

        {currentProject && (
          <Button
            type="button"
            ref={renameButtonRef}
            variant="outline"
            size="sm"
            className="h-8 border-neon-cyan/30 bg-neon-cyan/5 px-2.5 text-xs text-neon-cyan hover:bg-neon-cyan/15"
            onClick={openRename}
            disabled={renameSaving || createSaving}
            aria-label="選択中の本の管理名を変更"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            名前を変更
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenManual}
          className="h-8 border-neon-pink/30 bg-neon-pink/5 text-neon-pink hover:bg-neon-pink/15"
        >
          <CircleHelp className="w-3.5 h-3.5" />
          使い方
        </Button>

        <DataBackupDialog
          beforeAction={flushPendingSaves}
          onRestored={() => window.location.reload()}
        />

        {currentProject && (
          <span className="text-xs text-neon-cyan font-bold truncate max-w-[200px] hidden md:block">
            選択中：{currentProject.name}
          </span>
        )}
      </div>

      {/* 新規作成インライン */}
      {creating && (
        <div className="px-4 pb-2.5">
          <div className="mx-auto max-w-xl rounded-lg border border-neon-pink/25 bg-neon-pink/5 p-3">
            <label htmlFor="new-project-name" className="text-xs font-bold text-neon-pink">本の管理名</label>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">正式な書名が未定でも、「○○（仮）」で始められます。この名前はあとから変更できます。</p>
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              <input
                id="new-project-name"
                autoFocus
                value={newName}
                maxLength={PROJECT_DISPLAY_NAME_MAX_LENGTH}
                disabled={createSaving}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.nativeEvent?.isComposing) return;
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setCreating(false);
                }}
                placeholder="例：はじめてのKindle本（仮）"
                className="min-h-11 px-3 text-xs bg-secondary border border-neon-pink/40 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-pink disabled:opacity-60 w-full sm:w-72"
              />
              <Button size="sm" disabled={createSaving} className="min-h-11 text-xs bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30" onClick={handleCreate}>{createSaving ? '作成中…' : '作成'}</Button>
              <Button size="sm" variant="ghost" disabled={createSaving} className="min-h-11 text-xs" onClick={() => setCreating(false)}>キャンセル</Button>
            </div>
          </div>
        </div>
      )}

      {renaming && currentProject?.id === renamingProjectId && (
        <div className="px-4 pb-2.5">
          <div className="mx-auto max-w-xl rounded-lg border border-neon-cyan/25 bg-neon-cyan/5 p-3">
            <label htmlFor="rename-project-name" className="text-xs font-bold text-neon-cyan">本の管理名を変更</label>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">この名前はナビの中で本を見分けるためのものです。変更しても、KDPへ登録する正式な書名・原稿・進捗は変わりません。</p>
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              <input
                id="rename-project-name"
                autoFocus
                value={renameName}
                maxLength={PROJECT_DISPLAY_NAME_MAX_LENGTH}
                disabled={renameSaving}
                onChange={e => setRenameName(e.target.value)}
                onKeyDown={e => {
                  if (e.nativeEvent?.isComposing) return;
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape' && !renameSaving) closeRename();
                }}
                placeholder="例：正式タイトル決定前（仮）"
                className="min-h-11 px-3 text-xs bg-secondary border border-neon-cyan/40 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-cyan disabled:opacity-60 w-full sm:w-72"
              />
              <Button size="sm" disabled={renameSaving} className="min-h-11 text-xs bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/25" onClick={handleRename}>
                {renameSaving ? '変更中…' : '名前を変更'}
              </Button>
              <Button size="sm" variant="ghost" disabled={renameSaving} className="min-h-11 text-xs" onClick={closeRename}>キャンセル</Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
