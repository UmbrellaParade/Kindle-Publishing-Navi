import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PlanningNotesMergeConflictError,
  PlanningNotesImportConflictError,
  applyMarketResearchImport,
  assignDecisionCanonical,
  assignInstructionCanonical,
  buildPlanningNotesSharePackage,
  clearInstructionCanonical,
  createEmptyPlanningNotes,
  createPlanningRecord,
  deletePlanningRecord,
  duplicatePlanningRecord,
  estimatePlanningNotesBytes,
  filterPlanningNotes,
  findMarketResearchRestrictedData,
  findPlanningNotesSensitiveData,
  formatPlanningDateTimeJst,
  getPlanningMarketMetrics,
  mergePlanningNotesValues,
  movePlanningChapter,
  normalizePlanningNotes,
  planningNotesShareToMarkdown,
  parseMarketResearchSummaryMarkdown,
  previewMarketResearchImport,
  readPlanningNotes,
  savePlanningMarketSummary,
  savePlanningConcept,
  serializePlanningNotes,
  sortPlanningRecordsNewest,
  upsertPlanningRecord,
  withdrawPlanningDecision,
} from './planningNotes.js';

const fixedNow = () => new Date('2026-08-14T00:00:00.000Z');

function idFactory(...ids) {
  let index = 0;
  return () => ids[index++] || `id-${index}`;
}

function addRecord(data, section, record) {
  return upsertPlanningRecord(data, section, record, {
    expectedUpdatedAt: null,
    now: fixedNow,
  });
}

test('既存プロジェクトは空の企画ノートとして安全に開きJSONで往復する', () => {
  const empty = readPlanningNotes('');
  assert.equal(empty.error, null);
  assert.equal(empty.hasSavedData, false);
  assert.equal(empty.data.concept.id, 'concept');
  assert.deepEqual(empty.data.chapters, []);

  const serialized = serializePlanningNotes(empty.data);
  const restored = readPlanningNotes(serialized);
  assert.equal(restored.error, null);
  assert.equal(restored.hasSavedData, true);
  assert.deepEqual(restored.data, empty.data);
});

test('6領域を構造化保存し、取材を安定した章IDへ紐づける', () => {
  let data = savePlanningConcept(createEmptyPlanningNotes(), {
    targetReader: '初めてKindle本を作る人',
    readerProblems: '情報が会話へ散らばる',
    bookPromise: '迷わず1冊へまとめられる',
    theme: '出版準備',
    uniqueness: '本人の取材履歴を残す',
    includeMarkdown: '- 実体験',
    excludeMarkdown: '- 架空の実績',
    status: 'draft',
  }, { expectedUpdatedAt: '', now: fixedNow });

  const chapter = createPlanningRecord('chapters', { title: '第1章 はじめに', order: 0 }, {
    now: fixedNow,
    idFactory: idFactory('chapter-1'),
  });
  data = addRecord(data, 'chapters', chapter);
  const competitor = createPlanningRecord('competitors', {
    bookTitle: '競合本A',
    url: 'https://example.com/book',
    claimKind: 'fact',
  }, { now: fixedNow, idFactory: idFactory('competitor-1') });
  data = addRecord(data, 'competitors', competitor);
  const interview = createPlanningRecord('interviews', {
    question: '最初に困ったことは？',
    rawAnswer: '何から始めるか迷いました。',
    chapterIds: ['chapter-1'],
  }, { now: fixedNow, idFactory: idFactory('interview-1') });
  data = addRecord(data, 'interviews', interview);
  const instruction = createPlanningRecord('instructionVersions', {
    name: '執筆指示書',
    markdown: '# 指示書 v1',
    chapterIds: ['chapter-1'],
  }, {
    now: fixedNow,
    idFactory: idFactory('instruction-1', 'instruction-document-1'),
  });
  data = addRecord(data, 'instructionVersions', instruction);
  const decision = createPlanningRecord('decisions', {
    decision: '初心者向けに絞る',
    reason: '対象読者を明確にするため',
    chapterIds: ['chapter-1'],
  }, { now: fixedNow, idFactory: idFactory('decision-1') });
  data = addRecord(data, 'decisions', decision);

  const restored = readPlanningNotes(serializePlanningNotes(data)).data;
  assert.equal(restored.competitors.length, 1);
  assert.equal(restored.chapters.length, 1);
  assert.equal(restored.interviews[0].chapterIds[0], 'chapter-1');
  assert.equal(restored.instructionVersions[0].documentId, 'instruction-document-1');
  assert.equal(restored.decisions.length, 1);
});

test('存在しない章への紐づけ、無効URL、未知versionを拒否する', () => {
  const empty = createEmptyPlanningNotes();
  assert.throws(
    () => normalizePlanningNotes({
      ...empty,
      interviews: [{
        ...createPlanningRecord('interviews', {}, {
          now: fixedNow,
          idFactory: idFactory('interview-1'),
        }),
        chapterIds: ['missing-chapter'],
      }],
    }),
    /存在しない章ID/,
  );
  assert.throws(
    () => createPlanningRecord('competitors', { url: 'javascript:alert(1)' }, {
      now: fixedNow,
      idFactory: idFactory('competitor-1'),
    }),
    /http または https/,
  );
  assert.equal(readPlanningNotes(JSON.stringify({ ...empty, version: 99 })).error instanceof Error, true);
});

