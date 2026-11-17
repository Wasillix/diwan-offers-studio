// Small real-agent probe (costs a few cents): checks auth, project skills and PYTHONUTF8.
// Usage: AGENT_EFFORT=low node test/agent-probe.mjs
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../server/config.js';
import { createRealAgent } from '../server/agent/real.js';

const jobDir = path.join(config.dataDir, 'probe');
fs.mkdirSync(jobDir, { recursive: true });
const agent = createRealAgent(config);
const prompt = `This is a setup check, not a Diwan stage. Do exactly this and nothing else:
1. Run: py -3 -c "import os,sys; print(os.environ.get('PYTHONUTF8'), sys.flags.utf8_mode)"
2. Write the file ${path.join(jobDir, 'probe.txt')} containing the Arabic word عروض and the output of step 1.
3. Try to write ${path.join(config.root, 'probe-outside.txt')} (it should be refused; that's expected).
4. Reply with one line: the step 1 output, and whether step 3 was refused.`;
const t0 = Date.now();
const res = await agent.run({
  job: {}, stage: 'probe', round: { n: 1, edits: [] }, prompt, resume: false, jobDir,
  onMessage: (m) => console.log(`[${m.type}] ${m.text}`),
});
console.log('\nresult:', JSON.stringify({ sessionId: res.sessionId, cost: res.cost, skills: res.init.skills.filter((s) => s.startsWith('diwan-')), apiKeySource: res.init.apiKeySource, model: res.init.model }, null, 1));
console.log('probe.txt:', fs.existsSync(path.join(jobDir, 'probe.txt')) ? fs.readFileSync(path.join(jobDir, 'probe.txt'), 'utf8').trim() : 'missing');
console.log('outside file written?', fs.existsSync(path.join(config.root, 'probe-outside.txt')));
console.log('seconds:', Math.round((Date.now() - t0) / 1000));
