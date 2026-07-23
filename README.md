<p align="center"><img src="assets/logo.jpeg" width="88" alt="Kahoot logo"></p>

# tw-kahoot-skill 使用手冊

非官方、離線的 Kahoot 匯入檔產生器。它把**已對齊教材與學習者的**測驗 JSON 轉為 `.xlsx`、`.quality.json`、`.readiness.json`；不登入 Kahoot、不上傳、不發布、不指派，也不會判定學科內容事實正確。

## 事前條件

- Node.js 18 以上；在此資料夾執行 `npm install`。
- 可定位的教學來源（教材名稱及頁碼、段落等 locator）。
- 明確受測者：年級、程度、教學語言、至少一項先備能力。
- 學習目標、測驗用途、題數與命題藍圖。請從 [assessment-brief.example.json](references/assessment-brief.example.json) 複製後擴充。

## 標準使用

```bash
npm install
node scripts/build-xlsx.mjs quiz.json out.xlsx
```

成功時會產出：

| 檔案 | 先看什麼 |
|---|---|
| `out.xlsx` | 交由教師匯入的試算表。 |
| `out.quality.json` | `status` 必須是 `ready`；看 `blockers`、`warnings`、`perQuestion` 與 `blueprint`。 |
| `out.readiness.json` | 看每題是否 ready/skipped，以及截斷、媒體與時間等格式提醒。 |

## 輸入與命題品質

最上層為 Quiz（`title`、`questions[]`）；必須有 `assessment.version: 1`。`assessment` 必含：

- `sources[]`: 每筆 `id`、`title`、`locator`。
- `audience`: `gradeLevel`、`proficiency`、`language`、非空的 `prerequisites[]`。
- `objectives[]`: 每筆 `id`、`text`，以及 `purpose`。
- `blueprint[]`: `objectiveId`、`cognitiveLevel`、`difficulty`、正整數 `count`。

每題必含 `sourceRefIds[]`、`objectiveIds[]`、`cognitiveLevel`、`difficulty`。認知層次只能是 `remember`、`understand`、`apply`、`analyze`、`evaluate`、`create`；難度只能是 `basic`、`developing`、`proficient`、`advanced`。藍圖總題數和每個「目標 × 層次 × 難度」格都要與實際題目一致。選擇題至少有一個正解，`multiple_choice` 剛好一個；建議每題寫 `explanation` 供教師複核。

缺任一必填資料、追溯失敗、答案鍵錯誤或藍圖不符時，CLI 會以 `assessment-quality-blocked` 停止，**不會產出 xlsx**。這是刻意的安全門檻，不要在期限壓力下跳過。

## Kahoot 匯入

此工具只映射 `multiple_choice`、`multiple_select`、`true_false`。每題至少兩個、最多四個選項；題幹最多 120 字、選項最多 75 字；時間會調整至 5/10/20/30/60/90/120/240 秒。媒體與不支援題型必須在 Kahoot 編輯器手動補建；完整轉述 stdout 的 warnings。

教師操作：Kahoot → Create → Add question → Import → Import spreadsheet → 先下載當日官方 template 比對 → 上傳 `out.xlsx` → 在未發布草稿中逐題預覽與修正 → 再由教師決定是否發布。`readiness.json` 會保留目前欄位是以仍在線的 2019 年官方範本為基礎的提醒；它不是對當日平台 UI 的保證。

## 舊資料、隱私與維護

若必須處理舊 JSON，才明確使用 `node scripts/build-xlsx.mjs quiz.json out.xlsx --legacy`。此模式仍會輸出檔案，但 quality 狀態是 `legacy-unverified`，不可稱為驗題完成或標準產物。不要把學生個資、帳密或 API key 放進 JSON、產物或命令列。

平台範本變更時，維護者應下載當日官方匯入範本，將欄名、欄序、字元限制、時間選項與一份未發布草稿匯入逐項比對，再更新測試與 `references/platform-features.md`；未做真人帳號驗證不得宣稱已完成。

## 疑難排解

| 現象 | 處理 |
|---|---|
| `assessment-quality-blocked` | 讀 quality 的 `blockers`，補 brief 或題目追溯欄位；不要以 legacy 代替修正。 |
| 題目 skipped | 讀 readiness `perQuestion`，改成支援題型、補兩個選項與正解，或在平台手建。 |
| 欄位／預覽異常 | 使用當日官方 template 重新比對，保留 xlsx 與兩份 JSON 作為問題證據。 |

## 驗證

```bash
npm test
```

測試會檢查 assessment 品質門檻與輸出格式；不會登入平台或替你發布內容。評估情境見 [skill-evaluations.md](references/skill-evaluations.md)。
