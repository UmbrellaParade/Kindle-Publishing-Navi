import { useCallback, useEffect, useRef, useState } from 'react';

export const FALLBACK_APP_VERSION = '1.4.1';
export const APP_UPDATE_POLL_INTERVAL_MS = 15 * 60 * 1000;

const DISMISSED_VERSION_KEY = 'kindle_navi_dismissed_update_version';
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function isValidAppVersion(value) {
  return typeof value === 'string'
    && value.length <= 64
    && value === value.trim()
    && SEMVER_PATTERN.test(value);
}

export function parseVersionPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('version.json の形式が正しくありません。');
  }

  if (!isValidAppVersion(payload.version)) {
    throw new Error('version.json に有効なバージョンがありません。');
  }

  return payload.version;
}

function parseComparableVersion(version) {
  const [withoutBuild] = version.split('+');
  const [core, prerelease = ''] = withoutBuild.split('-', 2);
  return {
    core: core.split('.').map(Number),
    prerelease: prerelease ? prerelease.split('.') : [],
  };
}

/** SemVerとして latest が current より新しい場合だけ true を返します。 */
export function isNewerAppVersion(latest, current) {
  if (!isValidAppVersion(latest) || !isValidAppVersion(current)) return false;
  const left = parseComparableVersion(latest);
  const right = parseComparableVersion(current);
  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] !== right.core[index]) return left.core[index] > right.core[index];
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return right.prerelease.length > 0 && left.prerelease.length === 0;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const a = left.prerelease[index];
    const b = right.prerelease[index];
    if (a === undefined || b === undefined) return b === undefined;
    if (a === b) continue;
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return Number(a) > Number(b);
    if (aNumeric !== bNumeric) return !aNumeric;
    return a > b;
  }
  return false;
}

const configuredVersion = import.meta.env?.VITE_APP_VERSION;
export const CURRENT_APP_VERSION = isValidAppVersion(configuredVersion)
  ? configuredVersion
  : FALLBACK_APP_VERSION;

function readDismissedVersion() {
  try {
    return window.sessionStorage.getItem(DISMISSED_VERSION_KEY);
  } catch {
    return null;
  }
}

function saveDismissedVersion(version) {
  try {
    window.sessionStorage.setItem(DISMISSED_VERSION_KEY, version);
  } catch {
    // sessionStorage が使えない環境でも、この画面を開いている間は state で保持する。
  }
}

function getVersionUrl() {
  const baseUrl = import.meta.env?.BASE_URL || '/';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBaseUrl}version.json?t=${Date.now()}`;
}

/**
 * 公開中の version.json を監視し、現在のビルドと異なる場合だけ更新を知らせる。
 * 通信失敗はアプリ利用を妨げないよう通知せず、次回チェックで再試行する。
 */
export function useAppUpdate({
  pollIntervalMs = APP_UPDATE_POLL_INTERVAL_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  const [latestVersion, setLatestVersion] = useState(null);
  const [dismissedVersion, setDismissedVersion] = useState(readDismissedVersion);
  const inFlightRef = useRef(false);
  const controllersRef = useRef(new Set());

  const checkForUpdate = useCallback(async () => {
    if (inFlightRef.current || typeof fetchImpl !== 'function') return null;

    inFlightRef.current = true;
    const controller = new AbortController();
    controllersRef.current.add(controller);

    try {
      const response = await fetchImpl(getVersionUrl(), {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`version.json の取得に失敗しました (${response.status})`);
      }

      const version = parseVersionPayload(await response.json());
      setLatestVersion(version);
      return version;
    } catch (error) {
      if (error?.name !== 'AbortError') {
        // オフライン等は通常利用に影響させず、次回の定期確認に任せる。
      }
      return null;
    } finally {
      controllersRef.current.delete(controller);
      inFlightRef.current = false;
    }
  }, [fetchImpl]);

  useEffect(() => {
    checkForUpdate();

    const intervalId = window.setInterval(checkForUpdate, pollIntervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      controllersRef.current.forEach(controller => controller.abort());
      controllersRef.current.clear();
      inFlightRef.current = false;
    };
  }, [checkForUpdate, pollIntervalMs]);

  const dismissUpdate = useCallback(() => {
    if (!latestVersion) return;
    saveDismissedVersion(latestVersion);
    setDismissedVersion(latestVersion);
  }, [latestVersion]);

  return {
    currentVersion: CURRENT_APP_VERSION,
    latestVersion,
    updateAvailable: Boolean(
      latestVersion
      && isNewerAppVersion(latestVersion, CURRENT_APP_VERSION)
      && dismissedVersion !== latestVersion
    ),
    dismissUpdate,
    checkForUpdate,
  };
}
