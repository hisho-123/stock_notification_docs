# フロントエンドのテストケース

以下は改訂前の単一管理者仕様の実装記録。複数ユーザー・LINE登録仕様の検証済み結果ではない。

[テストケース一覧へ戻る](../test-cases.md)。IDのリンクから該当するテストコードを開ける。

単体・画面テストはVitest／Testing Library、ブラウザテストはPlaywrightと専用APIスタブを使用する。

## 入力検証・表示

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [FE-VAL-01][FE-VAL-01] | ID・パスワードの前後空白、ID 100文字、パスワード72／73バイト、空欄 | 空白を保持。ID 100文字・72バイトは許可し、空欄・パスワード超過は項目エラー |
| [FE-VAL-02][FE-VAL-02] | ` aapl `・` ^Gspc `・非ASCII文字、空欄・内部空白・制御文字、64／65文字 | `AAPL`・`^GSPC`へ正規化し、非ASCII文字は保持。不正文字・65文字は拒否 |
| [FE-VAL-03][FE-VAL-03] | 1・99、空欄・0・100・小数・指数表記・負数・空白付き・NaN・重複 | 1・99は許可。それ以外の例示入力はエラー |
| [FE-VAL-04][FE-VAL-04] | 長い整数・小数、微小値、6000を表示 | 精度を保持し、整数部分だけ桁区切りする |
| [FE-VAL-05][FE-VAL-05] | UTC 22:00・15:00を表示 | 翌日07:00・00:00 JSTを表示 |

## APIクライアント

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [FE-API-01][FE-API-01] | 全9操作、精度上限を超えるID、検索語`%_`、削除・ログアウト204 | IDを文字列で保持し検索語をエンコード。Cookieを付与し、ログイン以外の変更系にCSRF。本文なし要求にContent-Typeを付けず、204を処理 |
| [FE-API-02][FE-API-02] | ログイン401と保護APIの401 | 認証不一致では期限切れ処理を呼ばず、保護APIの401ではCSRFを破棄して未認証を通知 |
| [FE-API-03][FE-API-03] | 変更要求が403・429・503、Retry-Afterと項目別エラーあり | HTTP状態・項目エラー・待機秒数を保持し、各要求は1回だけ送る |
| [FE-API-04][FE-API-04] | 通信断、非JSONの502、不正JSONの200、要求取消、成否不明の判定 | 安全なエラーへ変換し、取消はそのまま伝える。503・汎用502は成否不明、価格取得エラー・409は確定失敗 |

## 一覧の非同期取得

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [FE-LIST-01][FE-LIST-01] | 検索変更後、新しい応答より遅れて古い応答が到着 | 古い要求を取消し、新しい検索結果を維持 |
| [FE-LIST-02][FE-LIST-02] | 一覧再取得が503、その後の再試行は成功 | 失敗中は直前の一覧とエラーを表示し、成功時に結果更新・エラー解消 |

## 通知設定画面

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [FE-SET-01][FE-SET-01] | 35%を追加し保存403、その後再保存は成功 | 編集を保持。再保存時の配列とJST更新日時を反映し、保存ボタンを無効化 |
| [FE-SET-02][FE-SET-02] | 未保存の削除後に一覧へ移動し、取消・破棄を選択 | 確認の初期フォーカスは「編集を続ける」。取消で編集保持、破棄で一覧へ遷移 |
| [FE-SET-03][FE-SET-03] | 初期設定取得503、その後再試行は成功 | 既定の通知率を表示せず編集不可。ログアウトは表示し、取得成功で編集可能 |

## ブラウザ操作

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [FE-E2E-01][FE-E2E-01] | 3画面表示、ログイン、追加・停止・再開、設定保存・再読み込み、ログアウト | ページ全体の横はみ出しなし。価格精度・警告・保存内容を表示。Secure／HttpOnly／SameSite=Strict／Path=/のCookie2件、Origin・CSRF送信、204後のCookie削除を確認 |
| [FE-E2E-02][FE-E2E-02] | 未認証で一覧へ移動、認証失敗、429、待機後Enterで再試行 | ログインへ遷移。失敗時ID保持・パスワード消去。待機中送信不可、待機後ログイン成功 |
| [FE-E2E-03][FE-E2E-03] | 初期セッション確認が失敗し、再試行は成功 | 確認失敗画面を表示し、再試行後にログインフォームを表示 |
| [FE-E2E-04][FE-E2E-04] | 名称検索、`%_`で0件、検索解除、9項目のソート選択、列見出し切替、更新失敗 | 検索結果・0件表示・解除を反映。全項目を選択でき、aria-sortが昇順／降順へ切替。失敗中は5件を保持し再試行で復旧 |
| [FE-E2E-05][FE-E2E-05] | 重複・未知銘柄・価格取得失敗・timeout、古い価格登録と再開、登録後通信断 | エラー時入力を保持。古い価格は停止中・0.00%で登録し再開後も警告保持。成否不明時は一覧で確認し、自動再送しない |
| [FE-E2E-06][FE-E2E-06] | 削除確認の取消・Esc、削除失敗後の再試行、行操作404 | 取消に初期フォーカス、Escで操作元へ復帰。失敗はダイアログ内表示、204で閉じて行削除。404は削除済みを案内して一覧更新 |
| [FE-E2E-07][FE-E2E-07] | 取得失敗、重複・0・100・小数、保存失敗と再保存、全通知率削除 | 取得失敗時編集不可・再試行可能。不正値拒否、保存失敗時編集保持。再保存後は未変更、空配列は保存不可 |
| [FE-E2E-08][FE-E2E-08] | 未保存でリンク・履歴・再読み込み・ログアウト、ログアウト失敗、破棄して戻る | Esc・取消・beforeunloadの取消で編集保持。ログアウト失敗を確認内に表示し、破棄して戻ると一覧へ遷移 |
| [FE-E2E-09][FE-E2E-09] | 保存後通信断、再取得、追加編集後にセッション失効・保存401 | 再取得で保存済み状態を反映。401では破棄確認を出さずログインへ遷移し編集を消去 |

[FE-VAL-01]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/validation.test.ts#L6
[FE-VAL-02]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/validation.test.ts#L15
[FE-VAL-03]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/validation.test.ts#L23
[FE-VAL-04]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/validation.test.ts#L30
[FE-VAL-05]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/validation.test.ts#L37
[FE-API-01]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/api.test.ts#L13
[FE-API-02]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/api.test.ts#L54
[FE-API-03]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/api.test.ts#L78
[FE-API-04]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/api.test.ts#L96
[FE-LIST-01]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/useAssetList.test.ts#L8
[FE-LIST-02]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/useAssetList.test.ts#L31
[FE-SET-01]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/pages/SettingsPage.test.tsx#L32
[FE-SET-02]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/pages/SettingsPage.test.tsx#L61
[FE-SET-03]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/src/pages/SettingsPage.test.tsx#L77
[FE-E2E-01]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/tests/e2e/app.spec.ts#L32
[FE-E2E-02]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/tests/e2e/app.spec.ts#L85
[FE-E2E-03]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/tests/e2e/app.spec.ts#L110
[FE-E2E-04]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/tests/e2e/app.spec.ts#L121
[FE-E2E-05]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/tests/e2e/app.spec.ts#L164
[FE-E2E-06]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/tests/e2e/app.spec.ts#L203
[FE-E2E-07]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/tests/e2e/app.spec.ts#L232
[FE-E2E-08]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/tests/e2e/app.spec.ts#L258
[FE-E2E-09]: https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/tests/e2e/app.spec.ts#L294
