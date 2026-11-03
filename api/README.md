# API仕様

機械可読な定義は[openapi.yaml](openapi.yaml)。APIは`/api/v1`配下、HTTPS・同一オリジンで提供する。認証はCookieセッション。[認証・運用仕様](../design/security-operations.md)も参照する。

## 共通規約

- JSONを使用し、要求ボディは`Content-Type: application/json`。Webhook以外の変更系・登録トークン確認は`Origin`必須。保護APIの変更系には`X-CSRF-Token`も必要。
- 公開APIはログイン・登録トークン確認・登録完了・Webhookのみ。それ以外は有効なセッションを必要とし、未認証・期限切れは401。全応答は`Cache-Control: no-store`。
- 未定義の入力プロパティ、未知のクエリ名、不正なJSON・型・列挙値は`400 VALIDATION_ERROR`。JSON以外の要求は`415 UNSUPPORTED_MEDIA_TYPE`。LINE Webhookは外部仕様の拡張を許可し、未知のプロパティ・未対応イベントは無視する。
- 銘柄IDは1〜9223372036854775807の十進整数文字列。先頭ゼロ・符号は不可。JSの整数精度を超えるIDも文字列で扱う。ユーザー識別子は1〜100文字の`login_id`で、別の`user_id`は設けない。
- 保護APIはセッションの`login_id`で所有者を絞る。銘柄・通知設定の要求に所有者指定はなく、他ユーザーの銘柄IDへの更新・削除は404。LINEユーザーIDとパスワードハッシュは応答に含めない。
- 価格は正の十進数文字列（例：`"6000"`、`"123.456789"`）。指数表記を返さず、末尾の不要な0は除去する。下落率は小数2桁の十進数文字列。
- 日時はUTC・RFC 3339（例：`2026-10-07T22:00:00Z`）。画面では日本時間に変換する。
- NULL許容項目も応答に含め、未通知・エラーなしは`null`で返す。

## エンドポイント

| メソッド・パス | 要求 | 成功応答 | 主なエラー |
| --- | --- | --- | --- |
| POST `/auth/login` | `login_id`, `password` | 200：Session、認証・CSRF Cookie発行 | 400、401 INVALID_CREDENTIALS、403、429、503 |
| POST `/auth/registration/validate` | `registration_token` | 200：RegistrationValidity（expires_at） | 400、403、410、429、503 |
| POST `/auth/register` | `registration_token`, `login_id`, `password` | 201：Session、認証・CSRF Cookie発行 | 400、403、409 LOGIN_ID_ALREADY_EXISTS、410、429、503 |
| POST `/webhooks/line` | LINEイベント・X-Line-Signature | 200：本文なし | 400、403 INVALID_LINE_SIGNATURE、415、503 |
| GET `/auth/session` | なし | 200：Session | 401、503 |
| POST `/auth/logout` | ボディなし、CSRF必須 | 204：セッション失効・両Cookie削除 | 401、403、503 |
| GET `/assets` | `q`, `sort`, `order` | 200：AssetList | 400、401、503 |
| POST `/assets` | `code` | 201：Asset、Locationヘッダー | 400、401、403、409、422、502、503、504 |
| PATCH `/assets/{id}` | `monitoring_enabled` | 200：Asset | 400、401、403、404、503 |
| DELETE `/assets/{id}` | ボディなし | 204 | 400、401、403、404、503 |
| GET `/settings/notifications` | なし | 200：NotificationSettings | 401、503 |
| PUT `/settings/notifications` | `thresholds` | 200：NotificationSettings | 400、401、403、503 |

パスの先頭はすべて`/api/v1`。ユーザー登録・銘柄登録・一覧APIからLINE送信は行わず、Webhook処理だけが登録・ログインURLを返信する。PATCHは監視状態だけを変更し、価格・名称・最高値・通知済み率の編集は受け付けない。

## 認証

```json
{"login_id":"owner","password":"example-password"}
```

成功時のSession（サンプルのトークンは実際の認証に使えない）：

```json
{
  "login_id": "owner",
  "expires_at": "2026-10-08T22:00:00Z",
  "csrf_token": "sample-csrf-token-for-documentation-only"
}
```

Cookie属性・有効期限は[認証仕様](../design/security-operations.md)を参照。IDは1〜100文字・完全一致、パスワードは8〜72 UTF-8バイトで、空白を除去しない。ログイン要求にはOriginとJSON形式を要求するが、CSRFトークンは不要。セッション確認でトークンを取得し、以後の保護APIの変更系ヘッダーに指定する。

## ユーザー登録・Webhook

登録URLは`PUBLIC_ORIGIN/register#token=<token>`。トークンは32バイト乱数のBase64URL（パディングなし、43文字）。URLのフラグメントを読み、APIへはJSON本文で渡す。確認・登録の両APIは認証・CSRF不要、Origin・JSON形式は必須。

```json
{"registration_token":"sample-registration-token-00000000000000000"}
```

確認成功は`{"expires_at":"2026-10-18T00:00:00Z"}`。トークンを消費せず、LINEユーザーID・登録済みIDは返さない。登録要求は上記に`"login_id":"owner","password":"example-password"`を加える。登録完了時に再検証し、ユーザー・初期通知設定・セッションの作成とトークン消費を同一トランザクションで行い、201で上記と同じSessionおよびCookieを返す。現在のブラウザの旧セッションは置換する。

