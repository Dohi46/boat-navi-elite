# 公開手順（GitHub Pages）

1. GitHubにログインし、新しいPublic repositoryを作成（例：boat-navi-elite）。
2. ZIPを解凍し、`index.html`、`app.js`、`manifest.webmanifest`、`sw.js`、`README.md`をリポジトリ直下へアップロード。
3. GitHubのリポジトリで Settings → Pages → Build and deployment → Deploy from a branch を選択。
4. Branchを `main`、folderを `/ (root)` にしてSave。
5. 数分後に表示される `https://ユーザー名.github.io/boat-navi-elite/` をスマホで開く。
6. iPhoneではSafariの共有ボタン →「ホーム画面に追加」でアプリ風に利用できます。

## 注意
- これは静的サイトです。API提供元が仕様変更・停止した場合は修正が必要です。
- 公開前にデータ提供元の最新利用条件を確認してください。
- 認証、決済、有料会員、サーバー側データベースはまだ含まれていません。
- まず無料のGitHub Pagesで動作確認し、必要になった段階で独自ドメインやSupabase等を検討してください。
