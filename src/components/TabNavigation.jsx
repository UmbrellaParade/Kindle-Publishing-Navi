import React from 'react';
import { ClipboardCheck, FileText, FolderSearch, MessageCircle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'checklist', label: 'チェックリスト', shortLabel: 'チェック', icon: ClipboardCheck, color: 'neon-pink' },
  { id: 'format', label: 'フォーマットガイド', shortLabel: 'フォーマット', icon: FileText, color: 'neon-cyan' },
  { id: 'category', label: 'カテゴリー確認', shortLabel: 'カテゴリー', icon: FolderSearch, color: 'neon-amber' },
  { id: 'review', label: '辛口論評ガイド', shortLabel: '論評', icon: MessageCircle, color: 'neon-red' },
  { id: 'promo', label: 'プロモスケジューラー', shortLabel: 'プロモ', icon: Calendar, color: 'neon-cyan' },
];

const colorClasses = {
  'neon-pink': { text: 'text-neon-pink', glow: 'neon-pink-glow', box: 'neon-box-pink', border: 'neon-border-pink' },
  'neon-cyan': { text: 'text-neon-cyan', glow: 'neon-cyan-glow', box: 'neon-box-cyan', border: 'neon-border-cyan' },
  'neon-amber': { text: 'text-neon-amber', glow: 'neon-amber-glow', box: 'neon-box-amber', border: '' },
  'neon-red': { text: 'text-neon-red', glow: 'neon-red-glow', box: '', border: '' },
};

export default function TabNavigation({ activeTab, onTabChange }) {
  return (
    <div className="relative z-10 border-b border-border">
      <div className="max-w-6xl mx-auto px-2 md:px-4">
        <nav className="flex overflow-x-auto gap-1 py-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const colors = colorClasses[tab.color];
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 md:px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold tracking-wide whitespace-nowrap transition-all duration-300 flex-shrink-0',
                  isActive
                    ? `${colors.text} ${colors.glow} bg-secondary ${colors.box} border border-current`
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}