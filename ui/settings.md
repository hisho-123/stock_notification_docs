# 通知設定画面（UI-03）

- アプリURL：`/settings/notifications`
- 画面イメージ：[asset/settings.html](../asset/settings.html)
- 共通通知率の規則：[機能仕様](../design/features.md)

## 要素・挙動

| HTML要素ID | 要素 | 挙動 |
| --- | --- | --- |
| assets-link | 一覧へ戻る | 未保存の変更がなければ`/assets`へ。変更ありは確認ダイアログを表示 |
| threshold-input / threshold-add-form | 通知率入力・追加 | 1〜99の整数。Enterまたは追加で編集中配列へ追加し昇順表示。重複・小数・範囲外は入力エラー。追加だけでは保存しない |
| threshold-list | 通知率一覧 | 各値に%と削除ボタン。削除は編集中配列のみ変更。0件にできるが保存不可 |
| settings-form / save-button | 保存 | PUT /settings/notificationsに配列全体を送信。未変更・0件・処理中は無効化 |
| settings-error | エラー | 入力エラー・取得失敗・保存失敗をrole=alertで表示。保存失敗時は編集を保持 |
| settings-status | 状態 | 読み込み中・保存中・保存成功をaria-liveで表示 |
| retry-button | 再試行 | 初期取得失敗時にGET /settings/notificationsを再実行 |
| updated-at | 更新日時 | 保存済みupdated_atを日本時間で表示。編集だけでは変えない |
| discard-dialog | 未保存確認 | 「変更を破棄して戻る」「編集を続ける」。Escは編集継続。ブラウザの再読み込み・離脱もbeforeunloadで確認 |

## 常時表示する説明

全ての監視対象に同じ通知率を適用し、複数到達時は最大の閾値で1通通知する。設定変更後も既に通知した最大率は保持し、それを超える設定値でのみ通知する。最高値を更新すると未通知に戻る。設定変更時には通知せず、次の毎日07:00 JSTの監視で適用する（実行中の変更は次回に適用）。

## API・状態

セッション確認後、GET /settings/notificationsで取得。取得失敗時は初期値を勝手に表示せず、編集・保存を無効化して再試行を案内する。保存成功は返却された昇順配列・更新日時を反映し、未保存状態を解消する。401はログインへ。

HTMLの画面確認用パネルで通常・読み込み中・取得失敗・保存中・保存失敗・保存成功を選択できる。保存操作はメモリ上のサンプル設定を変更する。エラー状態でも保存済み設定と編集中設定を区別する。
