import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import ChecklistItem from './ChecklistItem';
import { CATEGORY_COLORS } from '@/lib/publishingPreset';

const colorMap = {
  'neon-pink': { badge: 'bg-neon-pink/20 text-neon-pink border-neon-pink/40', count: 'text-neon-pink' },
  'neon-cyan': { badge: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40', count: 'text-neon-cyan' },
  'neon-amber': { badge: 'bg-neon-amber/20 text-neon-amber border-neon-amber/40', count: 'text-neon-amber' },
};

export default function CategorySection({ category, items, onToggle, onNoteChange, onDelete, onAddItem }) {
  const [collapsed, setCollapsed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTool, setNewTool] = useState('');

  const done = items.filter(i => i.is_done).length;
  const color = CATEGORY_COLORS[category] || 'neon-cyan';
  const cls = colorMap[color] || colorMap['neon-cyan'];

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAddItem(category, newTitle.trim(), newTool.trim());
    setNewTitle('');
    setNewTool('');
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center gap-2 flex-1 text-left group"
        >
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cls.badge}`}>{category}</span>
          <span className={`text-[10px] font-bold ${cls.count}`}>{done}/{items.length}</span>
          <span className="ml-auto text-muted-foreground group-hover:text-foreground transition-colors">
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </span>
        </button>
        <button
          onClick={() => setAdding(v => !v)}
          className="text-muted-foreground hover:text-neon-cyan transition-colors p-1"
          title="工程を追加"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-1.5 pl-1">
          {items.map(item => (
            <ChecklistItem
              key={item.id}
              item={item}
              onToggle={onToggle}
              onNoteChange={onNoteChange}
              onDelete={onDelete}
            />
          ))}

          {adding && (
            <div className="rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 p-3 space-y-2">
              <input
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
                placeholder="工程名を入力..."
                className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-cyan/50"
              />
              <input
                value={newTool}
                onChange={e => setNewTool(e.target.value)}
                placeholder="ツール名（任意）"
                className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-cyan/50"
              />
              <div className="flex gap-2">
                <button onClick={handleAdd} className="text-xs text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/30 px-3 py-1 rounded hover:bg-neon-cyan/20 transition-colors">追加</button>
                <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1">キャンセル</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}