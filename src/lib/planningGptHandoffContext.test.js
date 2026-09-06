import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCritiqueHandoffContext,
  resolvePlanningGptHandoffTarget,
} from './planningGptHandoffContext.js';
import {
  activatePlanningCritiqueGptSession,
  activatePlanningGptSession,
  createEmptyPlanningNotes,
  createPlanningCritiqueGptHandoffTarget,
  createPlanningCritiqueGptSessionRecord,
  createPlanningGptHandoffTarget,
  createPlanningGptSessionRecord,
  getDefaultPlanningGptHandoffTemplate,
  getNextPlanningCritiqueGptManagementId,
  getNextPlanningGptManagementId,
  renderPlanningGptHandoffTemplate,
  upsertPlanningCritiqueGptSession,
  upsertPlanningGptSession,
} from './planningNotes.js';

for (const kind of ['support', 'critique']) {
  const critique = kind === 'critique';
  const field = critique ? 'critiqueGptSessions' : 'gptSessions';
  const prefix = critique ? 'CRITIQUE' : 'GPT';
  const create = critique ? createPlanningCritiqueGptSessionRecord : createPlanningGptSessionRecord;
  const upsert = critique ? upsertPlanningCritiqueGptSession : upsertPlanningGptSession;
  const createTarget = critique ? createPlanningCritiqueGptHandoffTarget : createPlanningGptHandoffTarget;
  const activate = critique ? activatePlanningCritiqueGptSession : activatePlanningGptSession;
  const getNext = critique ? getNextPlanningCritiqueGptManagementId : getNextPlanningGptManagementId;

  test(`${kind}: 引継ぎ登録前→登録済み002→使用中切替のコピーIDは現在の関係に一致する`, () => {
    let data = createEmptyPlanningNotes();
    const source = create(data, { sessionName: '旧会話', sessionStatus: 'active' });
    data = upsert(data, source, { expectedUpdatedAt: null });
    const resolve = () => resolvePlanningGptHandoffTarget({
      kind, data, activeSession: data[field].find(record => record.sessionStatus === 'active'), nextManagementId: getNext(data),
    });
    assert.deepEqual(resolve(), {
      currentManagementId: `${prefix}-001`, nextManagementId: `${prefix}-002`, isRegisteredTarget: false, invalidTarget: false,
    });
    data = createTarget(data, source.id, { sessionName: '新会話' }, {
      expectedUpdatedAt: data[field].find(record => record.id === source.id).updatedAt,
    });
    assert.equal(getNext(data), `${prefix}-003`);
    assert.equal(resolve().nextManagementId, `${prefix}-002`);
    assert.equal(resolve().isRegisteredTarget, true);
    const rendered = renderPlanningGptHandoffTemplate(kind, getDefaultPlanningGptHandoffTemplate(kind).handoffStartMessage, resolve());
    assert.ok(rendered.includes(`${prefix}-002`));
    assert.ok(!rendered.includes(`${prefix}-003`));
    const currentSource = data[field].find(record => record.id === source.id);
    const target = data[field].find(record => record.id !== source.id);
    data = activate(data, target.id, {
      expectedTargetUpdatedAt: target.updatedAt, expectedSourceUpdatedAt: currentSource.updatedAt,
    });
    assert.deepEqual(resolve(), {
      currentManagementId: `${prefix}-002`, nextManagementId: `${prefix}-003`, isRegisteredTarget: false, invalidTarget: false,
    });
  });

  test(`${kind}: 消えた引継ぎ先・古い参照・別プロジェクトには安全な候補へ戻る`, () => {
    const source = { id: 'source', managementId: `${prefix}-001`, sessionStatus: 'active', handoffToId: `${prefix}-002` };
    const args = { kind, data: { [field]: [source] }, activeSession: source, nextManagementId: `${prefix}-003` };
    assert.equal(resolvePlanningGptHandoffTarget(args).invalidTarget, true);
    assert.equal(resolvePlanningGptHandoffTarget(args).nextManagementId, `${prefix}-003`);
    const staleSource = { ...source, handoffToId: `${prefix}-099` };
    const target = { id: 'target', managementId: `${prefix}-002`, sessionStatus: 'on_hold' };
    assert.equal(resolvePlanningGptHandoffTarget({ ...args, data: { [field]: [source, target] }, activeSession: staleSource }).nextManagementId, `${prefix}-002`);
    const changedProject = resolvePlanningGptHandoffTarget({ ...args, data: { [field]: [target] } });
    assert.equal(changedProject.currentManagementId, '');
    assert.equal(changedProject.isRegisteredTarget, false);
    assert.equal(resolvePlanningGptHandoffTarget({ ...args, data: { [field]: [source, { ...target, sessionStatus: 'completed' }] } }).isRegisteredTarget, false);
  });
}

