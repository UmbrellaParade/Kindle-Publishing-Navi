import { CREATION_PHASES, KDP_PHASES, PROMO_PHASES } from './checklistTasks.js';
import { RELEASE_TASK_OFFSETS, offsetDate, getScheduleWindow, parseDateOnly } from './releaseSchedule.js';

const TASKS = [
  ...CREATION_PHASES.map(phase => ({ ...phase, tabId: 'creation' })),
  ...KDP_PHASES.map(phase => ({ ...phase, tabId: 'kdp' })),
  ...PROMO_PHASES.map(phase => ({ ...phase, tabId: 'creation' })),
].flatMap(phase => phase.tasks.map(task => ({ ...task, taskId: task.id, phaseId: phase.id, tabId: phase.tabId })));

export function getTaskNavigation(taskId) {
  const task = TASKS.find(item => item.id === taskId);
  return task ? { tabId: task.tabId, phaseId: task.phaseId, taskId: task.id } : null;
}

export function getNextWorkTasks(checklistData = {}, limit = 3) {
  return TASKS.filter(task => !checklistData[task.id]?.is_done)
    .map(task => ({ ...task, due_date: checklistData[task.id]?.due_date || '' }))
    .sort((left, right) => {
      const a = parseDateOnly(left.due_date) ? left.due_date : '9999-12-31';
      const b = parseDateOnly(right.due_date) ? right.due_date : '9999-12-31';
      return a.localeCompare(b);
    }).slice(0, limit);
}

export function getStandardProvisionalDate(startDate) {
  return offsetDate(startDate, -Math.min(...Object.values(RELEASE_TASK_OFFSETS)));
}

export function hasPastScheduleTargets(releaseDate, today) {
  const window = getScheduleWindow(releaseDate);
  return Boolean(window && parseDateOnly(today) && window.startDate < today);
}
