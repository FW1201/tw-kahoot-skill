// Generator-correctness tests. No network/browser/API needed — mirrors
// tw-wayground-skill's build-xlsx.test.mjs coverage pattern.
import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildKahootWorkbook as rawBuildKahootWorkbook,
  MAX_QUESTION_CHARS,
  MAX_ANSWER_CHARS,
  VALID_TIME_SECONDS,
} from "../scripts/build-xlsx.mjs";
import { Quiz } from "../scripts/lib/models.mjs";
const buildKahootWorkbook = (quiz, outPath) => rawBuildKahootWorkbook(quiz, outPath, { legacy: true });

function tmpXlsx() {
  return path.join(os.tmpdir(), `kh-test-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
}

test("well-formed quiz: all questions ready, no warnings", async () => {
  // timeLimitSeconds explicitly set to a valid tier so the (by-design)
  // "no time limit provided, defaulting to 20s" note doesn't fire — that
  // note is exercised separately in the time-limit test below.
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      { type: "multiple_choice", prompt: "1+1=?", options: [{ text: "2", correct: true }, { text: "3", correct: false }], timeLimitSeconds: 20 },
    ],
  });
  const outPath = tmpXlsx();
  const result = await buildKahootWorkbook(quiz, outPath);
  assert.equal(result.questionCount, 1);
  assert.deepEqual(result.warnings, []);
  const readiness = JSON.parse(await fs.readFile(result.readinessReportPath, "utf8"));
  assert.equal(readiness.readyQuestions, 1);
  assert.equal(readiness.skippedQuestions, 0);
});

test("unsupported type (fill_blank) is skipped with a quiz-only reason", async () => {
  const quiz = Quiz.parse({
    title: "t",
    questions: [{ type: "fill_blank", prompt: "the answer is ___", options: [], acceptedAnswers: ["x"] }],
  });
  const result = await buildKahootWorkbook(quiz, tmpXlsx());
  assert.equal(result.questionCount, 0);
  assert.ok(result.warnings[0].includes("quiz-only"));
});

test("over-limit question text is truncated to MAX_QUESTION_CHARS and warned", async () => {
  const longPrompt = "字".repeat(MAX_QUESTION_CHARS + 20);
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      { type: "multiple_choice", prompt: longPrompt, options: [{ text: "a", correct: true }, { text: "b", correct: false }] },
    ],
  });
  const outPath = tmpXlsx();
  const result = await buildKahootWorkbook(quiz, outPath);
  assert.ok(result.warnings.some((w) => w.includes(`${MAX_QUESTION_CHARS} 字上限`)));
});

test("over-limit answer text is truncated to MAX_ANSWER_CHARS and warned", async () => {
  const longAnswer = "a".repeat(MAX_ANSWER_CHARS + 10);
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      { type: "multiple_choice", prompt: "p", options: [{ text: longAnswer, correct: true }, { text: "b", correct: false }] },
    ],
  });
  const result = await buildKahootWorkbook(quiz, tmpXlsx());
  assert.ok(result.warnings.some((w) => w.includes(`${MAX_ANSWER_CHARS} 字上限`)));
});

test("multiple_select encodes correct answers as comma-separated 1-indexed numbers", async () => {
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      {
        type: "multiple_select",
        prompt: "pick 2 and 4",
        options: [
          { text: "a", correct: false },
          { text: "b", correct: true },
          { text: "c", correct: false },
          { text: "d", correct: true },
        ],
      },
    ],
  });
  const outPath = tmpXlsx();
  await buildKahootWorkbook(quiz, outPath);
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(outPath);
  const ws = wb.worksheets[0];
  assert.equal(ws.getRow(9).getCell(8).value, "2,4");
});

test("no correct answer marked is skipped", async () => {
  const quiz = Quiz.parse({
    title: "t",
    questions: [{ type: "multiple_choice", prompt: "p", options: [{ text: "a", correct: false }, { text: "b", correct: false }] }],
  });
  const result = await buildKahootWorkbook(quiz, tmpXlsx());
  assert.equal(result.questionCount, 0);
  assert.ok(result.warnings[0].includes("no correct option"));
});

test("true_false maps to a two-row True/False answer set with the right correct index", async () => {
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      {
        type: "true_false",
        prompt: "植物需要陽光",
        options: [{ text: "True", correct: true }, { text: "False", correct: false }],
      },
    ],
  });
  const outPath = tmpXlsx();
  await buildKahootWorkbook(quiz, outPath);
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(outPath);
  const ws = wb.worksheets[0];
  const row = ws.getRow(9);
  assert.equal(row.getCell(3).value, "True");
  assert.equal(row.getCell(4).value, "False");
  assert.equal(row.getCell(8).value, "1");
});

test("time limit snaps to the nearest official VALID_TIME_SECONDS tier", async () => {
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      {
        type: "multiple_choice",
        prompt: "p",
        options: [{ text: "a", correct: true }, { text: "b", correct: false }],
        timeLimitSeconds: 45,
      },
    ],
  });
  const outPath = tmpXlsx();
  const result = await buildKahootWorkbook(quiz, outPath);
  assert.ok(result.warnings.some((w) => w.includes("官方檔位")));
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(outPath);
  const cellValue = wb.worksheets[0].getRow(9).getCell(7).value;
  assert.ok(VALID_TIME_SECONDS.includes(cellValue));
});

test("readiness.checklist[0] always contains the confidence caveat", async () => {
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      { type: "multiple_choice", prompt: "p", options: [{ text: "a", correct: true }, { text: "b", correct: false }] },
    ],
  });
  const outPath = tmpXlsx();
  const result = await buildKahootWorkbook(quiz, outPath);
  const readiness = JSON.parse(await fs.readFile(result.readinessReportPath, "utf8"));
  assert.match(readiness.checklist[0], /尚未.*確認|已對照.*核對/);
});
