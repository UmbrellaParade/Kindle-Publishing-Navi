function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

// Resolve against the current project, not a stale record or the next unused ID.
export function resolvePlanningGptHandoffTarget({ kind, data, activeSession, nextManagementId }) {
  const sessions = (kind === 'critique' ? data?.critiqueGptSessions : data?.gptSessions) || [];
  const source = sessions.find(record => record.id === activeSession?.id && record.sessionStatus === 'active');
  const targetId = text(source?.handoffToId);
  const targets = targetId ? sessions.filter(record => (
    record.managementId === targetId
    && record.id !== source.id
    && record.sessionStatus === 'on_hold'
  )) : [];
  const target = targets.length === 1 ? targets[0] : null;
  return {
    currentManagementId: text(source?.managementId),
    nextManagementId: target?.managementId || text(nextManagementId),
    isRegisteredTarget: Boolean(target),
    invalidTarget: Boolean(targetId && !target),
  };
}

export function formatCritiqueHandoffFindings(entry, { unresolvedOnly = false } = {}) {
  if (!entry) return '未設定（対象版・論評回に対応する履歴を未選択）';
  if (unresolvedOnly && ['completed', 'deferred'].includes(entry.responseStatus)) return 'なし';
  const labels = { mustFix: '必ず直す', readerCheck: '読者確認', authorJudgment: '著者判断', deferred: '見送る' };
  const keys = unresolvedOnly ? ['mustFix', 'readerCheck', 'authorJudgment'] : Object.keys(labels);
  const categorized = keys.map(key => {
    const value = text(entry.findingCategories?.[key]);
    return value ? `【${labels[key]}】\n${value}` : '';
  }).filter(Boolean);
  if (categorized.length > 0) return categorized.join('\n\n');
  const fixes = (entry.priorityFixes || []).map(text).filter(Boolean);
  return fixes.length > 0 ? fixes.map((value, index) => `${index + 1}. ${value}`).join('\n') : '未設定';
}

// Legacy critique entries have a manuscript label but no round number. Do not
// infer a round from array position/count: deletion or another book version changes it.
export function resolveCritiqueHandoffContext(activeSession, entries = [], selection = null) {
  const version = text(activeSession?.targetManuscriptVersionId);
  const round = positiveInteger(activeSession?.critiqueRound);
  const candidates = version ? entries.filter(entry => (
    text(entry.manuscriptLabel) === version
    && (!positiveInteger(entry.critiqueRound) || positiveInteger(entry.critiqueRound) === round)
  )) : [];
  const exact = round ? candidates.filter(entry => positiveInteger(entry.critiqueRound) === round) : [];
  const chosen = selection ? candidates.find(entry => (
    entry.id === selection.id && (entry.updatedAt || '') === (selection.updatedAt || '')
  )) : null;
  const entry = chosen || (!selection && exact.length === 1 ? exact[0] : null);
  const roundNeedsConfirmation = Boolean(entry && !positiveInteger(entry.critiqueRound));
  return {
    candidates,
    entry,
    roundNeedsConfirmation,
    templateValues: {
      targetManuscriptVersionId: version || '未設定',
      critiqueRound: roundNeedsConfirmation
        ? `${round || '未設定'}（GPT管理欄の値。選択した履歴には論評回の記録がないため要確認）`
        : round || '未設定',
      previousFindings: formatCritiqueHandoffFindings(entry),
      unresolvedFindings: formatCritiqueHandoffFindings(entry, { unresolvedOnly: true }),
    },
  };
}