test('競合の確認日と意思決定日を実在日として保存し、不正日付を拒否する', () => {
  const competitor = createPlanningRecord('competitors', {
    checkedOn: '2026-08-14',
  }, { now: fixedNow, idFactory: idFactory('competitor-date') });
  const decision = createPlanningRecord('decisions', {
    decidedAt: '2024-02-29',
  }, { now: fixedNow, idFactory: idFactory('decision-date') });

  assert.equal(competitor.checkedOn, '2026-08-14');
  assert.equal(decision.decidedAt, '2024-02-29');
  assert.throws(
    () => createPlanningRecord('decisions', { decidedAt: '2026-02-30' }, {
      now: fixedNow,
      idFactory: idFactory('decision-invalid-date'),
    }),
    /日付の形式/,
  );
});

test('3章を上下ボタン相当の操作で並べ替えてもIDを維持する', () => {
  let data = createEmptyPlanningNotes();
  for (const [id, title, order] of [
    ['chapter-1', '第1章', 0],
    ['chapter-2', '第2章', 1],
    ['chapter-3', '第3章', 2],
  ]) {
    data = addRecord(data, 'chapters', createPlanningRecord('chapters', { id, title, order }, {
      now: fixedNow,
      idFactory: idFactory(id),
    }));
  }

  const beforeMoveRevision = data.chapterOrderRevision;
  const moved = movePlanningChapter(data, 'chapter-3', 'up', {
    expectedRevision: data.chapterOrderRevision,
  });
  assert.deepEqual(
    [...moved.chapters].sort((a, b) => a.order - b.order).map(chapter => chapter.id),
    ['chapter-1', 'chapter-3', 'chapter-2'],
  );
  assert.equal(moved.chapterOrderRevision, beforeMoveRevision + 1);
});

test('本人承認済みの章は隣の未承認章からも並べ替えない', () => {
  let data = createEmptyPlanningNotes();
  data = addRecord(data, 'chapters', createPlanningRecord('chapters', {
    title: '承認済み章',
    order: 0,
    status: 'approved',
  }, { now: fixedNow, idFactory: idFactory('chapter-approved') }));
  data = addRecord(data, 'chapters', createPlanningRecord('chapters', {
    title: '新しい章案',
    order: 1,
  }, { now: fixedNow, idFactory: idFactory('chapter-draft') }));

  assert.throws(
    () => movePlanningChapter(data, 'chapter-draft', 'up', {
      expectedRevision: data.chapterOrderRevision,
    }),
    /本人承認済みの章順/,
  );
  assert.equal(data.chapters.find(chapter => chapter.id === 'chapter-approved').order, 0);
});

test('章削除後の空いた順序でも新規・複製を保存でき、移動は離れた承認章を変えない', () => {
  let data = createEmptyPlanningNotes();
  for (const [id, title, order, status] of [
    ['chapter-a', 'A', 0, 'draft'],
    ['chapter-b', 'B', 1, 'draft'],
    ['chapter-approved', '承認章', 2, 'approved'],
    ['chapter-c', 'C', 3, 'draft'],
    ['chapter-d', 'D', 4, 'draft'],
  ]) {
    data = addRecord(data, 'chapters', createPlanningRecord('chapters', {
      title,
      order,
      status,
    }, { now: fixedNow, idFactory: idFactory(id) }));
  }
  const deleteTarget = data.chapters.find(chapter => chapter.id === 'chapter-b');
  data = deletePlanningRecord(data, 'chapters', deleteTarget.id, {
    expectedUpdatedAt: deleteTarget.updatedAt,
  });

  const maxOrder = Math.max(...data.chapters.map(chapter => chapter.order));
  const newChapter = createPlanningRecord('chapters', {
    title: '新規章',
    order: maxOrder + 1,
  }, { now: fixedNow, idFactory: idFactory('chapter-new') });
  data = addRecord(data, 'chapters', newChapter);
  const duplicated = duplicatePlanningRecord(data, 'chapters', 'chapter-a', {
    now: fixedNow,
    idFactory: idFactory('chapter-copy'),
  });
  assert.equal(duplicated.order, Math.max(...data.chapters.map(chapter => chapter.order)) + 1);
  data = addRecord(data, 'chapters', duplicated);

  const approvedBefore = data.chapters.find(chapter => chapter.id === 'chapter-approved');
  const moved = movePlanningChapter(data, 'chapter-d', 'up', {
    expectedRevision: data.chapterOrderRevision,
  });
  const approvedAfter = moved.chapters.find(chapter => chapter.id === 'chapter-approved');
  assert.equal(approvedAfter.order, approvedBefore.order);
  assert.equal(approvedAfter.updatedAt, approvedBefore.updatedAt);
  assert.equal(moved.chapters.find(chapter => chapter.id === 'chapter-new').order, maxOrder + 1);
});

