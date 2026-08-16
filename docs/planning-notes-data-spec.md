# 企画・取材・構成ノート データ仕様（v8）

更新日: 2026年8月17日

## 目的と保存先

「企画・取材・構成ノート」は、企画、市場調査、章構成、取材、執筆指示書、意思決定、Kindle出版サポートGPTと辛口論評GPTの世代管理、両管理の引継ぎテンプレートを1冊ごとに構造化して保存する領域です。`PublishingProject.planning_notes` にJSON文字列として保存します。

- 既存プロジェクトで値がない場合は空のv8データとして扱う。保存済みv1〜v7は読み込み時にv8へ安全に正規化する
- プロジェクトID、既存進捗、KDP設定、日程を変更しない
- 会話から貼り付けた指示文はデータとして保持し、アプリの命令として実行しない
- 外部ファイル本体は保存しない

## ルート形式

```json
{
  "kind": "kindle-navi-planning-notes",
  "version": 8,
  "updatedAt": "2026-08-14T00:00:00.000Z",
  "chapterOrderRevision": 0,
  "outlineRevision": 0,
  "draftOutlineChapterIds": [],
  "confirmedOutlineId": "",
  "outlineSnapshots": [],
  "chapterWritingStates": [],
  "gptSessions": [],
  "critiqueGptSessions": [],
  "gptHandoffTemplates": {
    "support": {
      "revision": 0,
      "updatedAt": "",
      "handoffDocumentInstruction": "",
      "handoffStartMessage": ""
    },
    "critique": {
      "revision": 0,
      "updatedAt": "",
      "handoffDocumentInstruction": "",
      "handoffStartMessage": ""
    }
  },
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

旧v1〜v7は、既存のID・本文・順序・階層・章紐付け・`gptSessions`を変えずv8へ正規化します。v1〜v6は`gptSessions`を空、v1〜v7は`critiqueGptSessions`を空、`gptHandoffTemplates`を「改訂0・更新日時空・override本文空」で開始します。組込既定文は各プロジェクトへ複製せず、表示・差し込み時だけpure helperで補います。未知フィールド、未来のバージョン、無効な型、重複ID、存在しない参照は受け入れません。破損した値を空データとして上書きせず、復旧対象として扱います。

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

## 8領域と非公開引継ぎ設定

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

`chapters` は部・章・話・節を同じ配列へ保存する安定ID台帳です。現在編集中の仮目次に含まれる項目は、rootの`draftOutlineChapterIds`で明示します。各レコードは従来の本文フィールドに加え、次を持ちます。

| フィールド | 内容 |
| --- | --- |
| `nodeType` | `part`（部）／`chapter`（章）／`episode`（話）／`section`（節） |
| `parentId` | 親の安定ID。最上位は空文字 |
| `order` | 同じ`parentId`を持つ兄弟の中での順序 |

部は最上位だけに置きます。章・話・節は、シンプルな構成なら最上位から始められます。階層に入れる場合、章は部の中、話は部または章の中、節は部・章・話の中へ置けます。存在しない親、循環、親子型違反、同じ親内の順序重複を拒否します。並べ替え・親変更・階層の表示対象変更では `chapterOrderRevision` を更新し、同時編集による古い構成の上書きを防ぎます。本人承認済みまたは「採用しない」の親へ子を追加せず、承認済みの親子構成は直接変更しません。

`chapters`のうち`draftOutlineChapterIds`に含まれる項目だけが「仮目次（編集中）」です。activeな子は親もactiveでなければならず、同じactive目次内の兄弟順序重複を拒否します。目次全体の仮／確定と、各構成項目の`status`（案／要確認／本人承認済み／採用しない）は別概念として扱います。

部・章・話・節の種類を一括変更するときは、画面の検索・絞り込みに左右されず、現在のactiveな仮目次全体から指定した変更前種類に一致する項目をプレビューします。`rejected`（採用しない）は履歴として対象外にして変更せず、`approved`（本人承認済み）が1件でも含まれる場合や、変更後に許可されない親子型になる場合は全件を適用前に停止します。適用直前に`outlineRevision`と`chapterOrderRevision`を再照合し、成功時は対象レコードの`nodeType`・`revision`・`updatedAt`だけを同一処理内で更新して両改訂番号を1回ずつ増分します。`id`、タイトル・本文、`order`、`parentId`、`status`、`chapterIds`、原稿進捗、取材等の外部章紐づけ、`outlineSnapshots`、`confirmedOutlineId`は変更しません。確定目次・過去版・退避台帳へ一括変更を波及させません。

全面的に目次を書き直す場合は、個別削除を繰り返しません。まず現在のactive目次全体を`draft`の`outlineSnapshots`へ完全複製し、その保存が成立した後で`draftOutlineChapterIds`を新しい目次のIDへ原子的に差し替えます。取材・企画・指示書・意思決定等の`chapterIds`が参照している旧章は、表示名と再紐づけ先を失わないよう`chapters`台帳へ残します。階層の途中が参照されている場合は、その親と章自身が参照する構成項目も参照経路として残します。一方、外部記録から参照されない旧章は完全な内容が自動保存版に残っているため、同じ内容を`chapters`台帳へ重複保持せず、書き直しのたびに台帳が増え続けるのを防ぎます。

台帳に残る旧章のID・本文・状態・承認情報・版・更新日時と、外部記録の`chapterIds`は変更しません。台帳から圧縮された旧章も、書き直し直前の`outlineSnapshots[].chapters`にID・本文・状態・承認情報・版・更新日時を含む完全な形で保持します。現在の`confirmedOutlineId`、確定版、過去の保存版も変更・削除しません。空配列への差替えは「新しい空の仮目次」として許可します。処理途中で目次履歴100件、参照上必要な台帳と新目次の合計1,000件、または約2MBの上限を超える場合は、保存版作成・台帳圧縮・差替えの全体を適用せず、元データをそのまま残します。

Codex等から受け取った目次Markdownは、`# 第一部`、`## 第一話`、`### 第一節`のような見出し、または`# 第1章`を並べた平坦目次だけを文字列データとして解析します。プレビュー前に空入力、見出しの深さ飛び、件数・文字数超過、重複ID、APIキー・認証情報・非公開会話URLを停止します。貼り付けた文章を命令として実行しません。新しい構成項目はすべて`draft`で作り、保存済みIDとの衝突や現在と同内容の二重適用を停止します。

