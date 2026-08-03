import React, { useEffect, useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { scheduleCoordinatedSave } from '@/lib/saveCoordinator';
import { readChecklistEnvelope, writeChecklistEnvelope } from '@/lib/releaseSchedule';
import { mutatePublishingProject } from '@/lib/projectMutation';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };

const BOOK_TYPES = [
  '実用・ビジネス',
  'エッセイ・自分史',
  '小説・ラノベ',
  '絵本・児童書',
  'マンガ',
  '写真・作品集',
  'その他',
];

// KDP上の名称や選択肢は変更されるため、ここでは検討の入口になる候補だけを扱います。
const CATEGORY_SUGGESTIONS = {
  '実用・ビジネス': [
    { label: 'ビジネス・経済（経営・起業）', keywords: '会社 独立 副業 仕事 キャリア' },
    { label: 'ビジネス・経済（マーケティング・セールス）', keywords: '集客 営業 広告 SNS 販売' },
    { label: '投資・金融・会社経営', keywords: 'お金 資産 株式 会計 経理' },
    { label: '自己啓発・ライフスタイル', keywords: '習慣 時間術 思考 メンタル 生き方' },
    { label: '暮らし・健康・子育て', keywords: '生活 家事 料理 健康 育児 教育' },
    { label: 'コンピュータ・IT', keywords: 'AI プログラミング Web アプリ 技術' },
  ],
  'エッセイ・自分史': [
    { label: '文学・評論（エッセー・随筆）', keywords: '日常 体験 暮らし コラム' },
    { label: '伝記・自叙伝', keywords: '自分史 人生 回想 半生' },
    { label: 'ノンフィクション', keywords: '実話 記録 取材 ルポ' },
    { label: '暮らし・健康・子育て', keywords: '家族 育児 介護 病気 生活' },
    { label: '旅行ガイド・紀行', keywords: '旅 海外 地域 移住 散歩' },
    { label: '社会・政治', keywords: '社会 問題 時事 文化' },
  ],
  '小説・ラノベ': [
    { label: '文学・評論（小説・文芸）', keywords: '純文学 青春 家族 人間ドラマ' },
    { label: 'ミステリー・サスペンス', keywords: '推理 探偵 犯罪 謎 ホラー' },
    { label: 'SF・ファンタジー', keywords: '未来 宇宙 異世界 魔法 神話' },
    { label: 'ロマンス', keywords: '恋愛 結婚 青春 ラブストーリー' },
    { label: '歴史・時代小説', keywords: '歴史 戦国 江戸 戦争 時代' },
    { label: 'ライトノベル', keywords: 'ラノベ 異世界 キャラクター ティーン' },
  ],
  '絵本・児童書': [
    { label: '絵本', keywords: '読み聞かせ 幼児 イラスト' },
    { label: '児童文学', keywords: '物語 小学生 冒険 友情' },
    { label: '学習・知育', keywords: '勉強 図鑑 科学 算数 ことば' },
    { label: '子どもの生活・成長', keywords: 'しつけ 感情 学校 家族' },
    { label: 'ティーン・ヤングアダルト', keywords: '中学生 高校生 青春 進路' },
  ],
  'マンガ': [
    { label: 'コミック・グラフィックノベル', keywords: '漫画 ストーリー 連載' },
    { label: 'エッセイマンガ', keywords: '日常 体験 育児 仕事' },
    { label: '学習マンガ', keywords: '解説 教育 ビジネス 実用' },
    { label: '4コマ・ショートコミック', keywords: '四コマ ギャグ 短編' },
    { label: 'ティーン向けコミック', keywords: '少年 少女 青春' },
  ],
  '写真・作品集': [
    { label: '写真', keywords: '風景 人物 ポートレート 旅行' },
    { label: 'アート・デザイン', keywords: '美術 イラスト グラフィック' },
    { label: '作品集・ポートフォリオ', keywords: '画集 制作 実績 作例' },
    { label: '建築・インテリア', keywords: '建物 空間 住宅' },
    { label: '趣味・実用', keywords: '撮影 カメラ 技法 メイキング' },
  ],
  その他: [
    { label: '詩・短歌・俳句', keywords: '詩歌 言葉 文芸' },
    { label: '教育・学参', keywords: '教材 学習 資格 語学' },
    { label: '宗教・思想', keywords: '哲学 スピリチュアル 信仰' },
    { label: '趣味・実用', keywords: 'スポーツ 手芸 ゲーム ペット' },
    { label: '専門書・研究', keywords: '学術 論文 医学 法律 科学' },
  ],
};

