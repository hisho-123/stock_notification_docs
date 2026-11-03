# 実装アプリのE2E検証（2026-10-13）

実際のChrome、React frontend、Go backend、PostgreSQL 17を接続して検証した。確認98項目が成功し、今回の範囲で製品の不具合は見つからなかった。検証後もDB・backend・frontend・模擬外部サービスを起動したままにしている。

## 構成とアクセス

| 対象 | 構成 |
| --- | --- |
| frontend | `stock_notification_frontend` / `fc5bf67`、Vite開発サーバー |
| backend | `stock_notification_backend` / `387586a`、Goの実装をE2E専用ビルド |
| 仕様 | `stock_notification_docs` / `d891e0b` |
| DB | 既存ComposeのPostgreSQL 17、専用DB `stock_e2e_20261013` |
| アクセスURL | <https://localhost:5173/assets> |
| ログインURL | <https://localhost:5173/login> |
| 通知設定URL | <https://localhost:5173/settings/notifications> |
| backend | `http://127.0.0.1:8080` |
| 模擬FMP・LINE | `http://127.0.0.1:18082` |
| 管理者 | 検証専用の `owner`。パスワードは完了報告に記載 |
| 実行用ファイル | `/private/tmp/stock-notification-e2e-20261013` |

FMP・LINEは仕様の受け入れ条件に従って模擬サービスを使用した。frontendのAPIスタブは使用せず、認証・API・保存・監視判定は実装済みのコードと実DBで実行した。外部サービスのURLだけをGoの`-overlay`でローカルへ差し替えたバイナリを使用し、backend・frontendの原本ソースと既存`.env`は変更していない。実際の市場価格取得・実ユーザーへのLINE送信は行っていない。

backendは起動ディレクトリの`.env`を環境変数より優先する。今回は検証専用ディレクトリの`.env`に専用DB、検証用認証情報、`PUBLIC_ORIGIN=https://localhost:5173`を設定した。Chromeの自己署名証明書警告はユーザーが確認・許可した。

## 結果

| 検証 | 件数・結果 | 証跡 |
| --- | --- | --- |
| Chromeの操作・表示 | 59 / 59成功 | [browser-checks.json](browser-checks.json) |
| 実HTTP API | 28 / 28成功 | [api-checks.json](api-checks.json) |
| 日次監視コマンド・DB状態 | 11 / 11成功 | [monitor-checks.json](monitor-checks.json) |
| backend既存結合テスト | 成功（race検査付き） | 下記コマンド |

backendの既存結合テストは専用の`stock_test` DBで実行した。

```sh
TEST_DATABASE_URL='postgres://stock:stock@127.0.0.1:5432/stock_test?sslmode=disable' \
  go test -race -tags=integration ./tests/integration/...
```

## Chromeで確認した操作

- ログイン成功・失敗、失敗時のパスワード消去、ログアウト、再読み込み後の認証・保存内容復元。
- ` aapl `の正規化、高精度価格の桁保持、名称欠落時のコード表示、古い価格の停止登録と警告。
- 重複・未知銘柄・価格0・timestamp欠落・外部障害・30秒タイムアウトの表示と登録件数保持。
- 大文字小文字を区別しない名称検索、`%`・`_`の文字としての検索、検索0件の専用表示と解除。
- 9と100を含む価格の数値ソート、同値のID順、降順。
- 停止・再開、手動再開後の警告保持。外部サービスのログから即時の価格取得・通知がないことを照合。
- 削除確認の取消・Esc・フォーカス復帰。ユーザー承認後に今回作成したTSLAだけを削除し、再登録。DB上のIDは7から8へ変わり、未通知で開始。
- 通知率の重複・0・100・小数の拒否、空配列の保存不可、昇順保存、再読み込み後の永続化。
- 未保存変更の離脱・ログアウト確認、取消・Escでの保持、破棄してログアウト。
- backend停止による一覧取得失敗時の直前データ保持、設定取得失敗時の編集禁止・再試行、保存失敗時の編集保持と復旧後の再保存。
- 日次監視後の下落率・通知済み率・自動停止状態の画面への反映。

## UIの確認

PCは1440×900、スマートフォンは390×844で3画面を確認した。ページ全体の横はみ出し、文字や操作要素の重なりは見つからなかった。一覧テーブル内だけ横スクロールでき、モバイルでも全列・行操作へ到達できた。キーボードによるテーブル横スクロールも確認した。監視中・停止中は文字で識別でき、古い価格の警告と確認日時を表示している。

入力ラベル、キーボード送信、ダイアログの初期フォーカス・Esc・取消後のフォーカス復帰、状態・エラーのroleも確認した。Chromeで収集したconsoleのwarn/errorは0件だった。スクリーンリーダーでの読み上げ確認は行っていない。

| 画面 | PC | スマートフォン |
| --- | --- | --- |
| ログイン | [画像](login-desktop.jpg) | [画像](login-mobile.jpg) |
| 監視対象 | [画像](assets-desktop.jpg) | [画像](assets-mobile.jpg) |
| 通知設定 | [画像](settings-desktop.jpg) | [画像](settings-mobile.jpg) |

[削除確認ダイアログ](delete-confirm-desktop.jpg)も保存した。

## API・日次監視

APIでは未認証401、Origin・CSRF違反403、JSON以外415、不正入力400、存在しないID404、通知済み率NULLの末尾配置、Cookie2件のSecure・HttpOnly・SameSite=Strict・Path・24時間属性、ログアウト後の旧Cookie失効を確認した。不正な通知率ではDBの設定が変更されない。

日次監視は実際のCLIを順番に起動し、次を確認した。

- 最高値100から73へ下落すると25%について1通のみ通知。同じ価格では再通知しない。
- 110で最高値更新・未通知へリセットし、99で10%について通知。
- LINE失敗では通知済み率を保持し`NOTIFICATION_FAILED`を保存。次の実行で105へ回復すると失敗した急落通知を繰り越さず、エラーを解消。
- FMP失敗では価格・最高値・通知済み率を保持し、`PRICE_FETCH_FAILED`を保存。正常処理で解消。
- 古い価格では停滞通知後に自動停止し、価格と最高値を保持。停止後の次の実行ではその銘柄の価格取得・通知とも0回。

LINEの呼び出しはローカルの模擬サービスだけに4回（200が3回、意図した500が1回）だった。監視CLIはエラー・停滞検知時に終了1、正常時に終了0を返した。

## 検証後の状態と範囲

7銘柄を残している。MSFTは最高値110・最終取得値105・下落率4.55%・通知済み率10%。STALEは古い価格の警告付きで停止中。通知率は初期値`[10,15,20,25,30]`へ戻した。Chromeは認証済みの一覧を開いたまま、画面サイズの上書きは解除した。

本番のFMP契約・LINE配信、実時間での24時間経過・15分待機、スケジューラ起動、本番公開環境は今回のChrome E2E対象外。既存のfrontend APIスタブ向けPlaywright一式は今回再実行していない。

このリポジトリには検証結果JSON・画面画像・本記録を追加した。製品コードの変更はない。
