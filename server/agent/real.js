// The real Offers Agent: one stage round = one Claude Agent SDK query() (BUILD_SPEC §4).
//
// cwd is the repo root, so settingSources ['project'] loads CLAUDE.md and the Diwan skills in .claude/skills
// (and standing-rule edits land in the real diwan-brand-rules skill, not a per-job copy). The job folder,
// the photo library and the logos folder come in through additionalDirectories; the prompt names the job
// folder with absolute paths. File writes are limited to the job folder and diwan-brand-rules by canUseTool.
import fs from 'node:fs';
import path from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { detectPython } from '../toolkit.js';

const REQUIRED_SKILLS = ['diwan-offers-pipeline', 'diwan-brand-rules', 'diwan-design-review'];
const READ_ONLY = ['Read', 'Glob', 'Grep', 'TodoWrite'];
// PowerShell is removed so every command goes through Bash and the one guard below.
const NEVER = ['WebFetch', 'WebSearch', 'NotebookEdit', 'Agent', 'Task', 'PowerShell'];

const norm = (p) => path.resolve(p).toLowerCase().replace(/[\\/]+$/, '');
const inside = (p, dir) => { const a = norm(p), b = norm(dir); return a === b || a.startsWith(b + path.sep); };
const short = (s, n = 160) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/** One-line summary of a tool call for the Studio log: "Bash · python build/build_full.py". */
export function toolLine(name, input = {}, jobDir) {
  const rel = (p) => (p && jobDir && inside(p, jobDir) ? path.relative(jobDir, p).replace(/\\/g, '/') : p);
  const arg = {
    Bash: input.command, Read: rel(input.file_path), Write: rel(input.file_path), Edit: rel(input.file_path),
    Glob: input.pattern, Grep: `${input.pattern}${input.path ? ` in ${rel(input.path)}` : ''}`, Skill: input.skill || input.name || input.command,
    TodoWrite: `${(input.todos || []).filter((t) => t.status === 'completed').length}/${(input.todos || []).length} done`,
  }[name];
  return `${name}${arg ? ` · ${short(arg)}` : ''}`;
}

/** Permission guard: what the agent may change. Read-only tools are pre-approved and never reach here. */
export function makeGuard({ jobDir, root, imageLibrary }) {
  const rulesDir = path.join(root, '.claude', 'skills', 'diwan-brand-rules');
  const lib = imageLibrary.replace(/[\\/]+$/, '');
  const libName = path.basename(path.dirname(lib)); // "005 - FMCG Items"
  return async (toolName, input) => {
    if (NEVER.includes(toolName)) return { behavior: 'deny', message: `${toolName} is not available to the Offers Agent.` };
    if (['Write', 'Edit', 'MultiEdit'].includes(toolName)) {
      const p = input.file_path || '';
      if (inside(p, jobDir) || inside(p, rulesDir)) return { behavior: 'allow', updatedInput: input };
      return { behavior: 'deny', message: `Write only inside the job folder (${jobDir}) or .claude/skills/diwan-brand-rules. ${p} is outside.` };
    }
    if (toolName === 'Bash') {
      const c = String(input.command || '');
      const touchesLib = c.includes(libName) || c.toLowerCase().includes(lib.toLowerCase());
      if (touchesLib && /\b(rm|del|erase|rmdir|rd|mv|move|ren|rename|Remove-Item|Move-Item|Rename-Item|Set-Content|Out-File)\b|(^|[^2])>[^&]/i.test(c)) {
        return { behavior: 'deny', message: 'The product photo library is read-only. Copy photos into the job\'s build/ folder and work there.' };
      }
      if (/\bgit\s+(push|reset|checkout|clean|commit)\b/i.test(c)) return { behavior: 'deny', message: 'No git commands from the Offers Agent.' };
      return { behavior: 'allow', updatedInput: input };
    }
    if (toolName === 'Skill' || READ_ONLY.includes(toolName)) return { behavior: 'allow', updatedInput: input };
    return { behavior: 'deny', message: `${toolName} is not needed for a Diwan stage.` };
  };
}

/** Facts about this machine the agent needs every run (appended to Claude Code's system prompt). */
function environmentNotes({ jobDir, root, config }) {
  const py = detectPython();
  const pyCmd = [py.cmd, ...py.pre].join(' ');
  return `You are the Diwan Offers Agent running inside Offers Studio on Waseem's Windows PC.
- The repo's CLAUDE.md is for the developer building the Studio; its build rules don't apply to you. Follow the user prompt, diwan-offers-pipeline and diwan-brand-rules.
- Job folder (absolute): ${jobDir}. Work in its build/ folder; put review files in review/<stage>/r<round>/; write review/<stage>/review.json last.
- Python: \`${pyCmd}\` (PYTHONUTF8=1 is already set). Node scripts: \`node "${path.join(jobDir, 'build')}\\<script>.js" "${path.join(jobDir, 'build')}"\`.
- Paths contain spaces: always quote them.
- Product photo library (read-only): ${config.imageLibrary}. Diwan logos: ${config.logosDir}.
- You may only write inside the job folder, and to ${path.join(root, '.claude', 'skills', 'diwan-brand-rules', 'SKILL.md')} for standing rules.
- No web access. If something is missing, ask in review.json questions instead of guessing.`;
}

