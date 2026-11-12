# 拾句：每天一句 Kobo 劃線

每天固定時間打開，看自己在 Kobo 劃過的句子，回答一個小問題，把想法存下來。

這個資料夾就是完整、可以直接使用的網頁 App，不需要安裝任何工具、也不需要編譯。

---

## 1. 實際可用嗎？

可以。這是一般的網頁檔案（HTML、CSS、JavaScript），放到任何免費的網頁空間就能在 iPhone 的 Safari 使用，不依賴任何付費服務。

| 功能 | 狀態 |
| --- | --- |
| 今日精選、上一則／下一則、左右滑動 | 可用 |
| 每天自動換一組句子（依日期） | 可用 |
| 今日想一想（Gemini 依當天句子出題） | 可用，需要免費的 Gemini 金鑰，見第 6 節 |
| 收藏、寫想法、想法分頁、搜尋 | 可用 |
| 書庫、書籍頁、封面 | 可用；中文書封面常找不到，會用藍灰漸層 |
| 從 Kobo 匯入劃線與註記 | 可用；第一次匯入需要網路 |
| 備份／還原 | 可用（設定頁） |
| 每天固定時間提醒 | 用 iPhone「捷徑」，見第 4 節 |

---

## 2. 檔案說明

| 檔案 | 用途 |
| --- | --- |
| `index.html` | App 外殼、底部分頁、AI 模型設定（`SHIJU_CONFIG`） |
| `styles.css` | 所有樣式。顏色、字體、圓角都在最上方的 `:root` |
| `data.js` | 範例劃線、範例想法 |
| `state.js` | 資料層：存檔、每日挑句、AI 出題、Kobo 匯入、封面、備份 |
| `app.js` | 畫面與互動：每個分頁的 render 函式、按鈕動作 |
| `sw.js` | 離線快取 |
| `manifest.webmanifest`、`icon-*.png` | App 名稱與圖示 |
| `ai-worker.js` | 進階選配：AI 中繼服務（放在 Cloudflare，不放在網頁空間） |

---

## 3. 放到網路上（GitHub Pages，免費）

1. 到 github.com 註冊帳號。
2. 建立新的 repository，例如 `shiju`，選 Public。
3. 按「Add file」→「Upload files」，把這個資料夾裡的檔案全部拖進去（`ai-worker.js` 可以不傳），按「Commit changes」。
4. 到 repository 的「Settings」→「Pages」，Source 選「Deploy from a branch」，Branch 選 `main`、資料夾選 `/ (root)`，按 Save。
5. 等一兩分鐘，網址會是 `https://你的帳號.github.io/shiju/`。
6. 在 iPhone 的 Safari 打開這個網址。

**重要：請一律在 Safari 裡使用，不要「加入主畫面」。**
iPhone 上，主畫面的網頁 App 和 Safari 的資料是分開存的。捷徑打開的是 Safari，如果你在主畫面版匯入資料，捷徑打開時會看不到。

---

## 4. 每天固定時間提醒（iPhone 捷徑）

1. 打開「捷徑」App，切到下方的「自動化」，點右上角「＋」。
2. 選「特定時間」，設定時間（例如 07:30），重複選「每天」。
3. 選「立即執行」。
4. 加入動作「顯示通知」，內容寫「今日想一想 ☀️」（可省略）。
5. 再加入動作「打開 URL」，貼上你的拾句網址，完成。

---

## 5. 從 Kobo 匯入

1. 用 USB 線把 Kobo 接上電腦，Kobo 上選「連接」。
2. 打開 Kobo 磁碟裡的隱藏資料夾 `.kobo`（Mac 按 Command＋Shift＋. 顯示隱藏檔；Windows 在檔案總管勾選「隱藏的項目」）。
3. 把 `KoboReader.sqlite` 複製到 iCloud 雲碟。
4. 在 iPhone 的拾句「設定」→「選擇 KoboReader.sqlite」，從「檔案」App 的 iCloud 雲碟選它。

- 匯入的是劃線、你的註記、劃線日期、書名、作者。
- 全書內容不會匯入；在 Kobo 書店買的書有加密，也無法讀取全文。
- 之後有新劃線，重新匯入一次即可，原本的收藏與想法會保留。
- USB-C 的 iPhone 也可能直接讀到 Kobo，但不保證；用電腦轉一次最穩。

---

## 6. 「今日想一想」：Gemini 依句子出題

每一題都由 Google Gemini 依「當天這一句劃線」和你的註記即時產生，不是固定題庫。

**申請金鑰（免費，約 3 分鐘）**
1. 用電腦或手機打開 aistudio.google.com，用 Google 帳號登入。
2. 按「Get API key」→「Create API key」，複製那串文字。
3. 在拾句的「設定」→「AI 出題」貼上，回到「今日」就會出題。

