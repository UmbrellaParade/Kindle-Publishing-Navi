import test from 'node:test';
import assert from 'node:assert/strict';
import { assessKindleCoverDimensions, KINDLE_COVER_SPEC } from './coverImageGuidance.js';

test('KDP電子書籍の表紙寸法を幅×高さで保持する', () => {
  assert.deepEqual(KINDLE_COVER_SPEC, {
    recommendedWidth: 1600,
    recommendedHeight: 2560,
    minimumWidth: 625,
    minimumHeight: 1000,
    maximumDimension: 10000,
    idealAspectRatio: 1.6,
    maximumFileSizeMb: 50,
  });
});

test('推奨寸法・最小寸法・比率・最大寸法を判定する', () => {
  const recommended = assessKindleCoverDimensions(1600, 2560);
  assert.equal(recommended.level, 'success');
  assert.equal(recommended.meetsRecommended, true);

  const minimum = assessKindleCoverDimensions(625, 1000);
  assert.equal(minimum.level, 'info');
  assert.equal(minimum.meetsMinimum, true);

  const tooSmall = assessKindleCoverDimensions(624, 1000);
  assert.equal(tooSmall.level, 'warning');
  assert.equal(tooSmall.meetsMinimum, false);

  const tooWide = assessKindleCoverDimensions(1600, 2000);
  assert.equal(tooWide.level, 'warning');
  assert.equal(tooWide.meetsIdealRatio, false);

  const tooLarge = assessKindleCoverDimensions(10001, 16002);
  assert.equal(tooLarge.level, 'warning');
  assert.equal(tooLarge.meetsMinimum, false);
});

test('未登録時は寸法不明として案内する', () => {
  assert.equal(assessKindleCoverDimensions().level, 'unknown');
});
