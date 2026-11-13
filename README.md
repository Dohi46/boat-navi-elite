# BOAT NAVI ELITE — 3連単・記録機能付きバージョン

## 主な機能
- 全国24場の当日公開JSONを取得（開催場・レース一覧）
- 出走表・取得できた直前情報の表示
- 選手成績・モーター・平均ST・展示タイムを使ったルールベース参考スコア
- 上位3艇の着順を入れ替えた3連単6通りの自動候補
- 自分で選んだ3連単の保存
- 自動候補・手動予想の保存
- レース結果と払戻金の手入力
- 的中数・回収率・保存した予想履歴の表示

## 大切な注意
AI LABは機械学習や生成AIによる予測ではなく、公開データを単純加重した参考スコアです。表示される6通りは上位3艇の順列であり、オッズ・展開・期待値を計算したものではありません。的中や利益を保証しません。
データ元は非公式の Boatrace Open API です。更新遅延・欠損・誤りがあり得るため、購入前に必ずBOAT RACE公式情報を確認してください。
予想履歴は利用中のブラウザのlocalStorageに保存されます。別端末とは同期せず、ブラウザデータ削除で消える場合があります。
RECORDの結果・払戻金は手入力です。回収率は入力された購入予定額と実際の受取額から算出します。

## GitHub Pagesへの更新
1. ZIPを解凍し、中の `boat-navi-elite` フォルダを開く
2. GitHubの `Dohi46/boat-navi-elite` リポジトリを開く
3. `Add file` → `Upload files`
4. 解凍したフォルダ内のファイル（index.html / app.js / manifest.webmanifest / sw.js / README.md / DEPLOY.md）をアップロード
5. 既存ファイルを置き換える形でCommit changes
6. 公開サイトを再読み込み。古い画面が残る場合はSafariでページを再読み込みするか、少し時間をおいて開き直す

## データ元
Boatrace Open API（非公式）
https://github.com/boatraceopenapi/api
https://boatraceopenapi.github.io/api/v1/today.json