const session = { targetManuscriptVersionId: '第1稿', critiqueRound: 2 };
const first = { id: 'v1-first', manuscriptLabel: '第1稿', updatedAt: '2026-09-01', findingCategories: { mustFix: '第1稿の指摘1' } };
const second = { id: 'v1-second', manuscriptLabel: '第1稿', updatedAt: '2026-09-02', findingCategories: { mustFix: '第1稿の指摘2' } };
const latest = { id: 'v2', manuscriptLabel: '第2稿', updatedAt: '2026-09-03', findingCategories: { mustFix: '第2稿の指摘' } };
const select = entry => ({ id: entry.id, updatedAt: entry.updatedAt });

test('論評引継ぎは別の版の最新履歴を使わず、回が不明な同一版は明示選択まで未設定', () => {
  const context = resolveCritiqueHandoffContext(session, [latest, second, first]);
  assert.deepEqual(context.candidates.map(entry => entry.id), ['v1-second', 'v1-first']);
  assert.equal(context.entry, null);
  assert.equal(context.templateValues.targetManuscriptVersionId, '第1稿');
  assert.equal(context.templateValues.critiqueRound, 2);
  assert.match(context.templateValues.previousFindings, /未選択/);
  assert.doesNotMatch(JSON.stringify(context.templateValues), /第2稿/);
});

test('論評履歴の明示選択後は同じ1件の前回指摘と未対応指摘だけを使い、回の不確かさを示す', () => {
  const context = resolveCritiqueHandoffContext(session, [latest, second, first], select(second));
  assert.equal(context.entry.id, second.id);
  assert.match(context.templateValues.previousFindings, /第1稿の指摘2/);
  assert.match(context.templateValues.unresolvedFindings, /第1稿の指摘2/);
  assert.match(context.templateValues.critiqueRound, /^2.*要確認/);
  assert.doesNotMatch(JSON.stringify(context.templateValues), /第1稿の指摘1|第2稿の指摘/);
  const completed = { ...second, responseStatus: 'completed' };
  assert.equal(resolveCritiqueHandoffContext(session, [completed], select(completed)).templateValues.unresolvedFindings, 'なし');
});

test('削除・更新・別の版への変更後は古い選択を差し込まず、別の履歴へも自動で切り替えない', () => {
  for (const entries of [[latest, first], [latest, { ...second, updatedAt: 'new' }]]) {
    const context = resolveCritiqueHandoffContext(session, entries, select(second));
    assert.equal(context.entry, null);
    assert.match(context.templateValues.previousFindings, /未選択/);
  }
  assert.equal(resolveCritiqueHandoffContext({ ...session, targetManuscriptVersionId: '第2稿' }, [latest, second], select(second)).entry, null);
  assert.equal(resolveCritiqueHandoffContext(session, [latest], select(latest)).entry, null);
});

test('版・回が明記されている履歴は一意に一致するときだけ自動で差し込む', () => {
  const roundOne = { ...first, critiqueRound: 1 };
  const roundTwo = { ...second, critiqueRound: 2 };
  assert.equal(resolveCritiqueHandoffContext(session, [latest, roundTwo, roundOne]).entry.id, second.id);
  assert.equal(resolveCritiqueHandoffContext(session, [roundOne], select(roundOne)).entry, null);
  const duplicateRound = { ...roundTwo, id: 'ambiguous' };
  assert.equal(resolveCritiqueHandoffContext(session, [roundTwo, duplicateRound]).entry, null);
  assert.equal(resolveCritiqueHandoffContext(session, [roundTwo], { id: '', updatedAt: '' }).entry, null);
});

test('使用中GPT・対象版が未設定なら履歴全件から補完せず、URLや非公開メモも差し込まない', () => {
  const context = resolveCritiqueHandoffContext(null, [latest, second]);
  assert.equal(context.entry, null);
  assert.deepEqual(context.candidates, []);
  assert.equal(context.templateValues.targetManuscriptVersionId, '未設定');
  const privateSession = { ...session, gptUrl: 'https://private.example/secret', handoffMemo: '秘密メモ', notes: '秘密備考' };
  assert.doesNotMatch(JSON.stringify(resolveCritiqueHandoffContext(privateSession, [second], select(second)).templateValues), /private|秘密/);
});
