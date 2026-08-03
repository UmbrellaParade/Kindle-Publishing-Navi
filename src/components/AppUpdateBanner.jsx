import React, { useState } from 'react';
import { Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAppUpdate } from '@/hooks/useAppUpdate';

export function buildUpdateReloadUrl(version, currentUrl = window.location.href) {
  const nextUrl = new URL(currentUrl);
  nextUrl.searchParams.set('app_version', version);
  return nextUrl.toString();
}

export default function AppUpdateBanner({ beforeReload }) {
  const {
    currentVersion,
    latestVersion,
    updateAvailable,
    dismissUpdate,
  } = useAppUpdate();
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!updateAvailable) return null;

  const handleUpdate = async () => {
    if (updating || !latestVersion) return;

    setUpdating(true);
    setErrorMessage('');

    try {
      const result = await beforeReload?.();
      if (result === false) {
        throw new Error('更新前の保存を完了できませんでした。');
      }

      window.location.replace(buildUpdateReloadUrl(latestVersion));
    } catch (error) {
      const detail = error instanceof Error && error.message
        ? `：${error.message}`
        : '';
      setErrorMessage(`更新前の保存に失敗したため、再読み込みしませんでした${detail}`);
      setUpdating(false);
    }
  };

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-xl border border-neon-cyan/40 bg-[#121225]/95 p-4 shadow-2xl backdrop-blur-md"
      aria-live="polite"
      aria-label="アプリの更新通知"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 gap-3">
          <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-neon-cyan/10 text-neon-cyan">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-foreground">新しいバージョンを利用できます</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              v{currentVersion} → v{latestVersion}
            </p>
            <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-400" aria-hidden="true" />
              <span>同じサイト内の更新なので、ブラウザに保存したプロジェクトと画像は通常そのまま残ります。</span>
            </p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={dismissUpdate}
            disabled={updating}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            あとで
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={updating}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-neon-cyan px-4 text-xs font-black text-[#0d0d1a] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${updating ? 'animate-spin' : ''}`} aria-hidden="true" />
            {updating ? '保存・更新中…' : '更新する'}
          </button>
        </div>
      </div>

      {errorMessage && (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300" role="alert">
          {errorMessage}
        </p>
      )}
    </aside>
  );
}
