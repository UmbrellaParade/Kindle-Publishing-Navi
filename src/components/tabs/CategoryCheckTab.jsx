import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };

const KDP_CATEGORY_GROUPS = [
  {
    group: 'フィクション',
    items: [
      'フィクション > 一般',
      'フィクション > アクション、アドベンチャー',
      'フィクション > 歴史的フィクション',
      'フィクション > ファンタジー > 一般',
      'フィクション > ファンタジー > コンテンポラリー',
      'フィクション > ファンタジー > ダークファンタジー',
      'フィクション > ファンタジー > 叙事詩',
      'フィクション > ファンタジー > 超常現象',
      'フィクション > ファンタジー > 都市',
      'フィクション > ファンタジー > ユーモア',
      'フィクション > ファンタジー > 神話',
      'フィクション > ホラー',
      'フィクション > 文学',
      'フィクション > マジカルリアリズム',
      'フィクション > ミステリー、探偵小説 > 一般',
      'フィクション > ミステリー、探偵小説 > コージー',
      'フィクション > ミステリー、探偵小説 > ハードボイルド',
      'フィクション > SF > 一般',
      'フィクション > SF > サイバーパンク',
      'フィクション > SF > スペースオペラ',
      'フィクション > SF > タイムトラベル',
      'フィクション > スリラー > 一般',
      'フィクション > スリラー > 超自然サスペンス',
      'フィクション > スリラー > 犯罪スリラー',
      'フィクション > ロマンス > 一般',
      'フィクション > ロマンス > ファンタジー',
      'フィクション > ロマンス > 歴史的ロマンス',
      'フィクション > 短編小説',
      'フィクション > ユーモア、サタイア',
      'フィクション > 戦争、軍',
    ],
  },
  {
    group: 'ライトノベル',
    items: [
      'ライトノベル > 一般',
      'ライトノベル > ボーイズラブノベルス',
      'ライトノベル > ガールズラブノベルス',
    ],
  },
  {
    group: 'ノンフィクション',
    items: [
      'ノンフィクション > 伝記',
      'ノンフィクション > エッセイ',
      'ノンフィクション > ビジネス',
      'ノンフィクション > 自己啓発',
      'ノンフィクション > 実用書',
      'ノンフィクション > 趣味、実用',
      'ノンフィクション > 料理',
      'ノンフィクション > 旅行',
      'ノンフィクション > 健康、フィットネス',
      'ノンフィクション > 歴史',
      'ノンフィクション > 社会、政治',
      'ノンフィクション > サイエンス、テクノロジー',
      'ノンフィクション > アート、音楽',
    ],
  },
  {
    group: 'その他',
    items: [
      'コミック、グラフィックノベル',
      '詩',
      '絵本、児童書',
      'ティーンズ、ヤング',
      '宗教、スピリチュアル',
    ],
  },
];

const ALL_CATEGORIES = KDP_CATEGORY_GROUPS.flatMap(g => g.items);