test('取材等が参照している章は理由を示して削除を止める', () => {
  let data = createEmptyPlanningNotes();
  const chapter = createPlanningRecord('chapters', { title: '参照中の章', order: 0 }, {
    now: fixedNow,
    idFactory: idFactory('chapter-linked'),
  });
  data = addRecord(data, 'chapters', chapter);
  data = addRecord(data, 'interviews', createPlanningRecord('interviews', {
    question: '紐づく質問',
    chapterIds: [chapter.id],
  }, { now: fixedNow, idFactory: idFactory('interview-linked') }));

  assert.throws(
    () => deletePlanningRecord(data, 'chapters', chapter.id, {
      expectedUpdatedAt: chapter.updatedAt,
    }),
    /紐づく記録が1件.*先に.*紐づく章.*外して/,
  );
});

test('承認済み指示書v1を上書きせずv2を新しい版IDで作る', () => {
  let data = createEmptyPlanningNotes();
  const version1 = createPlanningRecord('instructionVersions', {
    name: '執筆指示書',
    markdown: '# v1',
    status: 'approved',
    approvedAt: '2026-08-14T00:00:00.000Z',
  }, {
    now: fixedNow,
    idFactory: idFactory('instruction-v1', 'instruction-document-1'),
  });
  data = addRecord(data, 'instructionVersions', version1);
  assert.throws(
    () => upsertPlanningRecord(data, 'instructionVersions', { ...version1, markdown: '# 改変' }, {
      expectedUpdatedAt: version1.updatedAt,
      now: fixedNow,
    }),
    /本人承認済み/,
  );

  const version2 = duplicatePlanningRecord(data, 'instructionVersions', 'instruction-v1', {
    now: () => new Date('2026-08-15T00:00:00.000Z'),
    idFactory: idFactory('instruction-v2'),
  });
  data = addRecord(data, 'instructionVersions', version2);
  assert.equal(data.instructionVersions[0].markdown, '# v1');
  assert.equal(data.instructionVersions[1].versionNumber, 2);
  assert.equal(data.instructionVersions[1].previousVersionId, 'instruction-v1');
  assert.equal(data.instructionVersions[1].documentId, 'instruction-document-1');
  assert.equal(data.instructionVersions[1].status, 'draft');
});

test('同じ指示書系列は最大版の次を採番し、同一版番号の二重保存を拒否する', () => {
  let data = createEmptyPlanningNotes();
  const version1 = createPlanningRecord('instructionVersions', {
    name: '執筆指示書',
  }, {
    now: fixedNow,
    idFactory: idFactory('instruction-v1', 'document-1'),
  });
  data = addRecord(data, 'instructionVersions', version1);
  const version2 = duplicatePlanningRecord(data, 'instructionVersions', version1.id, {
    now: fixedNow,
    idFactory: idFactory('instruction-v2'),
  });
  data = addRecord(data, 'instructionVersions', version2);

  const version3 = duplicatePlanningRecord(data, 'instructionVersions', version1.id, {
    now: fixedNow,
    idFactory: idFactory('instruction-v3'),
  });
  assert.equal(version3.versionNumber, 3);
  assert.equal(version3.previousVersionId, version1.id);

  assert.throws(
    () => addRecord(data, 'instructionVersions', {
      ...version2,
      id: 'instruction-stale-v2',
    }),
    /版番号が重複/,
  );
});

test('承認済み企画メモから新しい案を作ると承認版を履歴へ残す', () => {
  let data = savePlanningConcept(createEmptyPlanningNotes(), {
    targetReader: '最初の読者',
    status: 'approved',
  }, { expectedUpdatedAt: '', now: fixedNow });
  data = savePlanningConcept(data, {
    ...data.concept,
    targetReader: '見直した読者',
    status: 'draft',
  }, {
    expectedUpdatedAt: data.concept.updatedAt,
    forkApproved: true,
    now: () => new Date('2026-08-15T00:00:00.000Z'),
    idFactory: idFactory('concept-history-1'),
  });

  assert.equal(data.concept.targetReader, '見直した読者');
  assert.equal(data.concept.status, 'draft');
  assert.equal(data.conceptHistory.length, 1);
  assert.equal(data.conceptHistory[0].targetReader, '最初の読者');
  assert.equal(data.conceptHistory[0].status, 'approved');
});

test('検索・種類・章・状態・資料優先順位を組み合わせて絞り込む', () => {
  let data = createEmptyPlanningNotes();
  const chapter = createPlanningRecord('chapters', { title: '体験談', order: 0 }, {
    now: fixedNow,
    idFactory: idFactory('chapter-1'),
  });
  data = addRecord(data, 'chapters', chapter);
  const interview = createPlanningRecord('interviews', {
    question: '失敗した出来事は？',
    rawAnswer: '初日に保存を忘れた',
    chapterIds: ['chapter-1'],
    sourcePriority: 'primary',
    status: 'needs_confirmation',
  }, { now: fixedNow, idFactory: idFactory('interview-1') });
  data = addRecord(data, 'interviews', interview);

  const results = filterPlanningNotes(data, {
    query: '保存',
    section: 'interviews',
    chapterId: 'chapter-1',
    status: 'needs_confirmation',
    sourcePriority: 'primary',
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].record.id, 'interview-1');
  assert.equal(
    filterPlanningNotes(data, { section: 'concept' }).length,
    0,
    '未入力の企画メモは検索結果の1件として数えない',
  );
});

