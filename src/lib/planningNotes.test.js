import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PlanningNotesMergeConflictError,
  buildPlanningNotesSharePackage,
  createEmptyPlanningNotes,
  createPlanningRecord,
  deletePlanningRecord,
  duplicatePlanningRecord,
  estimatePlanningNotesBytes,
  filterPlanningNotes,
  mergePlanningNotesValues,
  movePlanningChapter,
  normalizePlanningNotes,
  planningNotesShareToMarkdown,
  readPlanningNotes,
  savePlanningConcept,
  serializePlanningNotes,
  upsertPlanningRecord,
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
