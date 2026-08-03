import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCritiqueDraftScores,
  parseCritiqueScore,
  parseOptionalFiniteNumber,
  readCritiqueManuscriptState,
  resolveCritiqueManuscript,
  shouldNotifyCritiqueHistoryChange,
  serializeCritiqueDraftScores,
  validateCritiqueDraftScores,
} from './critiqueScoreUi.js';

const AXES = ['originality', 'expertise', 'evidence'];

test('未評価値を0へ変換せずnullとして扱う', () => {
  assert.equal(parseCritiqueScore(null), null);
  assert.equal(parseCritiqueScore(undefined), null);
  assert.equal(parseCritiqueScore(''), null);
  assert.equal(parseCritiqueScore(0), null);
  assert.equal(parseCritiqueScore('3'), 3);
});

test('同じプロジェクトの履歴が編集中に更新された場合だけ下書き保持通知を出す', () => {
  assert.equal(shouldNotifyCritiqueHistoryChange({
    previousProjectId: 'p1',
    currentProjectId: 'p1',
    previousHistory: 'old',
    currentHistory: 'new',
    draftOpen: true,
  }), true);
  assert.equal(shouldNotifyCritiqueHistoryChange({
    previousProjectId: 'p1',
    currentProjectId: 'p2',
    previousHistory: 'old',
    currentHistory: 'new',
    draftOpen: true,
  }), false);
  assert.equal(shouldNotifyCritiqueHistoryChange({
    previousProjectId: 'p1',
    currentProjectId: 'p1',
    previousHistory: 'old',
    currentHistory: 'new',
    draftOpen: false,
  }), false);
});

test('新規だけ3点で初期化し、既存の未評価は空欄を維持する', () => {
  const source = { originality: null, expertise: '', evidence: 4 };

  assert.deepEqual(buildCritiqueDraftScores(source, AXES, { isNew: false }), {
    originality: '',
    expertise: '',
    evidence: 4,
  });
  assert.deepEqual(buildCritiqueDraftScores(source, AXES, { isNew: true }), {
    originality: 3,
    expertise: 3,
    evidence: 4,
  });
});

test('既存編集は未評価を許可し、値がある評価点だけ1〜5へ制限する', () => {
  assert.equal(validateCritiqueDraftScores({ originality: '', expertise: null, evidence: 5 }, AXES), true);
  assert.equal(validateCritiqueDraftScores({ originality: '', expertise: 3, evidence: 5 }, AXES, { requireAll: true }), false);
  assert.equal(validateCritiqueDraftScores({ originality: 6, expertise: 3, evidence: 5 }, AXES), false);
  assert.equal(validateCritiqueDraftScores({ originality: 1, expertise: 3, evidence: 5 }, AXES, { requireAll: true }), true);
});

test('保存用スコアは未評価をnullのまま保持する', () => {
  assert.deepEqual(serializeCritiqueDraftScores({ originality: '', expertise: null, evidence: '5' }, AXES), {
    originality: null,
    expertise: null,
    evidence: 5,
  });
});

test('平均・差分用の数値変換でも空値を0にしない', () => {
  assert.equal(parseOptionalFiniteNumber(null), null);
  assert.equal(parseOptionalFiniteNumber(undefined), null);
  assert.equal(parseOptionalFiniteNumber(''), null);
  assert.equal(parseOptionalFiniteNumber('3.4'), 3.4);
});

test('原稿調整ツールで空にした本文を旧原稿へ戻さない', () => {
  assert.equal(resolveCritiqueManuscript({ sharedText: '' }, '旧原稿'), '');
  assert.equal(resolveCritiqueManuscript({ sharedText: '調整後原稿' }, '旧原稿'), '調整後原稿');
  assert.equal(resolveCritiqueManuscript({}, '旧原稿'), '旧原稿');
});

test('原稿調整キー不在時だけ旧原稿へ戻し、存在する破損データは停止する', () => {
  assert.equal(readCritiqueManuscriptState(null, '旧原稿'), '旧原稿');
  assert.equal(readCritiqueManuscriptState('{"sharedText":""}', '旧原稿'), '');
  assert.throws(() => readCritiqueManuscriptState('{broken', '旧原稿'), /コピーを停止/);
  assert.throws(() => readCritiqueManuscriptState('{}', '旧原稿'), /保存形式/);
});
