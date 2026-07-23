# Kahoot 官方匯入格式調查（2026-07-23，含即時下載範本核對）

Kahoot 沒有建立測驗的公開內容 API；官方提供的批次建立方式是內建的「Import spreadsheet」——編輯器內 Add question → Import → Import spreadsheet → 「Download our template」。

## 高信心（Kahoot 自己部落格逐字確認）

來源：[kahoot.com/blog/2018/08/23/import-kahoot-from-spreadsheet](https://kahoot.com/blog/2018/08/23/import-kahoot-from-spreadsheet/)

- 「At this point, the spreadsheet importer only supports quiz creation」——只支援 Quiz（選擇題）型別，其餘 Kahoot 遊戲模式（Jumble/Poll/Word Cloud/開放式等）不支援匯入。
- 每題至少 2 個答案，至少 1 個正解。
- 時間限制欄位若留空或無效，官方自動套用 20 秒。

## 高信心（實際下載官方第一方託管檔案、用 exceljs 讀出，2026-07-23）

Kahoot 官方支援頁面（`support.kahoot.com/hc/en-us/articles/115002812547`）對本工具的直接抓取回應 HTTP 403，但成功直接下載到兩個 Kahoot 自己網域（`kahoot.com/files/...`）託管的真實範本檔案，皆為 200 OK 的真實 xlsx：

| | 2018 版（`KahootQuizTemplate-3.xlsx`） | **2019 版（`Kahoot-Quiz-Spreadsheet-Template.xlsx`，本 skill 採用）** |
|---|---|---|
| 題幹上限 | 95 字元 | **120 字元** |
| 答案上限 | 60 字元 | **75 字元** |
| 時間限制檔位 | 5,10,20,30,60,90,120 秒 | **5,10,20,30,60,90,120,240 秒** |

兩個檔案在 2026-07-23 仍由 kahoot.com 正常提供下載，本 skill 採用較新的 2019 版數字（官方限制隨版本調高過）。

從 2019 版檔案讀出的確切結構（Sheet1）：

- **A 欄**：題目序號（1, 2, 3...）——容易被忽略但真實範本確實有這一欄，多數第三方教學網站的說明都漏了這點。
- **B 欄**：Question（`max 120 characters`）。
- **C-F 欄**：Answer 1-4（各 `max 75 characters`）。
- **G 欄**：Time limit (sec)——欄位本身有 **Excel 資料驗證（下拉選單）**，用 exceljs 讀出真實的合法值清單為 `formulae: ["5,10,20,30,60,90,120,240"]`，`allowBlank: true`。
- **H 欄**：Correct answer(s)——逗號分隔的 1-indexed 答案編號（如 `"1,2,3,4"`），天生支援單選與複選。
- 第 2-6 列是官方說明文字（標題「Quiz template」、操作提示、字元限制提醒、匯出格式提醒），第 8 列是標頭，第 9 列起為資料列。本 skill 產生的 xlsx 逐字複製這些說明列，最大化與官方範本的外觀一致性。

## 殘留不確定性（誠實標註，未確認）

- **這是 2019 年的檔案**（7 年前），雖然目前仍是 kahoot.com 在線上提供下載的真實檔案，但無法排除 app 內即時互動下載到的範本已再更新（例如字元上限可能又調高）。找不到更新的官方託管範本網址可比對。
- **圖片/媒體欄位**：範本裡完全沒有圖片相關欄位，本 skill 因此不新增猜測欄位；有媒體的題目會警告「需老師之後在編輯器手動加圖」。
- **True/False 是否有專屬型別標記**：範本本身沒有區分「這是不是 Quiz vs. True/False」的欄位——本 skill 把 `true_false` 題型轉成一般的 2 答案選擇題（True/False 選項），這是合理推斷但未經官方逐項確認。

## 下一輪建議

尚未用「即時登入 Kahoot 帳號、走過完整 Import spreadsheet UI 流程」驗證過真實匯入結果——建議下一輪有帳號/瀏覽器工具時，實際跑一次匯入，確認：(1) 字元上限是否仍是 120/75，(2) 產出的 xlsx 是否真的被接受，(3) True/False 題型在匯入後是否正確識別。

來源：
- https://kahoot.com/blog/2018/08/23/import-kahoot-from-spreadsheet/
- https://kahoot.com/files/2018/08/KahootQuizTemplate-3.xlsx（實際下載讀出）
- https://kahoot.com/files/2019/08/Kahoot-Quiz-Spreadsheet-Template.xlsx（實際下載讀出，本 skill 採用版本）
- support.kahoot.com 官方支援頁面對本工具回應 403，無法直接引用
