#!/usr/bin/env node
// Build a Kahoot spreadsheet-importer-ready .xlsx from a quiz.json.
// Live-sourced 2026-07-23: fetched Kahoot's own first-party-hosted template
// files directly (kahoot.com/files/2018/08/KahootQuizTemplate-3.xlsx and
// kahoot.com/files/2019/08/Kahoot-Quiz-Spreadsheet-Template.xlsx, both HTTP
// 200 with the real xlsx content-type at fetch time) and read them with
// exceljs — this is real downloaded-file inspection, not a guess or a
// third-party paraphrase. Kahoot's own support article
// (support.kahoot.com/hc/en-us/articles/115002812547) returned HTTP 403 to
// direct fetching, so these two first-party template files are the best
// available ground truth. The two files disagree on limits (2018: 95-char
// question / 60-char answer; 2019, newer and still served: 120/75) — this
// generator uses the 2019 numbers.
// ⚠️ CONFIDENCE CAVEAT: the 2019 file is 7 years old. It is still genuinely
// served by kahoot.com today (verified live), but the exact file Kahoot's
// in-app "Download our template" button serves in 2026 could differ (e.g. a
// further-raised character limit). If content gets rejected/truncated on
// real import, that's the first thing to re-check — see references/
// platform-features.md for the full confidence breakdown.
// Usage: node scripts/build-xlsx.mjs <quiz.json> <out.xlsx>
import { promises as fs } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { Quiz } from "./lib/models.mjs";
import { legacyQualityReport, validateAssessmentQuiz } from "./lib/assessment-quality.mjs";

// Real values read out of the 2019 official template (row 8 header text +
// the Excel data-validation dropdown list on the time-limit column, G9).
export const MAX_QUESTION_CHARS = 120;
export const MAX_ANSWER_CHARS = 75;
export const MAX_ANSWERS = 4;
export const VALID_TIME_SECONDS = [5, 10, 20, 30, 60, 90, 120, 240];
export const DEFAULT_TIME_SECONDS = 20;

const SUPPORTED_TYPES = new Set(["multiple_choice", "true_false", "multiple_select"]);

const plain = (text) => text.replace(/\s+/g, " ").trim();

function truncate(text, max) {
  return text.length > max ? text.slice(0, max) : text;
}

function snapToValidTime(seconds) {
  const t = seconds ?? DEFAULT_TIME_SECONDS;
  let best = VALID_TIME_SECONDS[0];
  for (const v of VALID_TIME_SECONDS) {
    if (Math.abs(v - t) < Math.abs(best - t)) best = v;
  }
  return best;
}

// Returns { ok: false, reason } for a skipped question, or
// { ok: true, ...row fields, notes } for a mapped one. Mirrors
// tw-wayground-skill's build-xlsx.mjs mapQuestion contract exactly.
function mapQuestion(q, idx) {
  const notes = [];

  if (!SUPPORTED_TYPES.has(q.type)) {
    return {
      ok: false,
      reason: `type '${q.type}' unsupported by Kahoot spreadsheet import (quiz-only per Kahoot's own blog post) — skipped.`,
    };
  }

  let options = q.options;
  if (q.type === "true_false") {
    const correctIsTrue = q.options.some(
      (o) => o.correct && /^(true|t|是|對|正確)$/i.test(o.text.trim()),
    );
    options = [
      { text: "True", correct: correctIsTrue },
      { text: "False", correct: !correctIsTrue },
    ];
  }

  const usable = options.slice(0, MAX_ANSWERS);
  if (options.length > MAX_ANSWERS) {
    notes.push(`Kahoot 匯入範本最多 ${MAX_ANSWERS} 個答案欄位——多出的選項已捨棄。`);
  }
  if (usable.length < 2) {
    return { ok: false, reason: "fewer than 2 options — skipped." };
  }

  const correctIdxs = usable.map((o, i) => (o.correct ? i + 1 : 0)).filter((n) => n > 0);
  if (correctIdxs.length === 0) {
    return { ok: false, reason: "no correct option(s) marked — skipped." };
  }
  const correct = correctIdxs.join(",");

  let questionText = plain(q.prompt);
  if (questionText.length > MAX_QUESTION_CHARS) {
    notes.push(
      `題幹 ${questionText.length} 字，超過 Kahoot 官方確認的 ${MAX_QUESTION_CHARS} 字上限，已截斷至 ${MAX_QUESTION_CHARS} 字。`,
    );
    questionText = truncate(questionText, MAX_QUESTION_CHARS);
  }

  const answers = usable.map((o, i) => {
    let text = plain(o.text);
    if (text.length > MAX_ANSWER_CHARS) {
      notes.push(
        `答案 ${i + 1}「${text.slice(0, 20)}...」共 ${text.length} 字，超過 Kahoot 官方確認的 ${MAX_ANSWER_CHARS} 字上限，已截斷。`,
      );
      text = truncate(text, MAX_ANSWER_CHARS);
    }
    return text;
  });

  if (q.media) {
    notes.push("Kahoot 匯入範本沒有圖片欄位；需老師之後在編輯器手動加圖。");
  }

  const providedTime = q.timeLimitSeconds;
  const time = snapToValidTime(providedTime);
  if (providedTime === undefined) {
    notes.push(`未提供時間限制，套用 Kahoot 官方文件記載的預設 ${DEFAULT_TIME_SECONDS} 秒。`);
  } else if (time !== providedTime) {
    notes.push(
      `時間限制 ${providedTime}s 已調整到最接近的官方檔位 ${time}s（官方下拉選單僅接受 ${VALID_TIME_SECONDS.join("/")} 秒）。`,
    );
  }

  return { ok: true, questionText, answers, correct, time, notes };
}

