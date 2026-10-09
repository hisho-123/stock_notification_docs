# ログイン画面（UI-01）

- アプリURL：`/login`
- 画面イメージ：[asset/login.html](../asset/login.html)
- 認証仕様：[認証・運用](../design/security-operations.md)

## 要素・挙動

| HTML要素ID | 要素 | 挙動 |
| --- | --- | --- |
| admin-id | ID入力 | 必須、1〜100文字、autocomplete=username。前後空白を含め完全一致 |
| password | パスワード入力 | 必須、bcryptの上限に合わせUTF-8で72バイト以下、autocomplete=current-password。値を保存しない |
| login-form / login-button | フォーム・ログイン | Enterまたはボタンで送信。空欄はAPIを呼ばず項目エラー。処理中は入力・送信ボタンを無効化 |
| login-error | エラー領域 | role=alert。認証不一致・通信失敗・試行制限を表示。失敗後はID保持、パスワード消去 |
| login-status | 送信状態 | aria-liveで「ログインしています…」。成功時は一覧へ置換遷移 |

## API・遷移

画面表示時は`GET /api/v1/auth/session`で確認し、有効なら`/assets`へ置換遷移。401ならフォームを表示。通信失敗なら再試行を案内し、認証済みと判断しない。

送信は`POST /api/v1/auth/login`に`admin_id`・`password`を渡す。200でCSRFトークンと期限をメモリ保持し、`/assets`へ。401は「IDまたはパスワードが違います。」、429はRetry-Afterに基づく待ち時間、その他は再試行可能なエラーを表示する。試行制限中は送信できない。

## 画面確認用の状態

HTML上部の状態セレクトで通常・送信中・認証エラー・通信失敗・試行制限を選べる。通常状態では空でないIDとパスワードの送信で一覧HTMLへ進む。これは画面確認用の動作であり、認証結果を検証するものではない。
