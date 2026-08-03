import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelPendingSaves,
  clearSaveError,
  flushPendingSaves,
  getPendingSaveCount,
  hasUnresolvedSaveErrors,
  retryFailedSaves,
  scheduleCoordinatedSave,
} from '../src/lib/saveCoordinator.js';

test.afterEach(() => {
  cancelPendingSaves();
  clearSaveError();
});

test('同じ保存キーは最新処理だけを残す', async () => {
  const calls = [];
  scheduleCoordinatedSave('project:1', async () => calls.push('old'), 10000);
  scheduleCoordinatedSave('project:1', async () => calls.push('new'), 10000);
  assert.equal(getPendingSaveCount(), 1);
  await flushPendingSaves();
  assert.deepEqual(calls, ['new']);
  assert.equal(getPendingSaveCount(), 0);
});

test('異なる保存キーをすべて flush する', async () => {
  const calls = [];
  scheduleCoordinatedSave('a', async () => calls.push('a'), 10000);
  scheduleCoordinatedSave('b', async () => calls.push('b'), 10000);
  await flushPendingSaves();
  assert.deepEqual(calls.sort(), ['a', 'b']);
});

test('異なる保存キーも読み書きが重ならないよう順番に実行する', async () => {
  const calls = [];
  let releaseFirst;
  const firstGate = new Promise(resolve => { releaseFirst = resolve; });

  scheduleCoordinatedSave('a', async () => {
    calls.push('a:start');
    await firstGate;
    calls.push('a:end');
  }, 10000);
  scheduleCoordinatedSave('b', async () => {
    calls.push('b:start');
    calls.push('b:end');
  }, 10000);

  const flushing = flushPendingSaves();
  await Promise.resolve();
  assert.deepEqual(calls, ['a:start']);
  releaseFirst();
  await flushing;
  assert.deepEqual(calls, ['a:start', 'a:end', 'b:start', 'b:end']);
});

test('タイマーから開始済みの保存も flush が完了まで待つ', async () => {
  let releaseSave;
  const gate = new Promise(resolve => { releaseSave = resolve; });
  let saveFinished = false;

  scheduleCoordinatedSave('already-running', async () => {
    await gate;
    saveFinished = true;
  }, 0);

  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(getPendingSaveCount(), 1);

  let flushFinished = false;
  const flushing = flushPendingSaves().then(() => { flushFinished = true; });
  await Promise.resolve();
  assert.equal(flushFinished, false);

  releaseSave();
  await flushing;
  assert.equal(saveFinished, true);
  assert.equal(flushFinished, true);
  assert.equal(getPendingSaveCount(), 0);
});

test('保存失敗を flush 呼び出し元へ返す', async () => {
  scheduleCoordinatedSave('failed', async () => {
    throw new Error('容量不足');
  }, 10000);
  await assert.rejects(flushPendingSaves(), /容量不足/);
});

test('失敗した保存を再試行し、成功後に未解決エラーを解除する', async () => {
  let attempts = 0;
  scheduleCoordinatedSave('retryable', async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('一時的な保存失敗');
  }, 10000);

  await assert.rejects(flushPendingSaves(), /一時的な保存失敗/);
  assert.equal(hasUnresolvedSaveErrors(), true);

  await retryFailedSaves();
  assert.equal(attempts, 2);
  assert.equal(hasUnresolvedSaveErrors(), false);
  assert.equal(getPendingSaveCount(), 0);
});

test('同じキーの新しい保存が実行中なら古い失敗処理を再実行しない', async () => {
  let oldAttempts = 0;
  scheduleCoordinatedSave('same-key', async () => {
    oldAttempts += 1;
    throw new Error('古い保存失敗');
  }, 10000);
  await assert.rejects(flushPendingSaves(), /古い保存失敗/);

  let signalStarted;
  let releaseNewSave;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const gate = new Promise(resolve => { releaseNewSave = resolve; });
  scheduleCoordinatedSave('same-key', async () => {
    signalStarted();
    await gate;
  }, 0);

  await started;
  const retrying = retryFailedSaves();
  releaseNewSave();
  await retrying;

  assert.equal(oldAttempts, 1);
  assert.equal(hasUnresolvedSaveErrors(), false);
});
