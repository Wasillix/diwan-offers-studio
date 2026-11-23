// The prompts the app sends the Offers Agent (BUILD_SPEC §5).
import { DELIVERABLES } from './stages.js';
import { quickNote } from './quick.js';

const label = (k) => (DELIVERABLES.find((d) => d.key === k) || { label: k }).label;

/** One edit as the agent reads it: "[page 4, near 512,830] text", "[card "حلّوم روابي"] …", "[answer q1] …". */
export function editLine(e) {
  let tag;
  if (e.kind === 'answer') tag = `answer ${String(e.qid || '').split(':').pop()}`;
  else if (e.kind === 'pin') tag = `page ${e.page ?? '?'}, near ${e.x ?? '?'},${e.y ?? '?'}`;
  else if (e.kind === 'card') tag = `card "${e.card}"`;
  else tag = 'general';
  const extra = e.standing ? ' (this is a standing rule)' : '';
  return `- [${tag}] ${e.text}${extra}`;
}

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

export function editPrompt(job, stage, round) {
  return `Round ${round.n} edits for stage "${stage}":
${round.edits.map(editLine).join('\n')}
Apply them, rebuild, re-check, and re-submit review/${stage}/review.json (round ${round.n}).
If an edit is a new standing rule, add it to diwan-brand-rules and say so in "changes".
If cards or prices changed, set "cards_changed": true in review.json.`;
}

export function rerunPrompt(job, stage, round, jobDir) {
  return `${firstRunPrompt(job, stage, jobDir).replace('(round 1)', `(round ${round.n})`)}
This is a rebuild: ${round.reason || 'an earlier stage changed'}. Rebuild from the current cards and say what changed in "changes".`;
}

/** Prompt for the round about to run. `resume` = the agent keeps the stage's session (edit rounds). */
export function promptFor(job, stage, round, jobDir) {
  const quick = quickNote(job.stages[stage], round.n);
  if (round.edits.length) return { prompt: editPrompt(job, stage, round) + quick, resume: true };
  if (round.n > 1) return { prompt: rerunPrompt(job, stage, round, jobDir) + quick, resume: false };
  return { prompt: firstRunPrompt(job, stage, jobDir), resume: false };
}
