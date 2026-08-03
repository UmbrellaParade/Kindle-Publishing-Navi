export const RELEASE_SCHEDULE_VERSION = 1;

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
    };
    updatedCount += 1;
  }

  return { data: next, updatedCount, preservedCount };
}

export function countOverdueTasks(checklistData, todayValue) {
  const today = todayValue || formatDateOnly(new Date());
  if (!parseDateOnly(today)) return 0;

  return Object.keys(RELEASE_TASK_OFFSETS).filter(taskId => {
    const state = checklistData?.[taskId];
    return state?.due_date && !state.is_done && state.due_date < today;
  }).length;
}