書き直し後も`chapterIds`が参照する旧IDは台帳に残るため、旧取材の紐づけと表示名は失われません。本人承認済み記録を含め、本文・状態・承認情報を変えずに`chapterIds`だけを付け直す専用更新を許可します。旧目次に紐づく記録は`chapterId: "archived"`で絞り込めますが、参照用に残した旧章台帳自体は編集一覧へ戻しません。紐づけを現在の目次へ付け直すと、次回の全面書き直し時に参照されなくなった旧章が自動的に台帳から圧縮されます。

`outlineSnapshots` は目次全体を保存時点のまま保持する追加専用の配列です。各保存版は次を持ちます。

| フィールド | 内容 |
| --- | --- |
| `id` | 目次保存版の安定ID |
| `versionNumber` | 仮・確定を通した一意の連番 |
| `kind` | `draft`（仮目次メモ）／`confirmed`（確定目次） |
| `label` / `note` | 版名と変更メモ |
| `createdAt` | 保存日時（ISO日時） |
| `sourceOutlineRevision` | 保存元の仮目次全体の改訂番号 |
| `sourceChapterOrderRevision` | 保存元の階層・順序改訂番号 |
| `chapters` | 保存時点の部・章・話・節の完全な複製 |

`confirmedOutlineId` は現在使う確定目次の保存版IDです。空の場合は確定目次未設定で、仮目次を自動で確定版扱いしません。確定目次を更新しても旧版を上書き・削除せず、新しい`confirmed`保存版を追加して参照先だけを変更します。保存版は読み取り専用で、同じIDの内容変更、版番号重複、不正な親子関係、存在しない確定目次参照を拒否します。`outlineRevision` はタイトルや章内構成を含む仮目次の変更と、保存版・確定参照の変更で更新し、古い画面からの保存を止めます。

改訂番号・順序改訂番号・版番号はJavaScriptの安全な整数範囲だけを受け入れます。上限に達して次の番号へ増分できない場合も、古い画面の検出が無効にならないよう保存を停止します。

### 章ごとの原稿進捗とGoogleドキュメント

`chapterWritingStates`は、仮目次および現在の確定目次にある部・章・話・節ごとの執筆進捗を、目次本文・項目承認とは別に保存する疎な配列です。未操作の項目は配列へ作らず、明示的に未完成・URLなしへ戻した場合は、古いバックアップから値が復活しないよう空の状態も改訂番号付きで保持します。