export function createRealAgent(config) {
  const model = process.env.AGENT_MODEL || 'claude-opus-5-5';
  const effort = process.env.AGENT_EFFORT || 'high';
  const maxBudgetUsd = +(process.env.AGENT_MAX_BUDGET_USD || 15);
  return {
    mode: 'real',
    model,
    async run({ job, stage, round, prompt, resume, sessionId, jobDir, signal, onMessage = () => {} }) {
      const abortController = new AbortController();
      signal?.addEventListener('abort', () => abortController.abort(), { once: true });
      const stderr = [];
      const extraDirs = [jobDir, config.imageLibrary, config.logosDir].filter((d) => d && fs.existsSync(d));
      const q = query({
        prompt,
        options: {
          cwd: config.root,
          additionalDirectories: extraDirs,
          settingSources: ['project'],
          skills: 'all',
          // no bare allowedTools: every call, read-only ones included, goes through canUseTool (which allows them)
          allowedTools: [],
          disallowedTools: NEVER,
          canUseTool: makeGuard({ jobDir, root: config.root, imageLibrary: config.imageLibrary }),
          permissionMode: 'default',
          systemPrompt: { type: 'preset', preset: 'claude_code', append: environmentNotes({ jobDir, root: config.root, config }) },
          model,
          effort,
          maxTurns: 120,
          maxBudgetUsd,
          resume: resume && sessionId ? sessionId : undefined,
          env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', CLAUDE_AGENT_SDK_CLIENT_APP: 'diwan-offers-studio/0.1' },
          abortController,
          stderr: (d) => { stderr.push(d); if (stderr.length > 40) stderr.shift(); },
        },
      });

      let sid = sessionId || null, result = null, init = null;
      for await (const m of q) {
        if (m.session_id) sid = m.session_id;
        if (m.type === 'system' && m.subtype === 'init') {
          init = { model: m.model, skills: m.skills, apiKeySource: m.apiKeySource, cwd: m.cwd, version: m.claude_code_version, tools: m.tools };
          const diwan = (m.skills || []).filter((s) => s.startsWith('diwan-'));
          onMessage({ type: 'system', subtype: 'init', sessionId: sid, init,
            text: `${m.model} · Claude Code ${m.claude_code_version} · auth ${m.apiKeySource === 'none' ? 'Claude login' : m.apiKeySource} · skills: ${diwan.join(', ') || 'none'}` });
          const missing = REQUIRED_SKILLS.filter((s) => !m.skills?.includes(s));
          if (missing.length) { abortController.abort(); throw new Error(`Project skills didn't load (missing ${missing.join(', ')}). Check .claude/skills.`); }
        } else if (m.type === 'assistant') {
          if (m.parent_tool_use_id) continue; // subagent chatter
          if (m.error) onMessage({ type: 'error', text: `API: ${m.error}` });
          for (const b of m.message?.content || []) {
            if (b.type === 'text' && b.text?.trim()) onMessage({ type: 'text', text: b.text.trim() });
            else if (b.type === 'tool_use') onMessage({ type: 'tool', text: toolLine(b.name, b.input, jobDir) });
          }
        } else if (m.type === 'user' && Array.isArray(m.message?.content)) {
          for (const b of m.message.content) {
            if (b.type === 'tool_result' && b.is_error) {
              const t = Array.isArray(b.content) ? b.content.map((c) => c.text || '').join(' ') : b.content;
              onMessage({ type: 'tool', text: `↳ ${short(t, 200)}` });
            }
          }
        } else if (m.type === 'result') {
          result = m;
        }
      }
      if (!result) throw new Error(`The agent stopped without a result.${stderr.length ? ` ${short(stderr.join(''), 400)}` : ''}`);
      const cost = +(result.total_cost_usd || 0);
      onMessage({ type: 'result', subtype: result.subtype, cost, sessionId: sid,
        text: `${result.subtype === 'success' ? 'done' : result.subtype} · ${result.num_turns} turns · $${cost.toFixed(3)} · ${Math.round(result.duration_ms / 1000)} s` });
      if (result.subtype !== 'success') {
        const why = { error_max_turns: 'ran out of turns (120)', error_max_budget_usd: `hit the $${maxBudgetUsd} budget for one run` }[result.subtype] || (result.errors || []).join('; ') || result.subtype;
        const err = new Error(`Agent ${why}`);
        err.sessionId = sid; err.cost = cost;
        throw err;
      }
      return { sessionId: sid, cost, init };
    },
  };
}
