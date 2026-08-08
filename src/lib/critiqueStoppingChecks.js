import { readChecklistEnvelope, writeChecklistEnvelope } from './releaseSchedule.js';

export const CRITIQUE_STOPPING_CHECKS_FIELD = '_critique_stopping_checks';
export const LEGACY_CRITIQUE_STOPPING_CHECKS_KEY = 'up-review-checklist';

export function normalizeCritiqueStoppingChecks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, checked]) => key && typeof checked === 'boolean')
      .map(([key, checked]) => [key, checked]),
  );
}

function readLegacyChecks(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return { checks: {}, error: null };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { checks: {}, error: new Error('旧終了判断チェックの形式が正しくありません') };
    }
    return { checks: normalizeCritiqueStoppingChecks(parsed), error: null };
  } catch (cause) {
    return { checks: {}, error: new Error('旧終了判断チェックを読み込めません', { cause }) };
  }
}

export function readCritiqueStoppingChecks(rawChecklistData, legacyRaw = null) {
  const checklist = readChecklistEnvelope(rawChecklistData);
  if (checklist.error) {
    return { checks: {}, source: 'error', error: checklist.error, legacyError: null };
  }

  const legacy = readLegacyChecks(legacyRaw);
  if (Object.prototype.hasOwnProperty.call(checklist.envelope, CRITIQUE_STOPPING_CHECKS_FIELD)) {
    return {
      checks: normalizeCritiqueStoppingChecks(checklist.envelope[CRITIQUE_STOPPING_CHECKS_FIELD]),
      source: 'project',
      error: null,
      legacyChecks: legacy.checks,
      legacyError: legacy.error,
    };
  }

  return {
    checks: legacy.checks,
    source: Object.keys(legacy.checks).length > 0 ? 'legacy' : 'empty',
    error: null,
    legacyChecks: legacy.checks,
    legacyError: legacy.error,
  };
}

export function writeCritiqueStoppingChecks(rawChecklistData, checks) {
  const checklist = readChecklistEnvelope(rawChecklistData);
  if (checklist.error) throw checklist.error;
  return writeChecklistEnvelope(rawChecklistData, checklist.data, {
    [CRITIQUE_STOPPING_CHECKS_FIELD]: normalizeCritiqueStoppingChecks(checks),
  });
}

export function patchCritiqueStoppingCheck(rawChecklistData, signId, checked) {
  const restored = readCritiqueStoppingChecks(rawChecklistData);
  if (restored.error) throw restored.error;
  const checks = {
    ...selectProjectCritiqueStoppingChecks(restored),
    [signId]: checked === true,
  };
  return {
    checks,
    value: writeCritiqueStoppingChecks(rawChecklistData, checks),
  };
}

export function mergeCritiqueStoppingChecks(rawChecklistData, incomingChecks) {
  const restored = readCritiqueStoppingChecks(rawChecklistData);
  if (restored.error) throw restored.error;
  const checks = {
    ...normalizeCritiqueStoppingChecks(incomingChecks),
    ...selectProjectCritiqueStoppingChecks(restored),
  };
  return {
    checks,
    value: writeCritiqueStoppingChecks(rawChecklistData, checks),
  };
}

export function selectProjectCritiqueStoppingChecks(readResult) {
  return readResult?.source === 'project'
    ? normalizeCritiqueStoppingChecks(readResult.checks)
    : {};
}

export function rollbackFailedCritiqueStoppingChecks(current, attempted, previous) {
  return current === attempted ? previous : current;
}
