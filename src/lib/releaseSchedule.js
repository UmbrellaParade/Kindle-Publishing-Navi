export const RELEASE_SCHEDULE_VERSION = 1;
export const SCHEDULE_DATE_SOURCE_RELEASE_TARGET = 'release_target';
export const SCHEDULE_DATE_SOURCE_PROVISIONAL = 'provisional';
const CUSTOM_TASK_LIST_KEYS = ['_creation_custom', '_kdp_custom', '_custom'];

// 発売日を 0 日目とした標準 8 週間プラン。
// KDP の審査期間に余裕を持たせるため、出版申請は発売日の 14 日前を目安にする。
export const RELEASE_TASK_OFFSETS = Object.freeze({
  t01: -56,
  t02: -55,
  t11: -54,
  t12: -52,
  t13: -49,
  t14: -47,
  t15: -35,
  t16: -34,
  t21: -33,
  t22: -32,
  t23: -31,
  t31: -30,
  t32: -28,
  t33: -26,
  t34: -25,
  t40: -25,
  t41: -24,
  t42: -23,
  t43a: -22,
  t43b: -22,
  t44: -21,
  t45: -20,
  t46: -19,
  t47: -18,
  t48: -17,
  t49: -14,
  t51: -42,
  t52: -21,
  t53: -7,
  t54: -4,
  t55: 0,
  t56: 3,
});

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnly(value) {
  const match = DATE_RE.exec(String(value || ''));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatDateOnly(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function offsetDate(dateValue, offsetDays) {
  const date = parseDateOnly(dateValue);
  if (!date || !Number.isInteger(offsetDays)) {
    throw new Error('正しい日付と日数を指定してください');
  }

  date.setUTCDate(date.getUTCDate() + offsetDays);
  return formatDateOnly(date);
}

export function addCalendarMonths(dateValue, months = 1) {
  const date = parseDateOnly(dateValue);
  if (!date || !Number.isInteger(months)) {
    throw new Error('正しい日付と月数を指定してください');
  }

  const originalDay = date.getUTCDate();
  const firstDayOfTargetMonth = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    1,
  ));
  const lastDayOfTargetMonth = new Date(Date.UTC(
    firstDayOfTargetMonth.getUTCFullYear(),
    firstDayOfTargetMonth.getUTCMonth() + 1,
    0,
  )).getUTCDate();

  firstDayOfTargetMonth.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return formatDateOnly(firstDayOfTargetMonth);
}

export function syncReleaseScheduleDrafts(currentDrafts, previousSaved, nextSaved) {
  if (previousSaved.projectId !== nextSaved.projectId) {
    return { ...nextSaved };
  }

  return {
    ...currentDrafts,
    projectId: nextSaved.projectId,
    releaseDate: currentDrafts.releaseDate === previousSaved.releaseDate
      ? nextSaved.releaseDate
      : currentDrafts.releaseDate,
    provisionalDate: currentDrafts.provisionalDate === previousSaved.provisionalDate
      ? nextSaved.provisionalDate
      : currentDrafts.provisionalDate,
    releaseMethod: currentDrafts.releaseMethod === previousSaved.releaseMethod
      ? nextSaved.releaseMethod
      : currentDrafts.releaseMethod,
  };
}

export function getScheduleWindow(releaseDate) {
  if (!parseDateOnly(releaseDate)) return null;
  const offsets = Object.values(RELEASE_TASK_OFFSETS);
  return {
    startDate: offsetDate(releaseDate, Math.min(...offsets)),
    releaseDate,
    followUpDate: offsetDate(releaseDate, Math.max(...offsets)),
  };
}

export function readChecklistEnvelope(rawChecklistData) {
  let parsed = {};
  try {
    parsed = rawChecklistData ? JSON.parse(rawChecklistData) : {};
  } catch (cause) {
    return {
      envelope: {},
      data: {},
      corruptRaw: String(rawChecklistData || ''),
      error: new Error('チェックリストの保存データが破損しています。上書きを停止しました。データ管理からバックアップを保存してください。', { cause }),
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      envelope: {},
      data: {},
      corruptRaw: String(rawChecklistData || ''),
      error: new Error('チェックリストの保存形式が正しくありません。上書きを停止しました。データ管理からバックアップを保存してください。'),
    };
  }

  if (Object.hasOwn(parsed, '_data')) {
    if (parsed._data && typeof parsed._data === 'object' && !Array.isArray(parsed._data)) {
      return { envelope: parsed, data: parsed._data, error: null };
    }
    return {
      envelope: {},
      data: {},
      corruptRaw: String(rawChecklistData || ''),
      error: new Error('チェックリストのタスクデータが破損しています。上書きを停止しました。データ管理からバックアップを保存してください。'),
    };
  }

  // 旧形式はルート直下がタスクデータ。保存時は新形式へ安全に包む。
  return { envelope: {}, data: parsed, error: null };
}

