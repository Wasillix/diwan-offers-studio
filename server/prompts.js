// The prompts the app sends the Offers Agent (BUILD_SPEC §5).
import path from 'node:path';
import { DELIVERABLES } from './stages.js';
import { quickNote } from './quick.js';
import { ROLES } from './attachments.js';

const label = (k) => (DELIVERABLES.find((d) => d.key === k) || { label: k }).label;

/**
 * One edit as the agent reads it: "[page 4, near 512,830] text", "[card "حلّوم روابي"] …", "[answer q1] …",
 * "[missing photo for "هاربيك"] …". Attached images follow as absolute paths when `jobDir` is given.
 */
export function editLine(e, jobDir) {
  let tag;
  if (e.kind === 'answer') tag = `answer ${String(e.qid || '').split(':').pop()}`;
  else if (e.kind === 'pin') tag = `page ${e.page ?? '?'}, near ${e.x ?? '?'},${e.y ?? '?'}`;
  else if (e.kind === 'card') tag = `card "${e.card}"`;
  else if (e.kind === 'photo') tag = `missing photo${e.card ? ` for "${e.card}"` : ''}`;
  else tag = 'general';
  const extra = e.standing ? ' (this is a standing rule)' : '';
  const imgs = e.images?.length
    ? `\n  Images: ${e.images.map((i) => `${jobDir ? path.join(jobDir, ...i.path.split('/')) : i.path} (${ROLES[i.role] || i.role})`).join('; ')}`
    : '';
  return `- [${tag}] ${e.text}${extra}${imgs}`;
}

const ATTACHMENT_RULES = `
Some edits have images attached. Open each one with Read before you apply that edit:
- client markup: a screenshot from the client, often with marks on it. Apply what it points at.
- reference: match what it shows (layout, colour, style). Don't put it on the flyer.
- new product photo: the photo for that item. Add "<its absolute path>": "<slug>" to build/image_map.json
  (prep_new.py accepts absolute paths) and run prep_new.py so it's cut out like the others, then use it on
  its card. If the background isn't plain white and the cut-out looks rough, say so in "assumptions".
  For every new product photo add a "library" entry to review.json (see the review contract) with the
  photo library folder and file name it belongs under. Waseem files it from the Studio; never write to
  the photo library yourself.`;

export function firstRunPrompt(job, stage, jobDir) {
  const tasks = job.tasks.length ? job.tasks.map((t) => `\n  - ${t}`).join('') : ' none';
  const look = stage === 'flyer'
    ? `\nUse the diwan-look-${job.look} skill, then run diwan-design-review before submitting.`
    : ['social', 'video'].includes(stage) ? `\nUse the diwan-look-${job.look} skill and run diwan-design-review before submitting.` : '';
  return `Week: ${job.offer_name} · ${job.dates_ar} / ${job.dates_en} · tag ${job.tag} · look ${job.look}
Job folder: ${jobDir}. Inputs in inputs/. Build in build/ (a copy of the toolkit).
Deliverables this week: ${job.deliverables.map(label).join(', ')}. Extra tasks from Waseem:${tasks}
Run stage "${stage}" of the diwan-offers-pipeline skill. Follow diwan-brand-rules.${look}
Finish by writing review/${stage}/review.json per the review contract (round 1), then stop.`;
}

export function editPrompt(job, stage, round, jobDir) {
  const withImages = round.edits.some((e) => e.images?.length);
  return `Round ${round.n} edits for stage "${stage}":
${round.edits.map((e) => editLine(e, jobDir)).join('\n')}
Apply them, rebuild, re-check, and re-submit review/${stage}/review.json (round ${round.n}).
If an edit is a new standing rule, add it to diwan-brand-rules and say so in "changes".
If cards or prices changed, set "cards_changed": true in review.json.${withImages ? ATTACHMENT_RULES : ''}`;
}

export function rerunPrompt(job, stage, round, jobDir) {
  return `${firstRunPrompt(job, stage, jobDir).replace('(round 1)', `(round ${round.n})`)}
This is a rebuild: ${round.reason || 'an earlier stage changed'}. Rebuild from the current cards and say what changed in "changes".`;
}

/** Prompt for the round about to run. `resume` = the agent keeps the stage's session (edit rounds). */
export function promptFor(job, stage, round, jobDir) {
  const quick = quickNote(job.stages[stage], round.n);
  if (round.edits.length) return { prompt: editPrompt(job, stage, round, jobDir) + quick, resume: true };
  if (round.n > 1) return { prompt: rerunPrompt(job, stage, round, jobDir) + quick, resume: false };
  return { prompt: firstRunPrompt(job, stage, jobDir), resume: false };
}
