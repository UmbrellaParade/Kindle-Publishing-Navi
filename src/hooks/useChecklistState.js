import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { buildInitialChecklistData } from '@/lib/checklistTasks';

/**
 * チェックリスト状態管理フック（全タブ共通）
 * project: PublishingProjectレコード
 * onProjectUpdate: 保存後のコールバック
 */
export function useChecklistState(project, onProjectUpdate) {
  const [checklistData, setChecklistData] = useState({});
  const [customTasks, setCustomTasks] = useState([]);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!project) { setChecklistData({}); setCustomTasks([]); return; }
    try {
      const parsed = project.checklist_data ? JSON.parse(project.checklist_data) : buildInitialChecklistData();
      setChecklistData(parsed._data || parsed);
      setCustomTasks(parsed._custom || []);
    } catch {
      setChecklistData(buildInitialChecklistData());
      setCustomTasks([]);
    }
  }, [project?.id]);

  const save = useCallback((data, custom) => {
    if (!project) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const existing = (() => {
        try { return project.checklist_data ? JSON.parse(project.checklist_data) : {}; }
        catch { return {}; }
      })();
      const updated = await base44.entities.PublishingProject.update(project.id, {
        checklist_data: JSON.stringify({ ...existing, _data: data, _custom: custom }),
      });
      onProjectUpdate(updated);
    }, 800);
  }, [project, onProjectUpdate]);

  const handleTaskChange = (taskId, newState) => {
    const next = { ...checklistData, [taskId]: newState };
    setChecklistData(next);
    save(next, customTasks);
  };

  const handleCustomTaskChange = (idx, newState) => {
    const next = customTasks.map((t, i) => i === idx ? { ...t, state: newState } : t);
    setCustomTasks(next);
    save(checklistData, next);
  };

  const handleDeleteCustomTask = (idx) => {
    const next = customTasks.filter((_, i) => i !== idx);
    setCustomTasks(next);
    save(checklistData, next);
  };

  const handleAddCustomTask = (title) => {
    const next = [...customTasks, { id: `c_${Date.now()}`, title, state: { is_done: false, due_date: '', note: '' } }];
    setCustomTasks(next);
    save(checklistData, next);
  };

  return {
    checklistData,
    customTasks,
    handleTaskChange,
    handleCustomTaskChange,
    handleDeleteCustomTask,
    handleAddCustomTask,
  };
}
