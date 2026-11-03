# バックエンドのテストケース

以下は改訂前の単一管理者仕様の実装記録。複数ユーザー・LINE登録仕様の検証済み結果ではない。

[テストケース一覧へ戻る](../test-cases.md)。IDのリンクから該当するテストコードを開ける。

通常テストは依存先をモック化し、DB結合テストは専用PostgreSQLを使用する。FMP・LINEへの通信は模擬サービスを使用する。Hは監視開始後の最高値、Pは取得価格、Lは通知済み率を表す。

## 価格・入力・通知判定

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [BE-DOM-01][BE-DOM-01] | 先頭・末尾0、指数表記、大きな整数、空・0・負数・NaN・Infinity・範囲外 | 正の十進数を精度維持して正規化し、不正価格は拒否 |
| [BE-DOM-02][BE-DOM-02] | `1e131071`・`1e-16383`と保存可能範囲の超過、未初期化価格の比較 | 保存可能な境界は許可、桁数・小数桁超過は拒否。未初期化価格の比較はpanic |
| [BE-DOM-03][BE-DOM-03] | ` aapl `・`éa`、空・内部空白・制御文字、通知率の不正配列と並べ替え | 前後空白除去・ASCIIだけ大文字化。不正入力拒否、`[30,10,20]`は昇順 |
| [BE-DOM-04][BE-DOM-04] | コード64／65文字・不正UTF-8・NUL、名称空白・200／201文字 | コード64文字は許可、不正コード拒否。名称は空白除去し空ならコード、最大200文字に切詰め |
| [BE-DOM-05][BE-DOM-05] | 通知率1〜99の逆順99件、100件、未整列・空の判定閾値 | 99件を入力配列を変えず昇順化。100件は拒否。未整列でも最大到達率、空なら到達なし |
| [BE-DOM-06][BE-DOM-06] | H=100、P=90.0001／90／73／89.995／100／微小正数 | 表示は10.00／10.00／27.00／10.01／0.00／100.00%。通知閾値は到達なし／10／25／10／なし／30% |
| [BE-DOM-07][BE-DOM-07] | H=100・L=20、P=95→80→100→110→99 | 100までは再通知せずL保持。110で最高値更新・L=null、99で10%に到達 |
| [BE-DOM-08][BE-DOM-08] | H=100・L=20、設定`[5,15,25]`、P=75 | 25%を通知候補とし、判定だけではLを更新しない |
| [BE-DOM-09][BE-DOM-09] | H=100、P=90と80、80と90、90同士を比較 | 下落率の小・大・同率を正確に比較 |
| [BE-DOM-10][BE-DOM-10] | データ経過863,999／864,000／864,001秒 | 863,999秒は通常、864,000秒以上は古いデータ |
| [BE-DOM-11][BE-DOM-11] | セッション期限の1ns前・期限ちょうど・1ns後 | 期限前だけ有効 |

## 銘柄操作・通知設定

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [BE-ASSET-01][BE-ASSET-01] | 正常登録、不正コード、重複確認・価格取得・保存失敗、不正価格・取得日時欠落 | 正常時はコード・名称・初期価格・監視中を保存。入力不正・重複・重複確認失敗は価格取得0回。取得・保存段階の失敗を返す |
| [BE-ASSET-02][BE-ASSET-02] | 240時間前の価格・名称空白で` xyz `を登録し、再登録 | XYZを名称として警告付き停止登録。重複は拒否し再取得しない |
| [BE-ASSET-03][BE-ASSET-03] | 検索語の前後空白・不正UTF-8・201文字、既定値・9ソート×昇降順・不正値 | 検索語を正規化し既定created_at／asc。不正値はDBへ渡さず、正常な条件とDBエラーを転送 |
| [BE-ASSET-04][BE-ASSET-04] | ID指定で停止・再開・削除、対象なし | ID・監視状態・更新日時をDBへ渡し、成功／対象なしを返す |
| [BE-ASSET-05][BE-ASSET-05] | 設定取得失敗、空・重複・0・100、`[30,10,20]`保存 | 不正値で既存設定を変更しない。正常値は`[10,20,30]`と更新日時を返す |

