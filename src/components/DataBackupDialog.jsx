import React, { useRef, useState } from 'react';
import packageInfo from '../../package.json';
import {
  AlertTriangle,
  DatabaseBackup,
  Download,
  FileJson,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  createBackupFileName,
  createCritiqueRecoveryFileName,
  createDataBackupBundle,
  downloadCritiqueRecovery,
  downloadDataBackup,
  importDataBackup,
  previewDataBackupPlanningNotesConflicts,
  readDataBackupFile,
} from '@/lib/dataBackup';

const DEFAULT_APP_VERSION = packageInfo.version || 'unknown';
const PLANNING_CONFLICT_SECTION_LABELS = Object.freeze({
  concept: '企画メモ',
  conceptHistory: '企画メモ履歴',
  marketSummary: '市場調査サマリー',
  competitors: '競合・市場調査',
  chapters: '目次・章構成',
  outlineSnapshots: '目次の保存版・確定版',
  interviews: '取材記録',
  instructionVersions: '執筆設計・GPTs指示書',
  decisions: '意思決定・版履歴',
});
const PLANNING_CONFLICT_REASON_LABELS = Object.freeze({
  same_id_different_content: '同じIDの内容違い',
  chapter_order_requires_review: '章順の重なり',
  duplicate_document_version: '同じ指示書系列・版番号の重なり',
  market_summary_requires_review: '市場調査サマリーの内容違い',
  outline_snapshot_requires_review: '同じ目次保存版の内容違い',
  outline_snapshot_limit_exceeded: '目次の保存履歴が上限100件を超える',
  outline_version_number_conflict: '目次の版番号の重なり',
  confirmed_outline_conflict: '現在使う確定目次の指定違い',
  draft_outline_membership_conflict: '編集中の仮目次が異なる（自動では切り替えない）',
  instruction_canonical_scope_conflict: '指示書の正本指定の重なり',
  instruction_first_read_conflict: '最初に見る指示書の重なり',
  decision_canonical_conflict: '意思決定の正本指定の重なり',
  decision_first_read_conflict: '最初に見る意思決定の重なり',
});

function downloadRecoveryIfNeeded(recovery, prefix = 'kindle-navi-critique-recovery') {
  if (!recovery) return false;
  downloadCritiqueRecovery(recovery, {
    filename: createCritiqueRecoveryFileName(prefix),
  });
  return true;
}

function BackupSummary({ backup }) {
  const exportedAt = new Date(backup.exportedAt).toLocaleString('ja-JP');
  return (
    <div className="rounded-lg border border-neon-cyan/25 bg-neon-cyan/5 p-3 text-xs space-y-1.5">
      <div className="flex items-center gap-2 text-neon-cyan font-bold">
        <FileJson className="w-4 h-4" />読み込み済みバックアップ
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
        <dt>作成日時</dt><dd className="text-foreground">{exportedAt}</dd>
        <dt>アプリ版</dt><dd className="text-foreground">{backup.appVersion}</dd>
        <dt>内容</dt>
        <dd className="text-foreground">
          {backup.data.projects.length}プロジェクト・原稿{backup.data.formatGuideStates.length}件・
          ルビ辞書{backup.data.projectRubyDictionaries.length}件・画像{backup.data.images.length}件
        </dd>
      </dl>
    </div>
  );
}

