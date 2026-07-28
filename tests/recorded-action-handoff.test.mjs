import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Kahoot handoff documents manual OAuth and draft-only boundaries", async () => {
  const skill = await readFile(new URL("../SKILL.md", import.meta.url), "utf8");
  const oauth = await readFile(new URL("../references/google-oauth-handoff.md", import.meta.url), "utf8");
  const handoff = await readFile(new URL("../references/recorded-action-handoff.md", import.meta.url), "utf8");
  for (const phrase of ["正常 Chrome", "Chrome 原生 Google 帳戶提示", "Cookie／Consent", "This browser or app may not be secure", "XLSX 入口", "匯入投影片", "80 MB", "繼續編輯", "quality.status=ready", "未發布草稿", "Publish", "Assign"]) {
    assert.match(`${skill}\n${oauth}\n${handoff}`, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