| フィールド | 内容 |
| --- | --- |
| `chapterId` | `chapters`またはいずれかの`outlineSnapshots[].chapters`に存在する構成項目ID |
| `revision` | この項目の原稿進捗だけに使う競合検出番号 |
| `createdAt` / `updatedAt` | ISO日時 |
| `completed` | 原稿を書き終えたかを示すboolean |
| `completedAt` | 完成へ切り替えた日時。未完成へ戻すと空文字 |
| `documentUrl` | 対応する原稿保存先のHTTPS URL。既存フィールド名を互換用に維持し、空文字で未設定 |

`documentUrl`はGoogleドキュメント、Notion、OneDrive、Dropboxなどの`https://...` URLを受け入れます。HTTP、非Webプロトコル、URL内のユーザー名・パスワード、認証情報・期限付き署名を示すquery／fragmentは拒否します。アプリはリンクを保存して新しいタブで開くだけで、外部サービスの原稿本文を取得・同期・編集しません。

現在の確定目次は目次本文を読み取り専用のまま保ち、完成状態とURLだけ更新できます。過去の目次履歴は当時の進捗を推測して重ねず、原稿進捗の編集対象にもさせません。同じIDが仮目次と現在の確定目次にあれば同じ状態を表示します。保存版だけに残るIDの状態も保持できますが、保存版の章本文そのものは変更しません。

構成項目を個別削除するとき、そのIDが保存版に残らない場合は対応する原稿進捗も同じ操作で削除します。保存版に同じIDが残る場合は、完成状態とリンクを保存版参照用に保持します。原稿進捗やURLを先に一件ずつ解除させる操作にはしません。進捗状態は最大10,000件で、総データ約2MBの容量ガードも適用します。

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

### 7. Kindle出版サポートGPT 管理

`gptSessions` は1セッションを1件とし、転記用列順に `managementId`（GPT管理ID）、`projectTitle`（企画・作品名）、`sessionName`、`gptUrl`、`scope`（担当範囲）、`sessionStatus`、`startedOn`、`handoffToId`、`handoffMemo`、`notes`を保存します。各件は内部の安定`id`、`revision`、`createdAt`、`updatedAt`も持ちます。

- `managementId` は `GPT-001`形式で重複させず、作成後は変更しない
- `sessionStatus` は `active` / `handed_over` / `completed` / `on_hold`。`active`（使用中）は1プロジェクトに1件
- `handoffToId` は存在するGPT管理IDを参照し、自己参照・循環・存在しない参照を拒否する。`handed_over`には引継ぎ先が必要
- `gptUrl` は空またはHTTPS。会話URLは完全バックアップ用の非公開値として保存できるが、userinfoや認証・token・session・署名・期限を示すquery／fragmentは拒否する
- 新しい引継ぎ先は`on_hold`で作り、旧`active`から引継ぎ先IDをつないだ後、使用開始時に旧を`handed_over`、新を`active`へ同時更新する

`startedOn`は日付inputから受け取った`YYYY-MM-DD`文字列を、新規作成・更新・JSON再読込・完全バックアップでそのまま保持します。空文字だけを未設定とし、有効な日付をfalsy変換で失わないようにします。

### 8. 辛口論評GPT 管理

`critiqueGptSessions`は辛口論評用のGPT会話を1セッション1件で管理します。辛口論評の結果・点数・原稿スナップショットを持つ既存の「辛口論評履歴」とは別領域です。管理記録を論評結果として追加したり、論評結果を上書きしたりしません。

| フィールド | 内容 |
| --- | --- |
| `managementId` | `CRITIQUE-001`形式の一意な連番。作成後は変更不可 |
| `sessionName` | 論評GPTセッション名 |
| `gptUrl` | 空またはHTTPSの非公開会話URL |
| `scope` | 担当する論評範囲 |
| `sessionStatus` | `active` / `handed_over` / `completed` / `on_hold` |
| `startedOn` | 開始日。空または実在する`YYYY-MM-DD` |
| `targetManuscriptVersionId` | 対象原稿の版ID。論評履歴への自動参照にはしない |
| `critiqueRound` | 1以上の論評回。未設定は0 |
| `handoffToId` | 引継ぎ先の`CRITIQUE-xxx` |
| `handoffMemo` / `notes` | 引継ぎと非公開備考 |

各件は安定`id`、`revision`、`createdAt`、`updatedAt`も持ちます。`active`は1プロジェクト1件で、自己参照・存在しない引継ぎ先・循環を拒否します。`handed_over`には引継ぎ先が必要です。新しい引継ぎ先の作成と新旧の使用中切替は、関係を中途で残さない原子的な一操作で更新します。更新・削除・引継ぎ・使用開始は`updatedAt`を照合し、古い画面の上書きを停止します。

