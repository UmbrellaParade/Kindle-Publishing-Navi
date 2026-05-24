import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Globe, Loader2, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import NeonCard from '../NeonCard';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export default function CategoryResearch() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);

  const research = async () => {
    setLoading(true);
    setResult(null);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Amazon KDP（Kindle Direct Publishing）の日本語Kindleストアで現在選択できる小説・文芸ジャンルのカテゴリー体系について、最新情報をまとめてください。

特に以下の情報を取得してください：
1. 日本語KDPで選択できる主要な小説・文芸カテゴリー一覧（ファンタジー・ライトノベル・ヒューマンドラマ・SF・ミステリー・ロマンス・音楽/芸術 等）
2. 小説以外の主要カテゴリー（ビジネス・エッセイ・自己啓発など）
3. カテゴリー選択のコツとニッチカテゴリー戦略
4. 注意点や変更点

日本のKindleストア（Amazon.co.jp）の実際のカテゴリー階層を元に回答してください。`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          novel_categories: {
            type: 'array',
            description: '小説・文芸の主要カテゴリー一覧',
            items: {
              type: 'object',
              properties: {
                main: { type: 'string' },
                subs: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          other_categories: {
            type: 'array',
            description: '小説以外の主要カテゴリー',
            items: {
              type: 'object',
              properties: {
                main: { type: 'string' },
                subs: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          strategy_tips: {
            type: 'array',
            description: 'カテゴリー選択のコツ（3〜5項目）',
            items: { type: 'string' },
          },
          niche_strategy: {
            type: 'string',
            description: 'ニッチカテゴリーで1位を狙う戦略の説明',
          },
          notes: {
            type: 'string',
            description: '注意事項・変更点など',
          },
        },
      },
    });

    setResult(res);
    setFetchedAt(new Date());
    setLoading(false);
  };

  const toggle = (section) => setExpandedSection(expandedSection === section ? null : section);

  return (
    <NeonCard glowColor="cyan">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-4 h-4 text-neon-cyan" />
        <h3 className="font-bold text-sm text-neon-cyan neon-cyan-glow">KDPカテゴリー 最新リサーチ</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        AIがウェブ検索で最新のKDP（日本語Kindle）カテゴリー情報を取得します。
      </p>

      {/* Warning */}
      <div className="flex items-start gap-2 bg-neon-amber/5 border border-neon-amber/20 rounded-md p-3 mb-4">
        <AlertTriangle className="w-4 h-4 text-neon-amber flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Amazonは定期的にカテゴリーを改定します。出版前に必ず
          <a href="https://kdp.amazon.co.jp" target="_blank" rel="noopener noreferrer" className="text-neon-cyan underline mx-1">KDP公式サイト</a>
          で最新情報をご確認ください。
        </p>
      </div>

      <Button
        onClick={research}
        disabled={loading}
        className="w-full bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 text-sm h-10 font-bold"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ウェブ検索中...</>
        ) : (
          <><Globe className="w-4 h-4 mr-2" />{result ? '再取得する' : '最新カテゴリーを調べる'}</>
        )}
      </Button>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 space-y-4"
          >
            {/* Fetch timestamp */}
            {fetchedAt && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>取得日時：{format(fetchedAt, 'yyyy年M月d日 HH:mm', { locale: ja })}</span>
                <span className="text-neon-amber">※ あくまで参考情報です。出版前に公式確認を。</span>
              </div>
            )}

            {/* Novel categories */}
            {result.novel_categories?.length > 0 && (
              <CollapsibleSection
                title="小説・文芸カテゴリー"
                sectionKey="novel"
                expanded={expandedSection === 'novel'}
                onToggle={() => toggle('novel')}
                color="neon-pink"
              >
                <div className="space-y-3">
                  {result.novel_categories.map((cat, i) => (
                    <div key={i}>
                      <p className="text-xs font-bold text-foreground mb-1">▸ {cat.main}</p>
                      {cat.subs?.length > 0 && (
                        <div className="ml-3 flex flex-wrap gap-1.5">
                          {cat.subs.map((sub, j) => (
                            <span key={j} className="text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground">{sub}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Other categories */}
            {result.other_categories?.length > 0 && (
              <CollapsibleSection
                title="その他の主要カテゴリー"
                sectionKey="other"
                expanded={expandedSection === 'other'}
                onToggle={() => toggle('other')}
                color="neon-amber"
              >
                <div className="space-y-3">
                  {result.other_categories.map((cat, i) => (
                    <div key={i}>
                      <p className="text-xs font-bold text-foreground mb-1">▸ {cat.main}</p>
                      {cat.subs?.length > 0 && (
                        <div className="ml-3 flex flex-wrap gap-1.5">
                          {cat.subs.map((sub, j) => (
                            <span key={j} className="text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground">{sub}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Strategy */}
            {(result.strategy_tips?.length > 0 || result.niche_strategy) && (
              <CollapsibleSection
                title="カテゴリー選択のコツ & ニッチ戦略"
                sectionKey="strategy"
                expanded={expandedSection === 'strategy'}
                onToggle={() => toggle('strategy')}
                color="neon-cyan"
              >
                <div className="space-y-2">
                  {result.niche_strategy && (
                    <p className="text-xs text-foreground leading-relaxed bg-neon-cyan/5 border border-neon-cyan/20 rounded p-3 mb-3">{result.niche_strategy}</p>
                  )}
                  {result.strategy_tips?.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="text-neon-cyan font-bold flex-shrink-0">{i + 1}.</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Notes */}
            {result.notes && (
              <div className="bg-secondary/50 rounded-md p-3 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">注意事項</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{result.notes}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </NeonCard>
  );
}

function CollapsibleSection({ title, sectionKey, expanded, onToggle, color, children }) {
  const colorClass = {
    'neon-pink': 'text-neon-pink',
    'neon-cyan': 'text-neon-cyan',
    'neon-amber': 'text-neon-amber',
  }[color] || 'text-foreground';

  return (
    <div className="bg-secondary/40 rounded-lg border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/60 transition-colors"
      >
        <span className={`text-xs font-bold ${colorClass}`}>{title}</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}