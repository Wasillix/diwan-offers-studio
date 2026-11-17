// HTTP API over a real server on a random port, with the mock agent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { makeEnv, WEEK } from './helpers.js';

async function serve(t, agentOptions) {
  const env = makeEnv(agentOptions);
  const server = createApp(env).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { server.closeAllConnections?.(); server.close(); env.cleanup(); });
  const call = async (method, p, body) => {
    const res = await fetch(base + p, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };
  return { env, base, call };
}

test('API: draft → inputs → confirm → review → edits → approve, with live events', async (t) => {
  const { env, base, call } = await serve(t);

  const meta = (await call('GET', '/api/meta')).data;
  assert.equal(meta.stages.length, 8);
  assert.deepEqual(meta.looks.map((l) => l.key).sort(), ['classic', 'editorial', 'market-bold', 'seasonal']);

  let { status, data: job } = await call('POST', '/api/jobs?copyToolkit=0', { ...WEEK, dates_ar: '' });
  assert.equal(status, 200);
  assert.equal(job.state, 'draft');
  assert.equal(job.tag, 'Weekend-20-23Nov');

  assert.equal((await call('POST', `/api/jobs/${job.id}/confirm`)).status, 400, 'no Arabic dates yet');
  job = (await call('PATCH', `/api/jobs/${job.id}`, { dates_ar: '20 - 23 تشرين الثاني', dates_en: '27 – 30 November 2026', tasks: 'one\n\ntwo' })).data;
  assert.equal(job.tag, 'Weekend-27-30Nov', 'tag follows the dates until set by hand');
  assert.deepEqual(job.tasks, ['one', 'two']);

  const fd = new FormData();
  fd.append('files', new Blob(['fake xlsx']), 'Weekend Offers 27-30 Nov.xlsx');
  job = await (await fetch(`${base}/api/jobs/${job.id}/inputs`, { method: 'POST', body: fd })).json();
  assert.equal(job.inputs[0].name, 'Weekend Offers 27-30 Nov.xlsx');

  // live events for this week
  const events = [];
  const ac = new AbortController();
  const es = fetch(`${base}/api/jobs/${job.id}/events`, { signal: ac.signal }).then(async (res) => {
    const reader = res.body.getReader(); const dec = new TextDecoder();
    try { for (;;) { const { value, done } = await reader.read(); if (done) break; events.push(dec.decode(value)); } } catch { /* aborted */ }
  });
  await new Promise((r) => setTimeout(r, 50));

  assert.equal((await call('POST', `/api/jobs/${job.id}/confirm`)).data.state !== 'draft', true);
  await env.runner.idle();
  job = (await call('GET', `/api/jobs/${job.id}`)).data;
  assert.equal(job.stages.intake.status, 'awaiting_review');
  assert.equal(job.state, 'question', 'intake has a blocking question');

  const review = (await call('GET', `/api/jobs/${job.id}/stages/intake/review`)).data;
  assert.equal(review.round, 1);
  const file = await fetch(`${base}/files/${job.id}/${review.files[0].path}`);
  assert.equal(file.status, 200);
  assert.match(await file.text(), /Inventory/);
  assert.equal((await fetch(`${base}/files/${job.id}/..%2F..%2Fpackage.json`)).status, 404, 'no escaping the job folder');

  // save pending edits, then send them
  await call('PUT', `/api/jobs/${job.id}/stages/intake/pending`, { edits: [{ kind: 'answer', qid: 'intake:q2', text: '2.49$' }] });
  job = (await call('POST', `/api/jobs/${job.id}/stages/intake/edits`)).data;
  assert.equal(job.stages.intake.status, 'editing');
  await env.runner.idle();
  job = (await call('GET', `/api/jobs/${job.id}`)).data;
  assert.equal(job.stages.intake.rounds.length, 2);
  assert.equal((await call('GET', `/api/jobs/${job.id}/stages/intake/review?round=1`)).data.round, 1, 'round history');

  assert.equal((await call('POST', `/api/jobs/${job.id}/stages/flyer/approve`)).status, 409, 'cannot approve a pending stage');
  job = (await call('POST', `/api/jobs/${job.id}/stages/intake/approve`)).data;
  await env.runner.idle();
  job = (await call('GET', `/api/jobs/${job.id}`)).data;
  assert.equal(job.current, 'images');
  assert.equal(job.stages.images.status, 'awaiting_review');

  const list = (await call('GET', '/api/jobs')).data;
  assert.equal(list.length, 1);
  assert.equal(list[0].stages.intake, 'approved');

  ac.abort(); await es;
  const stream = events.join('');
  assert.match(stream, /event: job/);
  assert.match(stream, /event: log/);
  assert.match(stream, /images round 1 ready for review/);

  assert.equal((await call('DELETE', `/api/jobs/${job.id}`)).status, 200);
  assert.equal((await call('GET', `/api/jobs/${job.id}`)).status, 404);
});