## 認証・トークン・パスワード

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [BE-AUTH-01][BE-AUTH-01] | 入力不正、ID／パスワード不一致、セッション／CSRF生成失敗、保存失敗 | 入力不正では照合・生成・保存0回。認証不一致・生成失敗では保存せず、認証不一致と内部障害を区別 |
| [BE-AUTH-02][BE-AUTH-02] | 旧セッションなし／ありでログイン成功 | セッション・CSRFのハッシュを保存し、旧セッションを置換。作成時刻と24時間期限を記録 |
| [BE-AUTH-03][BE-AUTH-03] | トークン欠落・セッションなし・期限切れ・CSRF不一致・DB障害、正常認証とログアウト | 認証不備とDB障害を区別。検索・削除にはハッシュを使い、CSRF照合・削除失敗の伝播を確認 |
| [BE-AUTH-04][BE-AUTH-04] | トークンを2回生成しハッシュ比較 | 32文字以上かつ別値。ハッシュは64文字、一致／不一致を判定 |
| [BE-AUTH-05][BE-AUTH-05] | bcrypt各対応形式、コスト12未満／31超、長さ・区切り・文字・余剰ビット不正 | 対応形式と上限コスト31は許可。不正形式・範囲外コストは拒否 |
| [BE-AUTH-06][BE-AUTH-06] | 正しい／誤ったパスワード、不正ハッシュ | 正しい組合せだけ一致 |

## 日次監視

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [BE-MON-01][BE-MON-01] | H=100でP=73／90.0001、下落通知失敗、価格取得失敗、停滞通知成功／失敗 | 73で25%を1通、90.0001は送信なし。下落通知失敗はL保持。取得失敗・停滞は旧価格保持。停滞通知成功時だけ停止し、本文・JST日時・エラー・確認日時・処理結果を確認 |
| [BE-MON-02][BE-MON-02] | 75で下落通知失敗後、翌日95／75 | 失敗時も価格75を保存し、即時再送なし。翌日95は繰越通知せずL=null、75は25%通知・L=25。どちらも正常完了でエラー解消 |
| [BE-MON-03][BE-MON-03] | 価格取得中に対象を停止し、共通閾値も変更 | 停止対象をスキップし、実行開始時の閾値で判定。取得はID順 |
| [BE-MON-04][BE-MON-04] | 1件目の保存が通常DB障害／接続喪失 | 通常障害は次の対象へ続行、接続喪失は残りを処理せず終了 |
| [BE-MON-05][BE-MON-05] | セッション掃除・設定取得・対象取得の各段階で失敗 | 起動エラーと空の集計を返し、価格取得・通知・銘柄別報告なし |
| [BE-MON-06][BE-MON-06] | 再確認時に削除済み、DB取得／トランザクション開始失敗、不正価格・取得日時欠落 | 削除はスキップ、DB障害は失敗報告して保存なし。不正価格は旧価格を保持しPRICE_FETCH_FAILED。通知0回 |
| [BE-MON-07][BE-MON-07] | 対象処理前／1件処理後の取消、対象0件 | 取消までの処理・報告件数を保持しCanceledを返す。0件は取得なしで正常 |
| [BE-MON-08][BE-MON-08] | L=20で価格取得失敗／停滞通知失敗 | L・最高値・最終取得値・取得日時を保持 |
| [BE-MON-09][BE-MON-09] | 対象IDを3・1・2の順で読み出す | 価格取得と報告は1・2・3の順。3件正常、通知なし |

