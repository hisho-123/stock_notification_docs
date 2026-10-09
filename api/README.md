# API仕様

機械可読な定義は[openapi.yaml](openapi.yaml)。APIは`/api/v1`配下、HTTPS・同一オリジンで提供する。認証はCookieセッション。[認証・運用仕様](../design/security-operations.md)も参照する。

## 共通規約

- JSONを使用し、要求ボディは`Content-Type: application/json`。変更系は`Origin`を必須とし、ログイン以外は`X-CSRF-Token`も必須。
- ログイン以外の全APIは有効なセッションを必要とする。未認証・期限切れは401。全応答は`Cache-Control: no-store`。
- 未定義の入力プロパティ、未知のクエリ名、不正なJSON・型・列挙値は`400 VALIDATION_ERROR`。JSON以外の要求は`415 UNSUPPORTED_MEDIA_TYPE`。
- IDは1〜9223372036854775807の十進整数文字列。先頭ゼロ・符号は不可。JSの整数精度を超えるIDも文字列で扱う。
- 価格は正の十進数文字列（例：`"6000"`、`"123.456789"`）。指数表記を返さず、末尾の不要な0は除去する。下落率は小数2桁の十進数文字列。
- 日時はUTC・RFC 3339（例：`2026-10-07T22:00:00Z`）。画面では日本時間に変換する。
- NULL許容項目も応答に含め、未通知・エラーなしは`null`で返す。

## エンドポイント

| メソッド・パス | 要求 | 成功応答 | 主なエラー |
| --- | --- | --- | --- |
| POST `/auth/login` | `admin_id`, `password` | 200：Session、認証・CSRF Cookie発行 | 400、401 INVALID_CREDENTIALS、403、429、503 |
| GET `/auth/session` | なし | 200：Session | 401、503 |
| POST `/auth/logout` | ボディなし、CSRF必須 | 204：セッション失効・両Cookie削除 | 401、403、503 |
| GET `/assets` | `q`, `sort`, `order` | 200：AssetList | 400、401、503 |
| POST `/assets` | `code` | 201：Asset、Locationヘッダー | 400、401、403、409、422、502、503、504 |
| PATCH `/assets/{id}` | `enabled` | 200：Asset | 400、401、403、404、503 |
| DELETE `/assets/{id}` | ボディなし | 204 | 400、401、403、404、503 |
| GET `/settings/notifications` | なし | 200：NotificationSettings | 401、503 |
| PUT `/settings/notifications` | `thresholds` | 200：NotificationSettings | 400、401、403、503 |

パスの先頭はすべて`/api/v1`。登録や一覧APIからLINE送信は行わない。PATCHは監視状態だけを変更し、価格・名称・最高値・通知済み率の編集は受け付けない。

## 認証

```json
{"admin_id":"owner","password":"example-password"}
```

成功時のSession（サンプルのトークンは実際の認証に使えない）：

```json
{
  "admin_id": "owner",
  "expires_at": "2026-10-08T22:00:00Z",
  "csrf_token": "sample-csrf-token-for-documentation-only"
}
```

Cookie属性・有効期限は[認証仕様](../design/security-operations.md)を参照。ログイン要求にはOriginとJSON形式を要求するが、CSRFトークンは不要。セッション確認でトークンを取得し、以後の変更系ヘッダーに指定する。

## 一覧・追加・状態変更

初期一覧は`GET /api/v1/assets?sort=created_at&order=asc`。検索例は`?q=SP&sort=decline_rate&order=desc`。

| パラメータ | 型・既定 | 制約 |
| --- | --- | --- |
| q | string、既定空文字 | 最大200文字、前後空白除去、コード・名称の大文字小文字を区別しない部分一致 |
| sort | string、既定created_at | created_at / code / name / highest_value / latest_value / decline_rate / latest_fetched_at / enabled / last_notified_threshold |
| order | string、既定asc | asc / desc |

