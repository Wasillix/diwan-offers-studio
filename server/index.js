// Diwan Offers Studio server. `npm run dev` (real agent) or `npm run mock` (mock agent).
import { config } from './config.js';
import { JobStore } from './store.js';
import { Runner } from './runner.js';
import { createApp } from './app.js';
import { createMockAgent } from './agent/mock.js';

async function makeAgent() {
  if (config.agentMode === 'mock') return createMockAgent();
  try {
    const { createRealAgent } = await import('./agent/real.js');
    return createRealAgent(config);
  } catch (e) {
    console.warn(`Real agent not available yet (${e.code || e.message}); using the mock agent. Phase 4 wires the Agent SDK.`);
    config.agentMode = 'mock';
    return createMockAgent();
  }
}

const store = new JobStore(config);
const runner = new Runner({ store, agent: await makeAgent() });
runner.recover();
for (const job of store.list()) runner.kick(job.id); // pick up queued edits / pending stages from last time

const app = createApp({ config, store, runner });
app.listen(config.port, '127.0.0.1', () => {
  console.log(`Diwan Offers Studio · http://localhost:${config.port} · agent: ${config.agentMode}`);
});