## HTTP API・静的配信

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [BE-HTTP-01][BE-HTTP-01] | ログイン、セッション確認、ログアウト、旧Cookie再利用、24時間期限 | ハッシュ保存、Cookie2件のSecure／HttpOnly／SameSite=Strict／Path=/・24時間、no-storeを確認。204で両Cookie削除し、旧Cookie・期限ちょうどは401 |
| [BE-HTTP-02][BE-HTTP-02] | 有効な旧Cookie付きで再ログイン | 保存は1セッションだけ、旧Cookieは401 |
| [BE-HTTP-03][BE-HTTP-03] | Origin・CSRF不正、未知／重複項目、型・必須項目・ID・query不正、JSON以外 | Origin・CSRFは403、形式違反400、メディア違反415。設定変更なし。正常設定は昇順、空一覧はitems=[] |
| [BE-HTTP-04][BE-HTTP-04] | 同一接続元で5回失敗、X-Forwarded-Forを変えて再試行、15分経過 | 6回目は429・Retry-After=900。未信頼ヘッダーで回避できず、15分後にログイン可能 |
| [BE-HTTP-05][BE-HTTP-05] | 信頼プロキシ経由／未信頼の接続元で転送IPを指定 | 信頼された経路の末尾から最初の未信頼IPを採用。未信頼接続元の転送ヘッダーは無視 |
| [BE-HTTP-06][BE-HTTP-06] | 検証・認証・DB・外部取得などの既知エラーと予期しないエラー | 400／401／403／404／409／415／422／500／502／503／504と所定コード・message・fieldsを返し、内部秘密文字列を含めない |
| [BE-HTTP-07][BE-HTTP-07] | 空・配列・壊れたJSON・不正UTF-8・64KiB超・読取失敗、入力型・ID・query不正 | 400、設定保存・銘柄操作0回 |
| [BE-HTTP-08][BE-HTTP-08] | 価格取得・DB・認証・ログアウトの障害、正常な銘柄CRUD | 障害に応じ422／502／503／504／404、認証処理失敗でCookie変更なし。正常登録201・Location、文字列ID／価格・UTC日時、一覧件数、停止200・削除204 |
| [BE-HTTP-09][BE-HTTP-09] | Origin／CSRFヘッダー重複、削除の非JSON本文、未知パス、panic | 403／415／404／500。nosniff、503のJSON Content-Type、panic情報の非露出を確認 |
| [BE-HTTP-10][BE-HTTP-10] | 接続元表記・転送IP不正・信頼IPのみ、失敗窓の一部期限切れ、ログイン成功 | IPを適切に正規化／フォールバック。期限切れ分だけ除去し残りを保持、再制限時60秒。ログイン成功で失敗履歴消去 |
| [BE-HTTP-11][BE-HTTP-11] | 各画面URL・JS・存在しないファイル・`.env`へGET | 画面URLはindex.html、JSは本体。存在しないファイル・隠しファイルは404 |
| [BE-HTTP-12][BE-HTTP-12] | POST／PUT／DELETE、index欠落・ディレクトリ、隠しパス、既存JSへHEAD | 許可外メソッド405、配信不可404、既存JSのHEADは200・本文なし |

## 外部サービス接続

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [BE-EXT-01][BE-EXT-01] | FMPの正常応答・空配列・コード不一致・不正timestamp・価格0／文字列・403 | 価格精度と名称を正規化。空／不一致は銘柄取得不可、それ以外は価格取得エラー。要求のsymbol・apikeyと秘密情報の非露出を確認 |
| [BE-EXT-02][BE-EXT-02] | FMP応答timeout／302 | timeoutは価格取得timeout、302は価格取得エラー |
| [BE-EXT-03][BE-EXT-03] | FMPクライアント未指定、timeout未指定・負数・1／30／31秒 | 既定／上限30秒。元クライアントを変更せずコピーし、リダイレクトを拒否 |
| [BE-EXT-04][BE-EXT-04] | FMPの不正URL・通信／読取失敗・1MiB超・不正JSON・timeout | timeoutを区別して安全なエラーへ変換。不正URLは通信0回、その他は1回、秘密情報を含めない |
| [BE-EXT-05][BE-EXT-05] | 一致コードが2件目、名称が文字列以外、固定取得時刻 | 一致する価格を採用し名称はコード。提供日時と取得完了日時を区別し、Accept: application/jsonを付与 |
| [BE-EXT-06][BE-EXT-06] | LINEが200／202／409／429／500を返す | 200だけ成功。Bearer認証・宛先・text本文・Content-Typeを確認し、再試行キーなし、各1回送信 |
| [BE-EXT-07][BE-EXT-07] | LINEクライアント未指定・timeout設定、不正URL・通信／本文読取失敗 | 既定／上限30秒、元設定を変更しない。失敗は通知エラー、不正URLは通信0回、その他は1回 |
| [BE-EXT-08][BE-EXT-08] | LINEが302を返す | 通知エラーとして扱い、転送先への送信0回 |