同値はID昇順、NULLはどちらの順序でも末尾。数値は数値として、下落率は丸め前でソートする。件数`total`は検索適用後の件数で、`items`の長さと一致する。

追加要求：`{"code":"^GSPC"}`。前後空白除去・ASCII英字大文字化後に重複確認し、外部価格取得を行う。監視状態変更要求：`{"enabled":false}`。追加・状態変更の成功応答は単一のAsset、一覧は次の形式。

```json
{
  "items": [
    {
      "id": "1",
      "code": "^GSPC",
      "name": "S&P 500",
      "highest_value": "6000",
      "latest_value": "5100",
      "decline_rate": "15.00",
      "latest_fetched_at": "2026-10-07T22:00:00Z",
      "enabled": true,
      "last_notified_threshold": 15,
      "last_checked_at": "2026-10-07T22:00:00Z",
      "last_error_code": null,
      "created_at": "2026-10-01T00:00:00Z",
      "updated_at": "2026-10-07T22:00:00Z"
    }
  ],
  "total": 1
}
```

AssetのIDはDBのIDに対応。`latest_fetched_at`は最後の有効価格取得完了時刻、`last_checked_at`は最後の取得試行完了時刻。価格取得失敗では後者のみ進む。銘柄の`last_error_code`はnull / PRICE_FETCH_FAILED / NOTIFICATION_FAILEDのいずれか。一覧GET自体はその銘柄にエラーがあっても200で返す。

登録成功時は`Location: /api/v1/assets/{id}`を返す（資源の識別用。単体GETは設けず一覧で確認する）。削除成功は204でボディなし。

## 共通設定

要求：`{"thresholds":[30,10,20]}`。成功応答は昇順の配列：

```json
{
  "thresholds": [10, 20, 30],
  "updated_at": "2026-10-08T00:00:00Z"
}
```

1〜99の整数を1件以上99件以下、重複なしで指定する。`null`、小数、文字列、空配列は400。通知済み率は変更しない。同じ設定の再保存も成功し、更新日時を更新する。

## 共通エラー

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容を確認してください。",
    "fields": {"thresholds":"1〜99の整数を重複なく1件以上指定してください。"}
  }
}
```

`fields`は常に含め、項目別エラーがなければ空オブジェクト。`message`は利用者に表示できる日本語の短い説明。秘密情報・外部レスポンス・SQLは含めない。

| HTTP | error.code | 意味 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | 要求形式・入力・クエリ・IDが不正 |
| 401 | INVALID_CREDENTIALS | ログイン情報が不一致 |
| 401 | UNAUTHENTICATED | 未ログイン、期限切れ、セッション不備 |
| 403 | CSRF_FAILED | Originまたは変更系CSRFトークンが不正 |
| 404 | ASSET_NOT_FOUND | 更新・削除対象が存在しない |
| 409 | ASSET_ALREADY_EXISTS | 正規化したコードが登録済み |
| 415 | UNSUPPORTED_MEDIA_TYPE | JSON以外のボディ |
| 422 | SYMBOL_UNAVAILABLE | 外部サービスに一致する銘柄価格がない |
| 429 | TOO_MANY_ATTEMPTS | ログイン試行制限、Retry-Afterを返す |
| 502 | PRICE_PROVIDER_ERROR | 外部サービスエラー、不正価格・レスポンス、契約による拒否 |
| 503 | RESOURCE_BUSY | 行ロック待機超過。再取得・再試行を案内 |
| 503 | SERVICE_UNAVAILABLE | DB利用不可、共通設定欠落など |
| 504 | PRICE_PROVIDER_TIMEOUT | 価格取得が30秒以内に完了しない |
| 500 | INTERNAL_ERROR | その他の予期しないサーバーエラー |

通信中断・503などで変更の成否が不明な場合、一覧または設定を再取得してから再試行する。フロントエンドは401でログインへ遷移し、処理中の変更要求を自動再送しない。