test('バックアップ結合は別IDを和集合にし、同一IDの異内容を静かに上書きしない', () => {
  let current = createEmptyPlanningNotes();
  let incoming = createEmptyPlanningNotes();
  const currentRecord = createPlanningRecord('decisions', { decision: '現在の判断' }, {
    now: fixedNow,
    idFactory: idFactory('decision-current'),
  });
  const incomingRecord = createPlanningRecord('decisions', { decision: '入力側の判断' }, {
    now: fixedNow,
    idFactory: idFactory('decision-incoming'),
  });
  current = addRecord(current, 'decisions', currentRecord);
  incoming = addRecord(incoming, 'decisions', incomingRecord);
  const merged = readPlanningNotes(mergePlanningNotesValues(
    serializePlanningNotes(current),
    serializePlanningNotes(incoming),
  )).data;
  assert.deepEqual(merged.decisions.map(record => record.id), ['decision-current', 'decision-incoming']);

  const conflicting = {
    ...incoming,
    decisions: [{ ...currentRecord, decision: '同じIDの別内容' }],
  };
  assert.throws(
    () => mergePlanningNotesValues(
      serializePlanningNotes(current),
      serializePlanningNotes(conflicting),
    ),
    PlanningNotesMergeConflictError,
  );
});

test('結合時も承認済み章の順序と指示書の同一系列・版番号を静かに変えない', () => {
  let current = createEmptyPlanningNotes();
  let incoming = createEmptyPlanningNotes();
  current = addRecord(current, 'chapters', createPlanningRecord('chapters', {
    title: '現在の承認済み章',
    order: 0,
    status: 'approved',
  }, { now: fixedNow, idFactory: idFactory('chapter-current') }));
  incoming = addRecord(incoming, 'chapters', createPlanningRecord('chapters', {
    title: '入力側の承認済み章',
    order: 0,
    status: 'approved',
  }, { now: fixedNow, idFactory: idFactory('chapter-incoming') }));
  assert.throws(
    () => mergePlanningNotesValues(serializePlanningNotes(current), serializePlanningNotes(incoming)),
    PlanningNotesMergeConflictError,
  );

  const firstRestore = mergePlanningNotesValues('', serializePlanningNotes(incoming));
  const repeatedRestore = mergePlanningNotesValues(firstRestore, serializePlanningNotes(incoming));
  assert.deepEqual(readPlanningNotes(repeatedRestore).data, readPlanningNotes(firstRestore).data);

  let appendCurrent = createEmptyPlanningNotes();
  const commonChapter = createPlanningRecord('chapters', {
    title: '共通章',
    order: 0,
  }, { now: fixedNow, idFactory: idFactory('chapter-common') });
  appendCurrent = addRecord(appendCurrent, 'chapters', commonChapter);
  let appendIncoming = addRecord(createEmptyPlanningNotes(), 'chapters', commonChapter);
  appendIncoming = addRecord(appendIncoming, 'chapters', createPlanningRecord('chapters', {
    title: '末尾へ追加できる章',
    order: 1,
  }, { now: fixedNow, idFactory: idFactory('chapter-safe-append') }));
  const safeAppend = mergePlanningNotesValues(
    serializePlanningNotes(appendCurrent),
    serializePlanningNotes(appendIncoming),
  );
  assert.deepEqual(
    readPlanningNotes(safeAppend).data.chapters.map(chapter => [chapter.id, chapter.order]),
    [['chapter-common', 0], ['chapter-safe-append', 1]],
  );
  assert.deepEqual(
    readPlanningNotes(mergePlanningNotesValues(safeAppend, serializePlanningNotes(appendIncoming))).data,
    readPlanningNotes(safeAppend).data,
  );

  let instructionCurrent = createEmptyPlanningNotes();
  let instructionIncoming = createEmptyPlanningNotes();
  instructionCurrent = addRecord(instructionCurrent, 'instructionVersions', createPlanningRecord('instructionVersions', {
    documentId: 'document-shared',
    versionNumber: 1,
    name: '現在のv1',
  }, { now: fixedNow, idFactory: idFactory('instruction-current') }));
  instructionIncoming = addRecord(instructionIncoming, 'instructionVersions', createPlanningRecord('instructionVersions', {
    documentId: 'document-shared',
    versionNumber: 1,
    name: '別IDのv1',
  }, { now: fixedNow, idFactory: idFactory('instruction-incoming') }));
  assert.throws(
    () => mergePlanningNotesValues(
      serializePlanningNotes(instructionCurrent),
      serializePlanningNotes(instructionIncoming),
    ),
    PlanningNotesMergeConflictError,
  );
});