// Rows 1-8 copied verbatim (text content) from the real 2019 official
// template so the produced file matches what Kahoot's importer expects to
// see, maximizing import success. Row 8 is the header; data starts row 9.
const INSTRUCTION_TEXT =
  "Add questions, at least two answer alternatives, time limit and choose correct answers (at least one). Have fun creating your awesome quiz!";
const LIMIT_TEXT = `Remember: questions have a limit of ${MAX_QUESTION_CHARS} characters and answers can have ${MAX_ANSWER_CHARS} characters max. Text will turn red in Excel or Google Docs if you exceed this limit. If several answers are correct, separate them with a comma.`;
const EXAMPLE_TEXT = "See an example question below (don't forget to overwrite this with your first question!)";
const EXPORT_REMINDER_TEXT =
  "And remember,  if you're not using Excel you need to export to .xlsx format before you upload to Kahoot!";

export async function buildKahootWorkbook(quiz, outPath, { legacy = false } = {}) {
  const effectiveQuality = legacy ? legacyQualityReport(quiz) : validateAssessmentQuiz(quiz);
  if (!effectiveQuality.ok) throw new Error("assessment-quality-blocked");
  const warnings = [];
  const perQuestion = [];
  const wb = new ExcelJS.Workbook();
  wb.creator = "tw-kahoot-skill";
  const ws = wb.addWorksheet("Sheet1");

  ws.getRow(2).getCell(2).value = "Quiz template";
  ws.getRow(3).getCell(2).value = INSTRUCTION_TEXT;
  ws.mergeCells("B3:H3");
  ws.getRow(4).getCell(2).value = LIMIT_TEXT;
  ws.mergeCells("B4:H4");
  ws.getRow(5).getCell(2).value = EXAMPLE_TEXT;
  ws.getRow(6).getCell(2).value = EXPORT_REMINDER_TEXT;
  ws.mergeCells("B6:H6");
  ws.getRow(8).values = [
    "",
    `Question - max ${MAX_QUESTION_CHARS} characters`,
    `Answer 1 - max ${MAX_ANSWER_CHARS} characters`,
    `Answer 2 - max ${MAX_ANSWER_CHARS} characters`,
    `Answer 3 - max ${MAX_ANSWER_CHARS} characters`,
    `Answer 4 - max ${MAX_ANSWER_CHARS} characters`,
    `Time limit (sec) – ${VALID_TIME_SECONDS.slice(0, -1).join(", ")}, or ${VALID_TIME_SECONDS.at(-1)} secs`,
    "Correct answer(s) - choose at least one",
  ];
  ws.getRow(8).font = { bold: true };
  ws.getColumn(1).width = 12.5;
  ws.getColumn(2).width = 49.3;
  for (let c = 3; c <= 6; c += 1) ws.getColumn(c).width = 31.8;
  ws.getColumn(7).width = 26.3;
  ws.getColumn(8).width = 33.2;

  let rowNum = 9;
  let questionCount = 0;
  quiz.questions.forEach((q, idx) => {
    const r = mapQuestion(q, idx);
    if (!r.ok) {
      warnings.push(`Q${idx + 1}: ${r.reason}`);
      perQuestion.push({ index: idx + 1, status: "skipped", type: q.type, reason: r.reason });
      return;
    }
    r.notes.forEach((n) => warnings.push(`Q${idx + 1}: ${n}`));
    perQuestion.push({
      index: idx + 1,
      status: "ready",
      type: q.type,
      notes: r.notes.length ? r.notes : undefined,
    });

    const dataRowIndex = rowNum - 8; // 1-based sequence in column A, per the real template
    ws.getRow(rowNum).values = [
      dataRowIndex,
      r.questionText,
      r.answers[0] ?? "",
      r.answers[1] ?? "",
      r.answers[2] ?? "",
      r.answers[3] ?? "",
      r.time,
      r.correct,
    ];
    rowNum += 1;
    questionCount += 1;
  });

  if (questionCount === 0) {
    warnings.push("No questions could be mapped to Kahoot's supported types.");
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await wb.xlsx.writeFile(outPath);

  // Import readiness report — the confidence caveat is always the first
  // checklist line, unconditionally, since this repo's template layout is
  // sourced from a 2019 file rather than a version confirmed identical to
  // what Kahoot serves today (see the module header comment).
  const skippedCount = perQuestion.filter((p) => p.status === "skipped").length;
  const flaggedCount = perQuestion.filter((p) => p.status === "ready" && p.notes).length;
  const readiness = {
    totalQuestions: quiz.questions.length,
    readyQuestions: questionCount,
    skippedQuestions: skippedCount,
    flaggedQuestions: flaggedCount,
    checklist: [
      "⚠️ 本欄位配置（欄名/欄序/字元上限）已對照 2026-07-23 直接下載的 kahoot.com 官方範本（2019 年版，仍在線上服務中）核對，但無法排除目前 app 內即時下載到的範本已再更新。上傳前請先到 Kahoot「Add question → Import → Import spreadsheet →『Download our template』」下載官方範本比對，如有落差請回報。",
      `${questionCount}/${quiz.questions.length} 題已就緒可匯入。`,
      ...(skippedCount ? [`${skippedCount} 題因型別/欄位不足被跳過，需在編輯器手動補建（見 perQuestion 的 skipped 項目）。`] : []),
      ...(flaggedCount ? [`${flaggedCount} 題有非致命提醒（截斷/媒體/時間調整等），上傳前建議先看過。`] : []),
    ],
    perQuestion,
  };
  const readinessPath = outPath.replace(/\.xlsx$/i, "") + ".readiness.json";
  await fs.writeFile(readinessPath, JSON.stringify(readiness, null, 2), "utf8");
  const exportedQuality = structuredClone(effectiveQuality);
  if (exportedQuality.status === "ready" && skippedCount > 0) {
    exportedQuality.ok = false;
    exportedQuality.status = "platform-partial";
    exportedQuality.blockers = [...(exportedQuality.blockers ?? []), { code: "platform-unmappable", message: `${skippedCount} 題無法映射為 Kahoot 匯入列；請修正後再交付。` }];
  }
  const qualityReportPath = outPath.replace(/\.xlsx$/i, "") + ".quality.json";
  await fs.writeFile(qualityReportPath, JSON.stringify(exportedQuality, null, 2), "utf8");

  return { path: path.resolve(outPath), readinessReportPath: path.resolve(readinessPath), qualityReportPath: path.resolve(qualityReportPath), warnings, questionCount };
}

// CLI entry point only — guarded so buildKahootWorkbook can be imported
// (e.g. by tests/build-xlsx.test.mjs) without triggering argv parsing.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const [, , input, output] = process.argv;
  const legacy = process.argv.includes("--legacy");
  if (!input || !output) {
    console.log(JSON.stringify({ ok: false, error: "usage", hint: "node scripts/build-xlsx.mjs <quiz.json> <out.xlsx>" }));
    process.exit(1);
  }
  try {
    const quiz = Quiz.parse(JSON.parse(await fs.readFile(input, "utf8")));
    const quality = legacy ? legacyQualityReport(quiz) : validateAssessmentQuiz(quiz);
    if (!quality.ok) {
      console.log(JSON.stringify({ ok: false, error: "assessment-quality-blocked", quality, hint: "請補齊 assessment brief，或明確使用 --legacy 產出未驗證檔案。" }));
      process.exit(1);
    }
    const result = await buildKahootWorkbook(quiz, output, { quality });
    console.log(JSON.stringify({ ok: true, ...result, title: quiz.title }));
  } catch (err) {
    console.log(
      JSON.stringify({
        ok: false,
        error: String(err?.message ?? err),
        hint: "請確認 quiz.json 符合 Quiz schema（title + questions[]，每題 type/prompt/options）。",
      }),
    );
    process.exit(1);
  }
}
