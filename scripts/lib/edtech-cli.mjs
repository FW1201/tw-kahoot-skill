import { createHash } from "node:crypto";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

export const CONTRACT_VERSION = 1;
const value = (args, name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (args, name) => args.includes(`--${name}`);
const out = (payload, code = 0) => { console.log(JSON.stringify(payload)); if (code) process.exitCode = code; };
const maskName = (value = "") => value ? `${String(value).slice(0, 1)}**` : "（未提供姓名）";
const maskEmail = (value = "") => { const [local = "", domain = ""] = String(value).split("@"); return domain ? `${local.slice(0, 1) || "*"}***@${domain}` : "（未提供信箱）"; };
async function rosterSummary(file) { if (!file) return { present: false, count: 0, preview: [] }; const raw = JSON.parse(await readFile(file, "utf8")); const students = Array.isArray(raw) ? raw : raw.students; if (!Array.isArray(students)) throw new Error("名單 JSON 必須是陣列或 { students: [...] }。"); return { present: true, count: students.length, preview: students.slice(0, 3).map((s) => `${maskName(s.name)} <${maskEmail(s.email ?? s.platformId)}>`), }; }
const confirmationCode = (plan) => createHash("sha256").update(JSON.stringify(plan)).digest("hex").slice(0, 16);
function localCdp(url) { try { return ["127.0.0.1", "localhost", "::1"].includes(new URL(url).hostname); } catch { return false; } }
async function checkChrome(cdpUrl) { if (!cdpUrl) return { checked: false, connected: false }; if (!localCdp(cdpUrl)) return { checked: true, connected: false, error: "cdp-url-must-be-localhost" }; try { const version = await (await fetch(new URL("/json/version", cdpUrl))).json(); return { checked: true, connected: Boolean(version.webSocketDebuggerUrl), browser: version.Browser ?? null }; } catch { return { checked: true, connected: false, error: "chrome-session-unavailable" }; } }
async function hasActionMap(root, action) { try { await access(path.join(root, "recordings", `${action.replace(/[^a-z0-9.-]+/gi, "_")}.action-map.json`)); return true; } catch { return false; } }
function call(command, args, cwd) { return new Promise((resolve, reject) => { const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; child.stdout.on("data", (chunk) => (stdout += chunk)); child.stderr.on("data", (chunk) => (stderr += chunk)); child.on("error", reject); child.on("close", (status) => resolve({ status, stdout, stderr })); }); }

export async function runEdtechCli({ platform, root, apiHandlers = {}, validate }) {
  const [command = "help", ...args] = process.argv.slice(2); const catalog = JSON.parse(await readFile(path.join(root, "capability-catalog.json"), "utf8")); const cdpUrl = value(args, "cdp-url");
  if (command === "help") return out({ ok: true, platform, contractVersion: CONTRACT_VERSION, commands: ["doctor", "catalog scan", "validate", "plan", "run", "verify"] });
  if (command === "doctor") return out({ ok: true, platform, contractVersion: CONTRACT_VERSION, catalogVersion: catalog.version, chrome: await checkChrome(cdpUrl), recordedActionMaps: catalog.actions.filter((item) => item.status === "available").map((item) => item.id) });
  if (command === "catalog" && args[0] === "scan") return out({ ok: true, platform, catalogVersion: catalog.version, chrome: await checkChrome(cdpUrl), actions: catalog.actions.map(({ id, category, risk, status, requiresStudentData }) => ({ id, category, risk, status, requiresStudentData: Boolean(requiresStudentData) })), note: "這是本機版本化目錄；登入帳戶與錄製驗證完成前，不會推測平台 UI 或可用方案。" });
  if (command === "validate") { const input = value(args, "input"); if (!input) return out({ ok: false, error: "usage", hint: "validate --input <json>" }, 1); try { return out({ ok: true, platform, ...(await validate(input)) }); } catch (error) { return out({ ok: false, error: "validation-failed", hint: String(error.message ?? error) }, 1); } }
  const action = value(args, "action"); const resource = value(args, "resource"); if (!action || !resource) return out({ ok: false, error: "usage", hint: `${command} --action <action-id> --resource <resource-id-or-title>` }, 1);
  const definition = catalog.actions.find((item) => item.id === action); if (!definition) return out({ ok: false, error: "unknown-action", action, hint: "先執行 catalog scan，僅可操作目錄中列出的功能。" }, 1);
  let studentData; try { studentData = await rosterSummary(value(args, "roster")); } catch (error) { return out({ ok: false, error: "invalid-roster", hint: String(error.message ?? error) }, 1); }
  const plan = { contractVersion: CONTRACT_VERSION, platform, catalogVersion: catalog.version, action, resource, risk: definition.risk, studentDataPresent: studentData.present, studentCount: studentData.count }; const code = confirmationCode(plan);
  if (command === "plan") return out({ ok: true, ...plan, confirmationCode: code, studentData, externalWriteAttempted: false });
  if (command === "verify") return out({ ok: false, error: "no-run-evidence", action, resource, hint: "verify 只讀取已完成 run 產生的遮罩證據；目前沒有可驗證的執行紀錄。", externalWriteAttempted: false }, 1);
  if (command !== "run") return out({ ok: false, error: "unknown-command", command }, 1);
  if (!flag(args, "confirm-write")) return out({ ok: false, error: "confirmation-required", hint: "這是外部寫入；先執行 plan，確認內容後加入 --confirm-write。", chromeChecked: false, externalWriteAttempted: false }, 1);
  if (value(args, "confirm-plan") !== code) return out({ ok: false, error: "plan-confirmation-required", confirmationCode: code, hint: "動作、資源或名單已變更；重新檢視 plan 後，以 --confirm-plan 提供確認碼。", externalWriteAttempted: false }, 1);
  if (definition.risk === "high" && value(args, "confirm-impact") !== `${action}:${resource}`) return out({ ok: false, error: "high-risk-confirmation-required", impact: `${action}:${resource}`, hint: "發布、分享、指派、名單、報告或刪除需要 --confirm-impact <action:resource> 的第二次確認。", externalWriteAttempted: false }, 1);
  if (studentData.present && !flag(args, "confirm-student-data")) return out({ ok: false, error: "student-data-confirmation-required", hint: "名單只可在本次執行讀取；加入 --confirm-student-data 以確認受影響人數。", externalWriteAttempted: false }, 1);
  if (definition.adapter === "api") { const handler = apiHandlers[action]; const payload = value(args, "payload"); if (!handler || !payload) return out({ ok: false, error: "api-payload-required", hint: "Padlet API 動作須提供 --payload，並維持既有 API 命令的讀回與速率限制保護。", externalWriteAttempted: false }, 1); const result = await call(process.execPath, handler({ resource, payload, args }), root); let forwarded; try { forwarded = JSON.parse(result.stdout.trim()); } catch { forwarded = { raw: result.stdout.trim() }; } out({ ...forwarded, platform, action, externalWriteAttempted: true }); process.exitCode = result.status ?? 1; return; }
  if (definition.status !== "available" || !(await hasActionMap(root, action))) return out({ ok: false, error: "requires-recording", action, hint: "此 UI 動作尚未有已審核的語意化 action map；請先在正常 Chrome 用 Record-a-Skill 錄製 Canary 流程。", externalWriteAttempted: false }, 1);
  const chrome = await checkChrome(cdpUrl); if (!chrome.connected) return out({ ok: false, error: "chrome-session-unavailable", chrome, hint: "請先在正常 Chrome 手動登入，再以本機 CDP URL 連接同一工作階段。", externalWriteAttempted: false }, 1);
  return out({ ok: false, error: "recorded-runner-pending", action, hint: "Action map 已存在但尚未通過該平台 Canary 驗證；不會執行未驗證的瀏覽器寫入。", externalWriteAttempted: false }, 1);
}
