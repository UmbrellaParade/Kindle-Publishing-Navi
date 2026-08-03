# Amazon A+ 管理画面 — Design QA

## 比較対象

- 参照画像: `C:\Users\myabe\AppData\Local\Temp\codex-clipboard-1bccd735-231d-4a16-a166-6df880a94bc8.png`
- 参照画像: `C:\Users\myabe\AppData\Local\Temp\codex-clipboard-26893125-f754-4e2e-917a-008236de5f4f.png`
- PC実装: `C:\Users\myabe\.codex\visualizations\2026\08\03\019fc56e-1a7b-73c0-a088-181ce21766f2\kindle-a-plus-qa\implementation-desktop-module.png`
- スマホ実装: `C:\Users\myabe\.codex\visualizations\2026\08\03\019fc56e-1a7b-73c0-a088-181ce21766f2\kindle-a-plus-qa\implementation-mobile-module.png`
- 同一画面比較: `C:\Users\myabe\.codex\visualizations\2026\08\03\019fc56e-1a7b-73c0-a088-181ce21766f2\kindle-a-plus-qa\source-vs-implementation.png`

参照画像のAmazon白色UIをそのまま複製せず、本ツール既存のダーク／ネオンテーマへ適応した。比較の主眼は、標準複数画像モジュールAの構造、入力順、操作性、レスポンシブ挙動である。

## 検証条件

- PC: 1275 × 720 px
- スマホ: 390 × 844 px（ページ実幅385 px）
- 状態: 空画像、画像登録済み、選択画像、任意項目入力、ASIN正常／異常、審査NG警告、モジュール追加／削除、自動保存後の再読込

## 比較結果

- 4画像枠、大プレビュー、4サムネイル、各キャプション、選択画像ごとの代替テキスト・見出し・説明を実装済み。
- モジュールと画像の並べ替え、差し替え、ダウンロード、削除を実装済み。
- 既存のNoto Sans JP、ネオン色、Lucideアイコン、カード面を一貫して使用している。
- PCでは参照画面と同じ左右2カラム、スマホでは画像部→登録文の1カラムへ崩れず変形する。
- スマホ実幅385 pxで `scrollWidth === clientWidth` を確認し、横方向のページ溢れはない。
- 入力ラベル、文字数、必須／任意、選択状態、無効状態、画像仕様、alt説明が読み分けられる。

## 修正履歴

1. P1: スマホで画像操作の削除ボタンだけが次行へ孤立した。アップロード操作をスマホ幅では全幅にし、アイコン操作を次行へまとめた。
2. P1: 制作進捗カードからA+へ移動した際、横スクロール内のアクティブタブが見えない場合があった。選択タブを中央へ自動スクロールし、`aria-current`を追加した。
3. P1: 任意の見出し・説明・キャプションが必須に見えた。任意表示を追加し、準備度は画像・alt・ASIN・提出前確認を中心に計算するよう修正した。
4. P1: ASIN、RGB、状態同期の説明が不足していた。10文字形式／重複検査、RGB・300PPI確認、KDP非同期の注記を追加した。
5. 最終パス: PC／スマホともP0・P1・P2の未解決事項なし。ブラウザコンソールエラーなし。

## Final result

passed
