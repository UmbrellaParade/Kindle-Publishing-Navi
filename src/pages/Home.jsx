import React, { useState, useEffect } from 'react';
import RainEffect from '../components/RainEffect';
import AppHeader from '../components/AppHeader';
import PublishingChecklistTab from '../components/tabs/PublishingChecklistTab';
import KdpChecklistTab from '../components/tabs/KdpChecklistTab';
import CategoryCheckTab from '../components/tabs/CategoryCheckTab';
import PromoChecklistTab from '../components/tabs/PromoChecklistTab';
import FormatGuideTab from '../components/tabs/FormatGuideTab';
import { base44 } from '@/api/base44Client';
import { AnimatePresence, motion } from 'framer-motion';

const TABS = [
  { id: 'creation',  label: 'Kindle本制作進捗' },
  { id: 'kdp',       label: 'KDP登録進捗' },
  { id: 'category',  label: 'カテゴリーチェック' },
  { id: 'promo',     label: 'プロモーション進捗' },
  { id: 'format',    label: '原稿Kindle調整ツール' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('creation');
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadProjects = async () => {
    const list = await base44.entities.PublishingProject.list('-created_date', 50);
    setProjects(list);
    return list;
  };

  useEffect(() => {
    loadProjects().then(list => {
      if (list.length > 0) setCurrentProject(list[0]);
    });
  }, []);

  const handleProjectUpdate = async (updated) => {
    setSaving(true);
    setCurrentProject(updated);
    setProjects(ps => ps.map(p => p.id === updated.id ? updated : p));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setTimeout(() => setSaving(false), 500);
  };

  const tabProps = { project: currentProject, onProjectUpdate: handleProjectUpdate, saving, saved };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#0d0d1a' }}>
      <RainEffect />
      <div className="fixed top-0 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(255,45,120,0.04)' }} />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(0,245,255,0.04)' }} />

      {/* ヘッダー（タイトル＋プロジェクト選択） */}
      <AppHeader
        projects={projects}
        currentProject={currentProject}
        onSelectProject={setCurrentProject}
        onRefresh={loadProjects}
        saving={saving}
        saved={saved}
      />

      {/* タブナビゲーション */}
      <div className="sticky top-0 z-30 border-b" style={{ background: 'rgba(13,13,26,0.97)', borderColor: '#2a2a4a', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-7xl mx-auto px-2">
          <div className="flex gap-0.5 py-2 overflow-x-auto scrollbar-hide">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-3 md:px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-neon-pink neon-pink-glow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={activeTab === tab.id
                  ? { background: 'transparent', border: '1px solid transparent' }
                  : { background: 'transparent', border: '1px solid transparent' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* コンテンツ */}
      <main className="relative z-10 max-w-7xl mx-auto px-2 py-6 pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'creation'  && <PublishingChecklistTab {...tabProps} />}
            {activeTab === 'kdp'       && <KdpChecklistTab {...tabProps} />}
            {activeTab === 'category'  && <CategoryCheckTab {...tabProps} />}
            {activeTab === 'promo'     && <PromoChecklistTab {...tabProps} />}
            {activeTab === 'format'    && <FormatGuideTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
