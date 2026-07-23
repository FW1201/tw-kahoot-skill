---
name: tw-kahoot-skill
description: Use when a teacher wants quiz content turned into a Kahoot spreadsheet-import-ready file — 產生 Kahoot 官方匯入試算表、匯入就緒報告。Triggers include quiz.json, Kahoot, 匯入題目, 匯入試算表.
---

# tw-kahoot-skill

把結構化測驗（quiz.json）轉成 Kahoot 官方「Import spreadsheet」格式的 `.xlsx`，並附上匯入就緒報告，老師拿著檔案自行到 kahoot.com 匯入、發布。

⚠️ **本 skill 的欄位配置尚未用真實下載範本逐欄核對過本輪即時版本**——2026-07-23 已直接下載 kahoot.com 官方託管的 2019 年範本檔並用程式讀出精確結構（見 `references/platform-features.md`），但無法排除 app 內即時提供的範本已再更新。建議下一輪用真實帳號驗證；上傳前務必先看 warnings 與 readiness report。

## 首次使用

```bash
cd <skill-dir> && npm install
```

只在 `node_modules/` 不存在時執行。

## 工作流程

1. **產生匯入檔（唯一步驟）**：
   ```bash
   node scripts/build-xlsx.mjs quiz.json out.xlsx
   ```
   輸出 JSON 含 `questionCount`、`warnings`、`readinessReportPath`（指向 `out.readiness.json`）。**warnings 一定要完整轉述給老師**，包含：不支援的題型（Kahoot 匯入僅支援 Quiz 選擇題）、超過 4 個答案被裁掉、題幹/答案超過官方確認的 120/75 字元上限已截斷、時間限制調整到官方檔位（5/10/20/30/60/90/120/240 秒）、含媒體的題目需人工補圖。
   `readiness.json` 的 `checklist[0]` 永遠是信心等級提醒；`perQuestion` 陣列列出每題 ready/skipped 狀態與原因，上傳前建議老師先看過。

2. **上傳後，請老師在 Kahoot 官網做的事**：登入 kahoot.com → Create → Add question → Import → Import spreadsheet → 上傳剛產生的 xlsx → 對照 warnings 核對截斷/跳過的題目 → 自行發布。

## 規則

- 每支腳本輸出單行 JSON：`{ok:true,...}` 或 `{ok:false,error,hint}`。
- `warnings` 一定完整轉述；不支援的題型（除 Multiple Choice/True-False/Multiple Select 外皆不支援匯入）一定要點名，提醒老師可在 Kahoot 編輯器手動補建。
- 這裡沒有任何瀏覽器/登入自動化，也沒有官方 API 可用——本 skill 只產生檔案。

## 常見錯誤

| 症狀 | 處理 |
|---|---|
| quiz.json 驗證失敗 | 對照 `scripts/lib/models.mjs` 的 Quiz schema 修正 |
| `No questions could be mapped` | 所有題目型別都不被支援；檢查 quiz.json 的 `type` 欄位（僅 multiple_choice/true_false/multiple_select 可匯入） |
