# まことちゃん通知BOT

指定したプロフィールページを Playwright で定期取得し、構造化したデータ同士を比較して Discord に差分だけ通知する Node.js 製 BOT です。HTML 丸ごとの差分ではなく、出勤情報、プロフィール、写真、写メ日記を意味単位で比較します。

## 概要

- 対象プロフィール: `https://m-surprise.com/profile/?id=4967`
- 通知方式: Discord Incoming Webhook
- 実行方式: ローカル実行または GitHub Actions で 5 分おき
- 永続化方式: `data/latest.json` と `data/previous.json` を更新し、Actions では必要に応じてリポジトリへコミット

## 必要環境

- Node.js 22 以上
- npm
- Discord Incoming Webhook URL

## インストール方法

```bash
npm install
npx playwright install chromium
```

## `.env` の設定方法

`.env.example` を参考に `.env` を作成してください。

```env
PROFILE_URL=https://m-surprise.com/profile/?id=4967
DIARY_URL=https://diary.m-surprise.com/category/no-75-%e3%81%be%e3%81%93%e3%81%a8/
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
TIMEZONE=Asia/Tokyo
DIARY_PAGE_LIMIT=3
NOTIFY_INITIAL_SNAPSHOT=false
NOTIFY_SCHEDULE=true
NOTIFY_PROFILE=true
NOTIFY_PHOTOS=true
NOTIFY_DIARY=true
```

主な設定値:

- `DIARY_PAGE_LIMIT`: 写メ日記カテゴリの先頭から何ページ取得するか。1 ページ 5 件前後です。
- `NOTIFY_INITIAL_SNAPSHOT`: 初回実行時に「初期スナップショット作成完了」を通知するか。
- `NOTIFY_SCHEDULE`, `NOTIFY_PROFILE`, `NOTIFY_PHOTOS`, `NOTIFY_DIARY`: 通知種別の ON/OFF。

## ローカル実行方法

```bash
npm start
```

初回実行時は比較対象がないため、通知せずにスナップショットだけ保存します。`NOTIFY_INITIAL_SNAPSHOT=true` の場合だけ初回通知します。

## GitHub Actions 設定方法

1. このプロジェクトを GitHub リポジトリに push します。
2. Repository Secret に `DISCORD_WEBHOOK_URL` を追加します。
3. 必要なら Repository Variables に以下を追加します。

- `PROFILE_URL`
- `DIARY_URL`
- `DIARY_PAGE_LIMIT`
- `NOTIFY_INITIAL_SNAPSHOT`
- `NOTIFY_SCHEDULE`
- `NOTIFY_PROFILE`
- `NOTIFY_PHOTOS`
- `NOTIFY_DIARY`

Workflow は `.github/workflows/watch.yml` で定義しています。

- 5 分おき実行: `*/5 * * * *`
- 手動実行: `workflow_dispatch`
- 実行後に `data/latest.json` と `data/previous.json` が変わっていれば自動コミット

## Discord Webhook 作成方法

1. Discord のサーバー設定を開く
2. `連携サービス` または `Integrations` を開く
3. `Webhook` を作成する
4. Webhook URL をコピーして `DISCORD_WEBHOOK_URL` に設定する

## データ構造

`data/latest.json` にはおおむね以下の形で保存されます。

```json
{
  "fetchedAt": "2026-03-24T12:34:56.000Z",
  "profile": {
    "name": "まこと",
    "basicInfo": {
      "age": "25",
      "height": "158",
      "size": "B:91(F) W:58 H:86",
      "hobby": "映画を見る！"
    },
    "texts": {
      "catchcopy": "まことのプロフィール 事前予約可",
      "message": "沢山ご奉仕します",
      "shopMessage": "..."
    }
  },
  "photos": ["https://..."],
  "schedule": {
    "2026-03-24": { "type": "off" },
    "2026-03-27": { "type": "work", "start": "10:00", "end": "17:00" }
  },
  "diary": [
    {
      "id": "26446",
      "title": "たまには",
      "url": "https://diary.m-surprise.com/no-75-%e3%81%be%e3%81%93%e3%81%a8/26446/",
      "image": "https://diary.m-surprise.com/wp-content/uploads/image0-2248-150x150.jpeg",
      "date": "2026-03-19"
    }
  ]
}
```

## 出勤比較ロジック

- 日付キー単位で比較します
- 並び順では比較しません
- 7 日表示の自然なスライドで古い日付が消えても通知しません
- 新しく末尾に追加された日付は通知対象です
- 既存日付の `お休み → 出勤`、`出勤 → お休み`、時間変更は通知します
- 取得不能な日だけが突然消えたようなケースは、誤通知を減らすため基本的に無視します

## セレクタ変更時の修正箇所

プロフィールサイト側:

- `src/fetchProfile.js`
- 主なセレクタ:
  - `.profile`
  - `.profile-slider__list-item img`
  - `.profile-list > .profile-list--item`
  - `.profile-week__date li`
  - `.profile-week__time li`

写メ日記側:

- `src/fetchDiary.js`
- 主なセレクタ:
  - `article.post`
  - `.entry-title a`
  - `.entry-time`
  - `img.wp-post-image`
  - `.post-categories a`

## 注意事項

- サイト構造が変わるとセレクタ修正が必要です
- `DIARY_PAGE_LIMIT` を小さくするとアクセス数は減りますが、古い写メ日記の削除検知は弱くなります
- GitHub Actions の永続化はリポジトリへのコミット更新を前提にしています
- Discord Webhook 未設定時は通知せず、コンソールログだけ出します

## ファイル構成

```text
makoto-watch-bot/
  src/
    browser.js
    config.js
    fetchProfile.js
    fetchDiary.js
    normalize.js
    diffSchedule.js
    diffProfile.js
    diffPhotos.js
    diffDiary.js
    notifyDiscord.js
    storage.js
    main.js
  data/
    latest.json
    previous.json
  .github/workflows/watch.yml
  package.json
  README.md
  .env.example
```

## 習慣管理アプリ向け export

この BOT は Discord 通知だけでなく、Expo / React Native 側の「習慣管理」アプリに流し込むための import payload も出力できます。

### latest.json から payload を作る

```bash
npm run export:life-log
```

デフォルトでは `data/latest.json` を読み、`data/life-log-import.json` を出力します。

引数を付ける場合:

```bash
node src/exportLifeLogPayload.js <input-json> <output-json> <source>
```

例:

```bash
node src/exportLifeLogPayload.js data/latest.json data/life-log-import.json discord-bot
```

### FC2 履歴 HTML から shiftRecords payload を作る

```bash
npm run export:fc2-history -- data/fc2-history.html data/fc2-history-import.json 2026
```

引数:
- 1つ目: 入力 HTML パス
- 2つ目: 出力 JSON パス
- 3つ目: 年 (HTML が 03/21 のような月日だけの場合に補完)

出力はどちらも次の形式です。

```json
{
  "source": "discord-bot",
  "importedAt": "2026-03-28T01:45:39.778Z",
  "shifts": [],
  "updates": []
}
```

この JSON を life-log-app 側の `importExternalSnapshot` へ流し込む想定です。