const CATEGORY_LABELS = ['候補 1', '候補 2', '候補 3'];
const CATEGORY_COLORS = [
  { border: 'border-neon-pink/30', text: 'text-neon-pink', badge: 'bg-neon-pink/20 text-neon-pink border-neon-pink/40', bg: 'rgba(255,45,120,0.04)' },
  { border: 'border-neon-cyan/30', text: 'text-neon-cyan', badge: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40', bg: 'rgba(0,245,255,0.03)' },
  { border: 'border-neon-amber/30', text: 'text-neon-amber', badge: 'bg-neon-amber/20 text-neon-amber border-neon-amber/40', bg: 'rgba(255,179,0,0.04)' },
];

const makeDefaultCats = () => [
  { value: '', custom: '', memo: '' },
  { value: '', custom: '', memo: '' },
  { value: '', custom: '', memo: '' },
];

function normalizeCategories(raw) {
  const defaults = makeDefaultCats();
  if (!Array.isArray(raw)) return defaults;
  return defaults.map((fallback, index) => {
    const stored = raw[index];
    return stored && typeof stored === 'object' && !Array.isArray(stored)
      ? { ...fallback, ...stored }
      : fallback;
  });
}

function inferBookType(cats) {
  const text = cats.map(cat => `${cat.value || ''} ${cat.custom || ''}`).join(' ');
  if (!text.trim()) return '';
  if (/絵本|児童|ティーン|ヤング/.test(text)) return '絵本・児童書';
  if (/コミック|マンガ|漫画|グラフィックノベル/.test(text)) return 'マンガ';
  if (/写真|アート|作品集|画集|デザイン/.test(text)) return '写真・作品集';
  if (/フィクション|小説|ライトノベル|ミステリー|SF|ファンタジー|ロマンス/.test(text)) return '小説・ラノベ';
  if (/伝記|自叙伝|エッセイ|随筆|ノンフィクション/.test(text)) return 'エッセイ・自分史';
  if (/ビジネス|自己啓発|実用|料理|健康|テクノロジー/.test(text)) return '実用・ビジネス';
  return 'その他';
}

function serializeCategories(cats, bookType, theme) {
  return cats.map((cat, index) => index === 0
    ? { ...cat, book_type: bookType, theme }
    : cat);
}

export default function CategoryCheckTab({ project, onProjectUpdate }) {
  const [cats, setCats] = useState(makeDefaultCats);
  const [bookType, setBookType] = useState('');
  const [theme, setTheme] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  useEffect(() => {
    if (!project) {
      setCats(makeDefaultCats());
      setBookType('');
      setTheme('');
      return undefined;
    }

    try {
      const parsed = project.categories ? JSON.parse(project.categories) : [];
      const normalized = normalizeCategories(parsed);
      setCats(normalized);
      setBookType(normalized[0]?.book_type || inferBookType(normalized));
      setTheme(normalized[0]?.theme || '');
    } catch {
      setCats(makeDefaultCats());
      setBookType('');
      setTheme('');
    }

  }, [project?.id]);

  const visibleSuggestions = useMemo(() => {
    if (!bookType) return [];
    const suggestions = CATEGORY_SUGGESTIONS[bookType] || CATEGORY_SUGGESTIONS.その他;
    const words = theme.trim().toLocaleLowerCase('ja-JP').split(/[\s、,]+/).filter(Boolean);
    if (words.length === 0) return suggestions;
    return suggestions.filter(item => {
      const searchable = `${item.label} ${item.keywords}`.toLocaleLowerCase('ja-JP');
      return words.some(word => searchable.includes(word));
    });
  }, [bookType, theme]);

  const save = (nextCats, nextBookType = bookType, nextTheme = theme) => {
    if (!project) return;
    scheduleCoordinatedSave(`categories:${project.id}`, async () => {
      const updated = await mutatePublishingProject(project.id, latest => {
        const { envelope, data } = readChecklistEnvelope(latest?.checklist_data);
        const kdpFields = { ...(envelope._kdp_fields || {}) };
        nextCats.forEach((cat, index) => {
          kdpFields[`t43a_category${index + 1}`] = cat.custom || cat.value || '';
        });
        return {
          categories: JSON.stringify(serializeCategories(nextCats, nextBookType, nextTheme)),
          checklist_data: writeChecklistEnvelope(latest?.checklist_data, data, { _kdp_fields: kdpFields }),
        };
      }, project);
      onProjectUpdate?.(updated);
      toast.success('カテゴリー候補を保存しました');
    }, 800);
  };

  const updateCat = (index, field, value) => {
    const next = cats.map((cat, currentIndex) => currentIndex === index ? { ...cat, [field]: value } : cat);
    setCats(next);
    save(next);
  };

  const updateBookType = (value) => {
    setBookType(value);
    save(cats, value, theme);
  };

  const updateTheme = (value) => {
    setTheme(value);
    save(cats, bookType, value);
  };

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground"><span className="text-4xl">🏷️</span><p className="mt-3 text-sm">プロジェクトを選択してください</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 space-y-4" style={CARD_STYLE}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-neon-pink" />
              <h3 className="text-sm font-bold text-neon-pink neon-pink-glow">カテゴリー候補を整理（最大 3 つ）</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              下の名称は検討用の参考候補です。カテゴリーの名称・選択肢は変更されることがあるため、出版時にKDP公式画面で最終確認してください。
              保存した候補は「KDP登録進捗」のカテゴリー欄へ自動で引き継がれます。
            </p>
          </div>
          <a href="https://kdp.amazon.co.jp/ja_JP/help/topic/G200652170" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-neon-cyan hover:text-neon-pink transition-colors px-2.5 py-1.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <ExternalLink className="w-3 h-3" />KDP公式画面で確認
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5">本の種類</label>
            <Select value={bookType || undefined} onValueChange={updateBookType}>
              <SelectTrigger className="text-xs h-9" style={INPUT_STYLE}>
                <SelectValue placeholder="本の種類を選択" />
              </SelectTrigger>
              <SelectContent style={{ background: '#1a1a2e', border: '1px solid #2a2a4a' }}>
                {BOOK_TYPES.map(type => <SelectItem key={type} value={type} className="text-xs">{type}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="category-theme" className="block text-[10px] text-muted-foreground mb-1.5">テーマ語（候補の絞り込み）</label>
            <input id="category-theme" value={theme} onChange={event => updateTheme(event.target.value)}
              placeholder="例：副業、子育て、ミステリー"
              className="w-full h-9 px-3 text-xs rounded text-foreground placeholder:text-muted-foreground focus:outline-none"
              style={INPUT_STYLE} />
          </div>
        </div>
        {theme.trim() && visibleSuggestions.length === 0 && (
          <p className="text-[10px] text-neon-amber">テーマ語に合う参考候補がありません。KDP公式画面で確認した名称を、各候補へ直接入力してください。</p>
        )}
        {['絵本・児童書', 'マンガ', '写真・作品集'].includes(bookType) && (
          <p className="text-[10px] text-neon-amber leading-relaxed">
            このナビの標準工程と原稿作成ガイドは文章中心のKindle本向けです。画像主体・固定レイアウトの本では、日程と形式ガイドを参考として使い、KDP公式要件も確認してください。
          </p>
        )}
      </div>

      {cats.map((cat, index) => {
        const color = CATEGORY_COLORS[index];
        const selectedValue = cat.value && cat.value !== '__none__' ? cat.value : '';
        const displayValue = cat.custom || selectedValue;
        const selectedIsVisible = visibleSuggestions.some(item => item.label === selectedValue);
        return (
          <div key={index} className={`rounded-xl border ${color.border} p-4 space-y-3`} style={{ background: color.bg }}>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color.badge}`}>{CATEGORY_LABELS[index]}</span>
              {displayValue && <span className={`text-xs font-bold truncate ${color.text}`}>{displayValue}</span>}
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">「{bookType}」の参考候補から選ぶ</p>
              <Select value={cat.value || ''} onValueChange={value => updateCat(index, 'value', value)}>
                <SelectTrigger className="text-xs h-9" style={INPUT_STYLE}>
                  <SelectValue placeholder="候補を選択..." />
                </SelectTrigger>
                <SelectContent style={{ background: '#1a1a2e', border: '1px solid #2a2a4a' }} className="max-h-80">
                  <SelectItem value="__none__" className="text-xs text-muted-foreground">（選択なし）</SelectItem>
                  {selectedValue && !selectedIsVisible && (
                    <SelectItem value={selectedValue} className="text-xs">保存済み：{selectedValue}</SelectItem>
                  )}
                  {visibleSuggestions.map(item => (
                    <SelectItem key={item.label} value={item.label} className="text-xs">{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">KDP画面の名称を直接入力（任意）</p>
              <input value={cat.custom || ''} onChange={event => updateCat(index, 'custom', event.target.value)}
                placeholder="KDP画面に表示されたカテゴリー名"
                className="w-full h-8 px-3 text-xs rounded text-foreground placeholder:text-muted-foreground focus:outline-none"
                style={INPUT_STYLE} />
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">確認メモ</p>
              <textarea value={cat.memo || ''} onChange={event => updateCat(index, 'memo', event.target.value)} rows={2}
                placeholder="選んだ理由、比較した候補、確認日など"
                className="w-full text-xs rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
                style={INPUT_STYLE} />
            </div>
          </div>
        );
      })}

      <div className="rounded-xl overflow-hidden" style={CARD_STYLE}>
        <button onClick={() => setShowSuggestions(value => !value)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors">
          <div>
            <h3 className="text-sm font-bold text-neon-amber neon-amber-glow">📚 本の種類別・参考候補リスト</h3>
            <p className="text-[10px] text-muted-foreground mt-1">公式カテゴリーの完全な一覧ではありません</p>
          </div>
          {showSuggestions ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        <AnimatePresence initial={false}>
          {showSuggestions && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-4 pb-4 space-y-4">
                {BOOK_TYPES.map(type => (
                  <div key={type}>
                    <p className="text-xs font-bold text-neon-cyan mb-2 pb-1 border-b border-border">{type}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {CATEGORY_SUGGESTIONS[type].map(item => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground">{item.label}</span>
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
