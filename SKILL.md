---
name: tw-kahoot-skill
description: Design and create source-traceable Kahoot interactive quizzes, slides, or courses, prepare supported imports, and verify content through available browser tools.
---

使用平台特有模式時，先查閱 [模式與驗證指引](references/platform-modes.md)。以 [教學 brief 範例](assets/lesson-brief-v1.example.json) 定義年級、來源、目標、活動、時間和玩家回饋；用既有 CLI 的 `lesson --input <brief.json>` 檢查時間及來源關聯，結果不取代教師審查。

## 跨 Agent 環境與工具發現

首次安裝前及需要外部平台操作前，執行 `node scripts/portable-core/agent-doctor.mjs --agent codex`；可將 codex 換為 claude、antigravity、opencode 或 other。診斷不會讀出或測試金鑰；unknown 不是可用。依診斷提示與當前 Agent 工具清單檢查 connector/MCP、權限、瀏覽器與登入，不能由本機 CLI 是否存在推論工具可用。詳見 [跨 Agent 與模式指引](references/portable-integration.md)。

連接器與 MCP 路徑僅在當前工具庫確認操作、權限與使用者需求後使用；使用具體工具前確認其參數及輸出。原有下方 CLI 與人工流程、品質檢查及外部寫入限制仍適用於原工具；不能宣稱未測試的工具路徑已完成。完成後讀回並區分草稿、發布及分享狀態。

# Kahoot 測驗匯入

將已審核的測驗 JSON 轉為 Kahoot `.xlsx` 匯入檔。核心原則是：**先取得可追溯的命題 brief，再產檔；格式可匯入不等於題目內容已被教學審核。**

## 必要工作流

1. 蒐集來源、受測者、學習目標、用途與藍圖；資料缺漏時不要編題、不要產檔。
2. 依下列契約建立 `quiz.json`，每題對應來源、目標、認知層次與難度。
3. 執行 `node scripts/build-xlsx.mjs quiz.json out.xlsx`。
4. 先讀 `out.quality.json`：`status: "ready"` 才能交付；逐題查看 `blockers`、`warnings`、`perQuestion` 和 `blueprint`。
5. 再讀 `out.readiness.json` 與 stdout `warnings`：它處理的是 Kahoot 匯入格式、截斷與跳題風險，不取代內容審題。
6. 依可用工具與使用者授權建立或匯入未發布草稿，核對題目、正解、預覽與可見度；只回報實際完成的上傳、發布或指派。

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

## 簡報匯入流程（實測）

在已登入的正常 Chrome 中：`建立新內容` → `建立新 Kahoot` → `匯入投影片`。目前頁面提供 `同步 Google 雲端硬碟`、`同步 OneDrive`，以及從電腦上傳投影片；對話框明示支援 PowerPoint、Google 簡報、Keynote、PDF，檔案上限 80 MB。選取檔案後等待轉換，頁面會顯示檔名與「這可能需要花上幾分鐘」，再由教師選擇「繼續編輯」。這是簡報轉 Kahoot 草稿流程，不等同已發布。

## 錄製後的草稿動作

先依 [google-oauth-handoff.md](references/google-oauth-handoff.md) 在教師平常使用的正常 Chrome 個人檔案完成登入。Cookie 提示與登入是兩個獨立狀態；登入可走 Chrome 原生 Google 帳戶提示或 Kahoot 一般登入頁兩條分支。Skill 不代填 Email、密碼、MFA，也不接管嵌入式 WebView 或新開的自動化瀏覽器。若出現 `This browser or app may not be secure`、`signin/rejected` 或仍在登入頁，停止並請教師回到正常 Chrome 完成登入。

只有在 Kahoot 回到管理頁、顯示工作區／帳戶入口且不再顯示登入／註冊後，才可接管同一個已登入 Chrome 工作階段。教師以 Record-a-Skill 提供可檢視錄製後，才可依 [recorded-action-handoff.md](references/recorded-action-handoff.md) 將錄到的 XLSX 匯入與未發布預覽接回工作流；沒有錄製時不可猜測網站操作。若現版只有「匯入投影片」而沒有 XLSX 入口，停止並回報版本差異。上傳前確認 `quality.status=ready`、readiness 無未處理 skipped／warning，並核對題數、題型、選項與正解。

Publish、Assign、分享、排程與學生資料操作都要在發布前停止並回報證據；不能把看見 Publish 按鈕當成已完成外部寫入。

## 例外與限制

`--legacy` 只用於既有資料救援：它會產出 `legacy-unverified` 的 quality report，來源、對象與藍圖均未驗證，不能當作標準流程或「已驗題」。未有已審核 action map 前，本 Skill 沒有 API、登入、瀏覽器控制、發布或指派功能。

## 常見錯誤

| 症狀 | 處理 |
|---|---|
| `assessment-quality-blocked` | 補足 v1 brief、題目追溯欄位與藍圖，不要直接改用 legacy。 |
| 題目被 skipped | 看 readiness 的 `perQuestion`，以支援題型和必填選項修正，或在編輯器手動補建。 |
| `explanation-missing` | 補上教師可複核的解析；這是 warning，不是內容正確性的證明。 |

## CLI 教學帳戶控制（錄製後啟用）

`tw-edtech-kahoot` 串接品質檢查、登入工作階段前置、動作計畫與遮罩證據。先跑 `doctor`、`validate --input quiz.json`、`catalog scan`、`plan`；未有使用者錄製並審核的 action map 時，`run` 只能安全回傳 `requires-recording`。

```bash
tw-edtech-kahoot validate --input quiz.json
tw-edtech-kahoot plan --action quiz.import --resource CANARY-kahoot
```

XLSX 匯入與草稿編輯以 `--confirm-write` 確認；Publish、Share、Host、Assign、報告、集合與刪除還需 `--confirm-plan` 和 `--confirm-impact`。含學生資料的名單另需 `--confirm-student-data`，不得進入輸出、截圖、錄製或 Git。
