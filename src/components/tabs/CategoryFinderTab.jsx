import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search, FolderSearch, Check, Copy } from 'lucide-react';
import NeonCard from '../NeonCard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import CategoryResearch from '../category/CategoryResearch';

const KDP_CATEGORIES = [
  // 文学・評論
  { main: '文学・評論', sub: '文芸作品', path: 'Kindleストア > Kindle本 > 文学・評論 > 文芸作品' },
  { main: '文学・評論', sub: '評論・文学研究', path: 'Kindleストア > Kindle本 > 文学・評論 > 評論・文学研究' },
  { main: '文学・評論', sub: 'エッセー・随筆', path: 'Kindleストア > Kindle本 > 文学・評論 > エッセー・随筆' },
  { main: '文学・評論', sub: '詩歌', path: 'Kindleストア > Kindle本 > 文学・評論 > 詩歌' },
  { main: '文学・評論', sub: '戯曲・シナリオ', path: 'Kindleストア > Kindle本 > 文学・評論 > 戯曲・シナリオ' },
  { main: '文学・評論', sub: '古典', path: 'Kindleストア > Kindle本 > 文学・評論 > 古典' },
  { main: '文学・評論', sub: '日本文学', path: 'Kindleストア > Kindle本 > 文学・評論 > 日本文学' },
  { main: '文学・評論', sub: '外国文学', path: 'Kindleストア > Kindle本 > 文学・評論 > 外国文学' },
  // ビジネス・経済
  { main: 'ビジネス・経済', sub: '経営学・キャリア・MBA', path: 'Kindleストア > Kindle本 > ビジネス・経済 > 経営学・キャリア・MBA' },
  { main: 'ビジネス・経済', sub: 'マーケティング・セールス', path: 'Kindleストア > Kindle本 > ビジネス・経済 > マーケティング・セールス' },
  { main: 'ビジネス・経済', sub: '経済学・経済事情', path: 'Kindleストア > Kindle本 > ビジネス・経済 > 経済学・経済事情' },
  { main: 'ビジネス・経済', sub: '投資・金融・会社経営', path: 'Kindleストア > Kindle本 > ビジネス・経済 > 投資・金融・会社経営' },
  { main: 'ビジネス・経済', sub: 'IT', path: 'Kindleストア > Kindle本 > ビジネス・経済 > IT' },
  { main: 'ビジネス・経済', sub: '実践経営・リーダーシップ', path: 'Kindleストア > Kindle本 > ビジネス・経済 > 実践経営・リーダーシップ' },
  { main: 'ビジネス・経済', sub: 'ビジネス実用', path: 'Kindleストア > Kindle本 > ビジネス・経済 > ビジネス実用' },
  // 人文・思想
  { main: '人文・思想', sub: '哲学・思想', path: 'Kindleストア > Kindle本 > 人文・思想 > 哲学・思想' },
  { main: '人文・思想', sub: '心理学', path: 'Kindleストア > Kindle本 > 人文・思想 > 心理学' },
  { main: '人文・思想', sub: '宗教', path: 'Kindleストア > Kindle本 > 人文・思想 > 宗教' },
  { main: '人文・思想', sub: '教育学', path: 'Kindleストア > Kindle本 > 人文・思想 > 教育学' },
  { main: '人文・思想', sub: '倫理学・道徳', path: 'Kindleストア > Kindle本 > 人文・思想 > 倫理学・道徳' },
  // 社会・政治
  { main: '社会・政治', sub: '政治', path: 'Kindleストア > Kindle本 > 社会・政治 > 政治' },
  { main: '社会・政治', sub: '社会学', path: 'Kindleストア > Kindle本 > 社会・政治 > 社会学' },
  { main: '社会・政治', sub: '法律', path: 'Kindleストア > Kindle本 > 社会・政治 > 法律' },
  { main: '社会・政治', sub: '福祉', path: 'Kindleストア > Kindle本 > 社会・政治 > 福祉' },
  // ノンフィクション
  { main: 'ノンフィクション', sub: 'ノンフィクション', path: 'Kindleストア > Kindle本 > ノンフィクション' },
  { main: 'ノンフィクション', sub: 'ルポルタージュ', path: 'Kindleストア > Kindle本 > ノンフィクション > ルポルタージュ' },
  // 趣味・実用
  { main: '趣味・実用', sub: 'スポーツ', path: 'Kindleストア > Kindle本 > 趣味・実用 > スポーツ' },
  { main: '趣味・実用', sub: '生活情報', path: 'Kindleストア > Kindle本 > 趣味・実用 > 生活情報' },
  { main: '趣味・実用', sub: '料理', path: 'Kindleストア > Kindle本 > 趣味・実用 > 料理' },
  { main: '趣味・実用', sub: '健康・ダイエット', path: 'Kindleストア > Kindle本 > 趣味・実用 > 健康・ダイエット' },
  { main: '趣味・実用', sub: '手芸・クラフト', path: 'Kindleストア > Kindle本 > 趣味・実用 > 手芸・クラフト' },
  { main: '趣味・実用', sub: 'ペット', path: 'Kindleストア > Kindle本 > 趣味・実用 > ペット' },
  { main: '趣味・実用', sub: '住まい・インテリア', path: 'Kindleストア > Kindle本 > 趣味・実用 > 住まい・インテリア' },
  // 暮らし・健康・子育て
  { main: '暮らし・健康・子育て', sub: '恋愛・結婚・離婚', path: 'Kindleストア > Kindle本 > 暮らし・健康・子育て > 恋愛・結婚・離婚' },
  { main: '暮らし・健康・子育て', sub: '妊娠・出産・子育て', path: 'Kindleストア > Kindle本 > 暮らし・健康・子育て > 妊娠・出産・子育て' },
  { main: '暮らし・健康・子育て', sub: '家庭医学・健康', path: 'Kindleストア > Kindle本 > 暮らし・健康・子育て > 家庭医学・健康' },
  // コンピュータ・IT
  { main: 'コンピュータ・IT', sub: 'プログラミング', path: 'Kindleストア > Kindle本 > コンピュータ・IT > プログラミング' },
  { main: 'コンピュータ・IT', sub: 'IT・Eコマース', path: 'Kindleストア > Kindle本 > コンピュータ・IT > IT・Eコマース' },
  { main: 'コンピュータ・IT', sub: 'Web開発・デザイン', path: 'Kindleストア > Kindle本 > コンピュータ・IT > Web開発・デザイン' },
  // 自己啓発
  { main: '人文・思想', sub: '自己啓発', path: 'Kindleストア > Kindle本 > 人文・思想 > 自己啓発' },
  { main: '人文・思想', sub: '倫理学・道徳', path: 'Kindleストア > Kindle本 > 人文・思想 > 倫理学・道徳' },
  // コミック・ラノベ
  { main: 'コミック', sub: 'コミック', path: 'Kindleストア > Kindle本 > コミック' },
  { main: 'ライトノベル', sub: 'ライトノベル', path: 'Kindleストア > Kindle本 > ライトノベル' },
  // SF・ホラー・ファンタジー
  { main: '文学・評論', sub: 'SF・ホラー・ファンタジー', path: 'Kindleストア > Kindle本 > 文学・評論 > SF・ホラー・ファンタジー' },
  { main: '文学・評論', sub: 'ミステリー・サスペンス・ハードボイルド', path: 'Kindleストア > Kindle本 > 文学・評論 > ミステリー・サスペンス・ハードボイルド' },
  { main: '文学・評論', sub: 'ロマンス', path: 'Kindleストア > Kindle本 > 文学・評論 > ロマンス' },
  { main: '文学・評論', sub: 'タイムトラベル', path: 'Kindleストア > Kindle本 > 文学・評論 > タイムトラベル' },
  // 旅行
  { main: '旅行ガイド・マップ', sub: '旅行ガイド', path: 'Kindleストア > Kindle本 > 旅行ガイド・マップ > 旅行ガイド' },
  // 資格・検定
  { main: '資格・検定・就職', sub: '資格・検定', path: 'Kindleストア > Kindle本 > 資格・検定・就職 > 資格・検定' },
  // 語学
  { main: '語学・辞事典・年鑑', sub: '英語', path: 'Kindleストア > Kindle本 > 語学・辞事典・年鑑 > 英語' },
  { main: '語学・辞事典・年鑑', sub: '日本語', path: 'Kindleストア > Kindle本 > 語学・辞事典・年鑑 > 日本語' },
  // 歴史
  { main: '歴史・地理', sub: '日本史', path: 'Kindleストア > Kindle本 > 歴史・地理 > 日本史' },
  { main: '歴史・地理', sub: '世界史', path: 'Kindleストア > Kindle本 > 歴史・地理 > 世界史' },
  // 科学
  { main: '科学・テクノロジー', sub: '数学', path: 'Kindleストア > Kindle本 > 科学・テクノロジー > 数学' },
  { main: '科学・テクノロジー', sub: '物理学', path: 'Kindleストア > Kindle本 > 科学・テクノロジー > 物理学' },
  // 写真集
  { main: 'アート・建築・デザイン', sub: '写真集', path: 'Kindleストア > Kindle本 > アート・建築・デザイン > 写真集' },
  { main: 'アート・建築・デザイン', sub: 'デザイン', path: 'Kindleストア > Kindle本 > アート・建築・デザイン > デザイン' },
];

