import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PlanningNotesMergeConflictError,
  PlanningNotesImportConflictError,
  PLANNING_NOTES_SAVE_LIMIT_BYTES,
  applyPlanningChapterNodeTypeBulkChange,
  applyMarketResearchImport,
  assignDecisionCanonical,
  assignInstructionCanonical,
  buildPlanningNotesSharePackage,
  buildPlanningChapterOrdinalLabels,
  clearInstructionCanonical,
  activatePlanningCritiqueGptSession,
  activatePlanningGptSession,
  createDefaultPlanningGptHandoffTemplates,
  createEmptyPlanningNotes,
  createPlanningCritiqueGptHandoffTarget,
  createPlanningCritiqueGptSessionRecord,
  createPlanningGptHandoffTarget,
  createPlanningGptSessionRecord,
  createPlanningChapterRecord,
  createPlanningOutlineSnapshot,
  createPlanningRecord,
  deletePlanningRecord,
  deletePlanningCritiqueGptSession,
  deletePlanningGptSession,
  duplicatePlanningRecord,
  estimatePlanningNotesBytes,
  filterPlanningNotes,
  flattenPlanningChapterTree,
  flattenPlanningOutlineSnapshot,
  findMarketResearchRestrictedData,
  findPlanningNotesSensitiveData,
  formatPlanningDateTimeJst,
  getPlanningMarketMetrics,
  getPlanningChapterDisplayTitle,
  getPlanningChapterOrdinalLabel,
  getPlanningChapterPresentation,
  getNextPlanningChapterOrder,
  getDefaultPlanningGptHandoffTemplate,
  getNextPlanningCritiqueGptManagementId,
  getNextPlanningGptManagementId,
  getPlanningChapterParentOptions,
  getConfirmedPlanningOutline,
  getPlanningChapterManuscript,
  getPlanningDraftOutlineChapters,
  isPlanningDraftChapter,
  mergePlanningNotesValues,
  movePlanningChapter,
  movePlanningChapterToParent,
  normalizePlanningNotes,
  planningNotesShareToMarkdown,
  parseMarketResearchSummaryMarkdown,
  parsePlanningOutlineMarkdown,
  planningOutlineMatchesSnapshot,
  previewMarketResearchImport,
  previewPlanningChapterNodeTypeBulkChange,
  previewPlanningNotesMerge,
  readPlanningNotes,
  replacePlanningOutlineDraft,
  resolvePlanningGptHandoffTemplates,
  savePlanningMarketSummary,
  savePlanningConcept,
  renderPlanningGptHandoffTemplate,
  serializePlanningNotes,
  sortPlanningRecordsNewest,
  sortPlanningCritiqueGptSessions,
  sortPlanningGptSessions,
  sortPlanningOutlineSnapshotsNewest,
  upsertPlanningRecord,
  upsertPlanningCritiqueGptSession,
  upsertPlanningGptSession,
  updatePlanningRecordChapterLinks,
  updatePlanningGptHandoffTemplates,
  updatePlanningChapterManuscript,
  validatePlanningGoogleDocumentUrl,
  validatePlanningManuscriptUrl,
  validatePlanningGptSessionUrl,
  validatePlanningCritiqueGptSessionUrl,
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

test('部の中へ話と節を作り、親子順で安定して平坦化する', () => {
  let data = createEmptyPlanningNotes();
  const part = createPlanningChapterRecord(data, {
    nodeType: 'part',
    title: '第一部',
  }, { now: fixedNow, idFactory: idFactory('part-1') });
  data = addRecord(data, 'chapters', part);
  const episode2 = createPlanningChapterRecord(data, {
    nodeType: 'episode',
    parentId: part.id,
    title: '第二話',
    order: 1,
  }, { now: fixedNow, idFactory: idFactory('episode-2') });
  data = addRecord(data, 'chapters', episode2);
  const episode1 = createPlanningChapterRecord(data, {
    nodeType: 'episode',
    parentId: part.id,
    title: '第一話',
    order: 0,
  }, { now: fixedNow, idFactory: idFactory('episode-1') });
  data = addRecord(data, 'chapters', episode1);
  const section = createPlanningChapterRecord(data, {
    nodeType: 'section',
    parentId: episode1.id,
    title: '最初の場面',
  }, { now: fixedNow, idFactory: idFactory('section-1') });
  data = addRecord(data, 'chapters', section);

  assert.equal(getNextPlanningChapterOrder(data, part.id), 2);
  assert.deepEqual(
    flattenPlanningChapterTree(data).map(({ record, depth }) => [record.id, depth]),
    [['part-1', 0], ['episode-1', 1], ['section-1', 2], ['episode-2', 1]],
  );
  assert.deepEqual(
    getPlanningChapterParentOptions(data, 'episode-1', 'episode').map(({ record }) => record.id),
    ['part-1'],
  );
  const duplicate = duplicatePlanningRecord(data, 'chapters', 'episode-1', {
    now: fixedNow,
    idFactory: idFactory('episode-copy'),
  });
  assert.equal(duplicate.parentId, 'part-1');
  assert.equal(duplicate.nodeType, 'episode');
  assert.equal(duplicate.order, 2);
  const markdown = planningNotesShareToMarkdown(buildPlanningNotesSharePackage(data, { now: fixedNow }));
  assert.match(markdown, /- 第1部：第一部（原稿：未完了）\n  - 第1話：第一話（原稿：未完了）\n    - 第1節：最初の場面（原稿：未完了）/);
});

test('現在の仮目次にある章だけを話へ一括変更し、ID・本文・階層・状態・リンク・保存版を維持する', () => {
  let data = createEmptyPlanningNotes();
  const addChapter = values => {
    const record = createPlanningChapterRecord(data, values, {
      now: fixedNow,
      idFactory: idFactory(values.id),
    });
    data = addRecord(data, 'chapters', record);
    return record;
  };
  const part = addChapter({ id: 'bulk-part', nodeType: 'part', title: '第一部' });
  const chapter1 = addChapter({
    id: 'bulk-chapter-1',
    nodeType: 'chapter',
    parentId: part.id,
    order: 0,
    title: '第1章 はじまり',
    status: 'needs_confirmation',
  });
  const section = addChapter({
    id: 'bulk-section',
    nodeType: 'section',
    parentId: chapter1.id,
    order: 0,
    title: '場面の整理',
  });
  const chapter2 = addChapter({
    id: 'bulk-chapter-2',
    nodeType: 'chapter',
    parentId: part.id,
    order: 1,
    title: '第2章 次の一歩',
  });
  const rejected = addChapter({
    id: 'bulk-rejected',
    nodeType: 'chapter',
    parentId: part.id,
    order: 2,
    title: '採用しない章',
    status: 'rejected',
  });
  const archived = addChapter({
    id: 'bulk-archived',
    nodeType: 'chapter',
    order: 1,
    title: '退避済みの旧章',
  });
  data = normalizePlanningNotes({
    ...data,
    draftOutlineChapterIds: data.draftOutlineChapterIds.filter(id => id !== archived.id),
  });
  data = addRecord(data, 'interviews', createPlanningRecord('interviews', {
    id: 'bulk-interview',
    question: 'この出来事を教えてください',
    chapterIds: [chapter1.id, archived.id],
  }, { now: fixedNow, idFactory: idFactory('bulk-interview') }));
  data = createPlanningOutlineSnapshot(data, {
    kind: 'confirmed',
    label: '一括変更前の確定目次',
  }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('bulk-confirmed'),
  });
  data = createPlanningOutlineSnapshot(data, {
    kind: 'draft',
    label: '一括変更前の仮目次メモ',
  }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('bulk-draft-snapshot'),
  });
  data = updatePlanningChapterManuscript(data, chapter1.id, {
    completed: true,
    documentUrl: 'https://docs.google.com/document/d/bulk-chapter-1/edit',
  }, { expectedRevision: 0, now: fixedNow });

  const beforeSnapshots = structuredClone(data.outlineSnapshots);
  const beforeLinks = structuredClone(data.interviews[0].chapterIds);
  const beforeWritingStates = structuredClone(data.chapterWritingStates);
  const beforeChapterInvariants = new Map(data.chapters.map(chapter => [chapter.id, {
    id: chapter.id,
    title: chapter.title,
    order: chapter.order,
    parentId: chapter.parentId,
    status: chapter.status,
    chapterIds: chapter.chapterIds,
  }]));
  const beforeOutlineRevision = data.outlineRevision;
  const beforeOrderRevision = data.chapterOrderRevision;
  const sameTypePreview = previewPlanningChapterNodeTypeBulkChange(data, {
    fromNodeType: 'chapter',
    toNodeType: 'chapter',
  });
  assert.equal(sameTypePreview.canApply, false);
  assert.equal(sameTypePreview.blockedCount, 2);
  assert.equal(sameTypePreview.historySkippedCount, 1);
  assert.equal(sameTypePreview.skippedCount, 3);
  const preview = previewPlanningChapterNodeTypeBulkChange(data, {
    fromNodeType: 'chapter',
    toNodeType: 'episode',
  });

  assert.equal(preview.canApply, true);
  assert.deepEqual(preview.targetChapterIds, [chapter1.id, chapter2.id]);
  assert.equal(preview.targetCount, 2);
  assert.equal(preview.changeableCount, 2);
  assert.equal(preview.blockedCount, 0);
  assert.equal(preview.historySkippedCount, 1);
  assert.equal(preview.skippedCount, 1);
  assert.equal(preview.items.find(item => item.chapterId === rejected.id).result, 'skipped');
  assert.ok(preview.warnings.some(warning => (
    warning.code === 'children_preserved' && warning.chapterId === chapter1.id
  )));

  const result = applyPlanningChapterNodeTypeBulkChange(data, preview, {
    expectedOutlineRevision: preview.expectedOutlineRevision,
    expectedChapterOrderRevision: preview.expectedChapterOrderRevision,
    now: () => new Date('2026-08-14T01:00:00.000Z'),
  });
  const next = result.data;
  assert.equal(result.summary.changedChapterCount, 2);
  assert.deepEqual(result.summary.chapterIds, [chapter1.id, chapter2.id]);
  assert.equal(next.chapters.find(chapter => chapter.id === chapter1.id).nodeType, 'episode');
  assert.equal(next.chapters.find(chapter => chapter.id === chapter2.id).nodeType, 'episode');
  assert.equal(next.chapters.find(chapter => chapter.id === rejected.id).nodeType, 'chapter');
  assert.equal(next.chapters.find(chapter => chapter.id === archived.id).nodeType, 'chapter');
  assert.equal(next.chapters.find(chapter => chapter.id === part.id).nodeType, 'part');
  assert.equal(next.chapters.find(chapter => chapter.id === section.id).nodeType, 'section');
  for (const chapter of next.chapters) {
    assert.deepEqual({
      id: chapter.id,
      title: chapter.title,
      order: chapter.order,
      parentId: chapter.parentId,
      status: chapter.status,
      chapterIds: chapter.chapterIds,
    }, beforeChapterInvariants.get(chapter.id));
  }
  assert.deepEqual(next.interviews[0].chapterIds, beforeLinks);
  assert.deepEqual(next.chapterWritingStates, beforeWritingStates);
  assert.deepEqual(next.outlineSnapshots, beforeSnapshots);
  assert.equal(next.confirmedOutlineId, data.confirmedOutlineId);
  assert.equal(next.outlineRevision, beforeOutlineRevision + 1);
  assert.equal(next.chapterOrderRevision, beforeOrderRevision + 1);

  const restored = readPlanningNotes(serializePlanningNotes(next)).data;
  assert.deepEqual(restored, next);
  const share = buildPlanningNotesSharePackage(next, { now: fixedNow });
  assert.equal(share.data.chapters.find(chapter => chapter.id === chapter1.id).nodeType, 'episode');
  assert.equal(
    share.data.outlineSnapshots
      .find(snapshot => snapshot.id === data.confirmedOutlineId)
      .chapters.find(chapter => chapter.id === chapter1.id).nodeType,
    'chapter',
  );
  const shareMarkdown = planningNotesShareToMarkdown(share);
  assert.match(shareMarkdown, /第1話：はじまり/);
  assert.match(shareMarkdown, /第1章：はじまり/);
});

test('章から話への一括変更は本人承認済みをsilent skipせず全件を原子的に停止する', () => {
  let data = createEmptyPlanningNotes();
  const part = createPlanningChapterRecord(data, {
    id: 'bulk-approved-part', nodeType: 'part', title: '第一部',
  }, { now: fixedNow, idFactory: idFactory('bulk-approved-part') });
  data = addRecord(data, 'chapters', part);
  const draftChapter = createPlanningChapterRecord(data, {
    id: 'bulk-draft-chapter', nodeType: 'chapter', parentId: part.id, order: 0, title: '変更できる章',
  }, { now: fixedNow, idFactory: idFactory('bulk-draft-chapter') });
  data = addRecord(data, 'chapters', draftChapter);
  const approvedChapter = createPlanningChapterRecord(data, {
    id: 'bulk-approved-chapter', nodeType: 'chapter', parentId: part.id, order: 1,
    title: '承認済みの章', status: 'approved', approvedBy: '著者本人',
  }, { now: fixedNow, idFactory: idFactory('bulk-approved-chapter') });
  data = addRecord(data, 'chapters', approvedChapter);
  const before = serializePlanningNotes(data);
  const preview = previewPlanningChapterNodeTypeBulkChange(data, {
    fromNodeType: 'chapter',
    toNodeType: 'episode',
  });

  assert.equal(preview.canApply, false);
  assert.equal(preview.targetCount, 2);
  assert.equal(preview.changeableCount, 1);
  assert.equal(preview.blockedCount, 1);
  assert.equal(preview.skippedCount, 1);
  assert.equal(preview.items.find(item => item.chapterId === approvedChapter.id).result, 'blocked');
  assert.ok(preview.blockers.some(blocker => (
    blocker.code === 'approved_chapter' && blocker.chapterId === approvedChapter.id
  )));
  assert.throws(
    () => applyPlanningChapterNodeTypeBulkChange(data, preview, {
      expectedOutlineRevision: preview.expectedOutlineRevision,
      expectedChapterOrderRevision: preview.expectedChapterOrderRevision,
      now: fixedNow,
    }),
    /本人承認済み/,
  );
  assert.equal(serializePlanningNotes(data), before);
  assert.equal(data.chapters.find(chapter => chapter.id === draftChapter.id).nodeType, 'chapter');
});

test('子の型が不正になる一括変更をプレビューで示し、親子構造を変更せず停止する', () => {
  let data = createEmptyPlanningNotes();
  const part = createPlanningChapterRecord(data, {
    id: 'bulk-tree-part', nodeType: 'part', title: '第一部',
  }, { now: fixedNow, idFactory: idFactory('bulk-tree-part') });
  data = addRecord(data, 'chapters', part);
  const chapter = createPlanningChapterRecord(data, {
    id: 'bulk-tree-chapter', nodeType: 'chapter', parentId: part.id, title: '親になる章',
  }, { now: fixedNow, idFactory: idFactory('bulk-tree-chapter') });
  data = addRecord(data, 'chapters', chapter);
  const episode = createPlanningChapterRecord(data, {
    id: 'bulk-tree-episode', nodeType: 'episode', parentId: chapter.id, title: '子の話',
  }, { now: fixedNow, idFactory: idFactory('bulk-tree-episode') });
  data = addRecord(data, 'chapters', episode);
  const before = serializePlanningNotes(data);
  const preview = previewPlanningChapterNodeTypeBulkChange(data, {
    fromNodeType: 'chapter',
    toNodeType: 'episode',
  });

  assert.equal(preview.canApply, false);
  assert.equal(preview.blockedCount, 1);
  assert.equal(preview.skippedCount, 1);
  assert.ok(preview.blockers.some(blocker => (
    blocker.code === 'incompatible_child_type'
      && blocker.chapterId === chapter.id
      && blocker.relatedChapterId === episode.id
  )));
  assert.match(preview.items[0].reason, /中には置けません/);
  assert.throws(
    () => applyPlanningChapterNodeTypeBulkChange(data, preview, {
      expectedOutlineRevision: preview.expectedOutlineRevision,
      expectedChapterOrderRevision: preview.expectedChapterOrderRevision,
      now: fixedNow,
    }),
    /中には置けません/,
  );
  assert.equal(serializePlanningNotes(data), before);
});

test('一括変更プレビュー後に仮目次が更新された場合は古いプレビューを適用しない', () => {
  let data = createEmptyPlanningNotes();
  const chapter = createPlanningChapterRecord(data, {
    id: 'bulk-stale-chapter', nodeType: 'chapter', title: '更新前の章',
  }, { now: fixedNow, idFactory: idFactory('bulk-stale-chapter') });
  data = addRecord(data, 'chapters', chapter);
  const preview = previewPlanningChapterNodeTypeBulkChange(data, {
    fromNodeType: 'chapter',
    toNodeType: 'episode',
  });
  const updated = upsertPlanningRecord(data, 'chapters', {
    ...data.chapters[0],
    title: '別画面で更新された章',
  }, {
    expectedUpdatedAt: data.chapters[0].updatedAt,
    now: () => new Date('2026-08-14T01:00:00.000Z'),
  });
  const beforeApply = serializePlanningNotes(updated);

  assert.throws(
    () => applyPlanningChapterNodeTypeBulkChange(updated, preview, {
      expectedOutlineRevision: preview.expectedOutlineRevision,
      expectedChapterOrderRevision: preview.expectedChapterOrderRevision,
      now: fixedNow,
    }),
    /目次が別の画面で更新/,
  );
  assert.equal(serializePlanningNotes(updated), beforeApply);
  assert.equal(updated.chapters[0].nodeType, 'chapter');
});

