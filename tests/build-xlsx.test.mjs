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

test("over-limit question is skipped rather than truncated", async () => {
  const longPrompt = "字".repeat(MAX_QUESTION_CHARS + 20);
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      { type: "multiple_choice", prompt: longPrompt, options: [{ text: "a", correct: true }, { text: "b", correct: false }] },
    ],
  });
  const outPath = tmpXlsx();
  const result = await buildKahootWorkbook(quiz, outPath);
  assert.equal(result.questionCount, 0);
  assert.ok(result.warnings.some((w) => w.includes(`${MAX_QUESTION_CHARS} 字上限`) && w.includes("not truncated")));
});

test("over-limit answer is skipped rather than truncated", async () => {
  const longAnswer = "a".repeat(MAX_ANSWER_CHARS + 10);
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      { type: "multiple_choice", prompt: "p", options: [{ text: longAnswer, correct: true }, { text: "b", correct: false }] },
    ],
  });
  const result = await buildKahootWorkbook(quiz, tmpXlsx());
  assert.equal(result.questionCount, 0);
  assert.ok(result.warnings.some((w) => w.includes(`${MAX_ANSWER_CHARS} 字上限`) && w.includes("not truncated")));
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


test("true_false preserves source labels and key without assuming language",async()=>{const q=Quiz.parse({title:"t",questions:[{type:"true_false",prompt:"判斷",options:[{text:"錯誤",correct:false},{text:"正確",correct:true}]}]});const out=tmpXlsx();const result=await buildKahootWorkbook(q,out);assert.match(result.warnings.join(),/標準 Quiz/);const ExcelJS=(await import("exceljs")).default;const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(out);const row=wb.worksheets[0].getRow(9);assert.equal(row.getCell(3).value,"錯誤");assert.equal(row.getCell(4).value,"正確");assert.equal(row.getCell(8).value,"2")});
test("fifth option never gets silently dropped, even if correct",async()=>{const q=Quiz.parse({title:"t",questions:[{type:"multiple_choice",prompt:"p",options:[1,2,3,4,5].map(n=>({text:String(n),correct:n===5}))}]});const r=await buildKahootWorkbook(q,tmpXlsx());assert.equal(r.questionCount,0);assert.match(r.warnings.join(),/skipped/)});
test("90 and 240 seconds are converted to currently documented choices",async()=>{assert.deepEqual(VALID_TIME_SECONDS,[5,10,20,30,60,120]);for(const t of [90,240]){const q=Quiz.parse({title:"t",questions:[{type:"multiple_choice",prompt:"p",options:[{text:"a",correct:true},{text:"b",correct:false}],timeLimitSeconds:t}]});const r=await buildKahootWorkbook(q,tmpXlsx());assert.match(r.warnings.join(),/時間限制/)} });
test("multi-select and math symbols get explicit import limitations",async()=>{const q=Quiz.parse({title:"t",questions:[{type:"multiple_select",prompt:"x ≤ 3",options:[{text:"1",correct:true},{text:"2",correct:true}]}]});const r=await buildKahootWorkbook(q,tmpXlsx());assert.match(r.warnings.join(),/多個答案/);assert.match(r.warnings.join(),/數學符號/)});


test("CLI legacy path produces partial status when rows cannot be exported",async()=>{const {spawnSync}=await import("node:child_process");const cli=new URL("../scripts/build-xlsx.mjs",import.meta.url);const fixture=new URL("./fixtures/quiz.json",import.meta.url);const r=spawnSync(process.execPath,[cli.pathname,fixture.pathname,tmpXlsx(),"--legacy"],{encoding:"utf8"});assert.equal(r.status,2);const parsed=JSON.parse(r.stdout);assert.equal(parsed.ok,false);assert.equal(parsed.status,"partial");assert.ok(parsed.questionCount>0);assert.ok(parsed.warnings.length>0)});


test("readiness preserves source and learning objective IDs for exported and skipped items",async()=>{const q=Quiz.parse({title:"t",questions:[{type:"multiple_choice",prompt:"p",sourceRefIds:["src1"],objectiveIds:["obj1"],options:[{text:"a",correct:true},{text:"b",correct:false}]},{type:"fill_blank",prompt:"___",sourceRefIds:["src2"],objectiveIds:["obj2"]}]});const r=await buildKahootWorkbook(q,tmpXlsx());const report=JSON.parse(await fs.readFile(r.readinessReportPath,"utf8"));assert.deepEqual(report.perQuestion[0].sourceRefIds,["src1"]);assert.deepEqual(report.perQuestion[1].objectiveIds,["obj2"]);assert.equal(report.perQuestion[1].status,"skipped")});
