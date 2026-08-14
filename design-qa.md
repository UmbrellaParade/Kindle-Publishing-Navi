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

---

# Design QA: 発売目標日・仮リリース日のコンパクト化

## Visual source

- Source screenshot: `C:\Users\myabe\AppData\Local\Temp\codex-clipboard-e9a6fe68-a0b8-4ca4-8a9a-4e6c8e44317b.png`
- Source viewport: 1920 x 1080
- Source state: 公開版 v1.11.6、発売目標日と配信方法が入力済み、正式日基準の日程あり
- Intent: 縦に大きく広がった日付設定欄を、以前の発売目標日欄に近いコンパクトな大きさへ戻し、仮リリース日も同寸法へそろえる

## Implementation evidence

- PC full viewport: `C:\Users\myabe\AppData\Local\Temp\kindle-release-schedule-compact-pc-final-v2.png`
- PC focused view: `C:\Users\myabe\AppData\Local\Temp\kindle-release-schedule-compact-focused.png`
- Mobile full viewport: `C:\Users\myabe\AppData\Local\Temp\kindle-release-schedule-compact-mobile-final-v2.png`
- Implementation viewport/state: 1920 x 1080 and 390 x 844、ローカルQA本で発売目標日・仮リリース日をともに 2026-09-14、配信方法を予約注文にして確認。公開ブラウザとは保存領域が異なるため日程サマリーの内容だけ未設定だが、操作数が最大になる状態で比較した。

## Measurements

| Check | Before | After |
| --- | ---: | ---: |
| Release schedule card height at 1920px | 約741px | 271.4px |
| 正式日 row at 1920px | 126px | 80px |
| 仮日 row at 1920px | 178px | 80px |
| 正式日 input at 1920px | 約785 x 44px | 176 x 36px |
| 仮日 input at 1920px | 320 x 44px | 176 x 36px |
| Mobile date inputs | 309 x 44px | 309 x 44px |
| Mobile 正式日／仮日 rows | 不揃い | 272px / 272px |

Responsive checks:

- 1366px: 正式日・仮日とも 934 x 80px
- 1024px: 正式日・仮日とも 657 x 102px
- 768px: 正式日・仮日とも 713 x 102px
- 390px: document width 385px / viewport width 390px、横あふれなし
- 320px: document width 320px / viewport width 320px、入力と主要ボタンは44px

## Findings and fixes

1. First pass: 正式日、仮日、配信方法、リセットを4つの大きな縦積みカードから、正式日・仮日の2つのコンパクト行と右側レールへ再配置した。
2. First pass finding: 仮日の説明が折り返し、PCで正式日100px／仮日112pxになった。
3. Second pass: 初心者向けの意味を保った短い説明へ整え、詳しいKDP注意をスクリーンリーダー向けにも保持した。配信方法の詳細はラベル、説明関連付け、titleへ残した。
4. Second pass result: PCで正式日・仮日がともに80px、日付入力も176 x 36pxで一致した。
5. 最大操作数の状態で正式日だけ折り返すことを防ぐため、「すべて標準に戻す」を右側の日程サマリーへ移し、「仮日を正式欄へコピー」は意味を保って短く表示した。
6. リセット操作は空いていた右側の日程サマリー下へ移し、折りたたみ状態では44pxの見出しだけにした。
7. 配信方法は選択後も分かるよう、すべての選択肢へ「配信方法：」を付けた。
8. PCは旧来の36px操作域へ戻し、スマホは44px操作域を維持した。
9. 入力変更時の未反映警告は2行の外へまとめ、警告表示中も正式日・仮日の行寸法が変わらないようにした。
10. Console errors: 0
11. Automated checks: 221/221 tests passed, lint passed, Pages production build passed.

## Final comparison

- 参照画像と実装画像を同じ比較入力で確認済み。
- 余白の主因だった縦積みカードを除き、入力幅、高さ、色、角丸、枠線、既存のネオン配色を現行デザインへ一致させた。
- 正式日と仮日はPC・タブレット・スマホの各確認幅で同寸法。横あふれと44px未満のスマホ操作域はない。
- 既存の正式日／仮日／配信方法／逆算／4種類のリセット機能は維持した。

final result: passed