test('目次階層は存在しない親・循環・親子型違反・同じ親内の順序重複を拒否する', () => {
  let data = createEmptyPlanningNotes();
  data = addRecord(data, 'chapters', createPlanningRecord('chapters', {
    id: 'part-1', nodeType: 'part', title: '第一部', order: 0,
  }, { now: fixedNow, idFactory: idFactory('part-1') }));
  const episode = createPlanningRecord('chapters', {
    id: 'episode-1', nodeType: 'episode', parentId: 'part-1', title: '第一話', order: 0,
  }, { now: fixedNow, idFactory: idFactory('episode-1') });
  data = addRecord(data, 'chapters', episode);

  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      chapters: data.chapters.map(record => record.id === 'episode-1'
        ? { ...record, parentId: 'missing' }
        : record),
    }),
    /存在しない親/,
  );
  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      chapters: data.chapters.map(record => record.id === 'part-1'
        ? { ...record, parentId: 'episode-1' }
        : record),
    }),
    /循環/,
  );
  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      chapters: data.chapters.map(record => record.id === 'episode-1'
        ? { ...record, nodeType: 'part' }
        : record),
    }),
    /部は部の中には置けません/,
  );
  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      chapters: [...data.chapters, {
        ...episode,
        id: 'episode-duplicate-order',
      }],
      draftOutlineChapterIds: [...data.draftOutlineChapterIds, 'episode-duplicate-order'],
    }),
    /同じ親.*順序が重複/,
  );
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
    /存在しない構成項目ID/,
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

test('上下移動は同じ親の兄弟だけを入れ替え、別の部へは末尾追加できる', () => {
  let data = createEmptyPlanningNotes();
  for (const [id, title, order] of [
    ['part-1', '第一部', 0],
    ['part-2', '第二部', 1],
  ]) {
    data = addRecord(data, 'chapters', createPlanningRecord('chapters', {
      id, title, order, nodeType: 'part',
    }, { now: fixedNow, idFactory: idFactory(id) }));
  }
  for (const [id, parentId, order] of [
    ['episode-1', 'part-1', 0],
    ['episode-2', 'part-1', 1],
    ['episode-3', 'part-2', 0],
  ]) {
    data = addRecord(data, 'chapters', createPlanningRecord('chapters', {
      id, title: id, order, parentId, nodeType: 'episode',
    }, { now: fixedNow, idFactory: idFactory(id) }));
  }

  data = movePlanningChapter(data, 'episode-2', 'up', {
    expectedRevision: data.chapterOrderRevision,
  });
  assert.deepEqual(
    data.chapters
      .filter(record => record.parentId === 'part-1')
      .sort((a, b) => a.order - b.order)
      .map(record => record.id),
    ['episode-2', 'episode-1'],
  );
  assert.equal(data.chapters.find(record => record.id === 'episode-3').order, 0);

  data = movePlanningChapterToParent(data, 'episode-2', 'part-2', {
    expectedRevision: data.chapterOrderRevision,
    now: fixedNow,
  });
  const moved = data.chapters.find(record => record.id === 'episode-2');
  assert.equal(moved.parentId, 'part-2');
  assert.equal(moved.order, 1);
  assert.equal(data.chapters.find(record => record.id === 'episode-1').order, 1);
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
    /本人承認済みの構成順/,
  );
  assert.equal(data.chapters.find(chapter => chapter.id === 'chapter-approved').order, 0);
});

test('承認済みの親や子を含む階層は間接的にも順序・所属を変更しない', () => {
  let data = createEmptyPlanningNotes();
  const approvedPart = createPlanningRecord('chapters', {
    id: 'approved-part', nodeType: 'part', order: 0, title: '承認済みの部', status: 'approved',
  }, { now: fixedNow, idFactory: idFactory('approved-part') });
  data = addRecord(data, 'chapters', approvedPart);
  assert.throws(
    () => addRecord(data, 'chapters', createPlanningRecord('chapters', {
      id: 'new-child', nodeType: 'episode', parentId: approvedPart.id, order: 0, title: '追加案',
    }, { now: fixedNow, idFactory: idFactory('new-child') })),
    /承認済みの親項目へ子項目を追加/,
  );

  let draftTree = createEmptyPlanningNotes();
  const draftPart = createPlanningRecord('chapters', {
    id: 'draft-part', nodeType: 'part', order: 0, title: '未承認の部',
  }, { now: fixedNow, idFactory: idFactory('draft-part') });
  draftTree = addRecord(draftTree, 'chapters', draftPart);
  draftTree = addRecord(draftTree, 'chapters', createPlanningRecord('chapters', {
    id: 'approved-child', nodeType: 'episode', parentId: draftPart.id, order: 0,
    title: '承認済みの話', status: 'approved',
  }, { now: fixedNow, idFactory: idFactory('approved-child') }));
  draftTree = addRecord(draftTree, 'chapters', createPlanningRecord('chapters', {
    id: 'other-part', nodeType: 'part', order: 1, title: '別の部',
  }, { now: fixedNow, idFactory: idFactory('other-part') }));
  assert.throws(
    () => movePlanningChapter(draftTree, draftPart.id, 'down', {
      expectedRevision: draftTree.chapterOrderRevision,
    }),
    /本人承認済みの構成順/,
  );
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
    /紐づく記録が1件.*先に.*紐づく部・章・話・節.*外して/,
  );
});

test('子項目を持つ部は先に子を移動または削除するまで削除しない', () => {
  let data = createEmptyPlanningNotes();
  const part = createPlanningRecord('chapters', {
    nodeType: 'part', title: '第一部', order: 0,
  }, { now: fixedNow, idFactory: idFactory('part-with-child') });
  data = addRecord(data, 'chapters', part);
  data = addRecord(data, 'chapters', createPlanningRecord('chapters', {
    nodeType: 'episode', parentId: part.id, title: '第一話', order: 0,
  }, { now: fixedNow, idFactory: idFactory('episode-child') }));

  assert.throws(
    () => deletePlanningRecord(data, 'chapters', part.id, {
      expectedUpdatedAt: part.updatedAt,
    }),
    /1件の子項目.*移動または削除/,
  );
});

test('子項目を持つ部は採用しないへ変更して配下を画面から消さない', () => {
  let data = createEmptyPlanningNotes();
  const part = createPlanningRecord('chapters', {
    id: 'part-with-child', nodeType: 'part', order: 0, title: '第一部',
  }, { now: fixedNow, idFactory: idFactory('part-with-child') });
  data = addRecord(data, 'chapters', part);
  data = addRecord(data, 'chapters', createPlanningRecord('chapters', {
    id: 'episode-child', nodeType: 'episode', parentId: part.id, order: 0, title: '第一話',
  }, { now: fixedNow, idFactory: idFactory('episode-child') }));

  assert.throws(
    () => upsertPlanningRecord(data, 'chapters', { ...part, status: 'rejected' }, {
      expectedUpdatedAt: part.updatedAt,
      now: fixedNow,
    }),
    /子項目がある.*採用しない.*先に子項目を移動または削除/,
  );
});

