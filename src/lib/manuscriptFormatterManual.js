export const MANUSCRIPT_FORMATTER_MANUAL_UPDATED_AT = '2026年8月6日';

const MANUSCRIPT_FORMATTER_MANUAL_GROUPS_SOURCE = [
  {
    label: 'はじめに・準備',
    sections: [
      'このツールでできること',
      '最初に知っておきたいこと',
      '画面の見方',
      '新しい原稿を作る',
      '既存の原稿を開く',
      'ページ設定を選ぶ',
    ],
  },
  {
    label: '本文・素材の編集',
    sections: [
      '本文を編集する',
      '改ページを入れる',
      '画像を使う',
      '1ページ内を2列・3列にする',
      '縦書きを使う',
      '目次を作る',
      'QRコードカードを作る',
    ],
  },
  {
    label: '保存・書き出し',
    sections: [
      '原稿を保存する',
      'PDFを書き出す',
      'DOCXを書き出す',
      'EPUBを書き出す',
      '右側の「確認」を使う',
    ],
  },
  {
    label: '完成前の確認',
    sections: [
      'おすすめの制作手順',
      'よくある質問と対処',
      '最終チェックリスト',
    ],
  },
];

export const MANUSCRIPT_FORMATTER_MANUAL_GROUPS = MANUSCRIPT_FORMATTER_MANUAL_GROUPS_SOURCE.map((group, groupIndex) => {
  const previousCount = MANUSCRIPT_FORMATTER_MANUAL_GROUPS_SOURCE
    .slice(0, groupIndex)
    .reduce((total, item) => total + item.sections.length, 0);
  return {
    ...group,
    sections: group.sections.map((title, index) => {
      const number = previousCount + index + 1;
      return { id: `manual-section-${number}`, number, title };
    }),
  };
});

export function getManuscriptFormatterManualSectionId(heading) {
  const match = String(heading ?? '').trim().match(/^(\d+)\.\s+/);
  return match ? `manual-section-${match[1]}` : undefined;
}
