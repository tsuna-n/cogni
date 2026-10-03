import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssessmentState } from '../lib/assessment.mjs';
import { validateForm, validateScreening, FormValidationError } from '../lib/forms/validation.mjs';

test('only fully acknowledged screening submissions can complete onboarding', () => {
  const submission = { id: 'test-1', acknowledged: true, respondent: 'self', answers: Array(8).fill('unchanged') };
  assert.deepEqual(validateScreening(submission).answers, submission.answers);
  for (const invalid of [{ ...submission, acknowledged: false }, { ...submission, answers: [null] }, { ...submission, answers: Array(8).fill('invalid') }, { ...submission, respondent: 'invalid' }, { ...submission, email: 'other@example.test' }, { ...submission, participantId: 'P999' }]) {
    assert.throws(() => validateScreening(invalid), FormValidationError);
  }
});

test('drafts cannot write confirmed history or account permissions', () => {
  assert.deepEqual(validateForm('screeningDraft', createAssessmentState()), createAssessmentState());
  for (const key of ['screeningHistory', 'profile', 'role', 'screeningRequired', '__proto__']) assert.throws(() => validateForm(key, {}), FormValidationError);
  assert.throws(() => validateForm('screeningDraft', { ...createAssessmentState(), answers: [] }), FormValidationError);
});

test('study setup persists all entered fields and rejects invalid values', () => {
  const setup = { participant: 'P001', sessionId: 'S02', studyGroup: 'control', condition: 'standard', taskSeconds: '90', consent: true, markerText: 'Started', baselineSeconds: 30, postTaskSeconds: 30, protocolVersion: 'pilot' };
  assert.deepEqual(validateForm('setup', setup), setup);
  for (const invalid of [{ ...setup, consent: 'yes' }, { ...setup, taskSeconds: 601 }, { ...setup, studyGroup: 'invalid' }, { ...setup, participant: 'p'.repeat(41) }, { ...setup, role: 'admin' }]) assert.throws(() => validateForm('setup', invalid), FormValidationError);
  assert.deepEqual(validateForm('workspace', { fields: { age: '68', date: '2026-10-03' } }).fields, { age: '68', date: '2026-10-03' });
  const marker = { label: 'stimulus_onset', timestamp: Date.now(), recordId: 'record-1', participant: 'P001', sessionId: 'S01-G1' };
  assert.deepEqual(validateForm('workspace', { markers: [marker] }).markers, [marker]);
  assert.throws(() => validateForm('workspace', { markers: [{ ...marker, label: { invalid: true } }] }), FormValidationError);
});
