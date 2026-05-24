import React, { useState } from 'react';
import { Zap, ExternalLink, ChevronDown, ChevronUp, Trash2, GripVertical } from 'lucide-react';

export default function ChecklistItem({ item, onToggle, onNoteChange, onDelete }) {
  const [showNote, setShowNote] = useState(false);

  return (
    <div className={`group rounded-lg border transition-all ${
      item.is_done
        ? 'bg-secondary/30 border-border opacity-60'
        : item.is_important
        ? 'bg-neon-pink/5 border-neon-pink/30'
        : 'bg-secondary/50 border-border hover:border-neon-cyan/30'
    }`}>
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        {/* ドラッグハンドル */}
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 flex-shrink-0 cursor-grab" />

        {/* チェックボックス */}
        <button
          onClick={() => onToggle(item.id)}
          className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${
            item.is_done
              ? 'bg-neon-cyan border-neon-cyan'
              : 'border-muted-foreground/40 hover:border-neon-cyan'
          }`}
        >
          {item.is_done && <span className="text-background text-[10px] font-black leading-none">✓</span>}
        </button>

        {/* タイトルエリア */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.is_important && (
              <Zap className="w-3 h-3 text-neon-pink flex-shrink-0" />
            )}
            <span className={`text-xs leading-relaxed ${item.is_done ? 'line-through text-muted-foreground' : item.is_important ? 'text-foreground font-bold' : 'text-foreground'}`}>
              {item.title}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {item.tool && (
              <span className="text-[10px] text-neon-cyan bg-neon-cyan/10 px-1.5 py-0.5 rounded border border-neon-cyan/20">
                {item.tool}
              </span>
            )}
            {item.link && (
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-neon-amber flex items-center gap-0.5 hover:underline">
                <ExternalLink className="w-2.5 h-2.5" />リンク
              </a>
            )}
            {item.note && !showNote && (
              <span className="text-[10px] text-muted-foreground italic truncate max-w-[160px]">📝 {item.note}</span>
            )}
          </div>
        </div>

        {/* アクション */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setShowNote(v => !v)} className="text-muted-foreground hover:text-neon-amber transition-colors p-0.5">
            {showNote ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => onDelete(item.id)} className="text-muted-foreground hover:text-neon-red transition-colors p-0.5">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* メモ欄 */}
      {showNote && (
        <div className="px-3 pb-2.5 pt-0">
          <textarea
            value={item.note || ''}
            onChange={(e) => onNoteChange(item.id, e.target.value)}
            placeholder="メモを入力..."
            rows={2}
            className="w-full text-xs bg-background/50 border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-amber/50 resize-none"
          />
        </div>
      )}
    </div>
  );
}