export function writeChecklistEnvelope(rawChecklistData, nextData, metadata = {}) {
  const { envelope, error } = readChecklistEnvelope(rawChecklistData);
  if (error) throw error;
  return JSON.stringify({
    ...envelope,
    ...metadata,
    _data: nextData,
  });
}

export function applyReleaseSchedule(checklistData, releaseDate, options = {}) {
  if (!parseDateOnly(releaseDate)) {
    throw new Error('発売目標日を正しく入力してください');
  }

  const overwriteManual = options.overwriteManual === true;
  const scheduleSource = options.scheduleSource === SCHEDULE_DATE_SOURCE_PROVISIONAL
    ? SCHEDULE_DATE_SOURCE_PROVISIONAL
    : SCHEDULE_DATE_SOURCE_RELEASE_TARGET;
  const current = checklistData && typeof checklistData === 'object' ? checklistData : {};
  const next = { ...current };
  let updatedCount = 0;
  let preservedCount = 0;

  for (const [taskId, offset] of Object.entries(RELEASE_TASK_OFFSETS)) {
    const state = current[taskId] && typeof current[taskId] === 'object'
      ? current[taskId]
      : { is_done: false, due_date: '', note: '' };
    const hasLegacyDate = Boolean(state.due_date) && !state.due_date_source;
    const shouldPreserve = !overwriteManual && (
      state.is_done
      || state.due_date_source === 'manual'
      || hasLegacyDate
    );

    if (shouldPreserve) {
      preservedCount += 1;
      continue;
    }

    next[taskId] = {
      ...state,
      due_date: offsetDate(releaseDate, offset),
      due_date_source: 'auto',
      due_date_offset: offset,
      due_date_schedule_source: scheduleSource,
      due_date_schedule_for: releaseDate,
    };
    updatedCount += 1;
  }

  return { data: next, updatedCount, preservedCount };
}

function resetTaskDateState(state, clearAll, targetScheduleSource) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { state, changed: false, preserved: false };
  }

  const hasDateMetadata = Boolean(state.due_date)
    || Object.prototype.hasOwnProperty.call(state, 'due_date_source')
    || Object.prototype.hasOwnProperty.call(state, 'due_date_offset')
    || Object.prototype.hasOwnProperty.call(state, 'due_date_schedule_source')
    || Object.prototype.hasOwnProperty.call(state, 'due_date_schedule_for');
  if (!hasDateMetadata) return { state, changed: false, preserved: false };

  const hasAutoMarker = state.due_date_source === 'auto'
    || (!state.due_date_source && Number.isInteger(state.due_date_offset));
  const storedScheduleSource = state.due_date_schedule_source === SCHEDULE_DATE_SOURCE_PROVISIONAL
    ? SCHEDULE_DATE_SOURCE_PROVISIONAL
    : SCHEDULE_DATE_SOURCE_RELEASE_TARGET;
  const shouldClear = clearAll || (
    hasAutoMarker
    && (!targetScheduleSource || storedScheduleSource === targetScheduleSource)
  );
  if (!shouldClear) return { state, changed: false, preserved: Boolean(state.due_date) };

  const nextState = { ...state, due_date: '' };
  delete nextState.due_date_source;
  delete nextState.due_date_offset;
  delete nextState.due_date_schedule_source;
  delete nextState.due_date_schedule_for;
  return {
    state: nextState,
    changed: true,
    clearedDate: Boolean(state.due_date),
    preserved: false,
  };
}

function resetCustomTaskList(tasks, clearAll, targetScheduleSource) {
  if (!Array.isArray(tasks)) return { tasks, clearedCount: 0, preservedCount: 0 };

  let clearedCount = 0;
  let preservedCount = 0;
  const nextTasks = tasks.map((task) => {
    if (!task || typeof task !== 'object' || Array.isArray(task)) return task;
    const result = resetTaskDateState(task.state, clearAll, targetScheduleSource);
    if (result.clearedDate) clearedCount += 1;
    if (result.preserved) preservedCount += 1;
    return result.changed ? { ...task, state: result.state } : task;
  });

  return { tasks: nextTasks, clearedCount, preservedCount };
}

