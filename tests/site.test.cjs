const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');

function openPage(file = 'index.html', options = {}) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const dom = new JSDOM(html, { url: `https://portfolio.test/${file}`, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const intervals = new Map();
  const sockets = [];
  let nextTimer = 1;
  window.matchMedia = () => ({ matches: Boolean(options.reducedMotion), addEventListener() {} });
  window.setInterval = (callback, delay) => { const id = nextTimer++; intervals.set(id, { callback, delay }); return id; };
  window.clearInterval = id => intervals.delete(id);
  window.setTimeout = () => nextTimer++;
  window.clearTimeout = () => {};
  window.requestAnimationFrame = () => nextTimer++;
  window.cancelAnimationFrame = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, beginPath() {}, arc() {}, fill() {} });
  window.WebSocket = class {
    static OPEN = 1;
    constructor() { this.readyState = 1; this.sent = []; sockets.push(this); }
    send(message) { this.sent.push(JSON.parse(message)); }
    close() { this.readyState = 3; }
  };
  for (const [key, value] of Object.entries(options.preferences || {})) window.localStorage.setItem(key, value);
  if (options.blockedStorage) Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage disabled'); } });
  window.eval(fs.readFileSync(path.join(root, 'theme-init.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'script.js'), 'utf8'));
  for (const script of window.document.querySelectorAll('script:not([src])')) window.eval(script.textContent);
  return { window, document: window.document, intervals, sockets, close: () => dom.window.close() };
}

test('all internal page links and assets resolve', () => {
  for (const file of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const document = new JSDOM(html).window.document;
    for (const element of document.querySelectorAll('[href], script[src], img[src]')) {
      const reference = element.getAttribute('href') || element.getAttribute('src');
      if (!reference || /^(?:[a-z]+:|#|\/\/)/i.test(reference)) continue;
      const [target, anchor] = reference.split('#');
      assert.ok(fs.existsSync(path.join(root, target)), `${file}: missing ${target}`);
      if (anchor) {
        const targetDocument = new JSDOM(fs.readFileSync(path.join(root, target), 'utf8')).window.document;
        assert.ok(targetDocument.getElementById(anchor), `${file}: missing #${anchor} in ${target}`);
      }
    }
  }
});

test('blocked storage preserves working theme and navigation preferences for the session', () => {
  const page = openPage('settings.html', { blockedStorage: true });
  page.document.querySelector('#themeLight').click();
  assert.equal(page.document.documentElement.dataset.theme, 'light');
  page.document.querySelector('#navTabs').click();
  assert.ok(page.document.querySelector('.page-menu'));
  assert.equal(page.document.querySelector('#navTabs').getAttribute('aria-pressed'), 'true');
  page.document.querySelector('#navTerminal').click();
  page.document.querySelector('#termBtn').click();
  assert.ok(page.document.querySelector('#termOverlay').classList.contains('open'));
  page.close();
});

test('navigation can switch from tabs back to a working terminal without reloading', () => {
  const page = openPage('settings.html', { preferences: { navMode: 'tabs' } });
  page.document.querySelector('#navTerminal').click();
  const trigger = page.document.querySelector('#termBtn');
  trigger.focus(); trigger.click();
  const input = page.document.querySelector('#termInput');
  input.value = 'exit';
  input.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.ok(!page.document.querySelector('#termOverlay').classList.contains('open'));
  assert.equal(page.document.activeElement, trigger);
  assert.equal(page.document.querySelector('.page').inert, false);
  assert.equal(page.document.body.style.overflow, '');
  page.close();
});

test('reduced motion keeps introductory content readable and omits animated particles', () => {
  const page = openPage('index.html', { reducedMotion: true });
  assert.equal(page.document.querySelector('#particle-canvas'), null);
  assert.equal(page.document.querySelector('#typing-text').textContent, 'making computers do what I want');
  page.close();
});

test('presence starts a single heartbeat after Hello and reconnect closure clears it', () => {
  const page = openPage();
  const socket = page.sockets[0];
  const hello = { data: JSON.stringify({ op: 1, d: { heartbeat_interval: 30000 } }) };
  socket.onmessage(hello); socket.onmessage(hello);
  assert.equal([...page.intervals.values()].filter(timer => timer.delay === 30000).length, 1);
  assert.ok(socket.sent.some(message => message.op === 2 && message.d.subscribe_to_id === '1099818817934331914'));
  socket.onclose();
  assert.equal([...page.intervals.values()].filter(timer => timer.delay === 30000).length, 0);
  assert.match(page.document.querySelector('#spotify').textContent, /unavailable/);
  page.close();
});

test('untrusted activity strings stay text, and repeated tracks do not multiply timers', () => {
  const page = openPage();
  const data = { discord_status: 'online', spotify: { song: '<img src=x onerror=alert(1)>', artist: '<script>bad()</script>', album_art_url: 'javascript:alert(1)', timestamps: { start: Date.now() - 10000, end: Date.now() - 8000 } }, activities: [{ type: 0, name: '<svg onload=alert(1)>', details: '<b>untrusted</b>' }] };
  page.window.updateUI(data); page.window.updateUI(data); page.window.updateUI(data);
  const activity = page.document.querySelector('#spotify');
  assert.equal(activity.querySelector('strong').textContent, data.spotify.song);
  assert.equal(activity.querySelector('img, script, svg, b'), null);
  assert.equal(activity.querySelector('.spotify-progress').style.width, '100%');
  assert.equal(activity.querySelector('.spotify-current').textContent, '0:02');
  assert.equal([...page.intervals.values()].filter(timer => timer.delay === 1000).length, 1);
  page.window.updateUI({ discord_status: 'offline', activities: [] });
  assert.equal([...page.intervals.values()].filter(timer => timer.delay === 1000).length, 0);
  page.close();
});

test('pages without activity widgets do not open a presence connection', () => {
  const page = openPage('uses.html');
  assert.equal(page.sockets.length, 0);
  page.close();
});