無効・不明・24時間ちょうど以降・使用済み・再発行済み・ブロック済みURLは共通の410。ID重複は409で、トークンは消費しない。同じLINEの二重登録は許可せず、競合時は410。失敗は全体をロールバックする。成否不明時は自動再送せず、セッション確認または入力したID・パスワードでのログインを案内する。

WebhookはOrigin・認証Cookie・CSRF不要。`X-Line-Signature`を未加工の本文とチャネルシークレットで検証する。署名付きの空イベントは200。処理対象は1対1トークのfollow、unfollow、テキスト「登録」。重複イベントは副作用なく200、古い状態更新・URL発行はそれぞれ省く。未対応イベントも200で無視する。業務処理コミット前のDB失敗は503、コミット後の返信失敗は履歴へ記録して200とする。詳細な状態遷移・順序判定・復旧方法は[登録・LINE連携仕様](../design/registration.md)を参照。

## 一覧・追加・状態変更

初期一覧は`GET /api/v1/assets?sort=created_at&order=asc`。検索例は`?q=SP&sort=decline_rate&order=desc`。

| パラメータ | 型・既定 | 制約 |
| --- | --- | --- |
| q | string、既定空文字 | 最大200文字、前後空白除去、コード・名称の大文字小文字を区別しない部分一致 |
| sort | string、既定created_at | created_at / code / name / highest_value / latest_value / decline_rate / latest_fetched_at / monitoring_enabled / last_notified_threshold |
| order | string、既定asc | asc / desc |

同値はID昇順、NULLはどちらの順序でも末尾。数値は数値として、下落率は丸め前でソートする。件数`total`は検索適用後の件数で、`items`の長さと一致する。

追加要求：`{"code":"^GSPC"}`。前後空白除去・ASCII英字大文字化後に重複確認し、外部価格取得を行う。監視状態変更要求：`{"monitoring_enabled":false}`。追加・状態変更の成功応答は単一のAsset、一覧は次の形式。

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
      "monitoring_enabled": true,
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

AssetのIDはDBのIDに対応。`latest_fetched_at`は最後に保存した価格の取得完了時刻、`last_checked_at`は最後の取得試行完了時刻。日次処理では価格取得失敗・古いデータ検知のどちらも後者のみ進み、保存済み価格・最高値・通知済み率を保持する。警告付き新規登録では古い価格でも両日時を取得完了時刻にする。どちらもFMPのtimestampそのものではない。

`last_error_code`はnull / `PRICE_FETCH_FAILED` / `NOTIFICATION_FAILED` / `PRICE_DATA_STALE`のいずれか。`PRICE_DATA_STALE`は240時間以上前のデータによる警告付き停止登録、停滞通知成功による自動停止、またはブロック中の停滞検知（監視継続）を示す。一覧には「価格データが10日以上前」と表示する。停滞通知失敗時は監視中・`NOTIFICATION_FAILED`で翌日再判定する。一覧GET自体はその銘柄にエラーがあっても200で返す。

登録ではFMPの価格とUNIX秒の整数timestampを検証する。timestampの欠落・不正は`502 PRICE_PROVIDER_ERROR`。取得完了時刻との差が240時間以上でも登録は成功し、取得価格を初期最高値・最終取得値、通知済み率をnull、`monitoring_enabled=false`、`last_error_code=PRICE_DATA_STALE`として201を返す。10日未満なら監視中・エラーなし。どちらもLINE送信なし。判定の詳細は[通知・日次処理仕様](../design/monitoring.md)を参照する。

PATCHによる再開ではエラーを解消せず、即時取得・通知もしない。監視中の停止・再開・削除は運用で避け、監視処理との競合を排他制御しない。

登録成功時は`Location: /api/v1/assets/{id}`を返す（資源の識別用。単体GETは設けず一覧で確認する）。削除成功は204でボディなし。

## 本人の通知設定

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
| 403 | INVALID_LINE_SIGNATURE | LINE Webhookの署名が欠落・不一致 |
| 404 | ASSET_NOT_FOUND | 更新・削除対象が存在しない、または他ユーザーの所有 |
| 409 | ASSET_ALREADY_EXISTS | 本人に正規化したコードが登録済み |
| 409 | LOGIN_ID_ALREADY_EXISTS | ログインIDが使用済み。登録トークンは未消費 |
| 410 | REGISTRATION_LINK_UNAVAILABLE | 登録URLが無効・不明・期限切れ・使用済み・失効済み |
| 415 | UNSUPPORTED_MEDIA_TYPE | JSON以外のボディ |
| 422 | SYMBOL_UNAVAILABLE | 外部サービスに一致する銘柄価格がない |
| 429 | TOO_MANY_ATTEMPTS | ログイン・登録・登録確認の試行制限、Retry-Afterを返す |
| 502 | PRICE_PROVIDER_ERROR | 外部サービスエラー、不正価格・timestamp・レスポンス、契約による拒否 |
| 503 | SERVICE_UNAVAILABLE | DB利用不可、本人の通知設定欠落など |
| 504 | PRICE_PROVIDER_TIMEOUT | 価格取得が30秒以内に完了しない |
| 500 | INTERNAL_ERROR | その他の予期しないサーバーエラー |

通信中断・503などで変更の成否が不明な場合、一覧または設定を再取得してから再試行する。フロントエンドは401でログインへ遷移し、処理中の変更要求を自動再送しない。
