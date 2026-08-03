import { useState, useEffect, useCallback } from 'react';
import { buildInitialChecklistData } from '@/lib/checklistTasks';
import { readChecklistEnvelope, writeChecklistEnvelope } from '@/lib/releaseSchedule';
import { scheduleCoordinatedSave } from '@/lib/saveCoordinator';
import { mutatePublishingProject } from '@/lib/projectMutation';

/**
 * チェックリスト状態管理フック（全タブ共通）
 * project: PublishingProjectレコード
 * onProjectUpdate: 保存後のコールバック
 */
export function useChecklistState(project, onProjectUpdate) {
  const [checklistData, setChecklistData] = useState({});
  const [customTasks, setCustomTasks] = useState([]);
  useEffect(() => {
    if (!project) { setChecklistData({}); setCustomTasks([]); return; }
    try {
      const parsed = project.checklist_data ? JSON.parse(project.checklist_data) : buildInitialChecklistData();
      setChecklistData(parsed._data || parsed);
      setCustomTasks(parsed._creation_custom || parsed._custom || []);
    } catch {
      setChecklistData(buildInitialChecklistData());
      setCustomTasks([]);
    }
  }, [project?.id, project?.checklist_data]);

  const saveCreationTask = useCallback((taskId, taskState) => {
    if (!project) return;
    scheduleCoordinatedSave(`creation-checklist:${project.id}:${taskId}`, async () => {
      const updated = await mutatePublishingProject(project.id, latest => {
        const { data: latestData } = readChecklistEnvelope(latest?.checklist_data);
        const nextData = { ...latestData, [taskId]: taskState };
        return { checklist_data: writeChecklistEnvelope(latest?.checklist_data, nextData) };
      }, project);
      onProjectUpdate(updated);
    }, 800);
  }, [project, onProjectUpdate]);

  const saveCustomTasks = useCallback((custom) => {
    if (!project) return;
    scheduleCoordinatedSave(`creation-custom-checklist:${project.id}`, async () => {
      const updated = await mutatePublishingProject(project.id, latest => {
        const { data: latestData } = readChecklistEnvelope(latest?.checklist_data);
        return {
          checklist_data: writeChecklistEnvelope(latest?.checklist_data, latestData, { _creation_custom: custom }),
        };
      }, project);
      onProjectUpdate(updated);
    }, 800);
  }, [project, onProjectUpdate]);

  const handleTaskChange = (taskId, newState) => {
    const next = { ...checklistData, [taskId]: newState };
    setChecklistData(next);
    saveCreationTask(taskId, newState);
  };

  const handleCustomTaskChange = (idx, newState) => {
    const next = customTasks.map((t, i) => i === idx ? { ...t, state: newState } : t);
    setCustomTasks(next);
    saveCustomTasks(next);
  };

  const handleDeleteCustomTask = (idx) => {
    const next = customTasks.filter((_, i) => i !== idx);
    setCustomTasks(next);
    saveCustomTasks(next);
  };

  const handleAddCustomTask = (title) => {
    const next = [...customTasks, { id: `c_${Date.now()}`, title, state: { is_done: false, due_date: '', note: '' } }];
    setCustomTasks(next);
    saveCustomTasks(next);
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
