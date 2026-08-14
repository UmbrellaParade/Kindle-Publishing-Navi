import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROJECT_FIELD_ALLOWLIST } from '../src/lib/dataBackup.js';

const scheduleCardSource = readFileSync(
  new URL('../src/components/ReleaseScheduleCard.jsx', import.meta.url),
  'utf8',
);
const kdpChecklistSource = readFileSync(
  new URL('../src/components/tabs/KdpChecklistTab.jsx', import.meta.url),
  'utf8',
);
const entitySchemaSource = readFileSync(
  new URL('../base44/entities/PublishingProject.jsonc', import.meta.url),
  'utf8',
);

test('仮リリース日は正式日とKDP設定から明確に分離して案内する', () => {
  [
    '発売目標日（正式）',
    '仮リリース日（計画用）',
    '1か月後を仮設定',
    '仮日だけ保存',
    'この仮日で逆算',
    '仮日を正式欄へコピー',
    '仮日を設定しても、KDPの発売日・予約注文・配信方法は決まりません',
    '正式な発売目標日・KDP設定・配信方法は変更していません',
  ].forEach(phrase => assert.match(scheduleCardSource, new RegExp(phrase)));

  assert.match(kdpChecklistSource, /savedReleaseMethod = project\?\.release_method \|\| project\?\.schedule_mode \|\| ''/);
  assert.match(kdpChecklistSource, /配信方法：\{releaseMethod\?\.shortLabel \|\| '未設定'\}/);
  assert.match(kdpChecklistSource, /仮リリース日だけでは配信方法は決まりません/);
});

test('日付入力だけでは保存せず、明示ボタンからだけ保存・逆算する', () => {
  assert.match(
    scheduleCardSource,
    /id="provisional-release-date"[\s\S]*?onChange=\{event => setProvisionalDate\(event\.target\.value\)\}/,
  );
  assert.match(scheduleCardSource, /onClick=\{setOneMonthProvisionalDate\}/);
  assert.match(scheduleCardSource, /saveProvisionalDate\([\s\S]*?'save-one-month'/);
  assert.match(scheduleCardSource, /onClick=\{\(\) => applySchedule\(SCHEDULE_DATE_SOURCE_PROVISIONAL, false\)\}/);
  assert.match(scheduleCardSource, /syncReleaseScheduleDrafts\([\s\S]*?previousSaved, nextSaved\)/);
  assert.match(scheduleCardSource, /project\?\.id,[\s\S]*?project\?\.release_target_date/);
});

test('日付を戻す4操作は互いに独立し、強い全消去だけ二段階確認する', () => {
  [
    '仮日だけ未設定に戻す',
    '発売目標日だけ未設定に戻す',
    '自動入力した日程だけ消す',
    '手動日を含むすべての日程を消す',
  ].forEach(phrase => assert.match(scheduleCardSource, new RegExp(phrase)));

  assert.match(scheduleCardSource, /消えるもの：仮リリース日だけ/);
  assert.match(scheduleCardSource, /消えるもの：正式な発売目標日だけ/);
  assert.match(scheduleCardSource, /最終確認です。手動で入力した日付も含め/);
  assert.match(scheduleCardSource, /expectedSnapshot[\s\S]*latestSnapshot/);
  assert.match(scheduleCardSource, /expectedOverwriteSnapshot[\s\S]*getScheduleRevisionSnapshot\(latest\)/);
  assert.match(scheduleCardSource, /releaseTargetDate: project\?\.release_target_date \|\| ''/);
  assert.match(scheduleCardSource, /provisionalReleaseDate: project\?\.provisional_release_date \|\| ''/);
  assert.match(scheduleCardSource, /operationGenerationRef/);
  assert.match(
    scheduleCardSource,
    /if \(canApplyOperationResult\(targetProjectId, operationGeneration\)\) \{[\s\S]*?toast\.success/,
  );
});

test('仮日と逆算元はバックアップ許可項目と共有スキーマに含まれる', () => {
  assert.equal(PROJECT_FIELD_ALLOWLIST.includes('provisional_release_date'), true);
  assert.equal(PROJECT_FIELD_ALLOWLIST.includes('schedule_date_source'), true);
  assert.match(entitySchemaSource, /"provisional_release_date"/);
  assert.match(entitySchemaSource, /"schedule_date_source"/);
});

test('日付・配信方法・主要操作は説明付きで44px以上の操作域を持つ', () => {
  assert.match(scheduleCardSource, /htmlFor="release-target-date"/);
  assert.match(scheduleCardSource, /aria-describedby="release-target-date-help"/);
  assert.match(scheduleCardSource, /htmlFor="provisional-release-date"/);
  assert.match(scheduleCardSource, /aria-describedby="provisional-release-date-help"/);
  assert.match(scheduleCardSource, /id="release-method"[\s\S]*?min-h-11/);
  assert.match(scheduleCardSource, /aria-live="polite"/);
  assert.match(scheduleCardSource, /aria-busy=\{isWorking\}/);
});

test('正式日と仮日は同じ幅のコンパクト行で表示し、日程情報を右側へまとめる', () => {
  assert.match(scheduleCardSource, /data-release-date-row="official"/);
  assert.match(scheduleCardSource, /data-release-date-row="provisional"/);
  assert.equal(
    (scheduleCardSource.match(/sm:h-9 sm:min-h-9 sm:w-44/g) || []).length,
    2,
  );
  assert.doesNotMatch(scheduleCardSource, /sm:max-w-xs/);
  assert.match(scheduleCardSource, /data-release-schedule-rail/);
  assert.match(scheduleCardSource, /lg:grid-cols-\[minmax\(0,1fr\)_300px\]/);
  assert.match(scheduleCardSource, /data-release-schedule-rail[\s\S]*?すべて標準に戻す/);
  assert.match(scheduleCardSource, /data-release-date-row="provisional"[\s\S]*?data-release-schedule-notices/);
  assert.match(scheduleCardSource, /配信方法：\{option\.shortLabel\}/);
});

test('次にやることを日付行の直下へ置き、右レールの高さによる空白を作らない', () => {
  assert.equal(
    (scheduleCardSource.match(/data-release-next-tasks/g) || []).length,
    1,
  );
  assert.match(
    scheduleCardSource,
    /data-release-date-row="provisional"[\s\S]*?data-release-next-tasks[\s\S]*?data-release-schedule-rail/,
  );
  assert.match(scheduleCardSource, /data-release-next-tasks[\s\S]*?sm:grid-cols-3/);
  assert.match(scheduleCardSource, /data-release-schedule-rail[\s\S]*?p-2\.5 text-\[11px\] leading-4/);
  assert.equal(
    (scheduleCardSource.match(/grid min-w-0 flex-1 grid-cols-2 gap-2 sm:flex/g) || []).length,
    2,
  );
  assert.match(scheduleCardSource, /col-span-2 min-h-11[\s\S]*?sm:col-span-1 sm:h-9/);
});