test('採用しない親への子追加と承認済み親の子を採用しない変更を止める', () => {
  let rejectedTree = createEmptyPlanningNotes();
  const rejectedPart = createPlanningRecord('chapters', {
    id: 'rejected-part', nodeType: 'part', order: 0, title: '不採用の部', status: 'rejected',
  }, { now: fixedNow, idFactory: idFactory('rejected-part') });
  rejectedTree = addRecord(rejectedTree, 'chapters', rejectedPart);
  assert.equal(
    getPlanningChapterParentOptions(rejectedTree, '', 'episode').some(({ record }) => record.id === rejectedPart.id),
    false,
  );
  assert.throws(
    () => addRecord(rejectedTree, 'chapters', createPlanningRecord('chapters', {
      id: 'hidden-child', nodeType: 'episode', parentId: rejectedPart.id, order: 0, title: '見えない子',
    }, { now: fixedNow, idFactory: idFactory('hidden-child') })),
    /採用しない.*親項目へ子項目を追加・移動できません/,
  );
  const movableEpisode = createPlanningRecord('chapters', {
    id: 'movable-episode', nodeType: 'episode', parentId: '', order: 1, title: '移動する話',
  }, { now: fixedNow, idFactory: idFactory('movable-episode') });
  rejectedTree = addRecord(rejectedTree, 'chapters', movableEpisode);
  assert.throws(
    () => movePlanningChapterToParent(rejectedTree, movableEpisode.id, rejectedPart.id, {
      expectedRevision: rejectedTree.chapterOrderRevision,
      now: fixedNow,
    }),
    /採用しない.*親項目へ子項目を移動できません/,
  );

  let approvedTree = createEmptyPlanningNotes();
  const approvedPart = createPlanningRecord('chapters', {
    id: 'approved-parent', nodeType: 'part', order: 0, title: '承認済みの部', status: 'approved',
  }, { now: fixedNow, idFactory: idFactory('approved-parent') });
  const draftEpisode = createPlanningRecord('chapters', {
    id: 'draft-episode', nodeType: 'episode', parentId: approvedPart.id, order: 0, title: '未承認の話',
  }, { now: fixedNow, idFactory: idFactory('draft-episode') });
  approvedTree = normalizePlanningNotes({
    ...approvedTree,
    chapters: [approvedPart, draftEpisode],
    draftOutlineChapterIds: [approvedPart.id, draftEpisode.id],
  });
  assert.throws(
    () => upsertPlanningRecord(approvedTree, 'chapters', { ...draftEpisode, status: 'rejected' }, {
      expectedUpdatedAt: draftEpisode.updatedAt,
      now: fixedNow,
    }),
    /本人承認済みの親項目に属する構成順は直接変更できません/,
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

test('共有JSONとMarkdownは章の完成状態だけを残し外部サービスの原稿URLを完全に除外する', () => {
  let data = createEmptyPlanningNotes();
  const confirmedChapter = createPlanningRecord('chapters', {
    id: 'share-manuscript-confirmed', title: '確定版だけに残る章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('share-manuscript-confirmed') });
  data = addRecord(data, 'chapters', confirmedChapter);
  data = createPlanningOutlineSnapshot(data, { kind: 'confirmed', label: '共有確認の確定目次' }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('share-manuscript-confirmed-outline'),
  });
  data = updatePlanningChapterManuscript(data, confirmedChapter.id, {
    completed: true,
    documentUrl: 'https://www.notion.so/private/CONFIRMED_MANUSCRIPT_PAGE',
  }, { expectedRevision: 0, now: fixedNow });
  const activeChapter = createPlanningRecord('chapters', {
    id: 'share-manuscript-active', title: '現在執筆中の章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('share-manuscript-active') });
  data = replacePlanningOutlineDraft(data, [activeChapter], {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('share-manuscript-history'),
  }).data;
  data = updatePlanningChapterManuscript(data, activeChapter.id, {
    documentUrl: 'https://www.dropbox.com/scl/fi/PRIVATE_ACTIVE_DOC/manuscript.docx?rlkey=PRIVATE_SHARE_KEY&dl=0',
  }, { expectedRevision: 0, now: fixedNow });

  const share = buildPlanningNotesSharePackage(data, { bookTitle: '共有確認本', now: fixedNow });
  assert.equal(share.data.chapterWritingStates.length, 2);
  assert.ok(share.data.chapterWritingStates.every(state => !Object.hasOwn(state, 'documentUrl')));
  assert.equal(
    share.data.chapterWritingStates.find(state => state.chapterId === confirmedChapter.id).completed,
    true,
  );
  const json = JSON.stringify(share);
  assert.doesNotMatch(json, /notion\.so|dropbox\.com|CONFIRMED_MANUSCRIPT_PAGE|PRIVATE_ACTIVE_DOC|PRIVATE_SHARE_KEY|documentUrl/);

  const markdown = planningNotesShareToMarkdown(share);
  assert.doesNotMatch(markdown, /notion\.so|dropbox\.com|CONFIRMED_MANUSCRIPT_PAGE|PRIVATE_ACTIVE_DOC|PRIVATE_SHARE_KEY|documentUrl/);
  const draftBlock = markdown.slice(
    markdown.indexOf('### 仮目次（編集中）'),
    markdown.indexOf('### 現在の確定目次'),
  );
  assert.match(draftBlock, /現在執筆中の章（原稿：未完了）/);
  const confirmedBlock = markdown.slice(
    markdown.indexOf('### 現在の確定目次'),
    markdown.indexOf('### 過去の目次'),
  );
  assert.match(confirmedBlock, /確定版だけに残る章（原稿：書き終えた）/);
  const pastBlock = markdown.slice(markdown.indexOf('### 過去の目次'));
  assert.doesNotMatch(pastBlock, /原稿：/);
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
  for (const secret of [
    ['github_', 'pat_11AA22BB33CC44DD55EE66FF77GG88HH'].join(''),
    ['sk_', 'live_51AA22BB33CC44DD55EE66FF'].join(''),
    ['xox', 'b-123456789012-123456789012-abcdefghijklmnopqrstuvwx'].join(''),
  ]) {
    assert.throws(
      () => buildPlanningNotesSharePackage(createEmptyPlanningNotes(), {
        now: fixedNow,
        projectName: secret,
      }),
      /APIキー/,
    );
  }
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

test('章原稿進捗の保存で約2MBを超える場合は元データを変えず原子的に停止する', () => {
  let data = createEmptyPlanningNotes();
  const chapter = createPlanningRecord('chapters', {
    id: 'manuscript-capacity-chapter', title: '容量確認章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('manuscript-capacity-chapter') });
  data = addRecord(data, 'chapters', chapter);
  data = normalizePlanningNotes({
    ...data,
    concept: {
      ...data.concept,
      targetReader: 'a'.repeat(450_000),
      readerProblems: 'b'.repeat(450_000),
      bookPromise: 'c'.repeat(450_000),
      theme: 'd'.repeat(450_000),
    },
  });
  const padding = PLANNING_NOTES_SAVE_LIMIT_BYTES
    - estimatePlanningNotesBytes(serializePlanningNotes(data))
    - 80;
  assert.ok(padding > 0 && padding < 500_000);
  data = normalizePlanningNotes({
    ...data,
    concept: { ...data.concept, uniqueness: 'e'.repeat(padding) },
  });
  assert.ok(estimatePlanningNotesBytes(serializePlanningNotes(data)) < PLANNING_NOTES_SAVE_LIMIT_BYTES);
  const untouched = structuredClone(data);
  assert.throws(
    () => updatePlanningChapterManuscript(data, chapter.id, {
      completed: true,
      documentUrl: 'https://docs.google.com/document/d/capacity-doc/edit',
    }, { expectedRevision: 0, now: fixedNow }),
    /約2MB/,
  );
  assert.deepEqual(data, untouched);
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

test('v1企画ノートを新フィールド未設定のv6へ安全に移行する', () => {
  const legacy = createEmptyPlanningNotes();
  legacy.version = 1;
  delete legacy.marketSummary;
  delete legacy.outlineRevision;
  delete legacy.confirmedOutlineId;
  delete legacy.outlineSnapshots;
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
  assert.equal(migrated.version, 8);
  assert.equal(migrated.outlineRevision, 0);
  assert.equal(migrated.confirmedOutlineId, '');
  assert.deepEqual(migrated.outlineSnapshots, []);
  assert.equal(migrated.marketSummary.versionId, '');
  assert.equal(migrated.instructionVersions[0].audience, 'unset');
  assert.deepEqual(migrated.instructionVersions[0].canonicalFor, []);
  assert.equal(migrated.decisions[0].decisionState, 'unset');
  assert.equal(migrated.decisions[0].isCanonical, false);
});

test('部で絞り込むと配下の話・節と、それらへ紐づく記録も表示する', () => {
  let data = createEmptyPlanningNotes();
  const part = createPlanningRecord('chapters', {
    id: 'filter-part', nodeType: 'part', order: 0, title: '第一部',
  }, { now: fixedNow, idFactory: idFactory('filter-part') });
  const episode = createPlanningRecord('chapters', {
    id: 'filter-episode', nodeType: 'episode', parentId: part.id, order: 0, title: '第一話',
  }, { now: fixedNow, idFactory: idFactory('filter-episode') });
  data = addRecord(data, 'chapters', part);
  data = addRecord(data, 'chapters', episode);
  data = addRecord(data, 'interviews', createPlanningRecord('interviews', {
    id: 'filter-interview', question: '第一話の取材', chapterIds: [episode.id],
  }, { now: fixedNow, idFactory: idFactory('filter-interview') }));

  const ids = filterPlanningNotes(data, { chapterId: part.id })
    .map(result => result.record.id);
  assert.deepEqual(ids, [part.id, episode.id, 'filter-interview']);
});

test('v2の平坦な章はID・本文・orderを変えずrootの仮目次としてv6へ移行する', () => {
  const legacy = createEmptyPlanningNotes();
  legacy.version = 2;
  delete legacy.outlineRevision;
  delete legacy.confirmedOutlineId;
  delete legacy.outlineSnapshots;
  legacy.chapters = [createPlanningRecord('chapters', {
    id: 'legacy-chapter-1',
    order: 7,
    title: '旧データの第1章',
    outlineMarkdown: '本文構成をそのまま保持',
  }, { now: fixedNow, idFactory: idFactory('legacy-chapter-1') })];
  delete legacy.chapters[0].nodeType;
  delete legacy.chapters[0].parentId;

  const migrated = normalizePlanningNotes(legacy);
  assert.equal(migrated.version, 8);
  assert.equal(migrated.confirmedOutlineId, '');
  assert.deepEqual(migrated.outlineSnapshots, []);
  assert.deepEqual(
    {
      id: migrated.chapters[0].id,
      order: migrated.chapters[0].order,
      title: migrated.chapters[0].title,
      outlineMarkdown: migrated.chapters[0].outlineMarkdown,
      nodeType: migrated.chapters[0].nodeType,
      parentId: migrated.chapters[0].parentId,
    },
    {
      id: 'legacy-chapter-1',
      order: 7,
      title: '旧データの第1章',
      outlineMarkdown: '本文構成をそのまま保持',
      nodeType: 'chapter',
      parentId: '',
    },
  );
});

test('階層目次の結合は親ごとのorderを扱い、親子関係を保ったまま冪等になる', () => {
  const part1 = createPlanningRecord('chapters', {
    id: 'part-1', nodeType: 'part', parentId: '', order: 0, title: '第一部',
  }, { now: fixedNow, idFactory: idFactory('part-1') });
  const part2 = createPlanningRecord('chapters', {
    id: 'part-2', nodeType: 'part', parentId: '', order: 1, title: '第二部',
  }, { now: fixedNow, idFactory: idFactory('part-2') });
  let current = addRecord(createEmptyPlanningNotes(), 'chapters', part1);
  current = addRecord(current, 'chapters', createPlanningRecord('chapters', {
    id: 'episode-1', nodeType: 'episode', parentId: part1.id, order: 0, title: '第一話',
  }, { now: fixedNow, idFactory: idFactory('episode-1') }));
  let incoming = addRecord(createEmptyPlanningNotes(), 'chapters', part2);
  incoming = addRecord(incoming, 'chapters', createPlanningRecord('chapters', {
    id: 'episode-2', nodeType: 'episode', parentId: part2.id, order: 0, title: '第二部の第一話',
  }, { now: fixedNow, idFactory: idFactory('episode-2') }));

  const once = mergePlanningNotesValues(
    serializePlanningNotes(current),
    serializePlanningNotes(incoming),
  );
  const twice = mergePlanningNotesValues(once, serializePlanningNotes(incoming));
  const merged = readPlanningNotes(twice).data;
  assert.deepEqual(twice, once);
  assert.deepEqual(
    flattenPlanningChapterTree(merged).map(({ record, depth }) => [record.id, record.order, depth]),
    [
      ['part-1', 0, 0],
      ['episode-1', 0, 1],
      ['part-2', 1, 0],
      ['episode-2', 0, 1],
    ],
  );
  assert.ok(merged.outlineRevision > Math.max(current.outlineRevision, incoming.outlineRevision));
});

test('v3の階層目次はID・本文・親子順・章紐付けを変えずv6の仮目次へ移行する', () => {
  let legacy = createEmptyPlanningNotes();
  const part = createPlanningRecord('chapters', {
    id: 'legacy-part', nodeType: 'part', parentId: '', order: 0, title: '第一部',
  }, { now: fixedNow, idFactory: idFactory('legacy-part') });
  const episode = createPlanningRecord('chapters', {
    id: 'legacy-episode', nodeType: 'episode', parentId: part.id, order: 0,
    title: '第一話', outlineMarkdown: '既存の章内構成',
  }, { now: fixedNow, idFactory: idFactory('legacy-episode') });
  legacy = addRecord(legacy, 'chapters', part);
  legacy = addRecord(legacy, 'chapters', episode);
  legacy = addRecord(legacy, 'interviews', createPlanningRecord('interviews', {
    id: 'legacy-interview', question: '既存の質問', chapterIds: [episode.id],
  }, { now: fixedNow, idFactory: idFactory('legacy-interview') }));
  legacy.version = 3;
  delete legacy.outlineRevision;
  delete legacy.confirmedOutlineId;
  delete legacy.outlineSnapshots;

  const migrated = normalizePlanningNotes(legacy);
  assert.equal(migrated.version, 8);
  assert.deepEqual(
    migrated.chapters.map(record => ({
      id: record.id,
      parentId: record.parentId,
      order: record.order,
      nodeType: record.nodeType,
      title: record.title,
      outlineMarkdown: record.outlineMarkdown,
    })),
    [
      { id: 'legacy-part', parentId: '', order: 0, nodeType: 'part', title: '第一部', outlineMarkdown: '' },
      { id: 'legacy-episode', parentId: 'legacy-part', order: 0, nodeType: 'episode', title: '第一話', outlineMarkdown: '既存の章内構成' },
    ],
  );
  assert.deepEqual(migrated.interviews[0].chapterIds, ['legacy-episode']);
  assert.deepEqual(migrated.draftOutlineChapterIds, ['legacy-part', 'legacy-episode']);
  assert.equal(migrated.confirmedOutlineId, '');
  assert.deepEqual(migrated.outlineSnapshots, []);
});

test('v4目次は全既存IDを編集中の仮目次としてv6へ移行する', () => {
  let legacy = createEmptyPlanningNotes();
  const chapter = createPlanningRecord('chapters', {
    id: 'legacy-v4-chapter', title: '旧版の章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('legacy-v4-chapter') });
  legacy = addRecord(legacy, 'chapters', chapter);
  legacy = addRecord(legacy, 'interviews', createPlanningRecord('interviews', {
    id: 'legacy-v4-interview', question: '旧版の質問', chapterIds: [chapter.id],
  }, { now: fixedNow, idFactory: idFactory('legacy-v4-interview') }));
  const expectedChapter = structuredClone(legacy.chapters[0]);
  const expectedInterview = structuredClone(legacy.interviews[0]);
  legacy.version = 4;
  delete legacy.draftOutlineChapterIds;

  const migrated = normalizePlanningNotes(legacy);
  assert.equal(migrated.version, 8);
  assert.deepEqual(migrated.draftOutlineChapterIds, ['legacy-v4-chapter']);
  assert.deepEqual(migrated.chapters[0], expectedChapter);
  assert.deepEqual(migrated.interviews[0], expectedInterview);
});

test('v5のactive目次・退避台帳・保存版を変えず原稿進捗未設定のv6へ移行する', () => {
  let legacy = createEmptyPlanningNotes();
  const oldChapter = createPlanningRecord('chapters', {
    id: 'legacy-v5-old', title: '退避済みの旧章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('legacy-v5-old') });
  legacy = addRecord(legacy, 'chapters', oldChapter);
  legacy = addRecord(legacy, 'interviews', createPlanningRecord('interviews', {
    id: 'legacy-v5-interview', question: '旧章の取材', chapterIds: [oldChapter.id],
  }, { now: fixedNow, idFactory: idFactory('legacy-v5-interview') }));
  const nextChapter = createPlanningRecord('chapters', {
    id: 'legacy-v5-active', title: '現在の仮目次', order: 0,
  }, { now: fixedNow, idFactory: idFactory('legacy-v5-active') });
  legacy = replacePlanningOutlineDraft(legacy, [nextChapter], {
    expectedOutlineRevision: legacy.outlineRevision,
    expectedChapterOrderRevision: legacy.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('legacy-v5-snapshot'),
  }).data;
  legacy.version = 5;
  delete legacy.chapterWritingStates;

  const migrated = normalizePlanningNotes(legacy);
  assert.equal(migrated.version, 8);
  assert.deepEqual(migrated.draftOutlineChapterIds, ['legacy-v5-active']);
  assert.deepEqual(migrated.chapterWritingStates, []);
  assert.equal(migrated.outlineSnapshots[0].chapters[0].id, 'legacy-v5-old');
  assert.equal(migrated.chapters.some(chapter => chapter.id === 'legacy-v5-old'), true);
});

test('仮目次と確定目次は章IDごとに原稿完成・原稿リンクを共有しsnapshot本文を変えない', () => {
  let data = createEmptyPlanningNotes();
  const chapter = createPlanningRecord('chapters', {
    id: 'manuscript-shared-chapter', title: '共有する第一章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('manuscript-shared-chapter') });
  data = addRecord(data, 'chapters', chapter);
  data = createPlanningOutlineSnapshot(data, { kind: 'confirmed', label: '原稿進捗の確定目次' }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('manuscript-confirmed'),
  });
  const confirmedBefore = structuredClone(getConfirmedPlanningOutline(data));
  const untouchedOutlineRevision = data.outlineRevision;
  const untouchedOrderRevision = data.chapterOrderRevision;
  assert.deepEqual(getPlanningChapterManuscript(data, chapter.id), {
    chapterId: chapter.id,
    revision: 0,
    createdAt: '',
    updatedAt: '',
    completed: false,
    completedAt: '',
    documentUrl: '',
  });

  data = updatePlanningChapterManuscript(data, chapter.id, {
    completed: true,
    documentUrl: 'https://docs.google.com/document/d/private-doc-id-001/edit?usp=sharing',
  }, {
    expectedRevision: 0,
    now: () => new Date('2026-08-15T00:00:00.000Z'),
  });
  const firstState = getPlanningChapterManuscript(data, chapter.id);
  assert.equal(firstState.completed, true);
  assert.equal(firstState.completedAt, '2026-08-15T00:00:00.000Z');
  assert.equal(firstState.revision, 1);
  assert.equal(data.outlineRevision, untouchedOutlineRevision);
  assert.equal(data.chapterOrderRevision, untouchedOrderRevision);
  assert.deepEqual(getConfirmedPlanningOutline(data), confirmedBefore);

  const nextChapter = createPlanningRecord('chapters', {
    id: 'manuscript-next-chapter', title: '全面改稿後の章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('manuscript-next-chapter') });
  data = replacePlanningOutlineDraft(data, [nextChapter], {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: () => new Date('2026-08-16T00:00:00.000Z'),
    idFactory: idFactory('manuscript-before-rewrite'),
  }).data;
  assert.equal(data.chapters.some(record => record.id === chapter.id), false);
  assert.equal(getConfirmedPlanningOutline(data).chapters[0].id, chapter.id);

  data = updatePlanningChapterManuscript(data, chapter.id, {
    documentUrl: 'https://docs.google.com/document/u/0/d/private-doc-id-002/edit',
  }, {
    expectedRevision: 1,
    now: () => new Date('2026-08-17T00:00:00.000Z'),
  });
  const snapshotOnlyState = getPlanningChapterManuscript(data, chapter.id);
  assert.equal(snapshotOnlyState.completed, true);
  assert.equal(snapshotOnlyState.completedAt, firstState.completedAt);
  assert.equal(snapshotOnlyState.revision, 2);
  assert.deepEqual(getConfirmedPlanningOutline(data), confirmedBefore);
  assert.equal(getPlanningChapterManuscript(data, nextChapter.id).revision, 0);
  assert.throws(
    () => updatePlanningChapterManuscript(data, chapter.id, { completed: false }, {
      expectedRevision: 1,
      now: fixedNow,
    }),
    /別の画面で更新/,
  );

  data = createPlanningOutlineSnapshot(data, { kind: 'confirmed', label: '全面改稿後の確定目次' }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: () => new Date('2026-08-18T00:00:00.000Z'),
    idFactory: idFactory('manuscript-next-confirmed'),
  });
  assert.equal(getConfirmedPlanningOutline(data).chapters[0].id, nextChapter.id);
  assert.throws(
    () => updatePlanningChapterManuscript(data, chapter.id, { completed: false }, {
      expectedRevision: 2,
      now: fixedNow,
    }),
    /過去の目次は変更できません/,
  );
  assert.equal(getPlanningChapterManuscript(data, chapter.id).revision, 2);
});

test('HTTPSの原稿保存先URLを検証し、章削除時は保存版の有無に応じて原稿情報を安全に扱う', () => {
  assert.equal(validatePlanningManuscriptUrl(''), '');
  for (const valid of [
    'https://docs.google.com/document/d/valid_doc-123/edit',
    'https://www.notion.so/workspace/manuscript-123',
    'https://1drv.ms/w/c/example-document',
    'https://www.dropbox.com/scl/fi/example/manuscript.docx?rlkey=share-key&dl=0',
    'https://drive.google.com/file/d/manuscript-file/view',
  ]) {
    assert.equal(validatePlanningManuscriptUrl(`  ${valid}  `), valid);
  }
  assert.equal(
    validatePlanningGoogleDocumentUrl('https://www.notion.so/workspace/legacy-api-alias'),
    'https://www.notion.so/workspace/legacy-api-alias',
  );
  for (const invalid of [
    'http://docs.google.com/document/d/doc/edit',
    'https://user@docs.google.com/document/d/doc/edit',
    'https://user:password@example.com/manuscript',
    'ftp://example.com/manuscript.docx',
    'javascript:alert(1)',
    'data:text/plain,manuscript',
    'file:///C:/manuscript.docx',
    'https://example.com/manuscript?token=private-token',
    'https://example.com/manuscript?%74oken=encoded-private-token',
    'https://example.com/manuscript?auth=private-auth',
    'https://example.com/manuscript?sessionId=private-session',
    'https://example.com/manuscript?X-Amz-Signature=signed-value',
    'https://example.com/manuscript#signature=signed-value',
    'https://example.com/#access_token=private-token',
    'https://chatgpt.com/c/private-conversation-id',
  ]) {
    assert.throws(() => validatePlanningManuscriptUrl(invalid), /URL|保存できません/);
  }

  let data = createEmptyPlanningNotes();
  const chapter = createPlanningRecord('chapters', {
    id: 'manuscript-delete-chapter', title: '削除確認章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('manuscript-delete-chapter') });
  data = addRecord(data, 'chapters', chapter);
  data = updatePlanningChapterManuscript(data, chapter.id, {
    completed: true,
    documentUrl: 'https://docs.google.com/document/d/delete-check/edit',
  }, { expectedRevision: 0, now: fixedNow });
  data = deletePlanningRecord(data, 'chapters', chapter.id, {
    expectedUpdatedAt: data.chapters[0].updatedAt,
  });
  assert.deepEqual(data.chapters, []);
  assert.deepEqual(data.chapterWritingStates, []);

  let saved = createEmptyPlanningNotes();
  const savedChapter = createPlanningRecord('chapters', {
    id: 'manuscript-snapshot-chapter', title: '保存版に残る章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('manuscript-snapshot-chapter') });
  saved = addRecord(saved, 'chapters', savedChapter);
  saved = updatePlanningChapterManuscript(saved, savedChapter.id, {
    completed: true,
    documentUrl: 'https://docs.google.com/document/d/snapshot-doc/edit',
  }, { expectedRevision: 0, now: fixedNow });
  saved = createPlanningOutlineSnapshot(saved, { kind: 'confirmed', label: '原稿リンクを残す確定目次' }, {
    expectedOutlineRevision: saved.outlineRevision,
    expectedChapterOrderRevision: saved.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('manuscript-delete-snapshot'),
  });
  saved = deletePlanningRecord(saved, 'chapters', savedChapter.id, {
    expectedUpdatedAt: saved.chapters[0].updatedAt,
  });
  assert.deepEqual(saved.chapters, []);
  assert.equal(saved.chapterWritingStates.length, 1);
  assert.equal(getPlanningChapterManuscript(saved, savedChapter.id).completed, true);
  assert.equal(
    getPlanningChapterManuscript(saved, savedChapter.id).documentUrl,
    'https://docs.google.com/document/d/snapshot-doc/edit',
  );
});

test('章原稿進捗は別章を結合し同じ章の差・明示クリア・古い画面を競合停止する', () => {
  let base = createEmptyPlanningNotes();
  const first = createPlanningRecord('chapters', {
    id: 'manuscript-merge-first', title: '第一章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('manuscript-merge-first') });
  const second = createPlanningRecord('chapters', {
    id: 'manuscript-merge-second', title: '第二章', order: 1,
  }, { now: fixedNow, idFactory: idFactory('manuscript-merge-second') });
  base = addRecord(base, 'chapters', first);
  base = addRecord(base, 'chapters', second);
  const current = updatePlanningChapterManuscript(base, first.id, { completed: true }, {
    expectedRevision: 0,
    now: () => new Date('2026-08-15T00:00:00.000Z'),
  });
  const incoming = updatePlanningChapterManuscript(base, second.id, {
    documentUrl: 'https://docs.google.com/document/d/second-doc/edit',
  }, {
    expectedRevision: 0,
    now: () => new Date('2026-08-16T00:00:00.000Z'),
  });
  const union = readPlanningNotes(mergePlanningNotesValues(
    serializePlanningNotes(current),
    serializePlanningNotes(incoming),
  )).data;
  assert.deepEqual(union.chapterWritingStates.map(state => state.chapterId), [first.id, second.id]);

  const divergent = updatePlanningChapterManuscript(base, first.id, {
    documentUrl: 'https://docs.google.com/document/d/other-first-doc/edit',
  }, {
    expectedRevision: 0,
    now: () => new Date('2026-08-17T00:00:00.000Z'),
  });
  assert.ok(previewPlanningNotesMerge(
    serializePlanningNotes(current),
    serializePlanningNotes(divergent),
  ).some(conflict => conflict.reason === 'chapter_writing_state_requires_review'));
  assert.throws(
    () => mergePlanningNotesValues(serializePlanningNotes(current), serializePlanningNotes(divergent)),
    PlanningNotesMergeConflictError,
  );

  const withUrl = updatePlanningChapterManuscript(base, first.id, {
    completed: true,
    documentUrl: 'https://docs.google.com/document/d/old-value/edit',
  }, { expectedRevision: 0, now: fixedNow });
  const cleared = updatePlanningChapterManuscript(withUrl, first.id, {
    completed: false,
    documentUrl: '',
  }, { expectedRevision: 1, now: () => new Date('2026-08-18T00:00:00.000Z') });
  assert.deepEqual(
    getPlanningChapterManuscript(cleared, first.id),
    {
      ...getPlanningChapterManuscript(cleared, first.id),
      completed: false,
      completedAt: '',
      documentUrl: '',
      revision: 2,
    },
  );
  assert.throws(
    () => mergePlanningNotesValues(serializePlanningNotes(cleared), serializePlanningNotes(withUrl)),
    PlanningNotesMergeConflictError,
  );
});

test('CodexのMarkdown目次を部・章・話・節へ安全に解析し、平坦な章も保持する', () => {
  const parsed = parsePlanningOutlineMarkdown([
    '# 目次案',
    '## 第一部　息をしているだけで精いっぱいだった',
    '### 第一話　朝が来るのが怖かった',
    '#### 第一節　最初の場面',
    '本文は取り込まない',
  ].join('\n'), {
    now: fixedNow,
    idFactory: idFactory('parsed-part', 'parsed-episode', 'parsed-section'),
  });
  assert.deepEqual(parsed.counts, { total: 3, part: 1, chapter: 0, episode: 1, section: 1 });
  assert.deepEqual(
    parsed.proposedChapters.map(record => [record.id, record.nodeType, record.parentId, record.status]),
    [
      ['parsed-part', 'part', '', 'draft'],
      ['parsed-episode', 'episode', 'parsed-part', 'draft'],
      ['parsed-section', 'section', 'parsed-episode', 'draft'],
    ],
  );
  assert.match(parsed.warnings.join('\n'), /目次全体の見出し/);
  assert.match(parsed.warnings.join('\n'), /本文1行/);

  const flat = parsePlanningOutlineMarkdown('# 第1章 はじめに\n# 第2章 本題', {
    now: fixedNow,
    idFactory: idFactory('flat-1', 'flat-2'),
  });
  assert.deepEqual(flat.proposedChapters.map(record => [record.nodeType, record.parentId, record.order]), [
    ['chapter', '', 0],
    ['chapter', '', 1],
  ]);

  const introduction = parsePlanningOutlineMarkdown('# はじめに\n## 第一章 本題', {
    now: fixedNow,
    idFactory: idFactory('introduction', 'main-chapter'),
  });
  assert.deepEqual(introduction.proposedChapters.map(record => record.title), ['はじめに', '第一章 本題']);
  assert.throws(
    () => parsePlanningOutlineMarkdown('# 第一部\n### 第一話', { now: fixedNow }),
    /見出しの深さが飛んでいます/,
  );
  assert.throws(
    () => parsePlanningOutlineMarkdown('# 第1章 sk-abcdefghijklmnop', { now: fixedNow }),
    /APIキー/,
  );
});

test('仮目次の一括書き直しは旧ID・承認・取材リンク・確定版を保持して新案だけをactiveにする', () => {
  let data = createEmptyPlanningNotes();
  const oldPart = createPlanningRecord('chapters', {
    id: 'rewrite-old-part', nodeType: 'part', order: 0, title: '旧第一部',
  }, { now: fixedNow, idFactory: idFactory('rewrite-old-part') });
  const oldEpisode = createPlanningRecord('chapters', {
    id: 'rewrite-old-episode', nodeType: 'episode', parentId: oldPart.id, order: 0,
    title: '旧第一話', status: 'approved', approvedBy: '著者本人',
  }, { now: fixedNow, idFactory: idFactory('rewrite-old-episode') });
  data = addRecord(data, 'chapters', oldPart);
  data = addRecord(data, 'chapters', oldEpisode);
  const interview = createPlanningRecord('interviews', {
    id: 'rewrite-interview', question: '当時どう感じましたか', rawAnswer: '怖かった',
    publicAnswer: '当時は怖さを感じました', visibility: 'share_candidate',
    chapterIds: [oldEpisode.id], status: 'approved', approvedBy: '著者本人',
  }, { now: fixedNow, idFactory: idFactory('rewrite-interview') });
  data = addRecord(data, 'interviews', interview);
  data = createPlanningOutlineSnapshot(data, { kind: 'confirmed', label: '確定目次 v1' }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('rewrite-confirmed'),
  });
  const oldChapters = structuredClone(data.chapters);
  const oldInterview = structuredClone(data.interviews[0]);
  const confirmedOutlineId = data.confirmedOutlineId;
  const parsed = parsePlanningOutlineMarkdown('# 第一部 新しい入口\n## 第一話 新しい朝', {
    now: fixedNow,
    idFactory: idFactory('rewrite-new-part', 'rewrite-new-episode'),
  });

  const result = replacePlanningOutlineDraft(data, parsed.proposedChapters, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('rewrite-before-snapshot'),
  });
  data = result.data;
  assert.equal(result.summary.archivedChapterCount, 2);
  assert.equal(result.summary.createdChapterCount, 2);
  assert.equal(result.summary.preservedLinkCount, 1);
  assert.equal(result.summary.needsRelinkCount, 1);
  assert.equal(result.summary.snapshotCreated, true);
  assert.equal(data.confirmedOutlineId, confirmedOutlineId);
  assert.deepEqual(data.chapters.slice(0, 2), oldChapters);
  assert.deepEqual(data.interviews[0], oldInterview);
  assert.deepEqual(data.interviews[0].chapterIds, ['rewrite-old-episode']);
  assert.deepEqual(
    getPlanningDraftOutlineChapters(data).map(record => record.id),
    ['rewrite-new-part', 'rewrite-new-episode'],
  );
  assert.equal(isPlanningDraftChapter(data, 'rewrite-old-episode'), false);
  assert.equal(isPlanningDraftChapter(data, 'rewrite-new-episode'), true);
  assert.deepEqual(
    data.outlineSnapshots.find(snapshot => snapshot.id === result.summary.snapshotId).chapters,
    oldChapters,
  );
  const archivedResults = filterPlanningNotes(data, { chapterId: 'archived' });
  assert.equal(archivedResults.some(({ section }) => section === 'chapters'), false);
  assert.ok(archivedResults.some(({ record }) => record.id === 'rewrite-interview'));
  const sharedAfterRewrite = buildPlanningNotesSharePackage(data, { now: fixedNow });
  assert.deepEqual(sharedAfterRewrite.data.draftOutlineChapterIds, ['rewrite-new-part', 'rewrite-new-episode']);
  assert.equal(sharedAfterRewrite.data.chapters.some(record => record.id === 'rewrite-old-episode'), true);
  assert.deepEqual(sharedAfterRewrite.data.interviews[0].chapterIds, ['rewrite-old-episode']);
  const sharedMarkdown = planningNotesShareToMarkdown(sharedAfterRewrite);
  const draftBlock = sharedMarkdown.slice(
    sharedMarkdown.indexOf('### 仮目次（編集中）'),
    sharedMarkdown.indexOf('### 現在の確定目次'),
  );
  assert.match(draftBlock, /新しい入口|新しい朝/);
  assert.doesNotMatch(draftBlock, /旧第一部|旧第一話/);

  const sameContent = parsePlanningOutlineMarkdown('# 第一部 新しい入口\n## 第一話 新しい朝', {
    now: fixedNow,
    idFactory: idFactory('rewrite-same-part', 'rewrite-same-episode'),
  });
  assert.throws(
    () => replacePlanningOutlineDraft(data, sameContent.proposedChapters, {
      expectedOutlineRevision: data.outlineRevision,
      expectedChapterOrderRevision: data.chapterOrderRevision,
      now: fixedNow,
    }),
    /現在の仮目次と同じ内容/,
  );
  assert.throws(
    () => replacePlanningOutlineDraft(data, [{
      ...sameContent.proposedChapters[0], id: 'rewrite-old-part', title: '衝突する別案',
    }], {
      expectedOutlineRevision: data.outlineRevision,
      expectedChapterOrderRevision: data.chapterOrderRevision,
      now: fixedNow,
    }),
    /保存済みの構成項目と重複/,
  );

  const emptied = replacePlanningOutlineDraft(data, [], {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('rewrite-empty-snapshot'),
  });
  assert.deepEqual(getPlanningDraftOutlineChapters(emptied.data), []);
  assert.equal(emptied.data.confirmedOutlineId, confirmedOutlineId);
  assert.deepEqual(emptied.data.interviews[0], oldInterview);
  const noOp = replacePlanningOutlineDraft(emptied.data, [], {
    expectedOutlineRevision: emptied.data.outlineRevision,
    expectedChapterOrderRevision: emptied.data.chapterOrderRevision,
    now: fixedNow,
  });
  assert.equal(noOp.summary.changed, false);
  assert.deepEqual(noOp.data, emptied.data);
});

test('50項目を25回書き直しても参照のない旧台帳を蓄積せず履歴と承認・リンク・確定版を保持する', () => {
  const initialChapters = Array.from({ length: 50 }, (_, index) => createPlanningRecord('chapters', {
    id: `rewrite-stress-initial-${index}`,
    title: `初期構成${index + 1}`,
    order: index,
    status: index <= 1 ? 'approved' : 'draft',
    approvedBy: index <= 1 ? '著者本人' : '',
  }, { now: fixedNow, idFactory: idFactory(`rewrite-stress-initial-${index}`) }));
  let data = normalizePlanningNotes({
    ...createEmptyPlanningNotes(),
    chapters: initialChapters,
    draftOutlineChapterIds: initialChapters.map(chapter => chapter.id),
  });
  const interview = createPlanningRecord('interviews', {
    id: 'rewrite-stress-interview',
    question: 'この章で伝えたい一次体験は？',
    rawAnswer: '承認済みの原回答',
    status: 'approved',
    approvedBy: '著者本人',
    chapterIds: [initialChapters[0].id],
  }, { now: fixedNow, idFactory: idFactory('rewrite-stress-interview') });
  data = addRecord(data, 'interviews', interview);
  data = createPlanningOutlineSnapshot(data, { kind: 'confirmed', label: '初期の確定目次' }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('rewrite-stress-confirmed'),
  });
  const linkedChapterBefore = structuredClone(
    data.chapters.find(chapter => chapter.id === initialChapters[0].id),
  );
  const interviewBefore = structuredClone(data.interviews[0]);
  const confirmedOutlineId = data.confirmedOutlineId;

  for (let round = 1; round <= 25; round += 1) {
    const currentDraft = getPlanningDraftOutlineChapters(data);
    data = normalizePlanningNotes({
      ...data,
      chapterWritingStates: [
        ...data.chapterWritingStates,
        ...currentDraft.map(chapter => ({
          chapterId: chapter.id,
          revision: 1,
          createdAt: fixedNow().toISOString(),
          updatedAt: fixedNow().toISOString(),
          completed: true,
          completedAt: fixedNow().toISOString(),
          documentUrl: '',
        })),
      ],
    });
    const proposed = Array.from({ length: 50 }, (_, index) => createPlanningRecord('chapters', {
      id: `rewrite-stress-${round}-${index}`,
      title: `第${round}案 構成${index + 1}`,
      order: index,
    }, { now: fixedNow, idFactory: idFactory(`rewrite-stress-${round}-${index}`) }));
    const result = replacePlanningOutlineDraft(data, proposed, {
      expectedOutlineRevision: data.outlineRevision,
      expectedChapterOrderRevision: data.chapterOrderRevision,
      now: fixedNow,
      idFactory: idFactory(`rewrite-stress-snapshot-${round}`),
    });
    data = result.data;
    assert.ok(data.chapters.length <= 51, `第${round}案で台帳が増え続けています`);
    assert.equal(result.summary.retainedLinkedChapterCount, 1);
  }

  assert.equal(data.chapters.length, 51);
  assert.equal(data.chapterWritingStates.length, 1_250);
  assert.ok(data.chapterWritingStates.every(state => state.completed));
  assert.equal(getPlanningDraftOutlineChapters(data).length, 50);
  assert.deepEqual(
    data.chapters.find(chapter => chapter.id === linkedChapterBefore.id),
    linkedChapterBefore,
  );
  assert.equal(data.chapters.some(chapter => chapter.id === initialChapters[1].id), false);
  assert.deepEqual(data.interviews[0], interviewBefore);
  assert.equal(data.confirmedOutlineId, confirmedOutlineId);
  assert.equal(data.outlineSnapshots.length, 26);
  assert.equal(data.outlineSnapshots.filter(snapshot => snapshot.kind === 'draft').length, 25);
  assert.ok(data.outlineSnapshots.every(snapshot => snapshot.chapters.length === 50));
  assert.deepEqual(
    data.outlineSnapshots.find(snapshot => snapshot.id === confirmedOutlineId).chapters,
    initialChapters,
  );
  assert.deepEqual(
    data.outlineSnapshots.find(snapshot => (
      snapshot.kind === 'draft'
      && snapshot.chapters.some(chapter => chapter.id === initialChapters[1].id)
    )).chapters,
    initialChapters,
  );
  assert.ok(data.outlineSnapshots.some(snapshot => (
    snapshot.kind === 'draft'
    && snapshot.chapters.some(chapter => chapter.id === 'rewrite-stress-24-49')
  )));
});

test('仮目次の一括書き直しは古い画面・履歴100件・台帳1000件・約2MB超過で原子的に停止する', () => {
  let base = createEmptyPlanningNotes();
  const old = createPlanningRecord('chapters', {
    id: 'rewrite-limit-old', title: '書き直し前', order: 0,
  }, { now: fixedNow, idFactory: idFactory('rewrite-limit-old') });
  base = addRecord(base, 'chapters', old);
  const proposed = [createPlanningRecord('chapters', {
    id: 'rewrite-limit-new', title: '書き直し後', order: 0,
  }, { now: fixedNow, idFactory: idFactory('rewrite-limit-new') })];
  const untouched = structuredClone(base);
  assert.throws(
    () => replacePlanningOutlineDraft(base, proposed, {
      expectedOutlineRevision: base.outlineRevision - 1,
      expectedChapterOrderRevision: base.chapterOrderRevision,
      now: fixedNow,
    }),
    /別の画面で更新/,
  );
  assert.deepEqual(base, untouched);

  const fullHistory = normalizePlanningNotes({
    ...base,
    outlineSnapshots: Array.from({ length: 100 }, (_, index) => ({
      id: `rewrite-history-${index + 1}`,
      versionNumber: index + 1,
      kind: 'draft',
      label: `履歴${index + 1}`,
      note: '',
      createdAt: `2026-08-14T00:${String(index % 60).padStart(2, '0')}:00.000Z`,
      sourceOutlineRevision: base.outlineRevision,
      sourceChapterOrderRevision: base.chapterOrderRevision,
      chapters: base.chapters.map(chapter => ({ ...chapter, title: `過去の構成${index + 1}` })),
    })),
  });
  assert.throws(
    () => replacePlanningOutlineDraft(fullHistory, proposed, {
      expectedOutlineRevision: fullHistory.outlineRevision,
      expectedChapterOrderRevision: fullHistory.chapterOrderRevision,
      now: fixedNow,
    }),
    /目次履歴は100件が上限/,
  );

  const thousandChapters = Array.from({ length: 1000 }, (_, index) => createPlanningRecord('chapters', {
    id: `rewrite-registry-${index}`, title: `構成${index}`, order: index,
  }, { now: fixedNow, idFactory: idFactory(`rewrite-registry-${index}`) }));
  const fullRegistry = normalizePlanningNotes({
    ...createEmptyPlanningNotes(),
    chapters: thousandChapters,
    draftOutlineChapterIds: thousandChapters.map(chapter => chapter.id),
    interviews: [createPlanningRecord('interviews', {
      id: 'rewrite-registry-interview',
      question: '全構成項目を参照する記録',
      chapterIds: thousandChapters.map(chapter => chapter.id),
    }, { now: fixedNow, idFactory: idFactory('rewrite-registry-interview') })],
  });
  assert.throws(
    () => replacePlanningOutlineDraft(fullRegistry, proposed, {
      expectedOutlineRevision: fullRegistry.outlineRevision,
      expectedChapterOrderRevision: fullRegistry.chapterOrderRevision,
      now: fixedNow,
    }),
    /構成項目が1,000件を超えます/,
  );

  const largeText = 'あ'.repeat(450_000);
  let large = createEmptyPlanningNotes();
  large = addRecord(large, 'chapters', createPlanningRecord('chapters', {
    id: 'rewrite-large-old', title: '大きい旧章', order: 0, outlineMarkdown: largeText,
  }, { now: fixedNow, idFactory: idFactory('rewrite-large-old') }));
  const largeProposed = Array.from({ length: 4 }, (_, index) => createPlanningRecord('chapters', {
    id: `rewrite-large-new-${index}`, title: `大きい新章${index}`, order: index,
    outlineMarkdown: largeText,
  }, { now: fixedNow, idFactory: idFactory(`rewrite-large-new-${index}`) }));
  const largeUntouched = structuredClone(large);
  assert.throws(
    () => replacePlanningOutlineDraft(large, largeProposed, {
      expectedOutlineRevision: large.outlineRevision,
      expectedChapterOrderRevision: large.chapterOrderRevision,
      now: fixedNow,
      idFactory: idFactory('rewrite-large-snapshot'),
    }),
    /約2MBを超えました/,
  );
  assert.deepEqual(large, largeUntouched);
});

test('本人承認済み記録も本文と承認を保ったまま目次の紐づけだけ付け直せる', () => {
  let data = createEmptyPlanningNotes();
  const oldChapter = createPlanningRecord('chapters', {
    id: 'relink-old', title: '旧章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('relink-old') });
  data = addRecord(data, 'chapters', oldChapter);
  const interview = createPlanningRecord('interviews', {
    id: 'relink-interview', question: '大切な質問', rawAnswer: '変えてはいけない原回答',
    chapterIds: [oldChapter.id], status: 'approved', approvedBy: '著者本人',
    approvedAt: '2026-08-14T00:00:00.000Z',
  }, { now: fixedNow, idFactory: idFactory('relink-interview') });
  data = addRecord(data, 'interviews', interview);
  const nextChapter = createPlanningRecord('chapters', {
    id: 'relink-new', title: '新章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('relink-new') });
  data = replacePlanningOutlineDraft(data, [nextChapter], {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('relink-snapshot'),
  }).data;
  const before = data.interviews[0];
  const updated = updatePlanningRecordChapterLinks(
    data,
    'interviews',
    before.id,
    [oldChapter.id, nextChapter.id],
    { expectedUpdatedAt: before.updatedAt, now: () => new Date('2026-08-15T00:00:00.000Z') },
  );
  const after = updated.interviews[0];
  assert.deepEqual(after.chapterIds, ['relink-old', 'relink-new']);
  assert.equal(after.revision, before.revision + 1);
  for (const field of ['question', 'rawAnswer', 'status', 'approvedAt', 'approvedBy', 'createdAt']) {
    assert.equal(after[field], before[field]);
  }
  assert.throws(
    () => updatePlanningRecordChapterLinks(updated, 'interviews', after.id, [], {
      expectedUpdatedAt: before.updatedAt,
      now: fixedNow,
    }),
    /別の画面で更新/,
  );
  assert.throws(
    () => updatePlanningRecordChapterLinks(updated, 'interviews', after.id, ['missing-chapter'], {
      expectedUpdatedAt: after.updatedAt,
      now: fixedNow,
    }),
    /見つかりません/,
  );
  assert.throws(
    () => updatePlanningRecordChapterLinks(updated, 'chapters', nextChapter.id, [], {
      expectedUpdatedAt: nextChapter.updatedAt,
      now: fixedNow,
    }),
    /記録種類ではありません/,
  );
});

test('仮目次membershipの結合は旧単純追加を保ち、全面改稿後のactive目次を自動混合しない', () => {
  let active = createEmptyPlanningNotes();
  active = addRecord(active, 'chapters', createPlanningRecord('chapters', {
    id: 'merge-active-chapter', title: '現在の章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('merge-active-chapter') }));
  const emptyResult = replacePlanningOutlineDraft(active, [], {
    expectedOutlineRevision: active.outlineRevision,
    expectedChapterOrderRevision: active.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('merge-empty-snapshot'),
  }).data;
  const adopted = readPlanningNotes(mergePlanningNotesValues(
    serializePlanningNotes(createEmptyPlanningNotes()),
    serializePlanningNotes(active),
  )).data;
  assert.deepEqual(adopted.draftOutlineChapterIds, ['merge-active-chapter']);

  const kept = readPlanningNotes(mergePlanningNotesValues(
    serializePlanningNotes(active),
    serializePlanningNotes(createEmptyPlanningNotes()),
  )).data;
  assert.deepEqual(kept.draftOutlineChapterIds, ['merge-active-chapter']);

  assert.ok(previewPlanningNotesMerge(
    serializePlanningNotes(emptyResult),
    serializePlanningNotes(active),
  ).some(conflict => conflict.reason === 'draft_outline_membership_conflict'));
  assert.ok(previewPlanningNotesMerge(
    serializePlanningNotes(active),
    serializePlanningNotes(emptyResult),
  ).some(conflict => conflict.reason === 'draft_outline_membership_conflict'));

  const deletedEmpty = deletePlanningRecord(active, 'chapters', 'merge-active-chapter', {
    expectedUpdatedAt: active.chapters[0].updatedAt,
  });
  assert.deepEqual(deletedEmpty.chapters, []);
  assert.deepEqual(deletedEmpty.draftOutlineChapterIds, []);
  assert.equal(deletedEmpty.outlineSnapshots.length, 0);
  assert.ok(deletedEmpty.outlineRevision > 0);
  assert.ok(deletedEmpty.chapterOrderRevision > 0);
  assert.throws(
    () => mergePlanningNotesValues(
      serializePlanningNotes(deletedEmpty),
      serializePlanningNotes(active),
    ),
    error => error instanceof PlanningNotesMergeConflictError
      && error.conflicts.some(conflict => conflict.reason === 'draft_outline_membership_conflict'),
  );

  let other = createEmptyPlanningNotes();
  other = addRecord(other, 'chapters', createPlanningRecord('chapters', {
    id: 'merge-other-chapter', title: '別の章', order: 1,
  }, { now: fixedNow, idFactory: idFactory('merge-other-chapter') }));
  const safelyAppended = readPlanningNotes(mergePlanningNotesValues(
    serializePlanningNotes(active),
    serializePlanningNotes(other),
  )).data;
  assert.deepEqual(safelyAppended.draftOutlineChapterIds, ['merge-active-chapter', 'merge-other-chapter']);

  const rewrittenParsed = parsePlanningOutlineMarkdown('# 第1章 全面改稿後', {
    now: fixedNow,
    idFactory: idFactory('merge-rewritten-chapter'),
  });
  const rewritten = replacePlanningOutlineDraft(active, rewrittenParsed.proposedChapters, {
    expectedOutlineRevision: active.outlineRevision,
    expectedChapterOrderRevision: active.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('merge-rewritten-snapshot'),
  }).data;
  assert.throws(
    () => mergePlanningNotesValues(serializePlanningNotes(rewritten), serializePlanningNotes(other)),
    PlanningNotesMergeConflictError,
  );
  const once = mergePlanningNotesValues('', serializePlanningNotes(active));
  assert.equal(mergePlanningNotesValues(once, serializePlanningNotes(active)), once);
});

test('旧v1〜v4の真正な空目次は移行後もactive目次を安全に採用する', () => {
  let active = createEmptyPlanningNotes();
  active = addRecord(active, 'chapters', createPlanningRecord('chapters', {
    id: 'legacy-empty-merge-chapter', title: '復元する章', order: 0,
  }, { now: fixedNow, idFactory: idFactory('legacy-empty-merge-chapter') }));

  for (const version of [1, 2, 3, 4]) {
    const legacyEmpty = createEmptyPlanningNotes();
    legacyEmpty.version = version;
    delete legacyEmpty.draftOutlineChapterIds;
    if (version <= 3) {
      delete legacyEmpty.outlineRevision;
      delete legacyEmpty.confirmedOutlineId;
      delete legacyEmpty.outlineSnapshots;
    }
    const migrated = normalizePlanningNotes(legacyEmpty);
    assert.equal(migrated.outlineRevision, 0);
    assert.equal(migrated.chapterOrderRevision, 0);
    assert.deepEqual(migrated.chapters, []);
    const restored = readPlanningNotes(mergePlanningNotesValues(
      serializePlanningNotes(migrated),
      serializePlanningNotes(active),
    )).data;
    assert.deepEqual(restored.draftOutlineChapterIds, ['legacy-empty-merge-chapter']);
  }
});

test('仮目次を不変snapshotへ保存し、編集後も旧版を残して確定目次を更新する', () => {
  let data = createEmptyPlanningNotes();
  const part = createPlanningRecord('chapters', {
    id: 'snapshot-part', nodeType: 'part', parentId: '', order: 0, title: '第一部',
  }, { now: fixedNow, idFactory: idFactory('snapshot-part') });
  const episode = createPlanningRecord('chapters', {
    id: 'snapshot-episode', nodeType: 'episode', parentId: part.id, order: 0, title: '仮の第一話',
  }, { now: fixedNow, idFactory: idFactory('snapshot-episode') });
  data = addRecord(data, 'chapters', part);
  data = addRecord(data, 'chapters', episode);

  data = createPlanningOutlineSnapshot(data, {
    kind: 'draft', label: '最初の仮目次', note: '最初の保存',
  }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: () => new Date('2026-08-15T00:00:00.000Z'),
    idFactory: idFactory('outline-draft-1'),
  });
  const firstDraft = data.outlineSnapshots[0];
  assert.equal(firstDraft.sourceOutlineRevision, 2);
  assert.equal(firstDraft.sourceChapterOrderRevision, 2);
  assert.equal(planningOutlineMatchesSnapshot(data, firstDraft), true);

  const currentEpisode = data.chapters.find(record => record.id === episode.id);
  data = upsertPlanningRecord(data, 'chapters', {
    ...currentEpisode,
    title: '確定候補の第一話',
  }, {
    expectedUpdatedAt: currentEpisode.updatedAt,
    now: () => new Date('2026-08-16T00:00:00.000Z'),
  });
  assert.equal(firstDraft.chapters.find(record => record.id === episode.id).title, '仮の第一話');
  assert.equal(planningOutlineMatchesSnapshot(data, firstDraft), false);

  data = createPlanningOutlineSnapshot(data, { kind: 'confirmed', label: '確定目次 v1' }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: () => new Date('2026-08-17T00:00:00.000Z'),
    idFactory: idFactory('outline-confirmed-1'),
  });
  const confirmedV1 = getConfirmedPlanningOutline(data);
  assert.equal(confirmedV1.id, 'outline-confirmed-1');
  assert.equal(confirmedV1.versionNumber, 2);
  assert.deepEqual(
    flattenPlanningOutlineSnapshot(confirmedV1, { includeRejected: false }).map(({ record, depth }) => [record.id, depth]),
    [['snapshot-part', 0], ['snapshot-episode', 1]],
  );

  const confirmedEpisode = data.chapters.find(record => record.id === episode.id);
  data = upsertPlanningRecord(data, 'chapters', {
    ...confirmedEpisode,
    title: '改訂後の第一話',
  }, {
    expectedUpdatedAt: confirmedEpisode.updatedAt,
    now: () => new Date('2026-08-18T00:00:00.000Z'),
  });
  data = createPlanningOutlineSnapshot(data, { kind: 'confirmed', label: '確定目次 v2' }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: () => new Date('2026-08-19T00:00:00.000Z'),
    idFactory: idFactory('outline-confirmed-2'),
  });

  assert.equal(getConfirmedPlanningOutline(data).id, 'outline-confirmed-2');
  assert.equal(data.outlineSnapshots.length, 3);
  assert.equal(
    data.outlineSnapshots.find(snapshot => snapshot.id === confirmedV1.id)
      .chapters.find(record => record.id === episode.id).title,
    '確定候補の第一話',
  );
  assert.deepEqual(
    sortPlanningOutlineSnapshotsNewest(data).map(snapshot => snapshot.id),
    ['outline-confirmed-2', 'outline-confirmed-1', 'outline-draft-1'],
  );
  assert.throws(
    () => createPlanningOutlineSnapshot(data, { kind: 'confirmed' }, {
      expectedOutlineRevision: data.outlineRevision,
      expectedChapterOrderRevision: data.chapterOrderRevision,
      now: () => new Date('2026-08-20T00:00:00.000Z'),
      idFactory: idFactory('outline-duplicate'),
    }),
    /変わっていません/,
  );
});

test('目次snapshotは空保存・古い画面・不正な確定参照・版重複・壊れた階層を拒否する', () => {
  const empty = createEmptyPlanningNotes();
  assert.throws(
    () => createPlanningOutlineSnapshot(empty, { kind: 'draft' }, {
      expectedOutlineRevision: 0,
      expectedChapterOrderRevision: 0,
      now: fixedNow,
      idFactory: idFactory('empty-outline'),
    }),
    /採用する構成項目がない/,
  );

  let data = addRecord(empty, 'chapters', createPlanningRecord('chapters', {
    id: 'stale-chapter', title: '仮目次', order: 0,
  }, { now: fixedNow, idFactory: idFactory('stale-chapter') }));
  assert.throws(
    () => createPlanningOutlineSnapshot(data, { kind: 'draft' }, {
      expectedOutlineRevision: data.outlineRevision - 1,
      expectedChapterOrderRevision: data.chapterOrderRevision,
      now: fixedNow,
      idFactory: idFactory('stale-outline'),
    }),
    /別の画面で更新/,
  );
  assert.throws(
    () => createPlanningOutlineSnapshot(data, { kind: 'draft' }, {
      expectedOutlineRevision: data.outlineRevision,
      expectedChapterOrderRevision: data.chapterOrderRevision - 1,
      now: fixedNow,
      idFactory: idFactory('stale-order-outline'),
    }),
    /順序が別の画面で更新/,
  );

  data = createPlanningOutlineSnapshot(data, { kind: 'draft' }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('valid-draft-outline'),
  });
  assert.throws(
    () => normalizePlanningNotes({ ...data, confirmedOutlineId: 'valid-draft-outline' }),
    /確定目次ではない履歴/,
  );
  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      outlineSnapshots: [
        ...data.outlineSnapshots,
        { ...data.outlineSnapshots[0], id: 'duplicate-version-outline' },
      ],
    }),
    /版番号が重複/,
  );
  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      outlineSnapshots: [{
        ...data.outlineSnapshots[0],
        chapters: [{ ...data.outlineSnapshots[0].chapters[0], parentId: 'missing-parent' }],
      }],
    }),
    /存在しない親/,
  );
  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      outlineSnapshots: [{
        ...data.outlineSnapshots[0],
        chapters: [{ ...data.outlineSnapshots[0].chapters[0], chapterIds: ['missing-snapshot-chapter'] }],
      }],
    }),
    /保存版の中に存在しない構成項目ID/,
  );
});

test('目次の改訂番号・版番号は安全な整数に限定し、上限からの増分も停止する', () => {
  const unsafe = Number.MAX_SAFE_INTEGER + 1;
  const empty = createEmptyPlanningNotes();
  assert.throws(
    () => normalizePlanningNotes({ ...empty, outlineRevision: unsafe }),
    /outlineRevision.*安全な整数/,
  );
  assert.throws(
    () => normalizePlanningNotes({ ...empty, chapterOrderRevision: unsafe }),
    /chapterOrderRevision.*安全な整数/,
  );

  let data = addRecord(empty, 'chapters', createPlanningRecord('chapters', {
    id: 'safe-integer-chapter', title: '上限確認', order: 0,
  }, { now: fixedNow, idFactory: idFactory('safe-integer-chapter') }));
  assert.throws(
    () => createPlanningOutlineSnapshot(
      { ...data, outlineRevision: Number.MAX_SAFE_INTEGER },
      { kind: 'draft' },
      {
        expectedOutlineRevision: Number.MAX_SAFE_INTEGER,
        expectedChapterOrderRevision: data.chapterOrderRevision,
        now: fixedNow,
        idFactory: idFactory('outline-after-max-revision'),
      },
    ),
    /outlineRevision.*安全な整数/,
  );

  data = createPlanningOutlineSnapshot(data, { kind: 'draft' }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('outline-at-max-version'),
  });
  data = normalizePlanningNotes({
    ...data,
    outlineSnapshots: data.outlineSnapshots.map(snapshot => ({
      ...snapshot,
      versionNumber: Number.MAX_SAFE_INTEGER,
    })),
  });
  const chapter = data.chapters[0];
  data = upsertPlanningRecord(data, 'chapters', { ...chapter, title: '上限後の変更' }, {
    expectedUpdatedAt: chapter.updatedAt,
    now: () => new Date('2026-08-15T00:00:00.000Z'),
  });
  assert.throws(
    () => createPlanningOutlineSnapshot(data, { kind: 'draft' }, {
      expectedOutlineRevision: data.outlineRevision,
      expectedChapterOrderRevision: data.chapterOrderRevision,
      now: () => new Date('2026-08-16T00:00:00.000Z'),
      idFactory: idFactory('outline-version-overflow'),
    }),
    /versionNumber.*安全な整数/,
  );
  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      outlineSnapshots: data.outlineSnapshots.map(snapshot => ({ ...snapshot, versionNumber: unsafe })),
    }),
    /versionNumber.*安全な整数/,
  );
});

test('目次snapshotの結合は別版を和集合にし、同一ID異内容・版番号・確定指定競合を停止する', () => {
  let base = addRecord(createEmptyPlanningNotes(), 'chapters', createPlanningRecord('chapters', {
    id: 'merge-outline-chapter', title: '共通の仮目次', order: 0,
  }, { now: fixedNow, idFactory: idFactory('merge-outline-chapter') }));
  const current = createPlanningOutlineSnapshot(base, { kind: 'draft', label: '共通v1' }, {
    expectedOutlineRevision: base.outlineRevision,
    expectedChapterOrderRevision: base.chapterOrderRevision,
    now: () => new Date('2026-08-15T00:00:00.000Z'),
    idFactory: idFactory('outline-common-v1'),
  });
  const incoming = createPlanningOutlineSnapshot(current, { kind: 'confirmed', label: '確定v2' }, {
    expectedOutlineRevision: current.outlineRevision,
    expectedChapterOrderRevision: current.chapterOrderRevision,
    now: () => new Date('2026-08-16T00:00:00.000Z'),
    idFactory: idFactory('outline-confirmed-v2'),
  });

  const once = mergePlanningNotesValues(serializePlanningNotes(current), serializePlanningNotes(incoming));
  const twice = mergePlanningNotesValues(once, serializePlanningNotes(incoming));
  const merged = readPlanningNotes(twice).data;
  assert.equal(twice, once);
  assert.deepEqual(merged.outlineSnapshots.map(snapshot => snapshot.id), ['outline-common-v1', 'outline-confirmed-v2']);
  assert.equal(merged.confirmedOutlineId, 'outline-confirmed-v2');

  const sameIdDifferentContent = {
    ...incoming,
    outlineSnapshots: incoming.outlineSnapshots.map(snapshot => snapshot.id === 'outline-confirmed-v2'
      ? { ...snapshot, note: '同じIDの別内容' }
      : snapshot),
  };
  assert.throws(
    () => mergePlanningNotesValues(once, serializePlanningNotes(sameIdDifferentContent)),
    error => error instanceof PlanningNotesMergeConflictError
      && error.conflicts.some(conflict => conflict.reason === 'outline_snapshot_requires_review'),
  );

  const versionCollision = createPlanningOutlineSnapshot(base, { kind: 'draft', label: '別IDのv1' }, {
    expectedOutlineRevision: base.outlineRevision,
    expectedChapterOrderRevision: base.chapterOrderRevision,
    now: () => new Date('2026-08-15T00:00:00.000Z'),
    idFactory: idFactory('outline-other-v1'),
  });
  assert.throws(
    () => mergePlanningNotesValues(serializePlanningNotes(current), serializePlanningNotes(versionCollision)),
    error => error instanceof PlanningNotesMergeConflictError
      && error.conflicts.some(conflict => conflict.reason === 'outline_version_number_conflict'),
  );

  const secondConfirmed = {
    ...incoming,
    outlineSnapshots: incoming.outlineSnapshots.map(snapshot => snapshot.id === 'outline-common-v1'
      ? { ...snapshot, kind: 'confirmed' }
      : snapshot),
    confirmedOutlineId: 'outline-common-v1',
  };
  assert.throws(
    () => mergePlanningNotesValues(serializePlanningNotes(incoming), serializePlanningNotes(secondConfirmed)),
    error => error instanceof PlanningNotesMergeConflictError
      && error.conflicts.some(conflict => conflict.reason === 'confirmed_outline_conflict'),
  );

  const previouslyEmptied = {
    ...createEmptyPlanningNotes(),
    outlineRevision: 5,
    chapterOrderRevision: 5,
  };
  assert.throws(
    () => mergePlanningNotesValues(
      serializePlanningNotes(previouslyEmptied),
      serializePlanningNotes(base),
    ),
    error => error instanceof PlanningNotesMergeConflictError
      && error.conflicts.some(conflict => conflict.reason === 'draft_outline_membership_conflict'),
  );
});

test('目次履歴100件と追加版の結合は事前previewで上限超過を示す', () => {
  let seed = addRecord(createEmptyPlanningNotes(), 'chapters', createPlanningRecord('chapters', {
    id: 'outline-limit-chapter', title: '履歴上限確認', order: 0,
  }, { now: fixedNow, idFactory: idFactory('outline-limit-chapter') }));
  seed = createPlanningOutlineSnapshot(seed, { kind: 'draft' }, {
    expectedOutlineRevision: seed.outlineRevision,
    expectedChapterOrderRevision: seed.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('outline-limit-template'),
  });
  const template = seed.outlineSnapshots[0];
  const current = normalizePlanningNotes({
    ...seed,
    outlineSnapshots: Array.from({ length: 100 }, (_, index) => ({
      ...template,
      id: `outline-limit-${index + 1}`,
      versionNumber: index + 1,
      label: `保存版${index + 1}`,
    })),
  });
  const incoming = normalizePlanningNotes({
    ...seed,
    outlineSnapshots: [{
      ...template,
      id: 'outline-limit-101',
      versionNumber: 101,
      label: '保存版101',
    }],
  });
  const conflicts = previewPlanningNotesMerge(
    serializePlanningNotes(current),
    serializePlanningNotes(incoming),
  );
  assert.equal(conflicts.some(conflict => conflict.reason === 'outline_snapshot_limit_exceeded'), true);
  assert.throws(
    () => mergePlanningNotesValues(serializePlanningNotes(current), serializePlanningNotes(incoming)),
    error => error instanceof PlanningNotesMergeConflictError
      && error.conflicts.some(conflict => conflict.reason === 'outline_snapshot_limit_exceeded'),
  );
});

test('共有JSONとMarkdownは仮目次・現在の確定目次・過去の目次を分け、履歴内の秘密も停止する', () => {
  let data = addRecord(createEmptyPlanningNotes(), 'chapters', createPlanningRecord('chapters', {
    id: 'share-outline-chapter', title: '最初の仮目次', order: 0,
  }, { now: fixedNow, idFactory: idFactory('share-outline-chapter') }));
  data = createPlanningOutlineSnapshot(data, { kind: 'draft', label: '保存した仮目次' }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: () => new Date('2026-08-15T00:00:00.000Z'),
    idFactory: idFactory('share-outline-draft'),
  });
  data = createPlanningOutlineSnapshot(data, { kind: 'confirmed', label: '現在使う確定目次' }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: () => new Date('2026-08-16T00:00:00.000Z'),
    idFactory: idFactory('share-outline-confirmed'),
  });
  const rootChapter = data.chapters[0];
  data = upsertPlanningRecord(data, 'chapters', { ...rootChapter, title: '編集中の仮目次' }, {
    expectedUpdatedAt: rootChapter.updatedAt,
    now: () => new Date('2026-08-17T00:00:00.000Z'),
  });

  const share = buildPlanningNotesSharePackage(data, { bookTitle: '目次テスト本', now: fixedNow });
  const markdown = planningNotesShareToMarkdown(share);
  assert.equal(share.schemaVersion, 1);
  assert.equal(share.data.version, 8);
  assert.equal(share.data.outlineSnapshots.length, 2);
  assert.match(markdown, /## 目次・章構成/);
  assert.match(markdown, /### 仮目次（編集中）[\s\S]*編集中の仮目次/);
  assert.match(markdown, /### 現在の確定目次：現在使う確定目次[\s\S]*最初の仮目次/);
  assert.match(markdown, /### 過去の目次（新しい順）[\s\S]*保存した仮目次/);

  let secretData = addRecord(createEmptyPlanningNotes(), 'chapters', createPlanningRecord('chapters', {
    id: 'secret-outline-chapter', title: 'sk-1234567890abcdefghijkl', order: 0,
  }, { now: fixedNow, idFactory: idFactory('secret-outline-chapter') }));
  secretData = createPlanningOutlineSnapshot(secretData, { kind: 'draft' }, {
    expectedOutlineRevision: secretData.outlineRevision,
    expectedChapterOrderRevision: secretData.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('secret-outline-snapshot'),
  });
  const secretRoot = secretData.chapters[0];
  secretData = upsertPlanningRecord(secretData, 'chapters', { ...secretRoot, title: '共有可能な仮目次' }, {
    expectedUpdatedAt: secretRoot.updatedAt,
    now: () => new Date('2026-08-15T00:00:00.000Z'),
  });
  assert.throws(() => buildPlanningNotesSharePackage(secretData), /共有用データにAPIキー/);

  const privateInterview = createPlanningRecord('interviews', {
    id: 'markdown-private-interview',
    question: '非公開の質問',
    rawAnswer: 'Markdownへ出してはいけない生回答',
    anonymizationNotes: '非公開の匿名化メモ',
    visibility: 'private',
  }, { now: fixedNow, idFactory: idFactory('markdown-private-interview') });
  const fullData = addRecord(data, 'interviews', privateInterview);
  const directMarkdown = planningNotesShareToMarkdown({
    projectName: '直接変換の確認',
    bookTitle: '',
    data: fullData,
  });
  assert.doesNotMatch(directMarkdown, /出してはいけない|非公開の匿名化メモ/);
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
  assert.equal(share.data.version, 8);
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

test('outline ordinal labels count independently by parent and node type using order then stable ID', () => {
  const chapters = [
    { id: 'root-chapter-b', parentId: '', nodeType: 'chapter', order: 10, title: 'B' },
    { id: 'root-part', parentId: '', nodeType: 'part', order: 1, title: 'Part' },
    { id: 'root-chapter-a', parentId: '', nodeType: 'chapter', order: 2, title: 'A' },
    { id: 'part-chapter', parentId: 'root-part', nodeType: 'chapter', order: 0, title: 'Nested' },
    { id: 'episode-b', parentId: 'root-part', nodeType: 'episode', order: 3, title: 'Episode B' },
    { id: 'episode-a', parentId: 'root-part', nodeType: 'episode', order: 3, title: 'Episode A' },
    { id: 'other-part', parentId: '', nodeType: 'part', order: 20, title: 'Other' },
    { id: 'other-episode', parentId: 'other-part', nodeType: 'episode', order: 0, title: 'Reset' },
    { id: 'nested-section', parentId: 'episode-a', nodeType: 'section', order: 0, title: 'Section' },
  ];

  const labels = buildPlanningChapterOrdinalLabels(chapters.map(record => ({ record, depth: 0 })));
  assert.deepEqual(Object.fromEntries(labels), {
    'root-chapter-a': '第1章',
    'root-chapter-b': '第2章',
    'root-part': '第1部',
    'other-part': '第2部',
    'part-chapter': '第1章',
    'episode-a': '第1話',
    'episode-b': '第2話',
    'other-episode': '第1話',
    'nested-section': '第1節',
  });
  assert.equal(getPlanningChapterOrdinalLabel(chapters[0], chapters), '第2章');
  assert.equal(getPlanningChapterOrdinalLabel(null, chapters), '');
  assert.deepEqual(buildPlanningChapterOrdinalLabels(null), new Map());
});

test('outline ordinal labels follow reorder without mutating legacy stored titles', () => {
  const chapters = [
    { id: 'chapter-a', parentId: '', nodeType: 'chapter', order: 0, title: '第1章 諦めることは、負けることなんだろうか。' },
    { id: 'chapter-b', parentId: '', nodeType: 'chapter', order: 1, title: '第2章 次の題名' },
  ];
  const originalJson = JSON.stringify(chapters);
  assert.equal(getPlanningChapterOrdinalLabel(chapters[0], chapters), '第1章');

  const reordered = chapters.map(record => ({
    ...record,
    order: record.id === 'chapter-a' ? 1 : 0,
  }));
  assert.equal(getPlanningChapterOrdinalLabel(reordered[0], reordered), '第2章');
  assert.equal(getPlanningChapterOrdinalLabel(reordered[1], reordered), '第1章');
  assert.deepEqual(getPlanningChapterPresentation(reordered[0], reordered), {
    ordinalLabel: '第2章',
    displayTitle: '諦めることは、負けることなんだろうか。',
  });
  assert.equal(JSON.stringify(chapters), originalJson);
});

test('outline display title removes one clear Japanese or Arabic legacy ordinal only for presentation', () => {
  for (const [title, expected] of [
    ['第1章 諦めることは、負けることなんだろうか。', '諦めることは、負けることなんだろうか。'],
    ['第一章　漢数字の見出し', '漢数字の見出し'],
    ['第１章：全角数字の見出し', '全角数字の見出し'],
    ['1話 - 数字だけの接頭辞', '数字だけの接頭辞'],
    ['十二節・小見出し', '小見出し'],
    ['第2部—後半', '後半'],
    ['第1章 第2章 タイトル', '第2章 タイトル'],
  ]) {
    assert.equal(getPlanningChapterDisplayTitle(title), expected, title);
  }

  for (const title of [
    '第一章では、何を扱うのか。',
    '第1章',
    '第1章タイトルそのもの',
    '第1巻 タイトル',
    '章立てを考える',
    ' 第1章 先頭空白は意図として残す',
  ]) {
    assert.equal(getPlanningChapterDisplayTitle(title), title, title);
  }
  assert.equal(getPlanningChapterDisplayTitle(null), '');
});

test('outline node type changes renumber both affected type groups and keep a clean title', () => {
  const chapters = [
    { id: 'first', parentId: '', nodeType: 'chapter', order: 0, title: '第1章 章から話へ変える題名' },
    { id: 'second', parentId: '', nodeType: 'chapter', order: 1, title: '第2章 残る章' },
  ];
  const changed = chapters.map(record => record.id === 'first'
    ? { ...record, nodeType: 'episode' }
    : record);

  assert.deepEqual(getPlanningChapterPresentation(changed[0], changed), {
    ordinalLabel: '第1話',
    displayTitle: '章から話へ変える題名',
  });
  assert.deepEqual(getPlanningChapterPresentation(changed[1], changed), {
    ordinalLabel: '第1章',
    displayTitle: '残る章',
  });
  assert.equal(chapters[0].title, '第1章 章から話へ変える題名');
});

test('shared Markdown derives current ordinals while shared JSON preserves legacy titles', () => {
  let data = createEmptyPlanningNotes();
  for (const values of [
    { id: 'legacy-first', order: 0, title: '第1章 古い先頭番号を持つ題名' },
    { id: 'legacy-second', order: 1, title: '第2章 次の題名' },
  ]) {
    data = addRecord(data, 'chapters', createPlanningRecord('chapters', values, {
      now: fixedNow,
      idFactory: idFactory(values.id),
    }));
  }
  data = createPlanningOutlineSnapshot(data, { kind: 'draft', label: '並べ替え前の仮目次' }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('legacy-draft-snapshot'),
  });
  data = createPlanningOutlineSnapshot(data, { kind: 'confirmed', label: '並べ替え前の確定目次' }, {
    expectedOutlineRevision: data.outlineRevision,
    expectedChapterOrderRevision: data.chapterOrderRevision,
    now: fixedNow,
    idFactory: idFactory('legacy-confirmed-snapshot'),
  });
  data = movePlanningChapter(data, 'legacy-first', 'down', {
    expectedRevision: data.chapterOrderRevision,
  });

  const share = buildPlanningNotesSharePackage(data, { bookTitle: '自動番号テスト', now: fixedNow });
  assert.equal(
    share.data.chapters.find(record => record.id === 'legacy-first').title,
    '第1章 古い先頭番号を持つ題名',
  );
  const markdown = planningNotesShareToMarkdown(share);
  const outlineList = markdown.slice(
    markdown.indexOf('### 仮目次（編集中）'),
    markdown.indexOf('#### 構成項目の詳細'),
  );
  assert.match(outlineList, /- 第1章：次の題名/);
  assert.match(outlineList, /- 第2章：古い先頭番号を持つ題名/);
  assert.doesNotMatch(outlineList, /第[12]章：第[12]章/);
  const confirmedBlock = markdown.slice(
    markdown.indexOf('### 現在の確定目次'),
    markdown.indexOf('### 過去の目次（新しい順）'),
  );
  assert.match(confirmedBlock, /- 第1章：古い先頭番号を持つ題名/);
  assert.match(confirmedBlock, /- 第2章：次の題名/);
  assert.doesNotMatch(confirmedBlock, /第[12]章：第[12]章/);
  const historyBlock = markdown.slice(
    markdown.indexOf('### 過去の目次（新しい順）'),
    markdown.indexOf('## 競合・市場調査'),
  );
  assert.match(historyBlock, /- 第1章：古い先頭番号を持つ題名/);
  assert.match(historyBlock, /- 第2章：次の題名/);
  assert.doesNotMatch(historyBlock, /第[12]章：第[12]章/);
  assert.match(markdown, /"title": "第1章 古い先頭番号を持つ題名"/);
});

test('shared Markdown excludes rejected history from active ordinals and labels it without a number', () => {
  let data = createEmptyPlanningNotes();
  for (const values of [
    { id: 'rejected-first', order: 0, title: '第1章 採用しなかった旧案', status: 'rejected' },
    { id: 'active-after-rejected', order: 1, title: '第2章 現在採用している章' },
  ]) {
    data = addRecord(data, 'chapters', createPlanningRecord('chapters', values, {
      now: fixedNow,
      idFactory: idFactory(values.id),
    }));
  }

  const share = buildPlanningNotesSharePackage(data, { bookTitle: '採用状態の採番テスト', now: fixedNow });
  const markdown = planningNotesShareToMarkdown(share);
  const outlineBlock = markdown.slice(
    markdown.indexOf('### 仮目次（編集中）'),
    markdown.indexOf('### 現在の確定目次'),
  );
  const visibleList = outlineBlock.slice(0, outlineBlock.indexOf('#### 構成項目の詳細'));
  const completeHistory = outlineBlock.slice(outlineBlock.indexOf('#### 構成項目の詳細'));

  assert.match(visibleList, /- 第1章：現在採用している章/);
  assert.doesNotMatch(visibleList, /採用しなかった旧案/);
  assert.match(completeHistory, /##### 章：採用しなかった旧案 ／ 採用しない（履歴）/);
  assert.doesNotMatch(completeHistory, /##### 第\d+章：採用しなかった旧案/);
  assert.match(completeHistory, /##### 第1章：現在採用している章/);
  assert.equal(
    share.data.chapters.find(record => record.id === 'rejected-first').title,
    '第1章 採用しなかった旧案',
  );
});

test('GPTセッションは連番を提案し、非公開会話URLを安全にローカル保存できる', () => {
  let data = createEmptyPlanningNotes();
  assert.equal(getNextPlanningGptManagementId(data), 'GPT-001');
  const record = createPlanningGptSessionRecord(data, {
    projectTitle: '一冊目',
    sessionName: '企画と目次',
    gptUrl: 'https://chatgpt.com/c/private-conversation-id',
    scope: '企画から目次確定まで',
    sessionStatus: 'active',
    startedOn: '2026-08-16',
    handoffMemo: '現在地：目次確定待ち',
    notes: '著者用メモ',
  }, { now: fixedNow, idFactory: idFactory('gpt-session-1') });
  data = upsertPlanningGptSession(data, record, { expectedUpdatedAt: null, now: fixedNow });

  assert.equal(data.gptSessions[0].managementId, 'GPT-001');
  assert.equal(data.gptSessions[0].gptUrl, 'https://chatgpt.com/c/private-conversation-id');
  assert.equal(data.gptSessions[0].startedOn, '2026-08-16');
  assert.equal(
    readPlanningNotes(serializePlanningNotes(data)).data.gptSessions[0].startedOn,
    '2026-08-16',
  );
  assert.equal(getNextPlanningGptManagementId(data), 'GPT-002');
  assert.equal(validatePlanningGptSessionUrl('https://chat.openai.com/c/private-id'), 'https://chat.openai.com/c/private-id');
  for (const invalid of [
    'http://chatgpt.com/c/insecure',
    'https://user:pass@chatgpt.com/c/private',
    'https://chatgpt.com/c/private?token=secret',
    'https://chatgpt.com/c/private#sessionId=secret',
  ]) {
    assert.throws(() => validatePlanningGptSessionUrl(invalid), /URL|URLは保存できません/);
  }
});

test('GPT引継ぎ先の作成と使用開始は新旧を原子的につなぐ', () => {
  const firstNow = () => new Date('2026-08-14T00:00:00.000Z');
  const handoffNow = () => new Date('2026-08-15T00:00:00.000Z');
  const activateNow = () => new Date('2026-08-16T00:00:00.000Z');
  let data = createEmptyPlanningNotes();
  const sourceDraft = createPlanningGptSessionRecord(data, {
    sessionName: '第1世代', sessionStatus: 'active', startedOn: '2026-08-01',
  }, { now: firstNow, idFactory: idFactory('gpt-source') });
  data = upsertPlanningGptSession(data, sourceDraft, { expectedUpdatedAt: null, now: firstNow });
  const source = data.gptSessions[0];
  const targetDraft = createPlanningGptSessionRecord(data, {
    sessionName: '第2世代', handoffMemo: '現在地と未確定事項', startedOn: '2026-08-15',
  }, { now: handoffNow, idFactory: idFactory('gpt-target') });

  data = createPlanningGptHandoffTarget(data, source.id, targetDraft, {
    expectedUpdatedAt: source.updatedAt,
    now: handoffNow,
    idFactory: idFactory('gpt-target'),
  });
  const linkedSource = data.gptSessions.find(record => record.id === source.id);
  const target = data.gptSessions.find(record => record.managementId === linkedSource.handoffToId);
  assert.equal(linkedSource.sessionStatus, 'active');
  assert.equal(target.sessionStatus, 'on_hold');
  assert.equal(linkedSource.handoffToId, 'GPT-002');

  data = activatePlanningGptSession(data, target.id, {
    expectedTargetUpdatedAt: target.updatedAt,
    expectedSourceUpdatedAt: linkedSource.updatedAt,
    now: activateNow,
  });
  assert.equal(data.gptSessions.find(record => record.id === source.id).sessionStatus, 'handed_over');
  assert.equal(data.gptSessions.find(record => record.id === target.id).sessionStatus, 'active');
  assert.throws(
    () => deletePlanningGptSession(data, source.id, {
      expectedUpdatedAt: data.gptSessions.find(record => record.id === source.id).updatedAt,
    }),
    /引継ぎ先ID/,
  );
});

test('GPT管理ID・使用中・引継ぎ関係の不整合を拒否する', () => {
  const base = createEmptyPlanningNotes();
  const first = createPlanningGptSessionRecord(base, {
    managementId: 'GPT-001', sessionName: '一件目', sessionStatus: 'active',
  }, { now: fixedNow, idFactory: idFactory('gpt-first') });
  const withFirst = upsertPlanningGptSession(base, first, { expectedUpdatedAt: null, now: fixedNow });
  const second = createPlanningGptSessionRecord(withFirst, {
    managementId: 'GPT-002', sessionName: '二件目', sessionStatus: 'on_hold',
  }, { now: fixedNow, idFactory: idFactory('gpt-second') });
  const data = upsertPlanningGptSession(withFirst, second, { expectedUpdatedAt: null, now: fixedNow });

  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      gptSessions: data.gptSessions.map(record => ({ ...record, sessionStatus: 'active' })),
    }),
    /1件だけ/,
  );
  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      gptSessions: data.gptSessions.map(record => record.id === first.id
        ? { ...record, sessionStatus: 'handed_over', handoffToId: '' }
        : record),
    }),
    /引継ぎ先IDが必要/,
  );
  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      gptSessions: data.gptSessions.map(record => record.id === first.id
        ? { ...record, handoffToId: 'GPT-999' }
        : record),
    }),
    /見つかりません/,
  );
  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      gptSessions: data.gptSessions.map(record => ({
        ...record,
        sessionStatus: 'on_hold',
        handoffToId: record.id === first.id ? 'GPT-002' : 'GPT-001',
      })),
    }),
    /循環/,
  );
  assert.throws(
    () => upsertPlanningGptSession(data, { ...first, managementId: 'GPT-003' }, {
      expectedUpdatedAt: first.updatedAt,
      now: fixedNow,
    }),
    /作成後に変更できません/,
  );
});

test('GPT管理IDは過剰なゼロ埋めを許さず正規表記だけを受け付ける', () => {
  for (const managementId of ['GPT-001', 'GPT-999', 'GPT-1000']) {
    const record = createPlanningGptSessionRecord(createEmptyPlanningNotes(), {
      managementId,
      sessionName: '正規表記の確認',
    }, { now: fixedNow, idFactory: idFactory(`gpt-canonical-${managementId}`) });
    assert.equal(record.managementId, managementId);
  }

  for (const managementId of ['GPT-0001', 'GPT-01', 'gpt-001']) {
    assert.throws(
      () => createPlanningGptSessionRecord(createEmptyPlanningNotes(), {
        managementId,
        sessionName: '非正規表記の確認',
      }, { now: fixedNow, idFactory: idFactory(`gpt-invalid-${managementId}`) }),
      /GPT-001/,
    );
  }
});

test('GPTセッションは使用中を先頭に保ちつつ開始日順を切り替えられる', () => {
  const records = [
    { id: 'old', managementId: 'GPT-001', sessionStatus: 'completed', startedOn: '2026-08-01', createdAt: '2026-08-01T00:00:00.000Z' },
    { id: 'active', managementId: 'GPT-002', sessionStatus: 'active', startedOn: '2026-08-02', createdAt: '2026-08-02T00:00:00.000Z' },
    { id: 'new', managementId: 'GPT-003', sessionStatus: 'on_hold', startedOn: '2026-08-03', createdAt: '2026-08-03T00:00:00.000Z' },
  ];
  assert.deepEqual(sortPlanningGptSessions(records).map(record => record.id), ['active', 'new', 'old']);
  assert.deepEqual(
    sortPlanningGptSessions(records, { direction: 'oldest' }).map(record => record.id),
    ['active', 'old', 'new'],
  );
});

test('v1〜v7をv8へ安全に移行し、各版で必須のGPT管理項目の欠落を停止する', () => {
  for (const version of [1, 2, 3, 4, 5, 6]) {
    const legacy = { ...createEmptyPlanningNotes(), version };
    delete legacy.gptSessions;
    delete legacy.critiqueGptSessions;
    delete legacy.gptHandoffTemplates;
    if (version <= 4) delete legacy.draftOutlineChapterIds;
    if (version <= 5) delete legacy.chapterWritingStates;
    const migrated = normalizePlanningNotes(legacy);
    assert.deepEqual(migrated.gptSessions, []);
    assert.deepEqual(migrated.critiqueGptSessions, []);
    assert.deepEqual(migrated.gptHandoffTemplates, createDefaultPlanningGptHandoffTemplates());
  }
  const legacyV7 = { ...createEmptyPlanningNotes(), version: 7 };
  delete legacyV7.critiqueGptSessions;
  delete legacyV7.gptHandoffTemplates;
  const migratedV7 = normalizePlanningNotes(legacyV7);
  assert.equal(migratedV7.version, 8);
  assert.deepEqual(migratedV7.critiqueGptSessions, []);
  assert.deepEqual(migratedV7.gptHandoffTemplates, createDefaultPlanningGptHandoffTemplates());

  const brokenV7 = { ...legacyV7 };
  delete brokenV7.gptSessions;
  assert.throws(() => normalizePlanningNotes(brokenV7), /GPT管理の一覧/);
  assert.throws(
    () => normalizePlanningNotes({ ...createEmptyPlanningNotes(), gptSessions: null }),
    /GPT管理の一覧/,
  );
  assert.throws(
    () => normalizePlanningNotes({ ...createEmptyPlanningNotes(), version: 6, gptSessions: null }),
    /配列ではありません/,
  );
  for (const field of ['critiqueGptSessions', 'gptHandoffTemplates']) {
    const brokenV8 = { ...createEmptyPlanningNotes() };
    delete brokenV8[field];
    assert.throws(() => normalizePlanningNotes(brokenV8), /GPT管理|GPT引継ぎテンプレート/);
    assert.throws(
      () => normalizePlanningNotes({ ...createEmptyPlanningNotes(), [field]: null }),
      /GPT管理|GPT引継ぎテンプレート/,
    );
  }
});

test('GPTセッションのURLと引継ぎメモは共有JSONとMarkdownからコレクションごと除外する', () => {
  let data = createEmptyPlanningNotes();
  const record = createPlanningGptSessionRecord(data, {
    sessionName: '非公開セッション',
    gptUrl: 'https://chatgpt.com/c/PRIVATE-CONVERSATION-123',
    handoffMemo: 'session_id: PRIVATE-SESSION-456\n未公開の原稿一覧',
    notes: '外部共有しない',
    sessionStatus: 'active',
  }, { now: fixedNow, idFactory: idFactory('gpt-private') });
  data = upsertPlanningGptSession(data, record, { expectedUpdatedAt: null, now: fixedNow });
  const share = buildPlanningNotesSharePackage(data, { now: fixedNow });
  assert.deepEqual(share.data.gptSessions, []);
  const json = JSON.stringify(share);
  const markdown = planningNotesShareToMarkdown(share);
  for (const secret of ['PRIVATE-CONVERSATION-123', 'PRIVATE-SESSION-456', '未公開の原稿一覧']) {
    assert.doesNotMatch(json, new RegExp(secret));
    assert.doesNotMatch(markdown, new RegExp(secret));
  }
  assert.match(share.note, /Kindle出版サポートGPT管理[・の]/);
  assert.doesNotMatch(markdown, /## Kindle出版サポートGPT管理/);
});

test('GPTセッションの復元結合は和集合を保ち、ID・使用中の競合を停止する', () => {
  const makeData = (id, managementId, sessionName, sessionStatus = 'on_hold') => {
    let data = createEmptyPlanningNotes();
    const record = createPlanningGptSessionRecord(data, {
      managementId, sessionName, sessionStatus,
    }, { now: fixedNow, idFactory: idFactory(id) });
    return upsertPlanningGptSession(data, record, { expectedUpdatedAt: null, now: fixedNow });
  };
  const current = makeData('gpt-a', 'GPT-001', 'A');
  const incoming = makeData('gpt-b', 'GPT-002', 'B');
  const merged = readPlanningNotes(mergePlanningNotesValues(
    serializePlanningNotes(current),
    serializePlanningNotes(incoming),
  )).data;
  assert.deepEqual(merged.gptSessions.map(record => record.managementId).sort(), ['GPT-001', 'GPT-002']);

  const duplicateManagementId = makeData('gpt-other', 'GPT-001', '別のA');
  assert.ok(previewPlanningNotesMerge(
    serializePlanningNotes(current),
    serializePlanningNotes(duplicateManagementId),
  ).some(conflict => conflict.reason === 'gpt_management_id_conflict'));
  assert.throws(
    () => mergePlanningNotesValues(
      serializePlanningNotes(current),
      serializePlanningNotes(duplicateManagementId),
    ),
    PlanningNotesMergeConflictError,
  );

  const activeA = makeData('active-a', 'GPT-010', '使用中A', 'active');
  const activeB = makeData('active-b', 'GPT-011', '使用中B', 'active');
  assert.ok(previewPlanningNotesMerge(
    serializePlanningNotes(activeA),
    serializePlanningNotes(activeB),
  ).some(conflict => conflict.reason === 'gpt_active_session_conflict'));
});

test('GPTセッションの結合後が上限1,000件を超える場合は復元前previewで停止する', () => {
  const makeMany = (prefix, startSequence) => normalizePlanningNotes({
    ...createEmptyPlanningNotes(),
    gptSessions: Array.from({ length: 600 }, (_, index) => {
      const sequence = startSequence + index;
      return {
        id: `${prefix}-${sequence}`,
        revision: 1,
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        managementId: `GPT-${String(sequence).padStart(3, '0')}`,
        projectTitle: '',
        sessionName: `${prefix}-${sequence}`,
        gptUrl: '',
        scope: '',
        sessionStatus: 'on_hold',
        startedOn: '',
        handoffToId: '',
        handoffMemo: '',
        notes: '',
      };
    }),
  });
  const currentRaw = serializePlanningNotes(makeMany('current', 1));
  const incomingRaw = serializePlanningNotes(makeMany('incoming', 601));
  const conflicts = previewPlanningNotesMerge(currentRaw, incomingRaw);
  assert.ok(conflicts.some(conflict => (
    conflict.section === 'gptSessions'
    && conflict.reason === 'gpt_session_limit_exceeded'
    && conflict.current.count === 600
    && conflict.incoming.newCount === 600
  )));
  assert.throws(
    () => mergePlanningNotesValues(currentRaw, incomingRaw),
    PlanningNotesMergeConflictError,
  );
});

test('Kindle出版サポートGPTの開始日は画面と同じdraftから保存・再読込後も残る', () => {
  let data = createEmptyPlanningNotes();
  const openedDraft = createPlanningGptSessionRecord(data, {
    sessionName: '開始日の回帰確認',
  }, { now: fixedNow, idFactory: idFactory('support-started-on') });
  const inputDraft = { ...openedDraft, startedOn: '2026-08-17' };
  data = upsertPlanningGptSession(data, inputDraft, {
    expectedUpdatedAt: null,
    now: fixedNow,
  });
  assert.equal(data.gptSessions[0].startedOn, '2026-08-17');
  assert.equal(
    readPlanningNotes(serializePlanningNotes(data)).data.gptSessions[0].startedOn,
    '2026-08-17',
  );
});

test('辛口論評GPTセッションは対象版・論評回・開始日を履歴と分けて安全に保存する', () => {
  let data = createEmptyPlanningNotes();
  assert.equal(getNextPlanningCritiqueGptManagementId(data), 'CRITIQUE-001');
  const draft = createPlanningCritiqueGptSessionRecord(data, {
    sessionName: '第1回の辛口論評',
    gptUrl: 'https://chatgpt.com/c/private-critique-conversation',
    scope: '原稿全体の論理と文体',
    sessionStatus: 'active',
    startedOn: '2026-08-17',
    targetManuscriptVersionId: 'MANUSCRIPT-003',
    critiqueRound: 1,
    handoffMemo: '前回指摘なし',
    notes: '論評結果履歴とは別の管理メモ',
  }, { now: fixedNow, idFactory: idFactory('critique-session-1') });
  data = upsertPlanningCritiqueGptSession(data, draft, {
    expectedUpdatedAt: null,
    now: fixedNow,
  });
  const restored = readPlanningNotes(serializePlanningNotes(data)).data;
  assert.equal(restored.critiqueGptSessions[0].managementId, 'CRITIQUE-001');
  assert.equal(restored.critiqueGptSessions[0].startedOn, '2026-08-17');
  assert.equal(restored.critiqueGptSessions[0].targetManuscriptVersionId, 'MANUSCRIPT-003');
  assert.equal(restored.critiqueGptSessions[0].critiqueRound, 1);
  assert.equal(getNextPlanningCritiqueGptManagementId(restored), 'CRITIQUE-002');
  assert.equal(
    validatePlanningCritiqueGptSessionUrl('https://chat.openai.com/c/private-critique'),
    'https://chat.openai.com/c/private-critique',
  );
  assert.throws(
    () => validatePlanningCritiqueGptSessionUrl('https://chatgpt.com/c/private?token=secret'),
    /URLは保存できません/,
  );
});

test('辛口論評GPTの管理ID・使用中・参照・CASの不整合を拒否する', () => {
  for (const managementId of ['CRITIQUE-001', 'CRITIQUE-999', 'CRITIQUE-1000']) {
    const record = createPlanningCritiqueGptSessionRecord(createEmptyPlanningNotes(), {
      managementId,
      sessionName: '正規表記',
    }, { now: fixedNow, idFactory: idFactory(`valid-${managementId}`) });
    assert.equal(record.managementId, managementId);
  }
  for (const managementId of ['CRITIQUE-0001', 'CRITIQUE-01', 'critique-001']) {
    assert.throws(
      () => createPlanningCritiqueGptSessionRecord(createEmptyPlanningNotes(), {
        managementId,
        sessionName: '非正規表記',
      }, { now: fixedNow, idFactory: idFactory(`invalid-${managementId}`) }),
      /CRITIQUE-001/,
    );
  }

  let data = createEmptyPlanningNotes();
  const active = createPlanningCritiqueGptSessionRecord(data, {
    managementId: 'CRITIQUE-001', sessionName: '使用中', sessionStatus: 'active',
  }, { now: fixedNow, idFactory: idFactory('critique-active') });
  data = upsertPlanningCritiqueGptSession(data, active, {
    expectedUpdatedAt: null, now: fixedNow,
  });
  const standby = createPlanningCritiqueGptSessionRecord(data, {
    managementId: 'CRITIQUE-002', sessionName: '保留', sessionStatus: 'on_hold',
  }, { now: fixedNow, idFactory: idFactory('critique-standby') });
  data = upsertPlanningCritiqueGptSession(data, standby, {
    expectedUpdatedAt: null, now: fixedNow,
  });
  assert.throws(
    () => upsertPlanningCritiqueGptSession(data, { ...standby, notes: '古い画面' }, {
      expectedUpdatedAt: '2026-08-01T00:00:00.000Z', now: fixedNow,
    }),
    /別の画面/,
  );
  assert.throws(
    () => upsertPlanningCritiqueGptSession(data, { ...standby, managementId: 'CRITIQUE-003' }, {
      expectedUpdatedAt: standby.updatedAt, now: fixedNow,
    }),
    /作成後に変更できません/,
  );
  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      critiqueGptSessions: data.critiqueGptSessions
        .map(record => ({ ...record, sessionStatus: 'active' })),
    }),
    /1件だけ/,
  );
  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      critiqueGptSessions: data.critiqueGptSessions.map(record => record.id === standby.id
        ? { ...record, handoffToId: 'CRITIQUE-999' }
        : record),
    }),
    /見つかりません/,
  );
  assert.throws(
    () => normalizePlanningNotes({
      ...data,
      critiqueGptSessions: data.critiqueGptSessions.map(record => ({
        ...record,
        sessionStatus: 'on_hold',
        handoffToId: record.id === active.id ? 'CRITIQUE-002' : 'CRITIQUE-001',
      })),
    }),
    /循環/,
  );
  assert.throws(
    () => deletePlanningCritiqueGptSession(data, active.id, {
      expectedUpdatedAt: active.updatedAt,
      now: fixedNow,
    }),
    /使用中/,
  );
});

