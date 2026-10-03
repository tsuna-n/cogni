import test from "node:test";
import assert from "node:assert/strict";
import {
  assessmentReducer as reduce,
  createAssessmentState,
  allAnswered,
  questions,
} from "../lib/assessment.mjs";

function start() {
  let state = reduce(createAssessmentState(), {
    type: "acknowledge",
    value: true,
  });
  state = reduce(state, { type: "start" });
  state = reduce(state, { type: "respondent", value: "child" });
  return reduce(state, { type: "begin" });
}

function review() {
  let state = start();
  for (let index = 0; index < questions.length; index++) {
    state = reduce(state, {
      type: "answer",
      value: index % 2 ? "unknown" : "changed",
    });
    state = reduce(state, { type: "next" });
  }
  return state;
}

test("acknowledgement, respondent and answers guard navigation and submission", () => {
  let state = createAssessmentState();
  assert.equal(reduce(state, { type: "start" }), state);
  state = reduce(reduce(state, { type: "acknowledge", value: true }), {
    type: "start",
  });
  assert.equal(reduce(state, { type: "begin" }), state);
  state = start();
  for (const type of ["next", "back", "confirm"])
    assert.equal(reduce(state, { type }), state);
  assert.equal(
    reduce({ ...state, stage: "review" }, { type: "confirm" }).result,
    null,
  );
  assert.equal(allAnswered(Array(8).fill(null)), false);
  assert.equal(allAnswered(Array(7).fill("changed")), false);
  assert.equal(allAnswered(Array(9).fill("changed")), false);
  assert.equal(allAnswered(Array(8).fill("unknown")), true);
});

test("backtracking from question 5 to 3 preserves other answers and saves a change", () => {
  let state = start();
  for (let index = 0; index < 4; index++) {
    state = reduce(reduce(state, { type: "answer", value: "changed" }), {
      type: "next",
    });
  }
  state = reduce(reduce(state, { type: "back" }), { type: "back" });
  assert.equal(state.index, 2);
  state = reduce(state, { type: "answer", value: "unchanged" });
  state = reduce(reduce(state, { type: "next" }), { type: "next" });
  assert.equal(state.index, 4);
  assert.deepEqual(state.answers.slice(0, 5), [
    "changed",
    "changed",
    "unchanged",
    "changed",
    null,
  ]);
});

test("review editing returns directly to review and result contains confirmed answers only", () => {
  let state = review();
  assert.equal(state.stage, "review");
  assert.equal(state.result, null);
  assert.equal(reduce(state, { type: "edit", index: 8 }), state);
  assert.equal(reduce(state, { type: "edit", index: -1 }), state);
  state = reduce(state, { type: "edit", index: 1 });
  assert.equal(state.index, 1);
  assert.equal(state.answers[1], "unknown");
  state = reduce(reduce(state, { type: "answer", value: "unchanged" }), {
    type: "next",
  });
  assert.equal(state.stage, "review");
  state = reduce(state, { type: "confirm" });
  assert.equal(state.stage, "result");
  assert.deepEqual(state.result, {
    respondent: "child",
    answers: [
      "changed",
      "unchanged",
      "changed",
      "unknown",
      "changed",
      "unknown",
      "changed",
      "unknown",
    ],
  });
  assert.notEqual(state.result.answers, state.answers);
  assert.deepEqual(Object.keys(state.result).sort(), ["answers", "respondent"]);
});

test("restart clears consent, respondent, answers, position, editing and result", () => {
  const completed = reduce(review(), { type: "confirm" });
  const reset = reduce(completed, { type: "reset" });
  assert.deepEqual(reset, createAssessmentState());
  assert.notEqual(reset.answers, completed.answers);
  assert.equal(reduce(reset, { type: "confirm" }).result, null);
});
