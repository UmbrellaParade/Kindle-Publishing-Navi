import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CURRENT_APP_VERSION,
  FALLBACK_APP_VERSION,
  isValidAppVersion,
  isNewerAppVersion,
  parseVersionPayload,
} from '../src/hooks/useAppUpdate.js';

test('バージョン値は正しい SemVer だけを受け入れる', () => {
  assert.equal(isValidAppVersion('2.3.4'), true);
  assert.equal(isValidAppVersion('2.3.4-beta.1+build.5'), true);
  assert.equal(isValidAppVersion(' 2.3.4'), false);
  assert.equal(isValidAppVersion('2.3'), false);
  assert.equal(isValidAppVersion('<script>'), false);
});

test('現在より新しいバージョンだけを更新対象にする', () => {
  assert.equal(isNewerAppVersion('1.2.0', '1.1.9'), true);
  assert.equal(isNewerAppVersion('2.0.0', '1.9.9'), true);
  assert.equal(isNewerAppVersion('1.1.0', '1.1.0'), false);
  assert.equal(isNewerAppVersion('1.0.9', '1.1.0'), false);
  assert.equal(isNewerAppVersion('1.1.0', '1.1.0-beta.1'), true);
  assert.equal(isNewerAppVersion('1.1.0-beta.2', '1.1.0-beta.1'), true);
});

test('version.json の最低限の形式を厳格に検証する', () => {
  assert.equal(parseVersionPayload({ version: '2.0.0' }), '2.0.0');
  assert.throws(() => parseVersionPayload(null), /形式/);
  assert.throws(() => parseVersionPayload([]), /形式/);
  assert.throws(() => parseVersionPayload({ version: 2 }), /有効なバージョン/);
});

test('ビルド環境で未指定なら公開ファイルと揃えた既定値を使う', () => {
  assert.equal(CURRENT_APP_VERSION, FALLBACK_APP_VERSION);
  assert.equal(FALLBACK_APP_VERSION, '1.12.1');
  const packageInfo = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const publicVersion = JSON.parse(readFileSync(new URL('../public/version.json', import.meta.url), 'utf8'));
  assert.equal(packageInfo.version, FALLBACK_APP_VERSION);
  assert.equal(publicVersion.version, FALLBACK_APP_VERSION);
});