test('辛口論評GPTの引継ぎ先作成と使用開始は新旧を原子的に更新する', () => {
  const firstNow = () => new Date('2026-08-14T00:00:00.000Z');
  const handoffNow = () => new Date('2026-08-15T00:00:00.000Z');
  const activateNow = () => new Date('2026-08-16T00:00:00.000Z');
  let data = createEmptyPlanningNotes();
  const sourceDraft = createPlanningCritiqueGptSessionRecord(data, {
    sessionName: '論評第1世代', sessionStatus: 'active', critiqueRound: 1,
  }, { now: firstNow, idFactory: idFactory('critique-source') });
  data = upsertPlanningCritiqueGptSession(data, sourceDraft, {
    expectedUpdatedAt: null, now: firstNow,
  });
  const source = data.critiqueGptSessions[0];
  data = createPlanningCritiqueGptHandoffTarget(data, source.id, {
    sessionName: '論評第2世代',
    targetManuscriptVersionId: 'MANUSCRIPT-004',
    critiqueRound: 2,
    startedOn: '2026-08-15',
  }, {
    expectedUpdatedAt: source.updatedAt,
    now: handoffNow,
    idFactory: idFactory('critique-target'),
  });
  const linkedSource = data.critiqueGptSessions.find(record => record.id === source.id);
  const target = data.critiqueGptSessions
    .find(record => record.managementId === linkedSource.handoffToId);
  assert.equal(linkedSource.sessionStatus, 'active');
  assert.equal(linkedSource.handoffToId, 'CRITIQUE-002');
  assert.equal(target.sessionStatus, 'on_hold');
  assert.equal(target.startedOn, '2026-08-15');
  data = activatePlanningCritiqueGptSession(data, target.id, {
    expectedTargetUpdatedAt: target.updatedAt,
    expectedSourceUpdatedAt: linkedSource.updatedAt,
    now: activateNow,
  });
  assert.equal(
    data.critiqueGptSessions.find(record => record.id === source.id).sessionStatus,
    'handed_over',
  );
  assert.equal(
    data.critiqueGptSessions.find(record => record.id === target.id).sessionStatus,
    'active',
  );
  assert.throws(
    () => deletePlanningCritiqueGptSession(data, source.id, {
      expectedUpdatedAt: data.critiqueGptSessions.find(record => record.id === source.id).updatedAt,
    }),
    /引継ぎ先ID/,
  );
});