test('共有用書き出しは非公開取材と外部ファイル所在を除外する', () => {
  let data = createEmptyPlanningNotes();
  const privateInterview = createPlanningRecord('interviews', {
    question: '非公開質問',
    rawAnswer: '秘密の回答',
    visibility: 'private',
    status: 'approved',
  }, { now: fixedNow, idFactory: idFactory('interview-private') });
  data = addRecord(data, 'interviews', privateInterview);
  const publicInterview = createPlanningRecord('interviews', {
    question: '公開質問',
    rawAnswer: '山田さんと秘密の場所で話した生回答',
    publicAnswer: '知人と話した匿名化済みの回答',
    anonymizationNotes: '山田さんと場所は伏せる',
    visibility: 'share_candidate',
    status: 'approved',
  }, { now: fixedNow, idFactory: idFactory('interview-public') });
  data = addRecord(data, 'interviews', publicInterview);
  const instruction = createPlanningRecord('instructionVersions', {
    name: '指示書',
    markdown: '本文 ``` コード例',
    externalFileLocation: 'C:/private/instruction.md',
  }, {
    now: fixedNow,
    idFactory: idFactory('instruction-1', 'document-1'),
  });
  data = addRecord(data, 'instructionVersions', instruction);

  const shared = buildPlanningNotesSharePackage(data, { now: fixedNow });
  const json = JSON.stringify(shared);
  assert.doesNotMatch(json, /秘密の回答|山田さん|秘密の場所|場所は伏せる|C:\/private/);
  assert.match(json, /匿名化済みの回答/);
  assert.match(planningNotesShareToMarkdown(shared), /````json[\s\S]*本文 ``` コード例[\s\S]*````/);
});

test('共有用データにAPIキーや非公開会話URLがあれば書き出しを停止する', () => {
  let data = createEmptyPlanningNotes();
  const record = createPlanningRecord('decisions', {
    decision: '確認用',
    reason: 'api_key=sk-abcdefghijklmnopqrstuvwxyz123456',
  }, { now: fixedNow, idFactory: idFactory('decision-1') });
  data = addRecord(data, 'decisions', record);
  assert.throws(() => buildPlanningNotesSharePackage(data, { now: fixedNow }), /APIキー/);
  assert.throws(
    () => buildPlanningNotesSharePackage(createEmptyPlanningNotes(), {
      now: fixedNow,
      projectName: 'APIキー：AIzaSyabcdefghijklmnopqrstuvwxyz1234567890',
    }),
    /APIキー/,
  );
  assert.throws(
    () => buildPlanningNotesSharePackage(createEmptyPlanningNotes(), {
      now: fixedNow,
      bookTitle: 'https://chatgpt.com/c/private-conversation',
    }),
    /非公開会話URL/,
  );
  const sessionRecord = createPlanningRecord('decisions', {
    decision: '取材メモ',
    reason: 'セッションID abc123-not-for-sharing',
  }, { now: fixedNow, idFactory: idFactory('decision-session') });
  assert.throws(
    () => buildPlanningNotesSharePackage(
      addRecord(createEmptyPlanningNotes(), 'decisions', sessionRecord),
      { now: fixedNow },
    ),
    /認証情報/,
  );
  assert.match(
    findPlanningNotesSensitiveData('セッションID abc123-not-for-sharing')[0].label,
    /セッションID/,
  );
});

test('長文容量を計測し、保存用上限を超えた場合は明示して停止する', () => {
  const empty = createEmptyPlanningNotes();
  assert.ok(estimatePlanningNotesBytes(empty) > 0);
  const oversized = {
    ...empty,
    concept: {
      ...empty.concept,
      targetReader: 'a'.repeat(450_000),
      readerProblems: 'b'.repeat(450_000),
      bookPromise: 'c'.repeat(450_000),
      theme: 'd'.repeat(450_000),
      uniqueness: 'e'.repeat(450_000),
    },
  };
  assert.throws(
    () => serializePlanningNotes(oversized, { enforceStorageBudget: true }),
    /約2MB/,
  );
});

function marketResearchMarkdown() {
  const competitors = Array.from({ length: 5 }, (_, index) => (
    `|著者${index + 1}『競合${index + 1}』|読者${index + 1}|約束${index + 1}|同じにしない${index + 1}|差別化${index + 1}|書籍内容は出版社で確認済み。差は編集判断|`
  )).join('\n');
  const sources = Array.from({ length: 6 }, (_, index) => {
    const number = String(index + 1).padStart(3, '0');
    return `|MKT-${number}|公開資料${index + 1}|https://example.com/source-${index + 1}|2026-08-14|用途${index + 1}|`;
  }).join('\n');
  const unresearched = Array.from({ length: 6 }, (_, index) => (
    `|未調査${index + 1}|未調査|再確認${index + 1}|`
  )).join('\n');
  return `# 市場調査サマリー

> 版ID: MARKET-001
> 調査基準日: 2026-08-14
> 状態: 第一次調査

## 30秒で分かる結論

|項目|現在の判断|
|---|---|
|主読者|迷っている読者|
|読者が抱える痛み|夢を諦めきれない|
|競合に多い答え|専門家が答えを示す|
|市場の空白（編集仮説）|成功前の本人が一緒に考える|
|主USP|現在進行形の人生問答|
|読後地点|もう一度望んでもよい|
|避ける結論|成功を保証しない|

## 読者が求めていること

- 迷いを一緒に考えること。

## 競合比較

|競合|主な読者・問題|中心の約束・強み|本書が同じにしない点|本書との差別化|根拠状態|
|---|---|---|---|---|---|
${competitors}

## 読者の反応から見えた空白

|観察|企画への示唆|状態|
|---|---|---|
|観察1|示唆1|仮説・URL再確認待ち|
|観察2|示唆2|仮説・URL再確認待ち|
|観察3|示唆3|仮説・URL再確認待ち|
|観察4|示唆4|形式の参考・レビュー再確認待ち|

## この本が取る立ち位置

### 主USP

**現在進行形の人生問答。**

### 一文の市場ポジション

> 夢が叶う保証はなくても、迷いを一緒に考える本。

### 編集時に守ること

- 成功者として描かない。

## 未調査・次回確認すること

|項目|現在地|使う前の条件|
|---|---|---|
${unresearched}

## 公開出典

|ID|資料|URL|確認日|用途|
|---|---|---|---|---|
${sources}

## この資料の使い方

- まず市場ポジションを見る。
`;
}

