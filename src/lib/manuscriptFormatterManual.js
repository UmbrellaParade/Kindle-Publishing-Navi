export const MANUSCRIPT_FORMATTER_MANUAL_UPDATED_AT = '2026年8月15日';

const MANUSCRIPT_FORMATTER_MANUAL_GROUPS_SOURCE = [
  {
    label: '利用前の確認',
    sections: [
      'このマニュアルの対象',
      'パソコンで使用してください',
      'KindleとA5・A6の違い',
      '作業前に保存方法を確認する',
    ],
  },
  {
    label: 'Kindle原稿',
    sections: [
      '完成原稿をKindle用に仕上げる流れ',
      '新しい原稿を作る・既存原稿を開く',
      '画面の見方',
      '本文ツールバーの記号と機能',
      '見出し・ルビ・文字サイズを設定する',
      '改ページと画像を設定する',
      'Kindle向け目次を作る',
      'Kindle原稿をDOCXで書き出す',
      'DOCXを書き出した後に確認する',
      'KDPへ登録するときの注意',
    ],
  },
  {
    label: 'しまうま出版',
    sections: [
      'しまうま出版とは',
      'しまうま出版のA5・A6を選ぶ',
      'しまうま出版用PDFを作る流れ',
      '漫画・画像・QRコードを使う',
      '縦書き・横組み・カラムを使う',
    ],
  },
  {
    label: '保存・最終確認',
    sections: [
      '保存と復元',
      'よくある問題と最終チェック',
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