test('辛口論評GPT一覧は使用中を先頭にして開始日順を安定して切り替える', () => {
  const records = [
    { id: 'old', managementId: 'CRITIQUE-001', sessionStatus: 'completed', startedOn: '2026-08-01', createdAt: '2026-08-01T00:00:00.000Z' },
    { id: 'active', managementId: 'CRITIQUE-002', sessionStatus: 'active', startedOn: '2026-08-02', createdAt: '2026-08-02T00:00:00.000Z' },
    { id: 'new', managementId: 'CRITIQUE-003', sessionStatus: 'on_hold', startedOn: '2026-08-03', createdAt: '2026-08-03T00:00:00.000Z' },
  ];
  assert.deepEqual(
    sortPlanningCritiqueGptSessions(records).map(record => record.id),
    ['active', 'new', 'old'],
  );
  assert.deepEqual(
    sortPlanningCritiqueGptSessions(records, { direction: 'oldest' }).map(record => record.id),
    ['active', 'old', 'new'],
  );
});

test('GPT引継ぎテンプレートは空overrideと組込既定文を分け、安全な値だけを差し込む', () => {
  const data = createEmptyPlanningNotes();
  assert.deepEqual(data.gptHandoffTemplates, createDefaultPlanningGptHandoffTemplates());
  for (const kind of ['support', 'critique']) {
    const defaults = getDefaultPlanningGptHandoffTemplate(kind);
    assert.equal((defaults.handoffDocumentInstruction.match(/^\d+\./gm) || []).length, 10);
    assert.match(defaults.handoffStartMessage, /確定.*勝手に変え/);
    assert.match(defaults.handoffStartMessage, /未確定.*確定扱いせず/);
    assert.match(defaults.handoffStartMessage, /無断で上書き/);
    assert.match(defaults.handoffStartMessage, /不足・矛盾/);
    assert.match(defaults.handoffStartMessage, /著者.*承認.*再開/);
  }
  const supportDefaults = getDefaultPlanningGptHandoffTemplate('support');
  assert.match(supportDefaults.handoffDocumentInstruction, /本人の言葉とAIの提案を分け/);
  assert.match(supportDefaults.handoffDocumentInstruction, /確定.*仮.*未確認/);
  const resolved = resolvePlanningGptHandoffTemplates(data, 'support');
  assert.equal(
    resolved.handoffDocumentInstruction,
    supportDefaults.handoffDocumentInstruction,
  );

  const rendered = renderPlanningGptHandoffTemplate(
    'support',
    '{{作品名}}|{{現ID}}|{{次ID候補}}|{{担当範囲}}|{{URL}}',
    {
      projectTitle: '公開資料 https://example.com/book',
      currentManagementId: 'GPT-001',
      nextManagementId: 'GPT-002',
      scope: '企画から目次',
      gptUrl: 'https://chatgpt.com/c/SHOULD-NOT-BE-USED',
    },
  );
  assert.match(rendered, /https:\/\/example\.com\/book/);
  assert.match(rendered, /GPT-001\|GPT-002/);
  assert.match(rendered, /\{\{URL\}\}/);
  assert.doesNotMatch(rendered, /SHOULD-NOT-BE-USED/);
  assert.match(
    renderPlanningGptHandoffTemplate('critique', '{{前回指摘}}', {
      previousFindings: 'https://chatgpt.com/c/PRIVATE-CONVERSATION',
    }),
    /安全のため自動挿入しません/,
  );
});

