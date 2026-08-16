export const KINDLE_NAVI_MANUAL_UPDATED_AT = '2026年8月16日';

const KINDLE_NAVI_MANUAL_GROUPS_SOURCE = [
  {
    label: 'はじめる',
    sections: [
      'このマニュアルの使い方',
      'ゴリアスさんの教材・スプレッドシートとの関係',
      '仮日または発売目標日から始める初回ガイド',
      '出版までのおすすめ順',
      '画面上部と自動保存',
    ],
  },
  {
    label: '10の機能',
    sections: [
      'Kindle本制作進捗',
      '企画・取材・構成ノート',
      'KDP登録進捗',
      'カテゴリーチェック',
      'プロモーション戦略メモ',
      'KDP書籍説明文',
      '表紙＆A+コンテンツ',
      'Kindle原稿作成ガイド',
      'Kindle原稿整形ツール（テスト版）',
      '辛口論評',
    ],
  },
  {
    label: '安全に続ける',
    sections: [
      '保存・バックアップ・復元',
      'パソコンとスマホ・アップデート',
      '出版後の展開を残す',
      'よくある質問',
      '初回チェックリスト',
    ],
  },
];

export const KINDLE_NAVI_MANUAL_GROUPS = KINDLE_NAVI_MANUAL_GROUPS_SOURCE.map((group, groupIndex) => {
  const previousCount = KINDLE_NAVI_MANUAL_GROUPS_SOURCE
    .slice(0, groupIndex)
    .reduce((total, item) => total + item.sections.length, 0);

  return {
    ...group,
    sections: group.sections.map((title, index) => {
      const number = previousCount + index + 1;
      return { id: `kindle-navi-manual-section-${number}`, number, title };
    }),
  };
});

export function getKindleNaviManualSectionId(heading) {
  const match = String(heading ?? '').trim().match(/^(\d+)\.\s+/);
  return match ? `kindle-navi-manual-section-${match[1]}` : undefined;
}