export default function DataBackupDialog({
  appVersion = DEFAULT_APP_VERSION,
  beforeAction,
  onRestored,
  triggerClassName = '',
}) {
  const fileInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingBackup, setPendingBackup] = useState(null);
  const [planningMergeConflicts, setPlanningMergeConflicts] = useState([]);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [replacePhrase, setReplacePhrase] = useState('');
  const [replaceSafetyReady, setReplaceSafetyReady] = useState(false);
  const [replaceSafetyConfirmed, setReplaceSafetyConfirmed] = useState(false);

  const resetReplaceConfirmation = () => {
    setReplacePhrase('');
    setReplaceSafetyReady(false);
    setReplaceSafetyConfirmed(false);
  };

  const resetSelection = () => {
    setPendingBackup(null);
    setPlanningMergeConflicts([]);
    setSelectedFileName('');
    setErrorMessage('');
    resetReplaceConfirmation();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenChange = (nextOpen) => {
    if (busy) return;
    setOpen(nextOpen);
    if (!nextOpen) resetSelection();
  };

  const handleExport = async () => {
    setBusy(true);
    setErrorMessage('');
    try {
      if (beforeAction) await beforeAction();
      const { backup, critiqueRecovery } = await createDataBackupBundle({ appVersion });
      downloadDataBackup(backup, { filename: createBackupFileName() });
      const recoveryDownloaded = downloadRecoveryIfNeeded(critiqueRecovery);
      if (recoveryDownloaded) {
        toast.warning('通常バックアップに加え、読み込めない辛口論評履歴／本の前提／企画・取材・構成ノートの原文を復旧用JSONとして保存しました。両方を保管してください');
      } else {
        toast.success('バックアップをダウンロードしました');
      }
    } catch (error) {
      const message = error?.message || 'バックアップを作成できませんでした';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleFileSelection = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setPendingBackup(null);
    setPlanningMergeConflicts([]);
    setSelectedFileName(file.name);
    setErrorMessage('');
    resetReplaceConfirmation();
    try {
      const backup = await readDataBackupFile(file);
      if (beforeAction) await beforeAction();
      const currentBundle = await createDataBackupBundle({ appVersion });
      const conflicts = previewDataBackupPlanningNotesConflicts(currentBundle.backup, backup);
      setPlanningMergeConflicts(conflicts);
      setPendingBackup(backup);
      if (conflicts.length > 0) {
        toast.warning(`企画・取材・構成ノートに内容・章順・版・正本指定の競合が${conflicts.length}件あります。結合は停止しています`);
      } else {
        toast.success('バックアップの検証が完了しました');
      }
    } catch (error) {
      const message = error?.message || 'バックアップを読み込めませんでした';
      setErrorMessage(message);
      toast.error('復元せず停止しました');
    } finally {
      setBusy(false);
      // 同じファイルを選び直せるようにします。
      event.target.value = '';
    }
  };

  const prepareReplaceSafetyBackup = async () => {
    if (!pendingBackup || busy) return;
    setBusy(true);
    setErrorMessage('');
    setReplaceSafetyReady(false);
    setReplaceSafetyConfirmed(false);

    try {
      if (beforeAction) await beforeAction();
      const { backup, critiqueRecovery } = await createDataBackupBundle({ appVersion });
      downloadDataBackup(backup, {
        filename: createBackupFileName('kindle-navi-before-restore'),
      });
      const recoveryDownloaded = downloadRecoveryIfNeeded(
        critiqueRecovery,
        'kindle-navi-before-restore-critique-recovery',
      );
      setReplaceSafetyReady(true);
      if (recoveryDownloaded) {
        toast.warning('復元前バックアップと、読み込めない辛口論評履歴／本の前提／企画・取材・構成ノートの復旧用JSONを保存しました。両方を保管してください');
      } else {
        toast.success('復元前バックアップのダウンロードを開始しました');
      }
    } catch (error) {
      const message = error?.message || '復元前バックアップを保存できないため、全置換を停止しました';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async (mode) => {
    if (!pendingBackup || busy) return;
    if (mode === 'merge' && planningMergeConflicts.length > 0) {
      const message = '企画・取材・構成ノートに内容・章順・版・正本指定の競合があるため、結合を停止しました。全置換を使うか、競合内容を整理したバックアップを選んでください';
      setErrorMessage(message);
      toast.error(message);
      return;
    }
    if (mode === 'replace' && (!replaceSafetyReady || !replaceSafetyConfirmed)) return;
    setBusy(true);
    setErrorMessage('');

    let result;
    let preflightSnapshotDownloaded = false;
    let preflightCritiqueRecoveryDownloaded = false;
    try {
      if (beforeAction) await beforeAction();
    } catch (error) {
      const message = error?.message || '保存中のデータを確定できなかったため、復元を停止しました';
      setErrorMessage(message);
      toast.error(message);
      setBusy(false);
      return;
    }

    try {
      const beforeApply = ({ beforeSnapshot, beforeCritiqueRecovery }) => {
          downloadDataBackup(beforeSnapshot, {
            filename: createBackupFileName('kindle-navi-before-restore'),
          });
          preflightSnapshotDownloaded = true;
          if (beforeCritiqueRecovery) {
            preflightCritiqueRecoveryDownloaded = downloadRecoveryIfNeeded(
              beforeCritiqueRecovery,
              'kindle-navi-before-restore-critique-recovery',
            );
          }
          return {
            snapshotSaved: preflightSnapshotDownloaded,
            critiqueRecoverySaved: !beforeCritiqueRecovery
              || preflightCritiqueRecoveryDownloaded,
          };
        };
      result = await importDataBackup(pendingBackup, { mode, appVersion, beforeApply });
    } catch (error) {
      let recoverySnapshotDownloaded = preflightSnapshotDownloaded;
      let critiqueRecoveryDownloaded = preflightCritiqueRecoveryDownloaded;
      if (!error?.preflightFailed && !recoverySnapshotDownloaded && error?.beforeSnapshot) {
        try {
          downloadDataBackup(error.beforeSnapshot, {
            filename: createBackupFileName('kindle-navi-before-failed-restore'),
          });
          recoverySnapshotDownloaded = true;
        } catch {
          // 画面のエラーを優先し、ダウンロード失敗は下のメッセージにまとめます。
        }
      }
      if (!error?.preflightFailed
        && !critiqueRecoveryDownloaded
        && error?.beforeCritiqueRecovery) {
        try {
          critiqueRecoveryDownloaded = downloadRecoveryIfNeeded(
            error.beforeCritiqueRecovery,
            'kindle-navi-before-failed-restore-critique-recovery',
          );
        } catch {
          // 画面のエラーを優先し、ダウンロード失敗は下のメッセージにまとめます。
        }
      }
      const rollbackNote = error?.rollbackSucceeded === false
        ? recoverySnapshotDownloaded
          ? ' 元データの自動復旧も完了していません。自動保存された復元前バックアップをご確認ください。'
          : ' 元データの自動復旧と復元前バックアップの保存を完了できませんでした。'
        : '';
      const preflightNote = error?.preflightFailed
        ? ' 復元処理を始める前に停止したため、保存データは変更していません。'
        : '';
      const critiqueRecoveryNote = critiqueRecoveryDownloaded
        ? ' 読み込めない辛口論評履歴／本の前提／企画・取材・構成ノートの原文は、別の復旧用JSONにも保存しました。'
        : error?.beforeCritiqueRecovery
          ? ' 読み込めない辛口論評履歴／本の前提／企画・取材・構成ノートの復旧用JSONはダウンロードできませんでした。'
          : '';
      const message = `${error?.message || '復元できませんでした'}${rollbackNote}${preflightNote}${critiqueRecoveryNote}`;
      setErrorMessage(message);
      toast.error(message);
      setBusy(false);
      return;
    }

    // 結合前スナップショットは、書き込み前のbeforeApplyで保存済みです。
    // 全置換は、書き込み前に明示保存できた場合だけ runImport へ到達します。
    if (mode === 'merge' && preflightCritiqueRecoveryDownloaded) {
      toast.warning('結合前にあった読み込めない項目の原文を、別の復旧用JSONへ保存しました');
    }

    if (onRestored) {
      try {
        await onRestored(result);
      } catch {
        toast.warning('データは復元済みです。表示を更新するには画面を再読み込みしてください');
      }
    }

    toast.success(mode === 'replace' ? '全データを置き換えました' : 'バックアップを結合しました');
    setBusy(false);
    setMergeConfirmOpen(false);
    setReplaceConfirmOpen(false);
    setOpen(false);
    resetSelection();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            id="data-management-trigger"
            type="button"
            variant="outline"
            size="sm"
            className={`h-8 border-neon-cyan/30 text-neon-cyan bg-neon-cyan/5 hover:bg-neon-cyan/15 ${triggerClassName}`}
          >
            <DatabaseBackup className="w-3.5 h-3.5" />
            データ管理
          </Button>
        </DialogTrigger>

        <DialogContent
          className="max-w-xl max-h-[88vh] overflow-y-auto"
          style={{ background: '#151527', border: '1px solid #2a2a4a' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-neon-cyan">
              <DatabaseBackup className="w-5 h-5" />データのバックアップと復元
            </DialogTitle>
            <DialogDescription>
              更新や端末変更に備えて、制作データをJSONファイルとして手元に保存できます。
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
              <ShieldCheck className="w-4 h-4" />ファイルの取り扱いについて
            </div>
            バックアップには原稿・メモ・画像が含まれます。AI接続設定として保存されたAPIキーやトークンの専用保存キーは対象外です。
            ただし、原稿やメモへ手作業で貼り付けた機密文字列・非公開取材は通常バックアップに含まれます。「共有用JSON／Markdown」とは別の機密ファイルとして、安全な場所に保管してください。
            <p className="mt-2">
              読み込めない辛口論評履歴・本の前提・企画ノートを検出した場合は、復元できる通常バックアップと、原文だけを残す復旧用JSONを別々に保存します。通常の復元には通常バックアップを選び、復旧用JSONも修復が済むまで保管してください。
            </p>
          </div>

          <section className="rounded-xl border border-border/70 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">1. 現在のデータを保存</h3>
              <p className="text-xs text-muted-foreground mt-1">プロジェクト、原稿整形データ、ルビ辞書、保存画像をまとめます。</p>
            </div>
            <Button
              type="button"
              onClick={handleExport}
              disabled={busy}
              className="w-full bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/35 hover:bg-neon-cyan/25"
            >
              {busy ? <Loader2 className="animate-spin" /> : <Download />}
              バックアップをダウンロード
            </Button>
          </section>

          <section className="rounded-xl border border-border/70 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">2. バックアップから復元</h3>
              <p className="text-xs text-muted-foreground mt-1">
                まずJSONの全項目を検証します。不正なファイルは一切書き込まず停止します。
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleFileSelection}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="w-full border-neon-pink/35 text-neon-pink hover:bg-neon-pink/10"
            >
              {busy ? <Loader2 className="animate-spin" /> : <Upload />}
              バックアップファイルを選ぶ
            </Button>

            {selectedFileName && (
              <p className="text-[11px] text-muted-foreground break-all">選択：{selectedFileName}</p>
            )}
            {errorMessage && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="break-words">{errorMessage}</span>
              </div>
            )}

            {pendingBackup && (
              <div className="space-y-3">
                <BackupSummary backup={pendingBackup} />
                {planningMergeConflicts.length > 0 && (
                  <div className="rounded-md border border-amber-400/45 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
                    <div className="mb-1 flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      企画・取材・構成ノートの結合を停止しています
                    </div>
                    内容・章順・版・正本指定の競合が{planningMergeConflicts.length}件あります。
                    承認済みの内容を静かに上書きしないため、このファイルは「結合して復元」できません。
                    競合を整理したバックアップを選ぶか、内容をすべてバックアップ側へ置き換える場合だけ「すべて置き換える」を選んでください。
                    <ul className="mt-2 space-y-1 rounded-md border border-amber-300/20 bg-black/10 p-2">
                      {planningMergeConflicts.slice(0, 8).map(conflict => (
                        <li key={`${conflict.projectId}-${conflict.section}-${conflict.id}`} className="break-all">
                          ・{conflict.projectName} ／ {PLANNING_CONFLICT_SECTION_LABELS[conflict.section] || conflict.section} ／ {PLANNING_CONFLICT_REASON_LABELS[conflict.reason] || '内容の競合'} ／ ID: {conflict.id}
                        </li>
                      ))}
                      {planningMergeConflicts.length > 8 && <li>ほか{planningMergeConflicts.length - 8}件</li>}
                    </ul>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    onClick={() => setMergeConfirmOpen(true)}
                    disabled={busy || planningMergeConflicts.length > 0}
                    className="bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/35 hover:bg-neon-cyan/25"
                  >
                    結合して復元（推奨）
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setReplaceConfirmOpen(true)}
                    disabled={busy}
                  >
                    すべて置き換える
                  </Button>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  結合では既存プロジェクトを残し、同じIDのデータだけバックアップ側で更新します。全置換では、復元前バックアップを先に保存して確認します。
                </p>
              </div>
            )}
          </section>
        </DialogContent>
      </Dialog>

      <AlertDialog open={mergeConfirmOpen} onOpenChange={setMergeConfirmOpen}>
        <AlertDialogContent style={{ background: '#151527', border: '1px solid #2a2a4a' }}>
          <AlertDialogHeader>
            <AlertDialogTitle>バックアップを結合しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {planningMergeConflicts.length > 0
                ? `企画・取材・構成ノートに内容・章順・版・正本指定の競合が${planningMergeConflicts.length}件あるため、結合できません。`
                : '現在のプロジェクトは残ります。同じプロジェクトID、画像ID、原稿データはバックアップ側の内容で更新されます。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => runImport('merge')}
              disabled={busy || planningMergeConflicts.length > 0}
            >
              {busy && <Loader2 className="animate-spin" />}結合して復元
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={replaceConfirmOpen}
        onOpenChange={(nextOpen) => {
          setReplaceConfirmOpen(nextOpen);
          if (!nextOpen) resetReplaceConfirmation();
        }}
      >
        <AlertDialogContent style={{ background: '#151527', border: '1px solid #ef444466' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />現在の全データを置き換えます
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                現在だけにあるプロジェクト、原稿状態、ルビ辞書、画像は削除されます。先に復元前バックアップを保存し、ファイルを確認した場合だけ実行できます。
              </span>
              <span className="block font-bold text-foreground">1. 復元前バックアップをダウンロードしてください。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Button
            type="button"
            variant="outline"
            onClick={prepareReplaceSafetyBackup}
            disabled={busy}
            className="w-full border-amber-400/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
          >
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            {replaceSafetyReady ? '復元前バックアップをもう一度保存' : '復元前バックアップをダウンロード'}
          </Button>
          {replaceSafetyReady && (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-400/30 bg-amber-500/5 p-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={replaceSafetyConfirmed}
                onChange={event => setReplaceSafetyConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500"
              />
              <span>2. ダウンロードしたバックアップファイルを確認しました</span>
            </label>
          )}
          {errorMessage && (
            <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span className="break-words">{errorMessage}</span>
            </div>
          )}
          <p className="text-xs font-bold text-foreground">3. 続けるには「全置換」と入力してください。</p>
          <input
            autoFocus
            value={replacePhrase}
            onChange={event => setReplacePhrase(event.target.value)}
            placeholder="全置換"
            className="h-10 rounded-md border border-destructive/50 bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-destructive"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => runImport('replace')}
              disabled={busy || !replaceSafetyReady || !replaceSafetyConfirmed || replacePhrase !== '全置換'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy && <Loader2 className="animate-spin" />}全置換を実行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
