import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAssessmentQuiz } from "../scripts/lib/assessment-quality.mjs";

const complete = {
  title: "分數概念",
  assessment: {
    version: 1,
    sources: [{ id: "p1", title: "分數講義", locator: "p. 2" }],
    audience: { gradeLevel: "五年級", proficiency: "基礎", language: "zh-TW", prerequisites: ["認識分子與分母"] },
    objectives: [{ id: "o1", text: "比較同分母分數" }],
    purpose: "formative",
    blueprint: [{ objectiveId: "o1", cognitiveLevel: "apply", difficulty: "basic", count: 1 }],
  },
  questions: [{ type: "multiple_choice", prompt: "3/8 與 5/8 哪個較大？", options: [{ text: "5/8", correct: true }, { text: "3/8", correct: false }], sourceRefIds: ["p1"], objectiveIds: ["o1"], cognitiveLevel: "apply", difficulty: "basic", explanation: "同分母比較分子" }],
};

test("quality validator blocks a quiz without a complete assessment brief", () => {
  const result = validateAssessmentQuiz({ title: "t", questions: complete.questions });
  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((b) => b.code === "assessment-missing"));
});

test("quality validator accepts source-traceable questions that match the blueprint", () => {
  const result = validateAssessmentQuiz(complete);
  assert.equal(result.ok, true);
  assert.equal(result.perQuestion[0].status, "ready");
});

test("quality validator blocks unknown source, objective and incorrect answer key", () => {
  const bad = structuredClone(complete);
  bad.questions[0].sourceRefIds = ["unknown"];
  bad.questions[0].objectiveIds = ["missing"];
  bad.questions[0].options.forEach((o) => (o.correct = false));
  const result = validateAssessmentQuiz(bad);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((b) => b.code === "source-untraceable"));
  assert.ok(result.blockers.some((b) => b.code === "objective-untraceable"));
  assert.ok(result.blockers.some((b) => b.code === "answer-key-missing"));
});

test("quality validator blocks malformed blueprint rows and blank prerequisites", () => {
  const bad = structuredClone(complete);
  bad.assessment.audience.prerequisites = [""];
  bad.assessment.blueprint = [{ objectiveId: "unknown", cognitiveLevel: "guess", difficulty: "easy", count: 0 }];
  const result = validateAssessmentQuiz(bad);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((b) => b.code === "audience-incomplete"));
  assert.ok(result.blockers.some((b) => b.code === "blueprint-row-invalid"));
});
