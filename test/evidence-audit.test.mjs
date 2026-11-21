import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditReport } from '../scripts/evidence-audit.mjs';

const example = JSON.parse(fs.readFileSync(new URL('../examples/aicitybuilders-vibecoding/report.json', import.meta.url), 'utf8'));
function scenario(description, sourceTexts) {
  const report = structuredClone(example);
  report.sections.flow.steps = [{ stage: 'signup', label: 'Signup', text: description, status: 'observed', evidence: ['E1'] }];
  return { report, source: { texts: sourceTexts } };
}
const codes = (r) => r.blockers.map(b => b.code);

test('newsletter with generic signup blocks unclear classification', () => {
  const { report, source } = scenario('Sign Up button visible', ['Sign up with your email address to receive news and updates.', 'No account, no mailing list. Just the brief.']);
  assert.ok(codes(auditReport(report, source)).includes('POTENTIAL_SIGNUP_MISCLASSIFICATION'));
});
test('newsletter correctly identified does not trigger false account warning', () => {
  const { report, source } = scenario('Sign Up is for newsletter updates, not account creation.', ['Sign up with your email address to receive news and updates.']);
  assert.ok(!codes(auditReport(report, source)).includes('POTENTIAL_SIGNUP_MISCLASSIFICATION'));
});
test('account signup without contradictory newsletter evidence is not blocked', () => {
  const { report, source } = scenario('Register an account', ['Create account with a password']);
  assert.ok(!codes(auditReport(report, source)).includes('POTENTIAL_SIGNUP_MISCLASSIFICATION'));
});
test('missing one line summary remains blocked', () => {
  const { report, source } = scenario('News subscription', ['Subscribe to news']);
  report.meta.one_line = '';
  assert.ok(codes(auditReport(report, source)).includes('UPSTREAM_VALIDATION_ERROR'));
});
test('unreviewed terms block final audit approval', () => {
  const { report, source } = scenario('News subscription', ['Subscribe to news']);
  report.meta.terms.status = 'robots-only';
  assert.ok(codes(auditReport(report, source)).includes('TERMS_NOT_VERIFIED'));
});