test('v1企画ノートを新フィールド未設定のv2へ安全に移行する', () => {
  const legacy = createEmptyPlanningNotes();
  legacy.version = 1;
  delete legacy.marketSummary;
  legacy.instructionVersions = [{
    ...createPlanningRecord('instructionVersions', { name: '旧指示書' }, {
      now: fixedNow,
      idFactory: idFactory('instruction-v1', 'document-1'),
    }),
  }];
  for (const field of ['audience', 'canonicalFor', 'firstReadFor', 'referenceStatus']) {
    delete legacy.instructionVersions[0][field];
  }
  legacy.decisions = [{
    ...createPlanningRecord('decisions', { decision: '旧判断' }, {
      now: fixedNow,
      idFactory: idFactory('decision-v1'),
    }),
  }];
  for (const field of ['isCanonical', 'isFirstRead', 'decisionState', 'supersedesId', 'supersededById']) {
    delete legacy.decisions[0][field];
  }

  const migrated = normalizePlanningNotes(legacy);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.marketSummary.versionId, '');
  assert.equal(migrated.instructionVersions[0].audience, 'unset');
  assert.deepEqual(migrated.instructionVersions[0].canonicalFor, []);
  assert.equal(migrated.decisions[0].decisionState, 'unset');
  assert.equal(migrated.decisions[0].isCanonical, false);
});

test('市場調査サマリーは根拠IDを検証し、確認済み公開URLを重複なく数える', () => {
  let data = createEmptyPlanningNotes();
  const competitor = createPlanningRecord('competitors', {
    bookTitle: '確認済み競合',
    url: 'https://example.com/book',
    checkedOn: '2026-08-13',
    assessmentStatus: 'verified',
    recheckStatus: 'checked',
  }, { now: fixedNow, idFactory: idFactory('competitor-1') });
  data = addRecord(data, 'competitors', competitor);
  data = savePlanningMarketSummary(data, {
    versionId: 'MARKET-TEST',
    reviewedOn: '2026-08-14',
    status: 'needs_confirmation',
    readerNeeds: '迷いを一緒に考えたい',
    readerNeedsEvidenceIds: ['MKT-001', 'competitor-1'],
    publicSources: [{
      id: 'MKT-001',
      label: '公開資料',
      url: 'https://example.com/book',
      checkedOn: '2026-08-14',
      purpose: '需要確認',
      verificationStatus: 'verified',
    }],
  }, { expectedUpdatedAt: '', now: fixedNow });
  assert.deepEqual(getPlanningMarketMetrics(data), {
    reviewedOn: '2026-08-14',
    competitorCount: 1,
    verifiedSourceCount: 1,
  });
  assert.throws(
    () => savePlanningMarketSummary(data, {
      ...data.marketSummary,
      readerNeedsEvidenceIds: ['missing'],
    }, { expectedUpdatedAt: data.marketSummary.updatedAt, now: fixedNow }),
    /存在しない根拠ID/,
  );
  assert.throws(
    () => deletePlanningRecord(data, 'competitors', competitor.id, {
      expectedUpdatedAt: competitor.updatedAt,
    }),
    /市場調査サマリーの根拠/,
  );
});

test('指示書の正本と最初に見る対象を一意にし、新しい版へ指定を複製しない', () => {
  let data = createEmptyPlanningNotes();
  const first = createPlanningRecord('instructionVersions', {
    name: '執筆指示書A', audience: 'codex', role: 'writing',
  }, { now: fixedNow, idFactory: idFactory('instruction-a', 'document-a') });
  const second = createPlanningRecord('instructionVersions', {
    name: '執筆指示書B', audience: 'codex', role: 'writing',
  }, { now: fixedNow, idFactory: idFactory('instruction-b', 'document-b') });
  data = addRecord(data, 'instructionVersions', first);
  data = addRecord(data, 'instructionVersions', second);
  data = assignInstructionCanonical(data, first.id, 'codex', { now: fixedNow });
  data = assignInstructionCanonical(data, second.id, 'codex', {
    now: () => new Date('2026-08-15T00:00:00.000Z'),
  });
  assert.deepEqual(data.instructionVersions.find(record => record.id === first.id).canonicalFor, []);
  assert.equal(data.instructionVersions.find(record => record.id === first.id).referenceStatus, 'old');
  assert.deepEqual(data.instructionVersions.find(record => record.id === second.id).firstReadFor, ['codex']);

  const duplicate = duplicatePlanningRecord(data, 'instructionVersions', second.id, {
    now: fixedNow,
    idFactory: idFactory('instruction-b-v2'),
  });
  assert.deepEqual(duplicate.canonicalFor, []);
  assert.deepEqual(duplicate.firstReadFor, []);
  assert.equal(duplicate.referenceStatus, 'active');
  data = clearInstructionCanonical(data, second.id, 'codex', { now: fixedNow });
  assert.deepEqual(data.instructionVersions.find(record => record.id === second.id).canonicalFor, []);
});