const CATEGORY_LABELS = ['メイン', 'サブ 1', 'サブ 2'];
const CATEGORY_COLORS = [
  { border: 'border-neon-pink/30', text: 'text-neon-pink', badge: 'bg-neon-pink/20 text-neon-pink border-neon-pink/40', bg: 'rgba(255,45,120,0.04)' },
  { border: 'border-neon-cyan/30',  text: 'text-neon-cyan',  badge: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40',   bg: 'rgba(0,245,255,0.03)' },
  { border: 'border-neon-amber/30', text: 'text-neon-amber', badge: 'bg-neon-amber/20 text-neon-amber border-neon-amber/40', bg: 'rgba(255,179,0,0.04)' },
];

const DEFAULT_CATS = [
  { value: '', custom: '', memo: '' },
  { value: '', custom: '', memo: '' },
  { value: '', custom: '', memo: '' },
];

export default function CategoryCheckTab({ project, onProjectUpdate, saving, saved }) {
  const [cats, setCats] = useState(DEFAULT_CATS);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const saveTimer = useRef(null);

  // プロジェクト選択時にデータを読み込み
  useEffect(() => {
    if (!project) { setCats(DEFAULT_CATS); return; }
    
    // categories フィールドから読み込み
    try {
      const parsed = project.categories ? JSON.parse(project.categories) : DEFAULT_CATS;
      setCats(Array.isArray(parsed) && parsed.length === 3 ? parsed : DEFAULT_CATS);
    } catch { setCats(DEFAULT_CATS); }
  }, [project?.id]);

  // 自動保存
  const save = (nextCats) => {
    if (!project) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const updated = await base44.entities.PublishingProject.update(project.id, { categories: JSON.stringify(nextCats) });
      onProjectUpdate(updated);
      toast.success('カテゴリーを保存しました');
    }, 1000);
  };

  const updateCat = (idx, field, val) => {
    const next = cats.map((c, i) => i === idx ? { ...c, [field]: val } : c);
    setCats(next);
    save(next);
  };

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground"><span className="text-4xl">🏷️</span><p className="mt-3 text-sm">プロジェクトを選択してください</p></div>;
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="rounded-xl p-4" style={CARD_STYLE}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-neon-pink" />
            <h3 className="text-sm font-bold text-neon-pink neon-pink-glow">Amazon カテゴリー管理（最大 3 つ）</h3>
          </div>
          <a href="https://kdp.amazon.co.jp" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-neon-cyan hover:text-neon-pink transition-colors px-2.5 py-1.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <ExternalLink className="w-3 h-3" />Amazon KDP で確認する
          </a>
        </div>
        <p className="text-xs text-muted-foreground mt-2">狙うカテゴリーを最大 3 つ登録・管理できます。</p>
      </div>

      {/* カテゴリー 3 枚 */}
      {cats.map((cat, idx) => {
        const c = CATEGORY_COLORS[idx];
        const displayVal = cat.value && cat.value !== '__none__' ? cat.value : cat.custom || '';
        return (
          <div key={idx} className={`rounded-xl border ${c.border} p-4 space-y-3`} style={{ background: c.bg }}>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>{CATEGORY_LABELS[idx]}</span>
              {displayVal && <span className={`text-xs font-bold truncate ${c.text}`}>{displayVal}</span>}
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">KDP カテゴリーから選択</p>
              <Select value={cat.value} onValueChange={val => updateCat(idx, 'value', val)}>
                <SelectTrigger className="text-xs h-9" style={INPUT_STYLE}>
                  <SelectValue placeholder="カテゴリーを選択..." />
                </SelectTrigger>
                <SelectContent style={{ background: '#1a1a2e', border: '1px solid #2a2a4a' }} className="max-h-80">
                  <SelectItem value="__none__" className="text-xs text-muted-foreground">（選択なし）</SelectItem>
                  {KDP_CATEGORY_GROUPS.map(group => (
                    <React.Fragment key={group.group}>
                      <div className="px-2 py-1 text-[10px] text-muted-foreground font-bold uppercase tracking-wide border-t border-border mt-1">{group.group}</div>
                      {group.items.map(cat => (
                        <SelectItem key={cat} value={cat} className="text-xs pl-4">{cat}</SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">または手動で入力（リストにない場合）</p>
              <input value={cat.custom} onChange={e => updateCat(idx, 'custom', e.target.value)}
                placeholder="例：フィクション > 独自カテゴリー"
                className="w-full h-8 px-3 text-xs rounded text-foreground placeholder:text-muted-foreground focus:outline-none"
                style={INPUT_STYLE} />
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">このカテゴリーで狙う戦略メモ</p>
              <textarea value={cat.memo} onChange={e => updateCat(idx, 'memo', e.target.value)} rows={2}
                placeholder="例：このカテゴリーで 3 冠を狙う！ 競合少ない穴場..."
                className="w-full text-xs rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
                style={INPUT_STYLE} />
            </div>
          </div>
        );
      })}

      {/* 全カテゴリー一覧（アコーディオン） */}
      <div className="rounded-xl overflow-hidden" style={CARD_STYLE}>
        <button onClick={() => setShowAllCategories(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors">
          <h3 className="text-sm font-bold text-neon-amber neon-amber-glow">📚 Amazon Kindle 全カテゴリー一覧（参考）</h3>
          {showAllCategories ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        <AnimatePresence initial={false}>
          {showAllCategories && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-4 pb-4 space-y-4">
                {KDP_CATEGORY_GROUPS.map(group => (
                  <div key={group.group}>
                    <p className="text-xs font-bold text-neon-cyan mb-2 pb-1 border-b border-border">{group.group}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {group.items.map(cat => (
                        <div key={cat} className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground">{cat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}