## DBアダプタ（モック）

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [BE-DB-01][BE-DB-01] | 重複・対象なし・接続断・ネットワーク・制約違反・未知のDBエラー | 重複／対象なし／接続喪失／利用不可へ分類 |
| [BE-DB-02][BE-DB-02] | 不正接続URL、接続前にcontext取消 | 接続プールは利用不可、固定接続の取消は接続喪失として返す |
| [BE-DB-03][BE-DB-03] | DBの価格文字列不正、保存済みエラーコードあり | 不正価格を拒否し、有効なエラーコードを復元 |
| [BE-DB-04][BE-DB-04] | 一覧／監視対象取得のquery・scan・反復失敗、不正ソート条件 | 失敗を返し、取得済みRowsを閉じる。不正条件を拒否 |
| [BE-DB-05][BE-DB-05] | 同率を含む未整列データの下落率昇順／降順、監視対象読取 | 下落率順、同率はID昇順。Rowsを閉じ、対象ID・コードを復元 |
| [BE-DB-06][BE-DB-06] | 下落率同率で既にID順のデータを昇順／降順取得 | どちらでもID昇順を維持 |
| [BE-DB-07][BE-DB-07] | 削除SQL失敗・対象なし・正常削除、設定保存行なし、セッション削除・期限掃除失敗 | 対象なしと利用不可を区別。セッションハッシュ・掃除時刻をSQLへ渡す |
| [BE-DB-08][BE-DB-08] | 開始・処理・commit失敗、正常commit、処理中のcontext取消 | 失敗を返し、開始後は取消済みcontextに依存せずrollbackを試みる。正常時だけ変更を確定 |
| [BE-DB-09][BE-DB-09] | 旧セッションなし／あり、開始・旧行削除・新行挿入・commit失敗 | 新規は挿入だけ、置換は削除と挿入を同一トランザクションで行い、途中失敗ではcommitしない |

## 設定読込・起動・CLI

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [BE-OPS-01][BE-OPS-01] | monitor／serveの設定差、不正PUBLIC_ORIGIN | monitorは管理者認証設定不要。serveは認証必須・既定127.0.0.1:8080。不正Originは秘密値を出さず拒否 |
| [BE-OPS-02][BE-OPS-02] | 切詰め／コスト11のbcryptハッシュ | serveは変数名だけ示して拒否し秘密値を含めない。monitorは認証ハッシュ不要 |
| [BE-OPS-03][BE-OPS-03] | 各コマンドの必須設定を1項目ずつ空白にする | 欠落変数名を示して失敗 |
| [BE-OPS-04][BE-OPS-04] | ID・待受・CIDR・URL不正、各上書き設定、ID 100文字、未知コマンド | 不正設定拒否。HTTP_ADDR・STATIC_DIR・IPv4／IPv6 CIDRを反映し、既定STATIC_DIRはweb/dist。未知コマンド拒否 |
| [BE-OPS-05][BE-OPS-05] | serve／monitorで`.env`と環境変数が競合 | `.env`を優先し、プロセス環境変数自体は変更しない |
| [BE-OPS-06][BE-OPS-06] | `.env`なし・一部項目なし・必須項目空・任意項目空 | 未定義項目は環境変数へ補完。明示的な空は上書きし、必須なら失敗、任意なら既定値 |
| [BE-OPS-07][BE-OPS-07] | `.env`の不正キー・閉じていない引用符・ディレクトリ | 読込失敗を返し、内容や秘密値を含めない |
| [BE-OPS-08][BE-OPS-08] | DB接続・セッション掃除・設定読込で起動失敗 | HTTPを起動せず、取得済みDB資源を解放し起動contextを取消 |
| [BE-OPS-09][BE-OPS-09] | listen失敗・既終了・正常shutdown・shutdown失敗 | APIと待受・期限・ヘッダー上限を設定。正常終了は成功、異常は利用不可。DBを解放し、shutdown失敗時は強制close |
| [BE-OPS-10][BE-OPS-10] | 依存先を接続したmonitorでH=100→P=75 | 25%を通知・保存し資源解放。asset_id・result・error_code・finished_atをJSONログへ記録 |
| [BE-OPS-11][BE-OPS-11] | 公開起動関数へ不正DB URLを渡す | serve／monitorとも利用不可を返す |
| [BE-OPS-12][BE-OPS-12] | コマンドなし・未知・余分な引数・設定不正、serve／monitor選択 | 不正時は起動せず終了1。正常時は依存先と終了コードを引継ぎcommand_finishedを記録 |
| [BE-OPS-13][BE-OPS-13] | serveの成功／失敗、monitorの成功・銘柄失敗・停滞・接続断・その他失敗 | 正常0、失敗／停滞1。monitor_finishedと分類済みエラーコードを記録し秘密値を含めない |
| [BE-OPS-14][BE-OPS-14] | 実バイナリへ未知コマンド・設定欠落・不正`.env`を指定 | 終了1、run_id付きJSONログ。不正設定はCONFIG_INVALIDで、`.env`の内容・秘密値を含めない |

