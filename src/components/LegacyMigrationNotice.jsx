import React, { useEffect, useState } from 'react';
import { ArchiveRestore, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inspectLegacyMigration, migrateLegacyProjects } from '@/lib/legacyMigration';

const CARD_STYLE = {
  background: 'linear-gradient(90deg, rgba(255,45,120,0.10), rgba(0,245,255,0.08))',
  border: '1px solid rgba(0,245,255,0.28)',
};

export default function LegacyMigrationNotice({
  beforeMigrate,
  onMigrated,
  onDismiss,
  onError,
  storage,
}) {
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    try {
      const inspection = inspectLegacyMigration(storage ? { storage } : undefined);
      setStatus(inspection);
    } catch (error) {
      setStatus(null);
      onError?.(error);
    }
  }, [storage, onError]);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleMigrate = async () => {
    setErrorMessage('');
    setMigrating(true);
    try {
      const result = await migrateLegacyProjects({
        ...(storage ? { storage } : {}),
        beforeMigrate,
      });
      setStatus(current => current ? { ...current, count: 0, candidateIds: [] } : current);
      if (onMigrated) await onMigrated(result);
      else window.location.reload();
    } catch (error) {
      setErrorMessage(error?.message || '旧版データを取り込めませんでした');
      onError?.(error);
    } finally {
      setMigrating(false);
    }
  };

  if (dismissed || !status || status.count < 1) return null;

  const backupReady = typeof beforeMigrate === 'function';

  return (
    <section className="relative z-20 px-2 py-3 border-b border-border/50" aria-live="polite">
      <div className="max-w-7xl mx-auto rounded-xl p-4" style={CARD_STYLE}>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-start gap-2.5 flex-1">
            <ArchiveRestore className="w-5 h-5 text-neon-cyan mt-0.5 flex-shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-neon-cyan">
                旧版のプロジェクトを {status.count} 件見つけました
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                現在のデータを完全バックアップしてから、安全なコピーとして取り込みます。
                旧版のデータは削除も上書きもしません。
              </p>
              <p className="text-[10px] text-neon-amber mt-1 leading-relaxed">
                旧版と現行版では工程が異なるため、完了状態は新しい標準工程へ自動対応させず、参照用として残します。
              </p>
              {!backupReady && (
                <p className="text-[10px] text-red-400 mt-1">
                  移行前バックアップの準備ができていません。データ管理機能を確認してください。
                </p>
              )}
              {errorMessage && <p className="text-[11px] text-red-400 mt-2">{errorMessage}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
            <Button
              size="sm"
              onClick={handleMigrate}
              disabled={migrating || !backupReady}
              className="h-9 gap-1.5 bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/35 hover:bg-neon-cyan/25"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {migrating ? 'バックアップ・コピー中...' : 'コピーして取り込む'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              disabled={migrating}
              className="h-9 gap-1 text-xs text-muted-foreground"
            >
              <X className="w-3.5 h-3.5" />今回はしない
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
