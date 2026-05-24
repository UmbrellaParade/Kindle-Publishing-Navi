import React from 'react';
import { cn } from '@/lib/utils';
import { FileText, BookOpen, Image } from 'lucide-react';

const SECTIONS = [
  { id: 'writing', label: '📝 出稿チェックリスト', shortLabel: '出稿', icon: FileText },
  { id: 'publishing', label: '📚 出版チェックリスト', shortLabel: '出版', icon: BookOpen },
  { id: 'images', label: '🖼️ 画像管理', shortLabel: '画像', icon: Image },
];

export default function SectionNavigation({ activeSection, onSectionChange }) {
  return (
    <div className="relative z-10 bg-background/80 backdrop-blur-sm border-b-2 border-neon-pink/20">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex gap-1 py-2">
          {SECTIONS.map(sec => {
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => onSectionChange(sec.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 md:px-5 py-2 rounded-lg text-xs md:text-sm font-bold tracking-wide whitespace-nowrap transition-all duration-300 flex-shrink-0',
                  active
                    ? 'text-neon-pink neon-pink-glow bg-secondary neon-box-pink border border-neon-pink/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                <span className="hidden md:inline">{sec.label}</span>
                <span className="md:hidden">{sec.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}