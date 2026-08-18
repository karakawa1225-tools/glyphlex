# PDF画像貼り付けアプリ（超初心者向け）

PDFの上に画像を貼り付けて、編集後のPDFを保存できるアプリです。

## 1. まず最初にすること

1. `PDF-app` フォルダを開く
2. `start.bat` をダブルクリック
3. ブラウザが開いて `http://localhost:8080` が表示されたらOK

ブラウザが自動で開かない場合は、手動で `http://localhost:8080` を開いてください。
初回はライブラリ準備のため少し時間がかかることがあります。

## 2. 使い方（画面操作）

1. ホームのメニューで流れを確認する
2. （任意）ホームの「画像の取り込み」でPNG/JPGを複数選ぶ
3. PDFなしで透かしを消す場合は `画像を開いて編集` → `画像の透かしを削除` → `画像を保存`
4. PDFを編集する場合は `Choose File` でPDFを選び、`PDF読込` を押す（選んだ画像は1ページ目に載ります）
5. 編集画面で追加する場合は `PDF画像を追加`（必要なら `画像の透かしを削除`）
6. 画像をドラッグして移動する
7. 画像のハンドルをドラッグしてサイズを変える
8. 右上の `保存` を押してダウンロードする

## 3. アプリを閉じる方法

- `start.bat` 実行時の黒い画面で `Ctrl + C` を押す

## 4. うまく動かないとき

- **黒い画面にエラーが出る**  
  表示されたメッセージをそのまま確認してください（消さない）
- **「Python が見つかりません」と出る**  
  Pythonをインストールしてください
- **「npm が見つかりません」と出る**  
  Node.js をインストールしてください
- **画面が開かない**  
  `http://localhost:8080` を直接ブラウザに入力してください

---

## 5. GitHub 経由で Web 公開する（初心者向け）

インターネット上の URL でアプリを開けるようにする手順です。**GitHub** と **GitHub Pages** を使います。  
（自分の PC だけで使う場合は `start.bat` で十分です。ここから先は「ネットに公開したい人」向けです。）

### 準備するもの

- [GitHub](https://github.com/) の無料アカウント
- このプロジェクトのフォルダ一式（`PDF-app`）

### 手順の全体像

1. GitHub 上に **リポジトリ**（プロジェクトの置き場）を作る  
2. フォルダの中身を **Git で push** する  
3. **GitHub Pages** をオンにする  
4. 自動でビルド・公開される（数分待つ）

### A. GitHub でリポジトリを作る

1. GitHub にログインする  
2. 右上の **+** → **New repository**  
3. **Repository name** に例: `glyphlex-pdf` と入力  
4. **Public** を選ぶ（無料で Pages を使いやすいです）  
5. **Create repository** を押す  
6. 次の画面に出る URL（`https://github.com/あなたのID/glyphlex-pdf.git` のようなもの）をメモする  

### B. パソコンからファイルを送る（Git）

**まだ Git を入れていない場合**  
[Git for Windows](https://git-scm.com/download/win) をインストールし、インストール後に一度 PC を開き直すか、新しいターミナルを開きます。

**PDF-app フォルダで**、次を順に実行します（`あなたのID` と `リポジトリ名` は自分のものに変えてください）。

```text
cd PDF-app のある場所
git init
git add .
git commit -m "初回コミット"
git branch -M main
git remote add origin https://github.com/あなたのID/リポジトリ名.git
git push -u origin main
```

- 初回は GitHub のログイン画面やトークン入力を求められることがあります。画面の案内に従ってください。  
- もし **default branch が `master`** だけの場合は、`git branch -M main` の代わりにそのまま `git push -u origin master` でも動きます（ワークフローは `main` と `master` の両方で動くようにしてあります）。

### C. GitHub Pages を有効にする

1. GitHub のそのリポジトリのページを開く  
2. **Settings**（設定）タブ  
3. 左メニューの **Pages**  
4. **Build and deployment** の **Source** で **GitHub Actions** を選ぶ  
5. 以上で設定完了です  

### D. 公開されるまで

1. リポジトリの **Actions** タブを開く  
2. **Deploy GitHub Pages** が緑のチェックで終わるまで待つ（初回は 2〜5 分程度のこともあります）  
3. **Settings** → **Pages** に表示される **Visit site** または URL があなたの Web アプリです  

URL の例:

- `https://あなたのID.github.io/リポジトリ名/`

### あとからコードを直したとき

また `PDF-app` フォルダで:

```text
git add .
git commit -m "更新内容のメモ"
git push
```

とすると、自動で再ビルド・再公開されます。

### ローカルで「公開用フォルダ」だけ試す

```text
npm install
npm run build:pages
```

で `docs` フォルダが生成されます。中身は GitHub Pages と同じ構成です（`docs` は `.gitignore` 済みのため、通常は push しません。GitHub 上では Actions が毎回生成します）。

### うまくいかないとき

- **Actions が赤い（失敗）**  
  失敗したジョブを開き、ログの赤いエラー文を確認する。`npm ci` が失敗する場合は `package-lock.json` がリポジトリに含まれているか確認してください。  
- **404 になる**  
  Pages の Source が **GitHub Actions** になっているか、デプロイ完了を待ったか確認してください。  
- **ブランチ名**  
  push しているブランチが `main` または `master` か確認してください。
