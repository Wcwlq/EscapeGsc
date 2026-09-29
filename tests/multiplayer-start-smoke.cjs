// NODE_PATH=/path/to/node_modules TEST_BASE_URL=https://your-site node tests/multiplayer-start-smoke.cjs
// No fabricated protocol messages: UI create/join/select/ready, observe real state packets.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:4324';
const OUT = process.env.SMOKE_OUT || '/tmp/gsc-start-smoke';
async function run(hostRole, difficulty) {
  const browser = await chromium.launch({headless: true});
  const pages = [], errors = [];
  const tag = `${hostRole}-${difficulty}`;
  try {
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext({viewport:{width:1280,height:900}});
      await context.addInitScript(() => {
        HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve();
      });
      const p = await context.newPage(); pages.push(p);
      p.on('pageerror', e => errors.push(`${i}: ${e.message}`));
      p.on('console', m => {if (m.type()==='error' && !m.text().includes('net::ERR_CONNECTION_CLOSED')) errors.push(`${i}: ${m.text()}`)});
      await p.goto(BASE, {waitUntil:'domcontentloaded'});
      await p.waitForFunction(() => typeof Net === 'object' && typeof Peer === 'function');
      await p.evaluate(() => {
        window.__states = [];
        Net.on('state', d => { if (window.__states.length < 2000) window.__states.push({...d, at:performance.now()}); });
      });
      await p.click('#multiplayer-btn');
    }
    const [a,b] = pages;
    await a.click('#create-room-btn');
    await a.waitForFunction(() => /^\d{6}$/.test(document.querySelector('#room-code').textContent.trim()), null, {timeout:20000});
    const code = await a.locator('#room-code').innerText();
    await b.fill('#room-input',code); await b.click('#join-room-btn');
    for (const p of pages) await p.waitForSelector('#setup.is-visible');
    await a.click(`[data-setup-role="${hostRole}"]`);
    await a.click(`[data-setup-difficulty="${difficulty}"]`);
    const guestRole = hostRole==='escaper'?'marshal':'escaper';
    await b.click(`[data-setup-role="${guestRole}"]`);
    await a.waitForFunction(() => document.querySelector('#setup-status').textContent.includes('对方：') && !document.querySelector('#setup-status').textContent.includes('未选'));
    await a.click('#setup-ready-btn'); await b.click('#setup-ready-btn');
    for (const p of pages) await p.waitForFunction(() => document.body.classList.contains('is-playing') && !document.querySelector('#cutscene.is-visible'));
    await Promise.all(pages.map(p => p.waitForTimeout(300))); // 300ms of actual play after opening scene, still inside 5s grace
    const state = await Promise.all(pages.map(p => p.evaluate(() => ({
      playing:document.body.classList.contains('is-playing'),
      result:document.querySelector('#result').className,
      resultTitle:document.querySelector('#result-title').textContent,
      status:document.querySelector('#status-text').textContent,
      packets:window.__states.length,
      first:window.__states[0], last:window.__states.at(-1),
      connected:Net.connected
    }))));
    console.log(JSON.stringify({phase:'opening',hostRole,difficulty,room:code,state,errors},null,2));
    for (let i=0;i<2;i++) await pages[i].screenshot({path:`${OUT}/${tag}-${i}.png`});
    assert.ok(state.every(s=>s.playing),'Both players must survive the overlapping spawn during opening protection');
    assert.ok(state.every(s=>s.connected && s.packets>0),'Both positions must sync during the protected opening');
    const escaper = hostRole==='escaper'?a:b, marshal = hostRole==='marshal'?a:b;
    assert.match(await escaper.locator('#status-text').innerText(), /无敌/);
    // 少帅可立即移动；只有逃离者受开局无敌保护。
    // Remain on overlapping spawns: after protection, capture must still work.
    await escaper.waitForSelector('#result.is-visible',{timeout:25000});
    await marshal.waitForSelector('#result.is-visible',{timeout:8000});
    assert.ok(await escaper.locator('#result').evaluate(e=>e.classList.contains('is-loss')));
    assert.ok(await marshal.locator('#result').evaluate(e=>e.classList.contains('is-win')));
    assert.deepEqual(errors,[]);
    console.log(`PASS ${tag}: protected opening -> protection expires -> escaper loses/marshal wins`);
  } finally {
    for (const p of pages) await p.evaluate(()=>window.Net?.close()).catch(()=>{});
    await browser.close();
  }
}
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  for(const role of ['escaper','marshal']) for(const diff of ['hard','nightmare']) await run(role,diff);
})().catch(e=>{console.error(e);process.exitCode=1});