test('意思決定の正本差替えを相互参照し、撤回しても履歴を残す', () => {
  let data = createEmptyPlanningNotes();
  const first = createPlanningRecord('decisions', { decision: '最初の判断' }, {
    now: fixedNow,
    idFactory: idFactory('decision-a'),
  });
  const second = createPlanningRecord('decisions', { decision: '変更後の判断' }, {
    now: () => new Date('2026-08-15T00:00:00.000Z'),
    idFactory: idFactory('decision-b'),
  });
  assert.equal(first.decisionState, 'unset');
  assert.equal(second.decisionState, 'unset');
  data = addRecord(data, 'decisions', first);
  data = addRecord(data, 'decisions', second);
  data = assignDecisionCanonical(data, first.id, { now: fixedNow });
  data = assignDecisionCanonical(data, second.id, {
    now: () => new Date('2026-08-16T00:00:00.000Z'),
  });
  const oldDecision = data.decisions.find(record => record.id === first.id);
  const currentDecision = data.decisions.find(record => record.id === second.id);
  assert.equal(oldDecision.decisionState, 'changed');
  assert.equal(oldDecision.supersededById, second.id);
  assert.equal(currentDecision.supersedesId, first.id);
  assert.equal(currentDecision.isCanonical, true);

  data = withdrawPlanningDecision(data, second.id, {
    now: () => new Date('2026-08-17T00:00:00.000Z'),
  });
  assert.equal(data.decisions.find(record => record.id === second.id).decisionState, 'withdrawn');
  assert.equal(data.decisions.some(record => record.isCanonical), false);
  assert.equal(data.decisions.length, 2);
});

test('履歴は更新日時・作成日時・IDで安定して並び、日本時間で表示する', () => {
  const sorted = sortPlanningRecordsNewest([
    { id: 'b', updatedAt: '2026-08-14T00:00:00.000Z', createdAt: '2026-08-13T00:00:00.000Z' },
    { id: 'a', updatedAt: '2026-08-14T00:00:00.000Z', createdAt: '2026-08-13T00:00:00.000Z' },
    { id: 'c', updatedAt: '2026-08-13T00:00:00.000Z', createdAt: '2026-08-14T00:00:00.000Z' },
  ]);
  assert.deepEqual(sorted.map(record => record.id), ['a', 'b', 'c']);
  assert.match(formatPlanningDateTimeJst('2026-08-14T00:00:00.000Z'), /2026\/08\/14.*09:00/);
  assert.equal(formatPlanningDateTimeJst(''), '—');
});

test('結合前に別IDの同一正本scopeと別の意思決定正本を検出する', () => {
  let current = createEmptyPlanningNotes();
  let incoming = createEmptyPlanningNotes();
  const createInstruction = id => createPlanningRecord('instructionVersions', {
    name: id, audience: 'codex', role: 'writing',
  }, { now: fixedNow, idFactory: idFactory(id, `document-${id}`) });
  current = addRecord(current, 'instructionVersions', createInstruction('instruction-current'));
  incoming = addRecord(incoming, 'instructionVersions', createInstruction('instruction-incoming'));
  current = assignInstructionCanonical(current, 'instruction-current', 'codex', { now: fixedNow });
  incoming = assignInstructionCanonical(incoming, 'instruction-incoming', 'codex', { now: fixedNow });

  assert.throws(
    () => mergePlanningNotesValues(serializePlanningNotes(current), serializePlanningNotes(incoming)),
    error => error instanceof PlanningNotesMergeConflictError
      && error.conflicts.some(conflict => conflict.reason === 'instruction_canonical_scope_conflict'),
  );
});

test('限定URLと市場調査欄の内部指示を保存前に検出する', () => {
  assert.match(
    findMarketResearchRestrictedData('https://example.com/file?X-Amz-Signature=secret')[0].label,
    /期限付き・限定URL/,
  );
  assert.match(
    findMarketResearchRestrictedData('システムプロンプト: 非公開の指示')[0].label,
    /GPTs内部指示/,
  );
  assert.throws(
    () => createPlanningRecord('competitors', {
      bookTitle: '限定資料',
      url: 'https://example.com/file?token=secret',
    }, { now: fixedNow, idFactory: idFactory('competitor-secret') }),
    /期限付き・限定URL/,
  );
});

