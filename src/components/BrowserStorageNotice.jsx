import React, { useState } from 'react';
import { DatabaseBackup, X } from 'lucide-react';

const DISMISSED_KEY = 'kindle_navi_storage_notice_dismissed_v1';

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function BrowserStorageNotice() {
  const [visible, setVisible] = useState(() => !wasDismissed());

  if (!visible) return null;

  const dismiss = async () => {
    try {
      // 対応ブラウザでは、利用者の操作をきっかけに永続保存を依頼する。
      await navigator.storage?.persist?.();
      localStorage.setItem(DISMISSED_KEY, 'true');
      setVisible(false);
    } catch {
      // 保存できない環境では重要な注意を非表示にしない。
    }
  };

  return (
    <aside className="relative z-20 border-b border-neon-amber/20 bg-neon-amber/5 px-3 py-2.5" aria-label="データ保存について">
      <div className="max-w-7xl mx-auto flex items-start gap-2.5 text-[11px] leading-relaxed">
        <DatabaseBackup className="w-4 h-4 text-neon-amber flex-shrink-0 mt-0.5" />
        <p className="text-muted-foreground flex-1">
          データはこのブラウザに自動保存されます。アプリ更新では通常残りますが、別端末・別ブラウザ・サイトデータ削除では引き継がれません。
          同じプロジェクトを複数タブで同時編集せず、上部の<span className="text-neon-cyan font-bold">「データ管理」</span>から定期的にバックアップしてください。
        </p>
        <button type="button" onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1" aria-label="お知らせを閉じる">
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
