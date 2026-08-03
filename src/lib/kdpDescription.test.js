import test from 'node:test';
import assert from 'node:assert/strict';

import { buildKdpDescriptionUpdates, readKdpDescription } from './kdpDescription.js';

test('独立したKDP説明文を従来メタデータより優先して読み込む', () => {
  assert.equal(readKdpDescription({
    kdp_description: '<p>現在の説明文</p>',
    kdp_meta: JSON.stringify({ description: '<p>以前の説明文</p>' }),
  }), '<p>現在の説明文</p>');
});

test('従来メタデータだけにあるKDP説明文も引き継ぐ', () => {
  assert.equal(readKdpDescription({
    kdp_meta: JSON.stringify({ description: '<p>引き継ぐ説明文</p>' }),
  }), '<p>引き継ぐ説明文</p>');
});

test('KDP説明文の保存時に既存メタデータを維持する', () => {
  const updates = buildKdpDescriptionUpdates({
    kdp_meta: JSON.stringify({ aplus: { version: 1 }, language: 'ja' }),
  }, '<p>新しい説明文</p>');

  assert.equal(updates.kdp_description, '<p>新しい説明文</p>');
  assert.deepEqual(JSON.parse(updates.kdp_meta), {
    aplus: { version: 1 },
    language: 'ja',
    description: '<p>新しい説明文</p>',
  });
});

test('壊れたKDPメタデータは上書きせず独立フィールドだけ保存する', () => {
  assert.deepEqual(buildKdpDescriptionUpdates({
    kdp_meta: '{broken',
  }, '<p>守る説明文</p>'), {
    kdp_description: '<p>守る説明文</p>',
  });
});
