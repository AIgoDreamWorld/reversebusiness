#!/usr/bin/env node
// AIBA opt-in independent audit; does not modify upstream check-report or evidence.
// Usage: node scripts/evidence-audit.mjs <report.json> [source.json] [--dissect-only]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkReport } from '../skill/reversebusiness/tools/check-report.mjs';

const text = (value) => String(value || '').toLowerCase();
const subscriptionRe = /newsletter|subscribe|subscription|news and updates|mailing list|뉴스레터|소식.{0,12}구독|이메일.{0,12}소식/i;
const signupRe = /sign\s*up|register|create account|회원\s*가입|계정\s*생성|가입/i;
const newsletterRe = /newsletter|subscribe|news and updates|소식|뉴스레터|구독/i;
const accountRe = /create account|register an account|회원\s*가입|계정\s*생성|로그인|password/i;

export function auditReport(report, source = null, { dissectOnly = true } = {}) {
  const base = checkReport(report, { dissectOnly });
  const blockers = [...base.errors.map(message => ({ code: 'UPSTREAM_VALIDATION_ERROR', message }))];
  const warnings = [...base.warnings.map(message => ({ code: 'UPSTREAM_WARNING', message }))];
  const sourceTexts = Array.isArray(source?.texts) ? source.texts.map(x => String(x)) : [];
  const combined = sourceTexts.join(' | ');
  const steps = Array.isArray(report?.sections?.flow?.steps) ? report.sections.flow.steps : [];
  const signupSteps = steps.filter(s => s?.stage === 'signup');
  const explicitNewsletter = subscriptionRe.test(combined);
  const explicitNoAccount = /no account|계정.{0,8}없/i.test(combined);

  for (const step of signupSteps) {
    if (step?.status !== 'observed') continue;
    const description = String(step.text || '') + ' ' + String(step.label || '');
    // Text from a Sign Up CTA alone cannot verify an account-registration flow.
    const citesOnlyCta = signupRe.test(description) && !accountRe.test(description) && !newsletterRe.test(description);
    const suggestsAccount = accountRe.test(description) && !newsletterRe.test(description);
    if ((explicitNewsletter || explicitNoAccount) && (citesOnlyCta || suggestsAccount)) {
      blockers.push({
        code: 'POTENTIAL_SIGNUP_MISCLASSIFICATION',
        message: 'Source indicates an email/news subscription or no account, but observed signup is presented as account registration/unspecified signup. Verify the actual action and relabel as newsletter or unknown.',
      });
    } else if (!source || (citesOnlyCta && !explicitNewsletter)) {
      warnings.push({ code: 'SIGNUP_ACTION_NOT_VERIFIED', message: 'Sign Up text alone cannot prove account creation; verify the action.' });
    }
  }

  if (!source || sourceTexts.length === 0) warnings.push({
    code: 'SOURCE_NOT_VERIFIED',
    message: 'source.json was not supplied or has no readable texts; cross-check is incomplete.',
  });
  const terms = report?.meta?.terms?.status;
  if (terms !== 'checked') blockers.push({
    code: 'TERMS_NOT_VERIFIED',
    message: 'Terms status is not checked; do not claim full analysis approval.',
  });
  return {
    verdict: blockers.length ? 'HOLD' : warnings.length ? 'PASS_WITH_WARNINGS' : 'PASS',
    blockers, warnings, baseline: { errors: base.errors.length, warnings: base.warnings.length },
    facts: { sourceTexts: sourceTexts.length, newsletterSignal: explicitNewsletter, noAccountSignal: explicitNoAccount },
  };
}

function main() {
  const args = process.argv.slice(2).filter(x => !x.startsWith('--'));
  if (!args[0]) { console.error('Usage: node scripts/evidence-audit.mjs <report.json> [source.json] [--dissect-only]'); process.exit(2); }
  try {
    const reportPath = path.resolve(args[0]);
    const sourcePath = path.resolve(args[1] || path.join(path.dirname(reportPath), 'source.json'));
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const source = fs.existsSync(sourcePath) ? JSON.parse(fs.readFileSync(sourcePath, 'utf8')) : null;
    const result = auditReport(report, source, { dissectOnly: process.argv.includes('--dissect-only') });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.verdict === 'HOLD' ? 1 : 0;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
