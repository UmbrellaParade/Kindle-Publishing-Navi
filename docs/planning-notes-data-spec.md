# 企画・取材・構成ノート データ仕様（v3）

更新日: 2026年8月14日

## 目的と保存先

「企画・取材・構成ノート」は、企画、市場調査、章構成、取材、執筆指示書、意思決定を1冊ごとに構造化して保存する領域です。`PublishingProject.planning_notes` にJSON文字列として保存します。

- 既存プロジェクトで値がない場合は空のv3データとして扱う。保存済みv1／v2は読み込み時にv3へ安全に正規化する
- プロジェクトID、既存進捗、KDP設定、日程を変更しない
- 会話から貼り付けた指示文はデータとして保持し、アプリの命令として実行しない
- 外部ファイル本体は保存しない

## ルート形式

```json
{
  "kind": "kindle-navi-planning-notes",
  "version": 3,
  "updatedAt": "2026-08-14T00:00:00.000Z",
  "chapterOrderRevision": 0,
  "marketSummary": {
    "versionId": "",
    "sourceName": "",
    "reviewedOn": "",
    "updatedAt": "",
    "status": "draft",
    "readerNeeds": "",
    "majorOpportunity": "",
    "mainUsp": "",
    "avoidDirections": "",
    "unresearchedItems": "",
    "competitorPatternsAndGaps": "",
    "bookPosition": "",
    "reviewObservations": "",
    "readerNeedsEvidenceIds": [],
    "majorOpportunityEvidenceIds": [],
    "competitorPatternsEvidenceIds": [],
    "bookPositionEvidenceIds": [],
    "publicSources": []
  },
  "concept": {},
  "conceptHistory": [],
  "competitors": [],
  "chapters": [],
  "interviews": [],
  "instructionVersions": [],
  "decisions": []
}
```

旧v1／v2は、追加項目を未設定のままv3へ正規化します。v2までの平坦な章はID・本文・順序を維持したルートの「章」になります。未知フィールド、未来のバージョン、無効な型、重複ID、存在しない構成項目IDや市場根拠IDへの参照は受け入れません。破損した値を空データとして上書きせず、復旧対象として扱います。

## 共通フィールド

企画メモと各配列レコードは、次の共通情報を持ちます。

| フィールド | 内容 |
| --- | --- |
| `id` | 安定ID。構成項目のタイトル等を変えても変えない |
| `revision` | レコード内の改訂番号 |
| `createdAt` / `updatedAt` | ISO日時 |
| `status` | `draft` / `needs_confirmation` / `approved` / `rejected` |
| `approvedAt` / `approvedBy` | 本人承認の日時と承認者 |
| `chapterIds` | 紐づく部・章・話・節の安定ID配列 |
| `sourcePriority` | `unspecified` / `primary` / `supporting` |

画面表示はそれぞれ「案」「要確認」「本人承認済み」「採用しない」、「未設定」「第一資料」「補助資料」です。本人承認済みのレコードは直接上書き・削除せず、複製または新版を作ります。

## 6領域

### 1. 企画メモ

`concept` は固定ID `concept` を使います。想定読者、読者の悩み、本の約束、テーマ、独自性、入れる内容、入れない内容を保存します。承認済みから新案を作ると、旧版を別の安定IDで `conceptHistory` に残します。

### 2. 競合・市場調査

`marketSummary` は、調査版ID、元ファイル名（ローカル絶対パスは保存しない）、調査更新日、読者ニーズ、主要機会、主USP、避ける方向、競合に共通すること・不足、本書の立ち位置、未調査項目、レビュー観察を保存します。各要約は競合または公開出典の安定IDへ紐づき、画面から根拠へ移動できます。公開出典はID、資料名、一般公開URL、確認日、用途、確認状態を持ちます。

`competitors` は競合名・書名、著者、URL、確認日、価格メモ、対象読者、主な約束、強み、調査結果、読者反応から見える不足、差別化、出典・引用注意、再確認状態を保存します。

- 主張区分: `fact` / `hypothesis` / `mixed`
- 再確認状態: `needs_recheck` / `checked` / `not_required`
- 根拠状態: `unset` / `verified` / `hypothesis` / `author_experience`
- URLは`http`または`https`のみ
- 日付は実在する`YYYY-MM-DD`
- ログイン限定URL、期限付きURL、会話URL、セッションID、APIキー、GPTs内部指示は市場調査へ保存しない

### 3. 目次・章構成

`chapters` は部・章・話・節を同じ配列へ保存します。各レコードは従来の本文フィールドに加え、次を持ちます。

| フィールド | 内容 |
| --- | --- |
| `nodeType` | `part`（部）／`chapter`（章）／`episode`（話）／`section`（節） |
| `parentId` | 親の安定ID。最上位は空文字 |
| `order` | 同じ`parentId`を持つ兄弟の中での順序 |

