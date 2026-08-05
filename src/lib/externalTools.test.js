import test from 'node:test';
import assert from 'node:assert/strict';

import { KINDLE_MANUSCRIPT_FORMATTER_URL } from './externalTools.js';

test('Kindle原稿整形ツールは指定されたHTTPSの公開URLを使う', () => {
  const url = new URL(KINDLE_MANUSCRIPT_FORMATTER_URL);

  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'umbrellaparade.github.io');
  assert.equal(url.pathname, '/novel-drafting-tool/');
});
