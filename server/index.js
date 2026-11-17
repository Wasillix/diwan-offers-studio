// Diwan Offers Studio server. `npm run dev` (agent mode from Settings, real by default) or `npm run mock`.
import { config } from './config.js';
import { JobStore } from './store.js';
import { Runner } from './runner.js';
import { createApp } from './app.js';
import { createMockAgent } from './agent/mock.js';
import { createRealAgent } from './agent/real.js';
import { Settings } from './settings.js';
import { Notifier, watchTransitions } from './notify.js';
import { InboxWatcher } from './inbox.js';
import { Scheduler } from './scheduler.js';
import { Startup } from './startup.js';

const forcedMock = process.argv.includes('--mock');
const settings = new Settings(config);
const store = new JobStore(config);

function makeAgent(mode) {
  config.agentMode = forcedMock ? 'mock' : mode;
  return config.agentMode === 'mock' ? createMockAgent() : createRealAgent(config, () => settings.get().agent);
}

const runner = new Runner({ store, agent: makeAgent(settings.get().agent.mode) });
const notifier = new Notifier({ config, settings });
const inbox = new InboxWatcher({ config, settings, store, notifier });
const scheduler = new Scheduler({ settings, store, notifier });
const startup = new Startup(config);

inbox.on('draft', (job) => runner.emit('job', job));
scheduler.on('fired', (job) => job && runner.emit('job', job));
inbox.on('error', (e) => console.warn(`Offers Inbox: ${e.message}`));
watchTransitions({ runner, store, notifier });

runner.recover();
for (const job of store.list()) runner.kick(job.id); // pick up queued edits / pending stages from last time

const onAgentMode = (mode) => {
  // switch between the mock and real agent; a run already in progress finishes on the old one
  runner.agent = makeAgent(mode);
  console.log(`Agent mode: ${config.agentMode}`);
};

const app = createApp({ config, store, runner, settings, notifier, scheduler, inbox, startup, onAgentMode });
const server = app.listen(config.port, '127.0.0.1', () => {
  console.log(`Diwan Offers Studio · http://localhost:${config.port} · agent: ${config.agentMode}`);
  inbox.start();
  scheduler.start();
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use: the Studio is probably running already (Start with Windows?). Open http://localhost:${config.port}`);
    process.exit(1);
  }
  throw e;
});
