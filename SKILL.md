---
name: tw-kahoot-skill
description: Use when a teacher needs a source-traceable, audience-aligned Kahoot spreadsheet import file, or needs to assess whether quiz JSON is ready for Kahoot import.
---

# Kahoot 測驗匯入

將已審核的測驗 JSON 轉為 Kahoot `.xlsx` 匯入檔。核心原則是：**先取得可追溯的命題 brief，再產檔；格式可匯入不等於題目內容已被教學審核。**

## 必要工作流

1. 蒐集來源、受測者、學習目標、用途與藍圖；資料缺漏時不要編題、不要產檔。
2. 依下列契約建立 `quiz.json`，每題對應來源、目標、認知層次與難度。
3. 執行 `node scripts/build-xlsx.mjs quiz.json out.xlsx`。
4. 先讀 `out.quality.json`：`status: "ready"` 才能交付；逐題查看 `blockers`、`warnings`、`perQuestion` 和 `blueprint`。
5. 再讀 `out.readiness.json` 與 stdout `warnings`：它處理的是 Kahoot 匯入格式、截斷與跳題風險，不取代內容審題。
6. 教師自行在 Kahoot 建立未發布草稿匯入並核對預覽；不得聲稱已自動上傳、發布或指派。

## assessment v1 契約

```json
{
  "title": "單元檢核",
  "questions": [{
    "type": "multiple_choice",
    "prompt": "題幹",
    "options": [{"text": "選項 A", "correct": true}, {"text": "選項 B", "correct": false}],
    "explanation": "供教師複核的說明",
    "sourceRefIds": ["src-1"], "objectiveIds": ["obj-1"],
    "cognitiveLevel": "understand", "difficulty": "basic"
  }],
  "assessment": {
    "version": 1,
    "sources": [{"id": "src-1", "title": "教材名稱", "locator": "第 3 頁／段落"}],
    "audience": {"gradeLevel": "國七", "proficiency": "基礎", "language": "zh-TW", "prerequisites": ["已學過…"]},
    "objectives": [{"id": "obj-1", "text": "能…"}],
    "purpose": "形成性檢核",
    "blueprint": [{"objectiveId": "obj-1", "cognitiveLevel": "understand", "difficulty": "basic", "count": 1}]
  }
}
```

允許的 `cognitiveLevel`：`remember`、`understand`、`apply`、`analyze`、`evaluate`、`create`；`difficulty`：`basic`、`developing`、`proficient`、`advanced`。藍圖各格題數總和及每格實際題數均須吻合。選擇題至少一個正解；`multiple_choice` 必須剛好一個。

## Kahoot 提醒

- 試算表僅映射 `multiple_choice`、`multiple_select`、`true_false`；每題至少兩個選項、最多四個，媒體須進編輯器補上。
- 題幹最多 120 字、選項最多 75 字；時間會調至 5/10/20/30/60/90/120/240 秒之一。完整轉述 warnings。
- `readiness.json` 首項會提醒範本來源是仍在線的 2019 年官方檔。匯入前在 Kahoot 的 Import spreadsheet 畫面下載當日範本比對欄位。

## 例外與限制

`--legacy` 只用於既有資料救援：它會產出 `legacy-unverified` 的 quality report，來源、對象與藍圖均未驗證，不能當作標準流程或「已驗題」。本 Skill 沒有 API、登入、瀏覽器自動化、發布或指派功能。

## 常見錯誤

| 症狀 | 處理 |
|---|---|
| `assessment-quality-blocked` | 補足 v1 brief、題目追溯欄位與藍圖，不要直接改用 legacy。 |
| 題目被 skipped | 看 readiness 的 `perQuestion`，以支援題型和必填選項修正，或在編輯器手動補建。 |
| `explanation-missing` | 補上教師可複核的解析；這是 warning，不是內容正確性的證明。 |
