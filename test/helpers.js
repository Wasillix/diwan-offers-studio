// Test helpers: a throwaway data dir, store, mock agent and runner.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeConfig } from '../server/config.js';
import { JobStore } from '../server/store.js';
import { Runner } from '../server/runner.js';
import { createMockAgent } from '../server/agent/mock.js';

export const WEEK = {
  offer_name: 'Weekend Offers', dates_ar: '20 - 23 تشرين الثاني', dates_en: '20 – 23 November 2026', look: 'market-bold',
  tasks: ['Kiri: use the 24-portion photo', 'Cover hero: Almarai laban'],
};

export function makeEnv(agentOptions = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diwan-test-'));
  const config = makeConfig({ dataDir, jobsDir: path.join(dataDir, 'jobs'), agentMode: 'mock' });
  const store = new JobStore(config);
  const agent = createMockAgent({ delayMs: 0, useSmoke: false, failOn: {}, ...agentOptions });
  const runner = new Runner({ store, agent });
  const cleanup = () => fs.rmSync(dataDir, { recursive: true, force: true });
  return { config, store, agent, runner, cleanup };
}

/** Create + confirm a week and wait for its first stage to reach review. */
export async function startWeek(env, fields = {}) {
  const { confirm } = await import('../server/machine.js');
  const job = env.store.create({ ...WEEK, ...fields }, { copyToolkit: false });
  confirm(job);
  env.store.save(job);
  env.runner.kick(job.id);
  await env.runner.idle();
  return env.store.get(job.id);
}

/** Apply a machine action to a stored job, save, kick the runner and wait for it to settle. */
export async function act(env, id, fn) {
  const job = env.store.get(id);
  const out = fn(job);
  env.store.save(job);
  env.runner.kick(id);
  await env.runner.idle();
  return { job: env.store.get(id), out };
}

export const statuses = (job) => Object.fromEntries(Object.entries(job.stages).map(([k, s]) => [k, s.status]));