test('GPT引継ぎテンプレートはCASでoverrideだけを保存し、デフォルトへの復帰は空に圧縮する', () => {
  const base = createEmptyPlanningNotes();
  const defaults = getDefaultPlanningGptHandoffTemplate('support');
  const unchanged = updatePlanningGptHandoffTemplates(base, 'support', defaults, {
    expectedUpdatedAt: '',
    now: fixedNow,
  });
  assert.deepEqual(unchanged.gptHandoffTemplates.support, base.gptHandoffTemplates.support);

  const customized = updatePlanningGptHandoffTemplates(base, 'support', {
    ...defaults,
    handoffStartMessage: '著者承認後に再開する独自文',
  }, { expectedUpdatedAt: '', now: fixedNow });
  assert.equal(customized.gptHandoffTemplates.support.revision, 1);
  assert.equal(
    customized.gptHandoffTemplates.support.handoffDocumentInstruction,
    '',
  );
  assert.equal(
    resolvePlanningGptHandoffTemplates(customized, 'support').handoffStartMessage,
    '著者承認後に再開する独自文',
  );
  assert.throws(
    () => updatePlanningGptHandoffTemplates(customized, 'support', defaults, {
      expectedUpdatedAt: '', now: fixedNow,
    }),
    /別の画面/,
  );
  const reset = updatePlanningGptHandoffTemplates(customized, 'support', defaults, {
    expectedUpdatedAt: customized.gptHandoffTemplates.support.updatedAt,
    now: () => new Date('2026-08-15T00:00:00.000Z'),
  });
  assert.equal(reset.gptHandoffTemplates.support.handoffStartMessage, '');
  assert.equal(
    resolvePlanningGptHandoffTemplates(reset, 'support').handoffStartMessage,
    defaults.handoffStartMessage,
  );
});

