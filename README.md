# 株・指数の下落通知サービス

任意の銘柄コードを登録し、監視開始後の最高値からの下落率が設定値に到達したとき、各ユーザーのLINEへ通知するサービスの仕様書です。

## 仕様書の目次

| 分類 | 文書 | 内容 |
| --- | --- | --- |
| 機能 | [機能仕様](design/features.md) | ユーザー別の銘柄登録、一覧、停止・再開、削除、通知設定 |
| 登録・LINE | [ユーザー登録・LINE連携](design/registration.md) | 友だち追加、専用URL、Webhook、ブロック・解除 |
| 通知 | [通知・日次処理](design/monitoring.md) | 判定式、具体例、処理順序、障害・同時実行 |
| DB | [ER図・テーブル定義](design/database.md) | PostgreSQLの型、キー、制約、状態 |
| 認証・運用 | [認証・運用仕様](design/security-operations.md) | セッション、CSRF、スケジュール、環境変数 |
| API | [API仕様](api/README.md) / [OpenAPI](api/openapi.yaml) | 要求・応答、検索・ソート、共通エラー |
| 画面 | [ユーザー登録](ui/register.md) | 専用URLの確認、ID・パスワード登録、自動ログイン |
| 画面 | [ログイン](ui/login.md) | ログイン、エラー、画面遷移 |
| 画面 | [監視対象一覧](ui/assets.md) | 追加、検索、ソート、停止・再開、削除 |
| 画面 | [通知設定](ui/settings.md) | 本人の全銘柄に適用する通知率の変更・保存 |
| 検証 | [受け入れ条件](design/acceptance.md) / [検証結果](design/verification.md) | 機能・画面・API・障害の確認シナリオと実施結果 |
| テスト | [実装済みテストケース](design/test-cases.md) | frontend・backendの条件・期待結果とテストコードへの参照 |

## システム構成

```mermaid
flowchart LR
    Browser[React / ブラウザ] -->|HTTPS・同一オリジン| Web[Go API・静的ファイル配信]
    LINEPlatform[LINE Platform] -->|署名付きWebhook| Web
    Web -->|登録URL・ログインURLの返信| LINE[LINE Messaging API]
    Web --> DB[(PostgreSQL)]
    Web -->|登録時の価格・名称取得| FMP[FMP Quote API]
    Scheduler[外部スケジューラ / 毎日07:00 JST] --> Monitor[Go 監視コマンド]
    Monitor --> DB
    Monitor -->|価格取得| FMP
    Monitor -->|下落・データ停滞通知| LINE[LINE Messaging API]
```

GoのWebプロセスと監視コマンドは同じDBを利用します。利用者はLINE公式アカウントを友だち追加し、トークに届く24時間有効・1回限りのURLから登録します。識別子は`login_id`に統一し、ユーザーテーブルにパスワードハッシュと通知先の`line_user_id`を保存します。銘柄・通知設定・セッションはユーザーごとに管理し、外部APIの秘密情報だけをサーバー設定で管理します。

対象はFMPの契約で価格を取得できる株・指数です。「最高値」は登録時に保存した価格と、毎日07:00（日本時間）の取得時に鮮度確認を通過した価格の最大値を指します。過去の最高値や日中の全値動きを示すものではありません。価格データが240時間以上前なら、日次処理では下落判定せず、停滞通知の受付成功時に自動停止します。古い価格での新規登録は警告付きの停止状態で許可します。詳細は[通知・日次処理](design/monitoring.md)を参照してください。

## 画面イメージの確認

[ユーザー登録](asset/register.html)、[ログイン](asset/login.html)、[監視対象一覧](asset/assets.html)、[通知設定](asset/settings.html)をブラウザで開けます。サーバー・外部ライブラリ・ネットワーク接続は不要です。

HTML上部の「画面確認用」パネルで読み込み中・空状態・通信失敗などを切り替えられます。登録・ログインは1〜100文字のIDと8〜72 UTF-8バイトのパスワードで一覧へ進み、一覧にはサンプルデータを表示します。追加・検索・ソート・停止・再開・削除と通知率編集を画面内で試せます。各ページを再読み込みするとサンプル状態へ戻ります。実際の認証、DB保存、価格取得、LINE送信は行いません。

## 文書の読み方・対象範囲

- 本文書の入力名・応答名はOpenAPIと一致させます。エンドポイントの型・必須項目はOpenAPIを参照してください。
- 画面のURLはReactアプリのルートです。`asset/`のHTMLパスは画面イメージのファイルパスです。
- 日時はDB・APIでUTC、画面で日本時間。価格と下落率はAPIで十進数文字列として扱います。
- 成果物は仕様書とHTMLの画面イメージです。Go・Reactの製品コードは含みません。
- 過去最高値の取得、銘柄別通知率、チャート、価格履歴、ユーザー管理画面、退会、ID変更、パスワード再設定・変更、別LINEへの再連携は対象外です。
- 開発段階のため旧API・DBとの後方互換やデータ移行は提供しません。関連実装の必要変更は[実装への影響](design/implementation-impact.md)を参照してください。

## 外部サービス・形式の参照

- [FMP Stock Quote API](https://site.financialmodelingprep.com/developer/docs/stable/quote)：銘柄コードを指定する価格取得エンドポイント。
- [LINE Messaging API](https://developers.line.biz/en/reference/messaging-api/#send-push-message)：プッシュ通知。
- [LINEの再試行仕様](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/)：受付後の通信失敗や再試行で重複が起こり得ること、受付と配信の違い。
- [OWASP CSRF対策](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)：同一オリジン確認とセッションに結び付くトークン。
- [OpenAPI 3.0.3](https://spec.openapis.org/oas/v3.0.3.html)：API記述形式。

仕様策定日：2026-10-08。複数ユーザー・LINE登録の仕様改訂日：2026-10-17。
