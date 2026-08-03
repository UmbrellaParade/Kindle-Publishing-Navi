export const DEFAULT_RELEASE_METHOD = 'ebook_preorder';

export const RELEASE_METHOD_OPTIONS = Object.freeze([
  {
    value: 'ebook_preorder',
    label: '電子書籍：予約注文（発売日を指定）',
    shortLabel: '電子書籍の予約注文',
    guidance: '発売日を指定したい電子書籍向けです。最終原稿は発売日の72時間以上前が公式期限ですが、このナビでは審査の余裕を見て14日前の提出を目安にします。',
  },
  {
    value: 'ebook_immediate',
    label: '電子書籍：審査後すぐ公開（目標日は目安）',
    shortLabel: '電子書籍の今すぐ配信',
    guidance: '審査完了後に販売開始されるため、入力日は計画上の目安です。審査は通常3〜10営業日ですが、追加確認で長引く場合があります。',
  },
  {
    value: 'print_scheduled',
    label: '紙書籍：発売日を設定',
    shortLabel: '紙書籍の発売日設定',
    guidance: '新規の紙書籍向けです。KDPでは5〜90日前から発売日を設定でき、原稿等の更新は発売日の5日前に締め切られます。',
  },
]);

export function getReleaseMethod(value) {
  return RELEASE_METHOD_OPTIONS.find(option => option.value === value)
    || RELEASE_METHOD_OPTIONS.find(option => option.value === DEFAULT_RELEASE_METHOD);
}
