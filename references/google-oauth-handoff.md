# Google OAuth 動作銜接：Kahoot

本文件只描述登入前置；Skill 不保存密碼、Cookie、token 或 MFA，也不代填 Google 憑證。

1. 教師在平常使用的正常 Chrome 個人檔案開啟 Kahoot。
2. 若出現 Cookie／Consent 橫幅，先由教師接受必要 Cookie 或關閉提示；這只是網站前置狀態，不代表已登入。
3. 登入分兩條分支：若出現 Chrome 原生 Google 帳戶提示（例如 `Continue as ...`），由教師確認正確帳戶；若回到 Kahoot 一般登入頁，則由教師使用 `Sign in with Google` 或正常帳密表單完成登入。Skill 不代填憑證、MFA 或 CAPTCHA。
4. 若出現 `This browser or app may not be secure`、`signin/rejected`、嵌入式登入頁或仍停在登入頁，停止自動化，回到正常 Chrome 處理。
5. 工具重新讀取頁面；只有看到 Kahoot 管理頁、工作區／帳戶入口且不再看到登入／註冊，才算成功。

2026-07-28 實測：正常 Chrome 已回讀 `create.kahoot.it/`、工作區 `chi456789883 私人`，並可進入「建立新 Kahoot」。現版建立器可見「空白內容／匯入投影片／範本」，未見舊錄製流程所稱的 XLSX／spreadsheet 入口；找不到入口時必須停下回報版本差異，不得猜測 URL。

Google OAuth 成功只代表登入工作階段成立，不代表 XLSX 已上傳、草稿已儲存、Kahoot 已發布、已指派或已分享。
