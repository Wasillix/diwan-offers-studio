// review.json check (BUILD_SPEC §3, diwan-offers-pipeline/references/review-contract.md).
// Returns { ok, errors, review } with the review normalised (missing arrays filled in).
import fs from 'node:fs';
import path from 'node:path';

export const FILE_KINDS = ['image', 'pdf', 'text', 'video', 'html', 'table', 'zip'];

export function validateReview(raw, { stage, round, jobDir } = {}) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['review.json is not an object'] };
  const r = { ...raw };
  if (stage && r.stage !== stage) errors.push(`stage is "${r.stage}", expected "${stage}"`);
  if (!Number.isInteger(r.round) || r.round < 1) errors.push('round must be a whole number ≥ 1');
  else if (round && r.round !== round) errors.push(`round is ${r.round}, expected ${round}`);
  if (typeof r.summary !== 'string' || !r.summary.trim()) errors.push('summary is missing');

  for (const k of ['changes', 'assumptions', 'rules_added']) {
    if (r[k] === undefined) r[k] = [];
    else if (!Array.isArray(r[k]) || r[k].some((x) => typeof x !== 'string')) errors.push(`${k} must be a list of strings`);
  }
  if (r.files === undefined) r.files = [];
  if (!Array.isArray(r.files)) errors.push('files must be a list');
  else r.files.forEach((f, i) => {
    if (!f || typeof f.path !== 'string') return errors.push(`files[${i}].path missing`);
    if (path.isAbsolute(f.path) || f.path.split(/[\\/]/).includes('..')) errors.push(`files[${i}].path must be relative to the job folder`);
    if (!FILE_KINDS.includes(f.kind)) errors.push(`files[${i}].kind "${f.kind}" is not one of ${FILE_KINDS.join(', ')}`);
    if (jobDir && !fs.existsSync(path.join(jobDir, f.path))) errors.push(`files[${i}] not found: ${f.path}`);
  });
  if (r.checks === undefined) r.checks = {};
  else if (typeof r.checks !== 'object' || Array.isArray(r.checks)) errors.push('checks must be an object');
  else for (const [k, v] of Object.entries(r.checks)) if (!['number', 'string', 'boolean'].includes(typeof v)) errors.push(`checks.${k} must be a number or short string`);
  if (r.questions === undefined) r.questions = [];
  else if (!Array.isArray(r.questions)) errors.push('questions must be a list');
  else r.questions.forEach((q, i) => {
    if (!q || typeof q.id !== 'string' || typeof q.text !== 'string') errors.push(`questions[${i}] needs id and text`);
    else q.blocking = !!q.blocking;
  });
  if (r.cards_changed !== undefined && typeof r.cards_changed !== 'boolean') errors.push('cards_changed must be true/false');
  return { ok: errors.length === 0, errors, review: r };
}

export function readAndValidate(jobDir, stage, round) {
  const f = path.join(jobDir, 'review', stage, 'review.json');
  if (!fs.existsSync(f)) return { ok: false, errors: [`review/${stage}/review.json was not written`] };
  let raw;
  try { raw = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return { ok: false, errors: [`review.json is not valid JSON: ${e.message}`] }; }
  return validateReview(raw, { stage, round, jobDir });
}
