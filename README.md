<p align="center"><img src="assets/logo.jpeg" width="88" alt="Kahoot logo"></p>

# tw-kahoot-skill

> ⚠️ **非官方工具**：本套件**不是** Kahoot 官方產品，也**非**其認可的整合。Kahoot 沒有建立測驗的公開 API，本套件只產生老師可以直接上傳的官方匯入試算表，不做任何瀏覽器自動化、登入或 API 呼叫。

台灣 K-12 教師用的 Kahoot agent skill：一句話把結構化測驗 JSON 轉成 Kahoot 官方「Import spreadsheet」格式的匯入試算表 + 匯入就緒報告，老師拿著檔案自行到 kahoot.com 匯入、發布。

## ⚠️ 已知限制與信心等級

本 skill 的官方格式資訊有兩層：
- **高信心**：字元限制（題幹 120 字/答案 75 字）、時間限制的 8 個官方檔位（5/10/20/30/60/90/120/240 秒）、正解編碼方式（逗號分隔編號）——這些是 2026-07-23 直接下載 kahoot.com 官方第一方託管的真實範本檔案、用程式讀出確認的，不是猜測。
- **殘留不確定性**：下載到的官方範本是 2019 年的檔案（雖然目前仍在 kahoot.com 線上服務中），無法排除 app 內即時提供的範本已再更新。詳見 `references/platform-features.md` 的完整信心分級。

## 這套 skill 能做什麼

老師把測驗題目給 agent，agent 產生 Kahoot 官方格式的匯入試算表（`.xlsx`），附上一份**匯入就緒報告**（每題 ready/skipped 狀態、截斷/時間調整等提醒），老師拿著檔案登入 Kahoot 自行匯入、發布。

## 快速上手

```bash
cd <skill-dir> && npm install                             # 首次
node scripts/build-xlsx.mjs quiz.json out.xlsx
```

## 自然指令範例

| 老師說 | 觸發 |
|---|---|
| 「把這 10 題轉成 Kahoot 匯入試算表」 | `build-xlsx.mjs quiz.json out.xlsx` |
| 「這份試算表能直接匯入嗎？」 | 看 stdout 的 `warnings` + `readinessReportPath` |

## 功能總覽

| 腳本 | 用途 | 輸入 | 輸出 |
|---|---|---|---|
| `scripts/build-xlsx.mjs` | 產生官方匯入試算表 + 匯入就緒報告 | `quiz.json` `out.xlsx` | 檔案路徑 + warnings + readinessReportPath |

支援題型：**Multiple Choice / True-False / Multiple Select**（Kahoot 官方確認「spreadsheet importer only supports quiz creation」）。其餘題型（fill_blank/short_answer/open_ended/poll/word_cloud/matching/ordering/draw）會被跳過並列入 warnings，提醒老師在 Kahoot 編輯器手動補建。

## 為什麼沒有瀏覽器自動化

這套 skill 從第一版就採用純格式產生器策略，跟同系列的 Wayground/Nearpod/Wordwall 三個 repo 目前的定位一致（那三個原本用 Playwright 自動化，後來發現即便解決了 Google OAuth 拒絕自動化瀏覽器的問題，選擇器驅動的 UI 自動化本身仍不穩定，因而拿掉）。Kahoot 沒有公開 API，也不打算重蹈瀏覽器自動化的覆轍——只產生最大程度符合官方匯入規範的檔案，平台 UI 的最後一哩路（上傳、發布）交給老師。

## License

MIT
