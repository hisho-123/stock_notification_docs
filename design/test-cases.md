# 実装済みテストケース

関連リポジトリのテストコードにある条件・期待結果をまとめる。各表のIDから、確認したコミットの該当コードを参照できる。確認日：2026-10-17。

本書と配下のケース一覧は、改訂前の単一管理者向け実装の記録。複数ユーザー・LINE登録仕様の実装済みテストではない。追加が必要なシナリオは[受け入れ条件](acceptance.md)、関連実装との差分は[実装への影響](implementation-impact.md)を参照。

| 対象 | テスト定義数 | ケース一覧 |
| --- | --- | --- |
| フロントエンド：単体・画面 | 56 | [入力・表示、API、一覧取得、通知設定](test-cases/frontend.md) |
| フロントエンド：ブラウザ | 17 | [Playwrightの画面操作](test-cases/frontend.md#ブラウザ操作) |
| バックエンド：通常 | 74 | [価格・判定、銘柄、認証、監視、API、外部接続、DB、起動](test-cases/backend.md) |
| バックエンド：DB結合 | 5 | [実PostgreSQLとの結合](test-cases/backend.md#結合テスト) |
| バックエンド：計測ツール | 2 | [カバレッジ計測の自己テスト](test-cases/backend.md#カバレッジ計測ツール) |
| フロントエンド：計測ツール | 5 | [カバレッジ計測の自己テスト](test-cases/frontend.md#カバレッジ計測の追加2026-10-17) |
| 合計 | 159 | テーブル駆動の入力展開・サブテスト・画面サイズ別実行は重複計上しない |

フロントエンドは2026-10-17のC0/C1対応後の検証済みコミットを反映。Vitestは56定義をパラメータ展開して72件、Playwrightは17シナリオをPC・スマートフォンで34件実行する。計測ツールの自己テストは5件。実測結果は[フロントエンドのカバレッジ検証](../verification/frontend-coverage-2026-10-17.md)を参照。

1つのテスト定義に複数の条件がある場合は同じ行にまとめ、DB結合の複合シナリオは確認内容ごとに分けた。表の行数とテスト定義数は一致しない。

## 参照元・実行範囲

| リポジトリ | 確認コミット | 依存先 |
| --- | --- | --- |
| stock_notification_frontend | [96d3e9e](https://github.com/hisho-123/stock_notification_frontend/tree/96d3e9e61f7b4002b6716c0de1e6c8f90809418c) | C0/C1対応後の計測コミット。従来ケースのリンクは元のコミットを保持。単体・画面はモック、ブラウザは専用APIスタブを使い、Go・DBには接続しない |
| stock_notification_backend | [387586a](https://github.com/hisho-123/stock_notification_backend/tree/387586acac1344dae8a10d04d281ec03ca1d5f79) | 通常はモック。結合は専用PostgreSQL・一時スキーマを使い、FMP・LINEは模擬サービス |

Playwrightの17シナリオはChromiumのPC 1440×900・スマートフォン390×844で実行する設定。ソート項目の選択や横はみ出しの確認はフロントエンド、数値・NULL・丸め前の実際のソート順はバックエンドのテストで確認する。

## 実行コマンド

各リポジトリ直下で実行する。DB結合・カバレッジ計測は、専用テストDBの接続先を`TEST_DATABASE_URL`に設定する。

| 対象 | コマンド |
| --- | --- |
| フロントエンド単体・画面（計測なし） | `npm test` |
| フロントエンドC0/C1 100%判定 | `npm run test:coverage` |
| フロントエンド計測ツール | `npm run test:coverage-tools` |
| フロントエンドブラウザ計測 | `npm run test:e2e:coverage` |
| フロントエンドブラウザ | `npm run build`後、`npm run test:e2e` |
| バックエンド通常（race検査付き） | `make test` |
| バックエンドDB結合（race検査付き） | `make test-integration` |
| バックエンド計測ツール自己テスト＋全体計測 | `make coverage` |

ブラウザテストの既定ポートは5173・18080。既存の開発サーバーが動作中なら`E2E_PORT=5175 E2E_API_PORT=18085`で別ポートを指定でき、既存プロセスは停止・再利用しない。詳細な準備は[フロントエンドREADME](https://github.com/hisho-123/stock_notification_frontend/blob/fc5bf674f744c82b4f7deaf9fbcd5f47b79d535c/README.md#検証)、[バックエンドのテスト手順](https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/docs/testing.md)を参照。

## 受け入れ条件・検証結果との関係

バックエンドの表は確認コミットのコードに基づくケース一覧。フロントエンドは今回、Vitest・計測ツール・通常E2E・計測付きE2Eを実行した。仕様上の合格条件は[受け入れ条件](acceptance.md)、過去の実施結果は[検証結果](verification.md)を参照する。

本番FMP契約・LINE実配信、毎日07:00のスケジューラ起動、スクリーンリーダーの読み上げは、ここに記載した自動テストの対象外。
