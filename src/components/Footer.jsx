import React from 'react';
import { Umbrella, ExternalLink } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-border mt-12">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Umbrella className="w-4 h-4 text-neon-pink" />
            <span className="font-heading text-xs tracking-wider text-muted-foreground">
              UMBRELLA PARADE © 2024
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs">
            <a
              href="https://umbrellaparade13.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-neon-cyan hover:text-neon-pink transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              公式サイト
            </a>
            <span className="text-muted-foreground">
              ゴリアスさんの「AI出版自走キット」と補完関係
            </span>
          </div>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-4 tracking-wide">
          ── 路地裏のネオンの下で、あなたの一冊が世界に放たれる ──
        </p>
      </div>
    </footer>
  );
}