export function resetReleaseScheduleDates(
  checklistData,
  {
    clearAll = false,
    customTaskLists = {},
    scheduleSource = '',
  } = {},
) {
  const current = checklistData && typeof checklistData === 'object' ? checklistData : {};
  const next = { ...current };
  let clearedCount = 0;
  let preservedCount = 0;

  for (const taskId of Object.keys(RELEASE_TASK_OFFSETS)) {
    const state = current[taskId];
    const result = resetTaskDateState(state, clearAll, scheduleSource);
    if (result.changed) {
      next[taskId] = result.state;
      if (result.clearedDate) clearedCount += 1;
    }
    if (result.preserved) preservedCount += 1;
  }

  const nextCustomTaskLists = {};
  for (const [key, tasks] of Object.entries(customTaskLists || {})) {
    const result = resetCustomTaskList(tasks, clearAll, scheduleSource);
    nextCustomTaskLists[key] = result.tasks;
    clearedCount += result.clearedCount;
    preservedCount += result.preservedCount;
  }

  return {
    data: next,
    customTaskLists: nextCustomTaskLists,
    clearedCount,
    preservedCount,
  };
}

export function getReleaseScheduleSource(project) {
  if (
    project?.schedule_date_source === SCHEDULE_DATE_SOURCE_RELEASE_TARGET
    || project?.schedule_date_source === SCHEDULE_DATE_SOURCE_PROVISIONAL
  ) {
    return project.schedule_date_source;
  }
  // 仮リリース日が存在しなかった旧版の逆算結果は正式日由来。
  return project?.schedule_calculated_for ? SCHEDULE_DATE_SOURCE_RELEASE_TARGET : '';
}

function getEnvelopeCustomTaskLists(envelope) {
  return Object.fromEntries(
    CUSTOM_TASK_LIST_KEYS
      .filter(key => Array.isArray(envelope?.[key]))
      .map(key => [key, envelope[key]]),
  );
}

export function buildReleaseScheduleUpdate(project, {
  date,
  source,
  releaseMethod = '',
  overwriteManual = false,
  generatedAt = new Date().toISOString(),
} = {}) {
  if (!parseDateOnly(date)) throw new Error('逆算する日付を正しく入力してください');
  if (
    source !== SCHEDULE_DATE_SOURCE_RELEASE_TARGET
    && source !== SCHEDULE_DATE_SOURCE_PROVISIONAL
  ) {
    throw new Error('日程の基準が正しくありません');
  }
  if (source === SCHEDULE_DATE_SOURCE_RELEASE_TARGET && !releaseMethod) {
    throw new Error('正式な発売目標日で逆算する前に、配信方法を選んでください');
  }

  const { data, error } = readChecklistEnvelope(project?.checklist_data);
  if (error) throw error;
  const result = applyReleaseSchedule(data, date, {
    overwriteManual,
    scheduleSource: source,
  });
  const metadata = {
    _schedule_version: RELEASE_SCHEDULE_VERSION,
    _schedule_calculated_for: date,
    _schedule_date_source: source,
    _schedule_generated_at: generatedAt,
    ...(source === SCHEDULE_DATE_SOURCE_RELEASE_TARGET ? { _schedule_mode: releaseMethod } : {}),
  };
  const updates = {
    schedule_calculated_for: date,
    schedule_date_source: source,
    schedule_generated_at: generatedAt,
    checklist_data: writeChecklistEnvelope(project?.checklist_data, result.data, metadata),
  };

  if (source === SCHEDULE_DATE_SOURCE_RELEASE_TARGET) {
    updates.release_target_date = date;
    updates.release_method = releaseMethod;
    updates.schedule_mode = releaseMethod;
  } else {
    // 仮日からの逆算では正式日・KDP日付・配信方法を決定しない。
    updates.provisional_release_date = date;
  }

  return { updates, result };
}

export function buildReleaseDateClearUpdate({ kind } = {}) {
  if (kind !== 'official' && kind !== 'provisional') {
    throw new Error('未設定に戻す日付の種類が正しくありません');
  }

  const updates = kind === 'provisional'
    ? { provisional_release_date: '' }
    : { release_target_date: '' };

  return { updates };
}

export function buildReleaseTaskDatesResetUpdate(project, { clearAll = false } = {}) {
  const { envelope, data, error } = readChecklistEnvelope(project?.checklist_data);
  if (error) throw error;
  const result = resetReleaseScheduleDates(data, {
    clearAll,
    customTaskLists: getEnvelopeCustomTaskLists(envelope),
  });
  return {
    updates: {
      schedule_calculated_for: '',
      schedule_date_source: '',
      schedule_generated_at: '',
      checklist_data: writeChecklistEnvelope(project?.checklist_data, result.data, {
        ...result.customTaskLists,
        _schedule_calculated_for: '',
        _schedule_date_source: '',
        _schedule_generated_at: '',
      }),
    },
    result,
  };
}

export function countOverdueTasks(checklistData, todayValue) {
  const today = todayValue || formatDateOnly(new Date());
  if (!parseDateOnly(today)) return 0;

  return Object.keys(RELEASE_TASK_OFFSETS).filter(taskId => {
    const state = checklistData?.[taskId];
    return state?.due_date && !state.is_done && state.due_date < today;
  }).length;
}
