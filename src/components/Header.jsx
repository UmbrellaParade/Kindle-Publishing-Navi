import React from 'react';

export default function Header() {
  return (
    <header className="relative z-10 w-full px-4 md:px-8 py-6">
      <h1 className="font-heading font-black text-2xl md:text-4xl tracking-wider neon-pink-glow text-neon-pink leading-tight">
        UMBRELLA PARADE
      </h1>
      <p className="font-heading text-xs md:text-sm tracking-widest text-neon-cyan neon-cyan-glow mt-1">
        KINDLE 出版ナビ
      </p>
      <p className="text-[10px] md:text-xs text-muted-foreground mt-1 tracking-wide">
        ── ヴェル13世と歩む、入稿完了への道 ──
      </p>
      <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-neon-pink to-transparent opacity-60" />
    </header>
  );
}