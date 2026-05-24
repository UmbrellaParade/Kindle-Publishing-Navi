import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Shield, Heart, Brain, Zap, CheckCircle2 } from 'lucide-react';
import NeonCard from '../NeonCard';
import { motion } from 'framer-motion';

const COMPLETION_SIGNS = [
  {
    id: 'same-feedback',
    text: '指摘内容が前回とほぼ同じになった（新しい改善点が出なくなった）',
    icon: Brain,
  },
  {
    id: 'minor-only',
    text: '指摘が「てにをは」レベルの微修正のみになった',
    icon: Zap,
  },
  {
    id: 'structure-ok',
    text: '章構成・論理構造への指摘がなくなった',
    icon: Shield,
  },
  {
    id: 'core-message',
    text: '核心メッセージが明確に伝わっていると評価された',
    icon: Heart,
  },
  {
    id: 'three-plus',
    text: '3回以上回して、大きな改善がなくなった',
    icon: CheckCircle2,
  },
];

const LOOP_TRAPS = [
  {
    title: '「完璧」は存在しない',
    text: 'AIの辛口論評は毎回必ず何か指摘する。それが仕事だから。指摘ゼロになることはない。「指摘があるからダメ」ではなく「致命的な指摘がないからOK」が正解。',
  },
  {
    title: '修正のループに入ったら危険信号',
    text: 'Aを直したらBが気になり、Bを直したらAに戻る...。これは「完成している証拠」。いつまでも磨き続けることが目的ではない。',
  },
  {
    title: '読者は粗探しをしない',
    text: 'AIほど細かく読む読者はいない。読者が求めるのは「価値ある体験」であって「完璧な文章」ではない。',
  },
  {
    title: '出版してからも修正できる',
    text: 'Kindle本は出版後もいつでも更新可能。初版で100%を目指す必要はない。80%で出して、読者の反応を見てから直す方が効率的。',
  },
];

const STORAGE_KEY = 'up-review-checklist';

export default function ReviewGuideTab() {
  const [checked, setChecked] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked]);

  const toggleItem = (id) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const completedCount = Object.values(checked).filter(Boolean).length;
  const allChecked = completedCount >= 3;

  return (
    <div className="space-y-6">
      {/* Completion signs */}
      <NeonCard glowColor="pink">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-neon-red" />
          <h3 className="font-bold text-sm text-neon-red neon-red-glow">辛口論評 終了判断チェックリスト</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          3つ以上チェックがついたら、あなたの原稿は「出版できる状態」です。
        </p>

        <div className="space-y-3">
          {COMPLETION_SIGNS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-all ${
                  checked[item.id] ? 'bg-neon-pink/5 border border-neon-pink/20' : 'bg-secondary/50 border border-transparent hover:border-border'
                }`}
                onClick={() => toggleItem(item.id)}
              >
                <Checkbox
                  checked={!!checked[item.id]}
                  onCheckedChange={() => toggleItem(item.id)}
                  className="mt-0.5 border-neon-red/50 data-[state=checked]:bg-neon-red data-[state=checked]:border-neon-red"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex items-start gap-2 flex-1">
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${checked[item.id] ? 'text-neon-pink' : 'text-muted-foreground'}`} />
                  <p className={`text-sm ${checked[item.id] ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {item.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {allChecked && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 rounded-lg bg-neon-pink/10 border border-neon-pink/30"
          >
            <p className="text-sm font-bold text-neon-pink neon-pink-glow text-center">
              ──  あなたの原稿は、世に出る準備ができている  ──
            </p>
            <p className="text-xs text-center text-muted-foreground mt-2">
              自分の判断を信じろ。ヴェル13世が保証する。
            </p>
          </motion.div>
        )}
      </NeonCard>

      {/* Loop trap warnings */}
      <div>
        <h3 className="text-xs font-bold text-neon-amber tracking-wide mb-3 px-1">
          ⚠ ループにはまらないための考え方
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {LOOP_TRAPS.map((trap, idx) => (
            <motion.div
              key={trap.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <NeonCard glowColor="amber" className="h-full">
                <h4 className="text-sm font-bold text-neon-amber mb-2">{trap.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{trap.text}</p>
              </NeonCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}