## 結合テスト

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [BE-INT-01][BE-INT-01] | 価格9／100・同値、`%`・`_`・小文字検索、通知済み率NULLの昇降順 | 数値順・同値ID順。記号は文字として検索し、大文字小文字を区別しない。NULLは常に末尾 |
| [BE-INT-02][BE-INT-02] | 不正価格・通知率配列をSQLで保存、設定更新、トランザクション内更新後失敗、同時重複登録、設定行削除 | DB制約で拒否。設定変更後もL保持、失敗時rollback。同時登録は成功1件・重複1件、設定欠落は利用不可 |
| [BE-INT-03][BE-INT-03] | 40桁を超える価格で丸め表示が同じになる下落率を降順取得 | 丸め前の差でソートし、ちょうど10%の対象が先頭 |
| [BE-INT-04][BE-INT-04] | 未認証→ログイン→登録・重複・停止／再開・設定変更・古い価格登録→監視 | 401から認証しCRUD・設定を永続化。停止／再開は即時取得なし、登録は通知なし。H=100→P=73で25%を1通、一覧へ27.00%・L=25を反映 |
| [BE-INT-05][BE-INT-05] | 停滞通知500→次回200→停止後の再実行、削除・再削除・ログアウト | 失敗時は監視中・旧価格保持、成功時だけ自動停止。停止後は価格取得0回。削除204→404、ログアウト204後401・セッション0件 |
| [BE-INT-06][BE-INT-06] | 監視用固定接続をDB側で切断し再度取得、マイグレーションdown→up | 接続喪失を繰返し返し再接続しない。down・upとも成功 |
| [BE-INT-07][BE-INT-07] | 実DBで0件monitor・serve起動／取消・不正待受、実CLIを環境変数／`.env`で実行 | 0件monitor正常。serveの正常起動・終了と待受失敗を確認。CLIはmonitor=0、使用中ポートのserve=1、command_finishedを記録 |

## カバレッジ計測ツール

| ID | 条件・操作 | 期待結果 |
| --- | --- | --- |
| [BE-TOOL-01][BE-TOOL-01] | ループのbreak・0回・完走・早期return・ネスト、真偽return・switch・サブテストを計測 | 計測前後の標準出力が一致。各分岐到達と自然終了を区別し、テスト名・サブテスト名を記録 |
| [BE-TOOL-02][BE-TOOL-02] | 型switchを含む未対応構文を計測 | 終了コード非0と明示的な未対応エラー |

