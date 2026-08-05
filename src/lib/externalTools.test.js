import test from 'node:test';
import assert from 'node:assert/strict';

import {
  KINDLE_MANUSCRIPT_FORMATTER_MANUAL_SOURCE_URL,
  KINDLE_MANUSCRIPT_FORMATTER_MANUAL_URL,
  KINDLE_MANUSCRIPT_FORMATTER_URL,
} from './externalTools.js';

test('Kindle原稿整形ツールは指定されたHTTPSの公開URLを使う', () => {
  const url = new URL(KINDLE_MANUSCRIPT_FORMATTER_URL);

  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'umbrellaparade.github.io');
  assert.equal(url.pathname, '/novel-drafting-tool/');
});

test('原稿制作ツールのマニュアルは指定されたGitHub公開先を使う', () => {
  const manualUrl = new URL(KINDLE_MANUSCRIPT_FORMATTER_MANUAL_URL);
  const sourceUrl = new URL(KINDLE_MANUSCRIPT_FORMATTER_MANUAL_SOURCE_URL);

  assert.equal(manualUrl.protocol, 'https:');
  assert.equal(manualUrl.hostname, 'github.com');
  assert.equal(manualUrl.pathname, '/UmbrellaParade/novel-drafting-tool/tree/main/manual');
  assert.equal(sourceUrl.protocol, 'https:');
  assert.equal(sourceUrl.hostname, 'github.com');
  assert.equal(sourceUrl.pathname, '/UmbrellaParade/novel-drafting-tool/blob/main/manual/README.md');
});