test('GPT引継ぎテンプレートの明示リセットは古いバックアップの独自文を復活させない', () => {
  const customizedAt = () => new Date('2026-08-16T00:00:00.000Z');
  const resetAt = () => new Date('2026-08-17T00:00:00.000Z');
  for (const kind of ['support', 'critique']) {
    for (const field of ['handoffDocumentInstruction', 'handoffStartMessage']) {
      const base = createEmptyPlanningNotes();
      const defaults = getDefaultPlanningGptHandoffTemplate(kind);
      const oldCustom = updatePlanningGptHandoffTemplates(base, kind, {
        ...defaults,
        [field]: `${kind}-${field}-OLD-CUSTOM-TEMPLATE`,
      }, {
        expectedUpdatedAt: '',
        now: customizedAt,
      });
      const explicitReset = updatePlanningGptHandoffTemplates(oldCustom, kind, defaults, {
        expectedUpdatedAt: oldCustom.gptHandoffTemplates[kind].updatedAt,
        now: resetAt,
      });
      assert.equal(explicitReset.gptHandoffTemplates[kind].revision, 2);
      assert.equal(explicitReset.gptHandoffTemplates[kind][field], '');

      for (const [current, incoming] of [
        [explicitReset, oldCustom],
        [oldCustom, explicitReset],
      ]) {
        const conflicts = previewPlanningNotesMerge(
          serializePlanningNotes(current),
          serializePlanningNotes(incoming),
        );
        assert.ok(conflicts.some(conflict => (
          conflict.section === 'gptHandoffTemplates'
          && conflict.id === kind
          && conflict.reason === 'gpt_handoff_template_conflict'
        )));
        assert.throws(
          () => mergePlanningNotesValues(
            serializePlanningNotes(current),
            serializePlanningNotes(incoming),
          ),
          PlanningNotesMergeConflictError,
        );
      }

      const pristineMergedWithReset = readPlanningNotes(mergePlanningNotesValues(
        serializePlanningNotes(base),
        serializePlanningNotes(explicitReset),
      )).data;
      assert.deepEqual(
        pristineMergedWithReset.gptHandoffTemplates[kind],
        explicitReset.gptHandoffTemplates[kind],
      );
    }
  }
});