部は最上位だけに置きます。章・話・節は、シンプルな構成なら最上位から始められます。階層に入れる場合、章は部の中、話は部または章の中、節は部・章・話の中へ置けます。存在しない親、循環、親子型違反、同じ親内の順序重複を拒否します。並べ替え・親変更・階層の表示対象変更では `chapterOrderRevision` を更新し、同時編集による古い構成の上書きを防ぎます。本人承認済みまたは「採用しない」の親へ子を追加せず、承認済みの親子構成は直接変更しません。

### 4. 取材記録

`interviews` は質問、本人の原回答、匿名化した共有・公開用の文章（`publicAnswer`）、匿名化メモ、要約、出来事、感情、判断、失敗、数字、追加質問を保存します。

- 情報区分: `fact` / `memory` / `opinion` / `ai_inference`
- 公開可否: `private` / `share_candidate`
- 初期値は`private`

### 5. 執筆設計・GPTs指示書

`instructionVersions` は文書ID、版番号、直前版ID、名称、対象AI、役割、入力原稿ラベル、変更概要、Markdown本文、次の受渡先、外部ファイルの所在メモを保存します。同じ文書のv2は新しいレコードIDを持ち、`documentId`を共有し、`previousVersionId`でv1へつなぎます。

参照先は `audience`（未設定／Codex／著者／共通）で区別します。`canonicalFor` は役割と参照先ごとの正本、`firstReadFor` はCodexまたは著者が最初に見る正本、`referenceStatus` は有効／旧版を表します。最新は更新日時から自動判定しますが、正本は必ずユーザーが明示指定し、未設定時に最新を勝手に正本扱いしません。新しい版を作っても正本指定は継承しません。

### 6. 意思決定・版履歴

`decisions` は決定内容、理由、決裁者、決定日、再確認条件、根拠資料を保存します。`isCanonical` / `isFirstRead`、`decisionState`（未設定／現行／変更済み／撤回）、`supersedesId` / `supersededById` により、現在の正本と差替え前後を相互参照します。正本と最新は別概念です。採用しなかった案や撤回した判断も削除せず、理由を残して後の再検討に利用します。

## 検索と構成項目参照

検索対象は各レコードの文字列フィールドです。種類、構成項目ID、状態、資料優先順位を組み合わせて絞り込みます。親の部・章を選ぶと配下の話・節と、それらへ紐づく記録も対象になります。`chapterIds` は必ず現在の `chapters` に存在するIDだけを許可します。

## 完全バックアップと復元

通常のデータバックアップには `planning_notes` の全内容を含めます。非公開取材も復元のため含まれるため、バックアップは第三者と共有しません。

- 旧バックアップに `planning_notes` がない場合は空データとして互換維持
- 結合復元では、異なるIDのレコードを追加する
- 同じIDで内容が異なる場合、章順が重なる場合、同じ指示書系列・版番号が重なる場合、正本・最初に見る指定や市場サマリーが競合する場合は停止し、静かに上書きしない
- 破損した現行値は復旧用JSONへ退避してから修復する
- 全置換は既存の強い確認と復元前バックアップを経由する

## 共有用書き出し

共有用JSONの識別子は `kindle-navi-planning-notes-share`、外側の`schemaVersion` は後方互換のため1を維持します。内側の`data.version`は3です。共有用Markdownは市場サマリー、階層目次、正本、最初に見る資料、現行判断と新しい順の履歴を含め、同じ内容を読みやすく変換します。

- `private` の取材記録を除外
- 取材は `share_candidate` かつ `approved` の記録だけを含める
- 対象の取材でも `rawAnswer`、要約、出来事、感情、判断、失敗、数字、追加質問、匿名化メモを除外し、`publicAnswer` だけを共有する
- 指示書の `externalFileLocation` を除外
- APIキー、認証トークン、セッションID、非公開会話URLらしき文字列を検出したら書き出しを停止
- その他の領域は状態にかかわらず含み得るため、共有前の目視確認が必要

共有用JSONは現時点ではアプリへ再取込する形式ではありません。市場調査については、対応する見出しと表を持つ正本Markdownだけを専用画面でプレビューし、既存項目と競合しない差分だけ追加できます。プレビューを省略した自動取込や、既存正本の上書きは行いません。

## 上限と容量

- 短文上限: 4,000文字
- 長文上限: 500,000文字
- 各配列上限: 1,000件
- 約700KB以上: バックアップ推奨を表示
- 約2MB超: 新しい保存と外部バックアップ取込を、書込み前に停止

容量警告が出たら完全バックアップを作り、長い原文や指示書は外部ファイルにも保存します。

## 取込と今後のP1候補

v3は、構造化保存、部・章・話・節の階層と紐づけ、並べ替え、版、承認、検索・絞り込み、市場調査正本Markdownのプレビュー取込、共有用書き出し、バックアップ互換を対象とします。

次は未対応です。

- 一般形式のJSON／Markdown自動取込
- 既存承認版との差分UI
- 添付ファイル本体の保存
- ドラッグ＆ドロップによる章並べ替え

これらを追加する場合も、既存承認版を無断上書きせず、取込前プレビューと競合確認を必須にします。