**運作方式**
- 同一天、同一句只會問 AI 一次，結果會存起來，重開 App 不會重問。按「換一題」才會再問一次，而且會要求換角度。
- 每天 3 則、偶爾換題，大約一天 3–10 次，遠低於免費額度。免費額度與規定會變動，以 Google 官方說明為準。
- 沒網路或 AI 出錯時會顯示「暫時無法出題」，按「換一題」重試。
- 要換模型，改 `index.html` 的 `model`。

**安全性**
- 金鑰只存在這支手機的 Safari，由手機直接傳給 Google，不會經過其他伺服器，也不會寫進程式碼或 GitHub。
- 匯出的備份檔不含金鑰，換手機時要重新貼一次。
- 建議在 Google Cloud 的「API 和服務」→「憑證」裡，把這把金鑰限制成只能用 Generative Language API。
- 免費方案送出的內容，Google 可能用於改善產品；不想讓劃線內容被使用，可以在 AI Studio 啟用付費方案。

**進階（可不做）**：不想把金鑰放在手機上，可以改用 `ai-worker.js` 部署到 Cloudflare Worker（有免費方案），把網址填進 `index.html` 的 `aiEndpoint`，設定頁就不用貼金鑰。步驟寫在 `ai-worker.js` 開頭。

---

## 7. 資料與備份

- 所有資料存在 Safari 的本機儲存（`localStorage`，鍵名 `shiju-v1`），不會上傳。
- 清除 Safari 網站資料、或連續很久沒打開，資料可能被系統清掉。每天用就不會有問題，但仍建議偶爾到「設定」→「匯出備份」，存到「檔案」App。
- 換手機時：舊手機匯出備份，新手機「還原備份」。

資料格式（`state.js` 的 `S`）：

```js
{
  v: 1,                    // 格式版本
  name: 'Catherine',       // 問候用的名字
  perDay: 3,               // 每天幾則
  hs: [{ id, book, author, date: 'YYYY-MM-DD', text, note, imported }],  // 劃線
  refl: { [劃線id]: [{ date: 'M/D', ts, q: '當時的問題', text }] },     // 想法
  starred: { [劃線id]: true },
  covers: { [書名]: '封面網址或空字串' },
  geminiKey: '',           // 只存在手機，備份不含
  aiCache: { ['日期:劃線id:換題次數']: '題目' },
  source: 'KoboReader.sqlite', sample: false,
  day: 'YYYY-MM-DD', todayIds: [...], idx: 0, promptShift: { [劃線id]: 0 }
}
```

---

## 8. 用程式修改

**改顏色、字體**：`styles.css` 最上方的 `:root`。

| 變數 | 色碼 | 用在 |
| --- | --- | --- |
| `--navy` | `#2a3547` | 文字、深色按鈕 |
| `--ocean` | `#4c5a6c` | 主要按鈕、標題 |
| `--tint` | `#c9d4e0` | 今日精選卡、想法卡、設定區塊 |
| `--tint-light` | `#e2e8ee` | 註記底色 |
| `--sky` | `#eef1f4` | 淺色按鈕 |
| `--bg` | `#f5f7f9` | 畫面底色 |
| `--muted` | `#646c78` | 書名等淺灰字 |
| `--prompt` | `#6f7d8f` | 今日想一想卡片 |
| `--yellow` | `#f2d675` | 收藏、已讀進度點 |

字體：蘋方（PingFang TC），沒有蘋方的裝置用思源黑體；大引號用 Georgia。卡片圓角 28px，按鈕為膠囊形。

**改文案**：`app.js` 內各 `render…` 函式。
**新增按鈕動作**：在按鈕加 `data-act="名稱" data-arg="參數"`，再到 `app.js` 的 `actions` 物件加同名函式。
**改每日挑句邏輯**：`state.js` 的 `ensureDay`。
**改 AI 出題的指示**：`state.js` 的 `coachPrompt`。
**改完上線**：把改過的檔案重新上傳到 GitHub，並把 `sw.js` 的 `VERSION` 加 1，手機才會載入新版。

**交給 Claude Code 時**可以這樣說：「這是一個不需編譯的網頁 App，資料層在 state.js、畫面在 app.js、樣式在 styles.css，請在不改變視覺設計的前提下幫我＿＿＿。」

---

## 9. 已知限制

- 網頁無法自己在背景定時發通知，所以提醒靠「捷徑」。
- 中文書封面常查不到，會顯示藍灰漸層；之後可以改成讀 Kobo 裡的封面圖片。
- 第一次匯入 Kobo 要連網，因為讀檔工具（sql.js）是從網路下載的。
- 今日想一想需要網路；沒網路時無法出題，其他功能可離線使用。
- 範例劃線僅供展示，匯入後會被你的資料取代。
- 我沒有在實機 iPhone 上測試過，第一次使用請先確認每個分頁都正常。