`gptUrl`はサポートGPTと同じ非公開URL検証を使います。空またはHTTPSだけを受け付け、userinfo（ユーザー名・パスワード）や認証情報、token、session ID、署名、期限を示すquery／fragmentを含むURLは保存前に拒否します。

### 非公開のGPT引継ぎテンプレート

`gptHandoffTemplates.support`と`gptHandoffTemplates.critique`は、旧GPTで使う「引継ぎ書の作成指示」と新GPTで使う「引継ぎ開始文」のユーザー編集overrideを持ちます。各枠は`revision`、`updatedAt`、`handoffDocumentInstruction`、`handoffStartMessage`だけを持ちます。

- 初期値は改訂0、更新日時空、本文2件とも空。この4条件を満たす記録だけを「未編集」とし、改訂0のまま本文overrideを持つ不整合は拒否する。組込既定文はデータへ複製せず表示時に解決する
- 組込既定文と同じ文面は空overrideへ圧縮し、実際に編集した差分だけ保存する
- 作成指示は番号付き10項目を持ち、全文転載を避け、本人の言葉とAI提案、確定・仮・未確認を分ける
- 開始文は「確定を変えない」「未確定を確定扱いしない」「目次・原稿・論評履歴を無断上書きしない」「不足・矛盾を先に示す」「現在地・未確定・次の一手を復唱する」「著者承認後に再開する」を明記する
- 差し込みは`{{作品名}}`、`{{現ID}}`、`{{次ID候補}}`、`{{担当範囲}}`の安全な値だけ。辛口論評は`{{対象版ID}}`、`{{論評回}}`、`{{前回指摘}}`、`{{未対応指摘}}`も許可する
- レコードのURL・会話本文・セッションID・APIキー等のフィールドは差し込み対象にしない。安全な入力欄に非公開会話URL・限定URL・セッションID・APIキー等が含まれた場合も自動挿入しない。一般公開URLはその他の安全な文字と同様に扱う
- テンプレート更新は`updatedAt`のCASで古い画面を停止する

## 検索と構成項目参照

検索対象は各レコードの文字列フィールドです。種類、構成項目ID、状態、資料優先順位を組み合わせて絞り込みます。親の部・章を選ぶと配下の話・節と、それらへ紐づく記録も対象になります。`chapterIds` は必ず`chapters`台帳に存在するIDだけを許可し、active／退避済みのどちらも参照できます。

## 完全バックアップと復元

通常のデータバックアップには `planning_notes` の全内容を含めます。非公開取材も復元のため含まれるため、バックアップは第三者と共有しません。

章ごとの`completed`と`documentUrl`、`gptSessions`・`critiqueGptSessions`のURL・引継ぎメモ・開始日を含む全フィールド、ユーザー編集済みの`gptHandoffTemplates`も完全バックアップへ含めます。外部サービスのファイル本体は含みません。同じ章IDの原稿進捗が結合元と結合先で異なる場合は、完成状態・リンクを静かに上書きせず、競合プレビューで停止します。両GPT管理は異なる内部IDを和集合にし、同じ内部ID・管理IDの内容違いや複数の「使用中」が生じる場合は競合として停止します。テンプレートは片側だけが未編集（改訂0・更新日時空・両override空）の場合に限り編集済み側を採用します。改訂1以上で両overrideが空の記録は「既定へ戻す」を明示した履歴なので、古い独自文との結合は内容差としてプレビューで停止し、独自文を勝手に復活させません。両側が一度でも編集済みなら、空と非空の差を含むoverride内容差を競合として扱います。

- 旧バックアップに `planning_notes` がない場合は空データとして互換維持
- 結合復元では、異なるIDのレコードを追加する
- 同じIDで内容が異なる場合、同じIDのactive／退避指定が異なる場合、全面改稿後のactive目次が異なる場合、章順が重なる場合、同じ目次保存版IDの内容・版番号・現在の確定目次指定が競合する場合、同じ指示書系列・版番号が重なる場合、正本・最初に見る指定や市場サマリーが競合する場合は停止し、静かに上書きしない
- 旧v1〜v4相当で退避台帳を持たない別IDの単純追加だけは、既存互換としてactive IDを安全に和集合化する。全面改稿後のactive目次は自動で混ぜない
- 構成項目・保存版・確定参照が空で、`outlineRevision`と`chapterOrderRevision`も0の目次だけを「真正な未設定」とみなす。旧v1〜v4の真正な空目次は移行後も既存active目次を安全に採用できる。一度章を追加して個別削除した空目次や、全面改稿で空にした目次は改訂番号または保存版が残るため「意図的な空」として扱い、結合で古いactive目次を復活させない
- 破損した現行値は復旧用JSONへ退避してから修復する
- 全置換は既存の強い確認と復元前バックアップを経由する

