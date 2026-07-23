# 測試情境（產生器正確性）

`build-xlsx.mjs` 是唯一產品面，測試情境關注**產生器對官方規範的正確性**，可執行測試見 `tests/build-xlsx.test.mjs`（`npm test` 執行，node:test + node:assert，無需瀏覽器/帳號）。

## 涵蓋情境

1. **正常題目**：合法題目應無警告、`readiness.skippedQuestions` 為 0。
2. **不支援題型**：`fill_blank` 等非 quiz 型別被跳過，`reason` 明確標註「quiz-only」。
3. **超過 120 字題幹**：截斷至 120 字並警告（官方確認的硬限制，見 `references/platform-features.md`）。
4. **超過 75 字答案**：截斷並警告。
5. **`multiple_select` 正解編碼**：正確編碼成逗號分隔的 1-indexed 編號（如 `"2,4"`）。
6. **沒有正解被跳過**。
7. **`true_false` 對映**：正確轉成 True/False 兩個答案列，正解編號正確。
8. **時間限制 snap**：非官方檔位的秒數會被調整到最接近的 `VALID_TIME_SECONDS` 檔位並警告。
9. **信心提醒**：`readiness.checklist[0]` 一律包含「這是根據 2019 年官方範本、建議下一輪重新核對」的提醒字樣，防止未來改動不小心把這個提醒弄丟。

## 何時要補測試

`mapQuestion` 新增任何警告條件或欄位對映邏輯時，至少要補一組「觸發該警告」與「未觸發時不誤報」的測試。若下一輪取得更新版官方範本、需要調整 `MAX_QUESTION_CHARS`/`MAX_ANSWER_CHARS`/`VALID_TIME_SECONDS`，記得同步更新 `references/platform-features.md` 的信心分級與這裡的測試常數引用。