export default function CategoryFinderTab() {
  const [search, setSearch] = useState('');
  const [copiedPath, setCopiedPath] = useState(null);

  const mainCategories = useMemo(() => {
    return [...new Set(KDP_CATEGORIES.map((c) => c.main))];
  }, []);

  const filtered = useMemo(() => {
    if (!search) return KDP_CATEGORIES;
    const q = search.toLowerCase();
    return KDP_CATEGORIES.filter(
      (c) =>
        c.main.toLowerCase().includes(q) ||
        c.sub.toLowerCase().includes(q) ||
        c.path.toLowerCase().includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((c) => {
      if (!groups[c.main]) groups[c.main] = [];
      groups[c.main].push(c);
    });
    return groups;
  }, [filtered]);

  const handleCopy = (path) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    toast.success('カテゴリーパスをコピーしました');
    setTimeout(() => setCopiedPath(null), 2000);
  };

  return (
    <div className="space-y-6">
      <CategoryResearch />

      <NeonCard glowColor="amber">
        <div className="flex items-center gap-2 mb-1">
          <FolderSearch className="w-4 h-4 text-neon-amber" />
          <h3 className="font-bold text-sm text-neon-amber neon-amber-glow">KDPカテゴリー確認ツール</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          AIが提案したカテゴリーがKDPに実在するか確認しよう。存在しないカテゴリーは設定できない。
        </p>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="カテゴリー名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border focus:border-neon-amber/50 text-sm"
          />
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          {filtered.length} 件のカテゴリーが見つかりました
        </p>
      </NeonCard>

      <div className="space-y-4">
        {Object.entries(grouped).map(([main, items]) => (
          <div key={main}>
            <h4 className="text-xs font-bold text-neon-pink mb-2 tracking-wide uppercase">{main}</h4>
            <div className="space-y-1.5">
              {items.map((item, idx) => (
                <div
                  key={`${item.path}-${idx}`}
                  className="flex items-center justify-between bg-card border border-border rounded-md px-3 py-2.5 hover:border-neon-amber/30 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.sub}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.path}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 flex-shrink-0 text-muted-foreground hover:text-neon-amber"
                    onClick={() => handleCopy(item.path)}
                  >
                    {copiedPath === item.path ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}