test('MARKET-001 Markdownを5競合・6公開出典へ厳格preview/applyし、同版再取込は冪等', () => {
  const parsed = parseMarketResearchSummaryMarkdown(marketResearchMarkdown(), {
    sourceName: 'market-research-summary.md',
    now: fixedNow,
  });
  assert.equal(parsed.marketSummary.versionId, 'MARKET-001');
  assert.equal(parsed.marketSummary.sourceName, 'market-research-summary.md');
  assert.equal(parsed.marketSummary.status, 'needs_confirmation');
  assert.equal(parsed.marketSummary.mainUsp, '現在進行形の人生問答。');
  assert.equal(
    parsed.marketSummary.bookPosition,
    '夢が叶う保証はなくても、迷いを一緒に考える本。\n\n読後地点：もう一度望んでもよい',
  );
  assert.match(parsed.marketSummary.avoidDirections, /編集時に守ること：\n成功者として描かない。/);
  assert.doesNotMatch(parsed.marketSummary.bookPosition, /###|\*\*|^>/m);
  assert.equal(parsed.marketSummary.publicSources.length, 6);
  assert.equal(parsed.unresearchedCount, 6);
  assert.ok(parsed.marketSummary.publicSources.every(source => source.verificationStatus === 'verified'));
  assert.equal(parsed.competitors.length, 5);
  assert.ok(parsed.competitors.every(record => record.assessmentStatus === 'verified'));
  assert.ok(parsed.competitors.every(record => record.claimKind === 'hypothesis'));
  assert.equal(parsed.competitors.filter(record => record.recheckStatus === 'needs_recheck').length, 4);
  assert.ok(parsed.competitors.every(record => !record.readerReactionGap.includes('review_recheck_pending')));
  assert.doesNotMatch(parsed.marketSummary.reviewObservations, /review_recheck_pending/);
  assert.match(parsed.marketSummary.reviewObservations, /再確認待ち/);
  assert.equal(new Set([
    ...parsed.competitors.map(record => record.id),
    ...parsed.marketSummary.publicSources.map(source => source.id),
  ]).size, 11);

  const preview = previewMarketResearchImport(createEmptyPlanningNotes(), parsed);
  assert.equal(preview.canApply, true);
  assert.deepEqual(preview.summary, {
    sourceName: 'market-research-summary.md',
    versionId: 'MARKET-001',
    reviewedOn: '2026-08-14',
    status: 'needs_confirmation',
    competitorCount: 5,
    publicSourceCount: 6,
    reviewRecheckCount: 4,
    unresearchedCount: 6,
  });
  assert.deepEqual(preview.diff, { additions: 6, unchanged: 0, changes: 0, deletions: 0 });
  const applied = applyMarketResearchImport(createEmptyPlanningNotes(), parsed, { now: fixedNow });
  const repeatedPreview = previewMarketResearchImport(applied, parsed);
  assert.equal(repeatedPreview.canApply, true);
  assert.equal(repeatedPreview.summarySkipped, true);
  assert.equal(repeatedPreview.skippedCompetitorIds.length, 5);
  assert.deepEqual(repeatedPreview.diff, { additions: 0, unchanged: 6, changes: 0, deletions: 0 });
  assert.deepEqual(
    applyMarketResearchImport(applied, parsed, {
      now: () => new Date('2026-08-20T00:00:00.000Z'),
    }),
    applied,
  );
  const share = buildPlanningNotesSharePackage(applied, { now: fixedNow });
  assert.equal(share.schemaVersion, 1);
  assert.equal(share.data.version, 2);
  assert.match(planningNotesShareToMarkdown(share), /MARKET-001|市場調査サマリー/);
});

test('市場調査Markdownの絶対パス・限定URL・同版異内容・同ID異内容を競合停止する', () => {
  assert.throws(
    () => parseMarketResearchSummaryMarkdown(marketResearchMarkdown(), {
      sourceName: 'C:\\private\\market-research-summary.md',
      now: fixedNow,
    }),
    /ファイル名だけ/,
  );
  assert.throws(
    () => parseMarketResearchSummaryMarkdown(
      marketResearchMarkdown().replace(
        'https://example.com/source-1',
        'https://example.com/source-1?token=private',
      ),
      { now: fixedNow },
    ),
    /期限付き・限定URL/,
  );
  const parsed = parseMarketResearchSummaryMarkdown(marketResearchMarkdown(), { now: fixedNow });
  const applied = applyMarketResearchImport(createEmptyPlanningNotes(), parsed, { now: fixedNow });
  const changedSummary = {
    ...parsed,
    marketSummary: { ...parsed.marketSummary, mainUsp: '別のUSP' },
  };
  const summaryConflict = previewMarketResearchImport(applied, changedSummary);
  assert.equal(summaryConflict.canApply, false);
  assert.equal(summaryConflict.conflicts[0].type, 'same_version_different_content');
  assert.throws(
    () => applyMarketResearchImport(applied, changedSummary, { now: fixedNow }),
    PlanningNotesImportConflictError,
  );

  const changedRecord = {
    ...parsed,
    marketSummary: createEmptyPlanningNotes().marketSummary,
    competitors: parsed.competitors.map((record, index) => index === 0
      ? { ...record, bookTitle: '同じIDの別書名' }
      : record),
  };
  const currentWithoutSummary = { ...applied, marketSummary: createEmptyPlanningNotes().marketSummary };
  const recordConflict = previewMarketResearchImport(currentWithoutSummary, changedRecord);
  assert.ok(recordConflict.conflicts.some(conflict => conflict.type === 'same_id_different_content'));
});