test('revision 0の未編集GPT引継ぎテンプレートは本文overrideを持てない', () => {
  for (const kind of ['support', 'critique']) {
    for (const field of ['handoffDocumentInstruction', 'handoffStartMessage']) {
      const broken = createEmptyPlanningNotes();
      broken.gptHandoffTemplates[kind][field] = '未編集を偽装した独自文';
      assert.throws(
        () => normalizePlanningNotes(broken),
        /未編集テンプレートに本文overrideは保存できません/,
      );
    }
  }
});

test('辛口論評GPT管理と引継ぎテンプレートは共有JSON・Markdownから全体を除外する', () => {
  let data = createEmptyPlanningNotes();
  const record = createPlanningCritiqueGptSessionRecord(data, {
    sessionName: 'PRIVATE-CRITIQUE-NAME',
    gptUrl: 'https://chatgpt.com/c/PRIVATE-CRITIQUE-URL',
    sessionStatus: 'active',
    handoffMemo: 'PRIVATE-CRITIQUE-HANDOFF',
    notes: 'PRIVATE-CRITIQUE-NOTES',
  }, { now: fixedNow, idFactory: idFactory('critique-private') });
  data = upsertPlanningCritiqueGptSession(data, record, {
    expectedUpdatedAt: null, now: fixedNow,
  });
  data = updatePlanningGptHandoffTemplates(data, 'critique', {
    handoffDocumentInstruction: 'PRIVATE-TEMPLATE-DOCUMENT',
    handoffStartMessage: 'PRIVATE-TEMPLATE-START',
  }, { expectedUpdatedAt: '', now: fixedNow });
  const share = buildPlanningNotesSharePackage(data, { now: fixedNow });
  assert.deepEqual(share.data.critiqueGptSessions, []);
  assert.deepEqual(share.data.gptHandoffTemplates, createDefaultPlanningGptHandoffTemplates());
  const json = JSON.stringify(share);
  const markdown = planningNotesShareToMarkdown(share);
  for (const secret of [
    'PRIVATE-CRITIQUE-NAME',
    'PRIVATE-CRITIQUE-URL',
    'PRIVATE-CRITIQUE-HANDOFF',
    'PRIVATE-CRITIQUE-NOTES',
    'PRIVATE-TEMPLATE-DOCUMENT',
    'PRIVATE-TEMPLATE-START',
  ]) {
    assert.doesNotMatch(json, new RegExp(secret));
    assert.doesNotMatch(markdown, new RegExp(secret));
  }
  assert.match(share.note, /辛口論評GPT管理/);
  assert.match(share.note, /GPT引継ぎテンプレート/);
});

test('辛口論評GPTの復元結合は和集合を保ち、ID・使用中・上限・テンプレート差をpreviewで停止する', () => {
  const makeData = (id, managementId, sessionName, sessionStatus = 'on_hold') => {
    let data = createEmptyPlanningNotes();
    const record = createPlanningCritiqueGptSessionRecord(data, {
      managementId, sessionName, sessionStatus,
    }, { now: fixedNow, idFactory: idFactory(id) });
    return upsertPlanningCritiqueGptSession(data, record, {
      expectedUpdatedAt: null, now: fixedNow,
    });
  };
  const current = makeData('critique-a', 'CRITIQUE-001', 'A');
  const incoming = makeData('critique-b', 'CRITIQUE-002', 'B');
  const merged = readPlanningNotes(mergePlanningNotesValues(
    serializePlanningNotes(current),
    serializePlanningNotes(incoming),
  )).data;
  assert.deepEqual(
    merged.critiqueGptSessions.map(record => record.managementId).sort(),
    ['CRITIQUE-001', 'CRITIQUE-002'],
  );
  const duplicateManagementId = makeData('critique-other', 'CRITIQUE-001', '別のA');
  assert.ok(previewPlanningNotesMerge(
    serializePlanningNotes(current),
    serializePlanningNotes(duplicateManagementId),
  ).some(conflict => conflict.reason === 'critique_gpt_management_id_conflict'));
  const activeA = makeData('critique-active-a', 'CRITIQUE-010', '使用中A', 'active');
  const activeB = makeData('critique-active-b', 'CRITIQUE-011', '使用中B', 'active');
  assert.ok(previewPlanningNotesMerge(
    serializePlanningNotes(activeA),
    serializePlanningNotes(activeB),
  ).some(conflict => conflict.reason === 'critique_gpt_active_session_conflict'));

  const currentTemplate = updatePlanningGptHandoffTemplates(current, 'critique', {
    handoffDocumentInstruction: '現在側の独自文',
    handoffStartMessage: '',
  }, { expectedUpdatedAt: '', now: fixedNow });
  const incomingTemplate = updatePlanningGptHandoffTemplates(incoming, 'critique', {
    handoffDocumentInstruction: '入力側の独自文',
    handoffStartMessage: '',
  }, { expectedUpdatedAt: '', now: fixedNow });
  assert.ok(previewPlanningNotesMerge(
    serializePlanningNotes(currentTemplate),
    serializePlanningNotes(incomingTemplate),
  ).some(conflict => conflict.reason === 'gpt_handoff_template_conflict'));

  const makeMany = (prefix, startSequence) => normalizePlanningNotes({
    ...createEmptyPlanningNotes(),
    critiqueGptSessions: Array.from({ length: 600 }, (_, index) => {
      const sequence = startSequence + index;
      return {
        id: `${prefix}-${sequence}`,
        revision: 1,
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        managementId: `CRITIQUE-${String(sequence).padStart(3, '0')}`,
        sessionName: `${prefix}-${sequence}`,
        gptUrl: '',
        scope: '',
        sessionStatus: 'on_hold',
        startedOn: '',
        targetManuscriptVersionId: '',
        critiqueRound: 0,
        handoffToId: '',
        handoffMemo: '',
        notes: '',
      };
    }),
  });
  const limitConflicts = previewPlanningNotesMerge(
    serializePlanningNotes(makeMany('current-critique', 1)),
    serializePlanningNotes(makeMany('incoming-critique', 601)),
  );
  assert.ok(limitConflicts.some(conflict => (
    conflict.reason === 'critique_gpt_session_limit_exceeded'
    && conflict.current.count === 600
    && conflict.incoming.newCount === 600
  )));
  assert.throws(
    () => normalizePlanningNotes({
      ...createEmptyPlanningNotes(),
      gptHandoffTemplates: {
        ...createDefaultPlanningGptHandoffTemplates(),
        critique: {
          ...createDefaultPlanningGptHandoffTemplates().critique,
          handoffDocumentInstruction: 'x'.repeat(100_001),
        },
      },
    }),
    /文字数が上限/,
  );
});