[BE-DOM-01]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/domain/price_test.go#L16
[BE-DOM-02]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/domain/boundaries_test.go#L11
[BE-DOM-03]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/domain/price_test.go#L71
[BE-DOM-04]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/domain/boundaries_test.go#L30
[BE-DOM-05]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/domain/boundaries_test.go#L47
[BE-DOM-06]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/domain/price_test.go#L29
[BE-DOM-07]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/domain/price_test.go#L47
[BE-DOM-08]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/domain/boundaries_test.go#L78
[BE-DOM-09]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/domain/boundaries_test.go#L67
[BE-DOM-10]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/domain/price_test.go#L62
[BE-DOM-11]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/domain/boundaries_test.go#L86
[BE-ASSET-01]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/asset_test.go#L43
[BE-ASSET-02]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/monitoring_test.go#L282
[BE-ASSET-03]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/asset_test.go#L100
[BE-ASSET-04]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/asset_test.go#L140
[BE-ASSET-05]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/asset_test.go#L157
[BE-AUTH-01]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/auth_test.go#L64
[BE-AUTH-02]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/auth_test.go#L115
[BE-AUTH-03]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/auth_test.go#L131
[BE-AUTH-04]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/security/token_test.go#L5
[BE-AUTH-05]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/security/password_test.go#L10
[BE-AUTH-06]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/security/password_test.go#L57
[BE-MON-01]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/monitoring_test.go#L134
[BE-MON-02]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/monitoring_test.go#L205
[BE-MON-03]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/monitoring_test.go#L238
[BE-MON-04]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/monitoring_test.go#L259
[BE-MON-05]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/monitoring_test.go#L298
[BE-MON-06]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/monitoring_test.go#L318
[BE-MON-07]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/monitoring_test.go#L366
[BE-MON-08]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/monitoring_test.go#L400
[BE-MON-09]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/usecase/monitoring_test.go#L425
[BE-HTTP-01]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/httpapi/router_test.go#L168
[BE-HTTP-02]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/httpapi/router_test.go#L213
[BE-HTTP-03]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/httpapi/router_test.go#L224
[BE-HTTP-04]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/httpapi/router_test.go#L277
[BE-HTTP-05]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/httpapi/router_test.go#L292
[BE-HTTP-06]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/httpapi/errors_test.go#L24
[BE-HTTP-07]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/httpapi/errors_test.go#L52
[BE-HTTP-08]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/httpapi/errors_test.go#L91
[BE-HTTP-09]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/httpapi/errors_test.go#L162
[BE-HTTP-10]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/httpapi/errors_test.go#L198
[BE-HTTP-11]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/httpapi/static_test.go#L10
[BE-HTTP-12]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/httpapi/static_test.go#L37
[BE-EXT-01]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/fmp/client_test.go#L15
[BE-EXT-02]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/fmp/client_test.go#L57
[BE-EXT-03]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/fmp/errors_test.go#L24
[BE-EXT-04]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/fmp/errors_test.go#L43
[BE-EXT-05]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/fmp/errors_test.go#L83
[BE-EXT-06]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/line/client_test.go#L11
[BE-EXT-07]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/line/errors_test.go#L21
[BE-EXT-08]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/line/errors_test.go#L61
[BE-DB-01]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/postgres/repository_test.go#L118
[BE-DB-02]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/postgres/repository_test.go#L150
[BE-DB-03]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/postgres/repository_test.go#L167
[BE-DB-04]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/postgres/repository_test.go#L184
[BE-DB-05]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/postgres/repository_test.go#L220
[BE-DB-06]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/postgres/repository_test.go#L276
[BE-DB-07]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/postgres/repository_test.go#L246
[BE-DB-08]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/postgres/repository_test.go#L288
[BE-DB-09]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/adapter/postgres/repository_test.go#L335
[BE-OPS-01]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/config/config_test.go#L10
[BE-OPS-02]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/config/config_test.go#L33
[BE-OPS-03]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/config/boundaries_test.go#L18
[BE-OPS-04]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/config/boundaries_test.go#L39
[BE-OPS-05]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/config/dotenv_test.go#L11
[BE-OPS-06]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/config/dotenv_test.go#L42
[BE-OPS-07]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/config/dotenv_test.go#L92
[BE-OPS-08]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/bootstrap/bootstrap_test.go#L79
[BE-OPS-09]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/bootstrap/bootstrap_test.go#L112
[BE-OPS-10]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/bootstrap/bootstrap_test.go#L180
[BE-OPS-11]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/internal/bootstrap/bootstrap_test.go#L206
[BE-OPS-12]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/cmd/stock-notification/main_test.go#L18
[BE-OPS-13]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/cmd/stock-notification/main_test.go#L68
[BE-OPS-14]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/cmd/stock-notification/main_test.go#L112
[BE-INT-01]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/tests/integration/backend_test.go#L96
[BE-INT-02]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/tests/integration/backend_test.go#L96
[BE-INT-03]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/tests/integration/backend_test.go#L194
[BE-INT-04]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/tests/integration/backend_test.go#L266
[BE-INT-05]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/tests/integration/backend_test.go#L266
[BE-INT-06]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/tests/integration/backend_test.go#L384
[BE-INT-07]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/tests/integration/commands_test.go#L38
[BE-TOOL-01]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/scripts/test_coverage.py#L56
[BE-TOOL-02]: https://github.com/hisho-123/stock_notification_backend/blob/387586acac1344dae8a10d04d281ec03ca1d5f79/scripts/test_coverage.py#L121
