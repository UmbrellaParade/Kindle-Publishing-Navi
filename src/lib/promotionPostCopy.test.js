import test from 'node:test';
import assert from 'node:assert/strict';

import { getPromotionPostCopyText } from './promotionPostCopy.js';

test('SNS投稿はタイトルや選択SNSを含めず本文だけをそのままコピーする', () => {
  const post = {
    subtitle: '発売告知',
    tags: ['X', 'Instagram'],
    body: '本日発売しました！\n詳細はこちらです。',
  };

  assert.equal(getPromotionPostCopyText(post), '本日発売しました！\n詳細はこちらです。');
  assert.doesNotMatch(getPromotionPostCopyText(post), /発売告知|Instagram/);
});

test('本文が文字列でない投稿は安全に空文字として扱う', () => {
  assert.equal(getPromotionPostCopyText(null), '');
  assert.equal(getPromotionPostCopyText({ body: null }), '');
});
