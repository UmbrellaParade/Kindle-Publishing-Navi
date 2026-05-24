import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Megaphone, Copy, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NeonCard from '../NeonCard';
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const SCHEDULE_TEMPLATE = [
  {
    offset: -21,
    label: '3週間前',
    phase: '匂わせ開始',
    color: 'cyan',
    template: `【匂わせ投稿】\n\nいま、ある「秘密のプロジェクト」を進めています。\n\n詳しくはまだ言えないけど…\nこれが完成したら、きっとあなたの◯◯が変わる。\n\n楽しみにしていてください。\n\n#執筆中 #近日公開`,
  },
  {
    offset: -14,
    label: '2週間前',
    phase: '執筆進捗ポスト',
    color: 'cyan',
    template: `【執筆進捗】\n\n実は今、Kindle本を書いています📖\n\nテーマは「◯◯」。\n\n今日で全体の80%が完成。\nあと少しで皆さんにお届けできそうです。\n\n#Kindle出版 #執筆中 #もうすぐ完成`,
  },
  {
    offset: -7,
    label: '1週間前',
    phase: 'タイトル発表',
    color: 'amber',
    template: `【タイトル発表】\n\n新刊のタイトルが決まりました！\n\n📕『◯◯◯◯◯◯』\n\nこの本は、◯◯に悩むすべての人に贈る一冊です。\n\n来週、Amazonで発売開始。\n詳細は追ってお知らせします！\n\n#新刊 #Kindle本`,
  },
  {
    offset: -4,
    label: '4日前',
    phase: '表紙デザイン発表',
    color: 'amber',
    template: `【表紙公開】\n\n新刊『◯◯◯◯◯◯』の表紙デザインが完成しました！\n\n[表紙画像を添付]\n\n◯月◯日発売予定。\n発売日は特別価格でお届けします。\n\n気になる方は、当日お見逃しなく！\n\n#Kindle新刊 #表紙公開`,
  },
  {
    offset: 0,
    label: '発売日',
    phase: '99円キャンペーン告知',
    color: 'pink',
    template: `🎉【本日発売】99円キャンペーン開始！\n\n📕『◯◯◯◯◯◯』\nAmazon Kindleにて本日発売！\n\n🔥発売記念として、5日間限定で【99円】！\n\n◯◯に悩む方、◯◯を目指す方にぜひ読んでほしい一冊です。\n\n👇ご購入はこちら\n[Amazonリンク]\n\n#Kindle本 #99円 #新刊`,
  },
  {
    offset: 2,
    label: '発売2日目',
    phase: 'リマインド投稿',
    color: 'pink',
    template: `📕99円キャンペーン、残り3日！\n\n『◯◯◯◯◯◯』\n\nおかげさまで◯◯ランキングに入りました！\n（入ってなくても「多くの方に手に取っていただいています」でOK）\n\nまだの方はお早めに👇\n[Amazonリンク]\n\n#Kindle #99円キャンペーン`,
  },
  {
    offset: 5,
    label: '発売5日目',
    phase: 'キャンペーン終了告知',
    color: 'pink',
    template: `⏰【本日最終日】99円キャンペーン終了！\n\n📕『◯◯◯◯◯◯』\n\n99円でお読みいただけるのは本日まで。\n明日から通常価格に戻ります。\n\n気になっていた方は今のうちに👇\n[Amazonリンク]\n\nたくさんの応援、ありがとうございました！\n\n#最終日 #Kindle`,
  },
];

const colorMap = {
  pink: { text: 'text-neon-pink', bg: 'bg-neon-pink', border: 'border-neon-pink/30', glow: 'neon-box-pink' },
  cyan: { text: 'text-neon-cyan', bg: 'bg-neon-cyan', border: 'border-neon-cyan/30', glow: 'neon-box-cyan' },
  amber: { text: 'text-neon-amber', bg: 'bg-neon-amber', border: 'border-neon-amber/30', glow: 'neon-box-amber' },
};

export default function PromoSchedulerTab() {
  const [releaseDate, setReleaseDate] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);

  const schedule = useMemo(() => {
    if (!releaseDate) return null;
    const base = new Date(releaseDate);
    return SCHEDULE_TEMPLATE.map((item) => ({
      ...item,
      date: addDays(base, item.offset),
    }));
  }, [releaseDate]);

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast.success('テンプレートをコピーしました');
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-6">
      <NeonCard glowColor="cyan">
        <div className="flex items-center gap-2 mb-1">
          <Megaphone className="w-4 h-4 text-neon-cyan" />
          <h3 className="font-bold text-sm text-neon-cyan neon-cyan-glow">プロモーションスケジューラー</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          発売日を入力すると、逆算でプロモーション投稿スケジュールと例文テンプレートを自動生成します。
        </p>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1 block">発売日</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="pl-9 bg-secondary border-border focus:border-neon-cyan/50 text-sm"
              />
            </div>
          </div>
        </div>
      </NeonCard>

      {/* Timeline */}
      <AnimatePresence>
        {schedule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative"
          >
            {/* Vertical line */}
            <div className="absolute left-4 md:left-6 top-0 bottom-0 w-px bg-gradient-to-b from-neon-cyan/50 via-neon-amber/50 to-neon-pink/50" />

            <div className="space-y-4">
              {schedule.map((item, idx) => {
                const colors = colorMap[item.color];
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="relative pl-10 md:pl-14"
                  >
                    {/* Dot */}
                    <div className={`absolute left-2.5 md:left-4.5 top-3 w-3 h-3 rounded-full ${colors.bg} ring-2 ring-background`} />

                    <div className={`bg-card border ${colors.border} rounded-lg p-4 ${colors.glow}`}>
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${colors.text}`}>{item.label}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs font-medium">{item.phase}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {format(item.date, 'yyyy年M月d日（E）', { locale: ja })}
                        </span>
                      </div>

                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-secondary/50 rounded-md p-3 leading-relaxed font-body">
                        {item.template}
                      </pre>

                      <Button
                        variant="ghost"
                        size="sm"
                        className={`mt-2 h-7 text-xs ${colors.text} hover:bg-secondary`}
                        onClick={() => handleCopy(item.template, idx)}
                      >
                        {copiedIdx === idx ? (
                          <><Check className="w-3 h-3 mr-1" />コピー済み</>
                        ) : (
                          <><Copy className="w-3 h-3 mr-1" />テンプレートをコピー</>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!schedule && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">発売日を入力すると、スケジュールが表示されます</p>
        </div>
      )}
    </div>
  );
}