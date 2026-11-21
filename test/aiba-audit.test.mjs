import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditReport } from '../scripts/aiba-audit.mjs';

const example = JSON.parse(fs.readFileSync(new URL('../examples/aicitybuilders-vibecoding/report.json', import.meta.url), 'utf8'));
function scenario(description, sourceTexts) {
  const report = structuredClone(example);
  report.sections.flow.steps = [{ stage: 'signup', label: '가입', text: description, status: 'observed', evidence: ['E1'] }];
  return { report, source: { texts: sourceTexts } };
}
const codes = (r) => r.blockers.map(b => b.code);

test('source newsletter + generic Sign Up blocks unverified account classification', () => {
  const { report, source } = scenario('Sign Up button visible', ['Sign up with your email address to receive news and updates.', 'No account, no mailing list. Just the brief.']);
  assert.ok(codes(auditReport(report, source)).includes('POTENTIAL_SIGNUP_MISCLASSIFICATION'));
});
test('correct newsletter description is not falsely marked as account registration', () => {
  const { report, source } = scenario('Sign Up is for newsletter updates, not account creation.', ['Sign up with your email address to receive news and updates.']);
  assert.ok(!codes(auditReport(report, source)).includes('POTENTIAL_SIGNUP_MISCLASSIFICATION'));
});
test('source without newsletter does not invent contradiction', () => {
  const { report, source } = scenario('Register an account', ['Create account with a password']);
  assert.ok(!codes(auditReport(report, source)).includes('POTENTIAL_SIGNUP_MISCLASSIFICATION'));
});
test('missing summary remains blocked by upstream validator', () => {
  const { report, source } = scenario('News subscription', ['Subscribe to news']);
  report.meta.one_line = '';
  assert.ok(codes(auditReport(report, source)).includes('UPSTREAM_VALIDATION_ERROR'));
});
test('unverified terms block final approval', () => {
  const { report, source } = scenario('News subscription', ['Subscribe to news']);
  report.meta.terms.status = 'robots-only';
  assert.ok(codes(auditReport(report, source)).includes('TERMS_NOT_VERIFIED'));
});
