# Design QA — メイン機能ナビゲーション

## 比較対象

- Source visual truth: `C:\Users\myabe\AppData\Local\Temp\codex-clipboard-35479cca-855e-4fa2-984b-3bc02fce4a4e.png`
- Source pixels: 1306 × 72 px
- Browser-rendered implementation: `C:\Users\myabe\AppData\Local\Temp\kindle-navi-nav-qa-final.png`
- Implementation pixels: 1301 × 717 px（ブラウザ表示領域 1306 × 720 CSS px、density 1相当）
- Focused side-by-side comparison: `C:\Users\myabe\AppData\Local\Temp\kindle-navi-nav-qa-comparison-final.png`
- Mobile closed/open evidence:
  - `C:\Users\myabe\AppData\Local\Temp\kindle-navi-nav-mobile-closed.png`
  - `C:\Users\myabe\AppData\Local\Temp\kindle-navi-nav-mobile-open.png`
- State: ダークテーマ、Kindle本制作進捗を選択、通常表示

## Findings

- P0/P1/P2の未解決項目なし。
- PC・タブレットでは10項目を5列×2段で均等配置し、横スクロールと項目欠落を解消した。
- スマホでは現在地を常時表示し、「機能一覧（10）」を押すと2列で全項目を確認できる。

## 必須 fidelity surfaces

- Fonts and typography: 既存のフォント、太さ、ネオン発光、正式な項目名を維持。長い項目だけ自然な折返しを許可し、省略していない。
- Spacing and layout rhythm: 元の左右余白、タブ間隔、44px以上の操作領域を維持。意図的に1段72pxから2段109pxへ広げ、10項目を表示した。
- Colors and visual tokens: 元の濃紺背景、ミュート文字、選択中のネオンピンク、シアンのフォーカス表示を維持。
- Image quality and asset fidelity: 対象領域にラスター画像・ロゴ・装飾画像はなく、画質差分なし。スマホ開閉アイコンは既存のLucideアイコンを使用。
- Copy and content: 10項目の名称・順番を変更していない。スマホには「表示中の機能」「機能一覧（10）」だけを追加した。

## Responsive / interaction evidence

- 768 / 1024 / 1306 / 1920px: 全10項目が表示され、ナビの `scrollWidth === clientWidth` または全ボタンがviewport内。
- 390px: document幅385px、viewport幅390pxで横はみ出しなし。ページ最上部から一覧を開くとナビが上端へ移動し、一覧下端313pxまで画面内に表示される。
- 320 × 568px: 全10項目が横はみ出しなく表示され、一覧下端317pxまで画面内に収まる。低い画面では一覧自体を縦スクロール可能。
- スマホで「辛口論評」を選ぶと一覧が閉じ、選択中表示と本文が切り替わり、フォーカスは「機能一覧（10）」へ戻る。
- マニュアル途中の固定目次は、2段ナビ下で `asideTop 128px >= navBottom 109px` となり隠れない。
- コンソール error / warning: 0。

## Comparison history

1. Before: 1306px幅で8項目だけ表示され、残り2項目は横スクロールしないと発見できなかった。
   Fix: PC・タブレットを5列×2段へ変更し、スマホを開閉式の全項目一覧へ変更。
   Evidence: focused comparisonの左が旧表示、右が修正後。右側は全10項目を表示しスクロールバーなし。
2. First implementation comparison: 選択中タブに新しい枠背景が付き、元デザインより強調が大きかった（P2）。
   Fix: PCの選択状態を元どおりネオンピンク文字＋発光だけへ戻した。
   Evidence: final focused comparisonでは選択状態の色・発光がsourceと一致している。

## Implementation checklist

- [x] PC・タブレットで全10項目を常時表示
- [x] スマホで現在地と全10項目へアクセス
- [x] ページ最上部・小さい画面でも開いた一覧を見失わない
- [x] 横スクロールを撤廃
- [x] 44px以上の操作領域、aria-current、focus ring、選択後のフォーカス復帰を維持
- [x] 2段ナビに合わせて固定目次の位置を調整
- [x] ブラウザで主要切替とコンソールを確認

## Follow-up polish

- なし。

final result: passed