## 共有用書き出し

共有用JSONの識別子は `kindle-navi-planning-notes-share`、外側の`schemaVersion` は後方互換のため1を維持します。内側の`data.version`は8です。共有用Markdownはactiveな仮目次（編集中）、現在の確定目次、過去の目次（新しい順）、市場サマリー、正本、最初に見る資料、現行判断と履歴を含め、同じ内容を読みやすく変換します。両GPT管理は全件除外して空配列、引継ぎテンプレートは改訂0の空overrideへ差し替えます。現在のリポジトリに独立した「Kindleプロジェクトパック」実装はなく、既存の企画ノート共有packageが共有経路です。将来別名のパックを追加する場合も、同じ非公開除外を必須にします。

- `private` の取材記録を除外
- 取材は `share_candidate` かつ `approved` の記録だけを含める
- 対象の取材でも `rawAnswer`、要約、出来事、感情、判断、失敗、数字、追加質問、匿名化メモを除外し、`publicAnswer` だけを共有する
- 章ごとの原稿完成状態は共有するが、`documentUrl`と保存先サービスのURL・文書ID・queryは共有JSON／Markdownの両方から除外する。共有Markdownの完成表示は現在の仮目次と現在の確定目次だけに重ね、過去版へ現在の進捗を表示しない
- 指示書の `externalFileLocation` を除外
- `gptSessions` はURL・引継ぎメモ・セッション名を含むコレクション全体を共有JSON／Markdownから除外
- `critiqueGptSessions` はURL・引継ぎメモ・対象版・論評回・セッション名を含むコレクション全体を除外
- `gptHandoffTemplates` はユーザー編集文を含む全体を改訂0の空overrideに置き換え、組込既定文も共有データへ複製しない
- APIキー、認証トークン、セッションID、非公開会話URLらしき文字列を検出したら書き出しを停止
- その他の領域は状態にかかわらず含み得るため、共有前の目視確認が必要

共有用JSONは現時点ではアプリへ再取込する形式ではありません。市場調査については、対応する見出しと表を持つ正本Markdownだけを専用画面でプレビューし、既存項目と競合しない差分だけ追加できます。プレビューを省略した自動取込や、既存正本の上書きは行いません。

## 上限と容量

- 短文上限: 4,000文字
- 長文上限: 500,000文字
- 各配列上限: 1,000件
- `gptSessions`・`critiqueGptSessions`: それぞれ1,000件。結合後の件数超過も復元前プレビューで停止
- 引継ぎテンプレート: 1文あたり100,000文字
- 目次保存版上限: 100件
- 約700KB以上: バックアップ推奨を表示
- 約2MB超: 新しい保存と外部バックアップ取込を、書込み前に停止。個別のバックアップが上限内でも、結合後の合計が超える場合は適用しない

容量警告が出たら完全バックアップを作り、長い原文や指示書は外部ファイルにも保存します。

目次保存版が100件に達した場合、アプリは履歴を自動削除せず、全面書き直しを安全側で停止します。完全バックアップを保存し、新しいプロジェクトで続けます。参照上必要な旧章台帳と新しい仮目次の合計が1,000件を超える場合は、完全バックアップ後に「旧目次に紐づく記録」の章紐づけを現在の目次へ付け直してから再実行します。実行できない「履歴整理」を案内しません。

## 取込と今後のP1候補

v8は、v7までの構造化保存・目次履歴・原稿進捗・取材・指示書・意思決定・市場調査・Kindle出版サポートGPT管理・バックアップ互換を保持したまま、辛口論評GPTの世代管理と両管理の編集可能な2段階引継ぎテンプレートを追加します。URL・メモ・テンプレートは端末内と完全バックアップだけに保持し、共有用データから管理全体を除外します。

次は未対応です。

- 目次以外を含む一般形式のJSON／Markdown自動取込
- 既存承認版との差分UI
- 添付ファイル本体の保存
- ドラッグ＆ドロップによる章並べ替え

これらを追加する場合も、既存承認版を無断上書きせず、取込前プレビューと競合確認を必須にします。
