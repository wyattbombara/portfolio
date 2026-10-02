// Preferences are optional: the portfolio also works with storage disabled.
const memoryPreferences = new Map();
function getPreference(key, fallback = null) {
  if (memoryPreferences.has(key)) return memoryPreferences.get(key);
  try { return localStorage.getItem(key) ?? fallback; }
  catch (_) { return memoryPreferences.get(key) ?? fallback; }
}
function setPreference(key, value) {
  memoryPreferences.set(key, value);
  try { localStorage.setItem(key, value); } catch (_) { /* Use this session's preference. */ }
}
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const settings = {
  navMode: getPreference('navMode', 'terminal'),
  particles: getPreference('particles', 'on') !== 'off',
  visitorEnabled: getPreference('visitorEnabled', 'on') !== 'off',
};

const sunIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
const moonIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z"/></svg>';
function applyTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.querySelectorAll('#themeToggle').forEach(button => {
    button.innerHTML = light ? moonIcon : sunIcon;
    button.setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} theme`);
    button.title = light ? 'Dark theme' : 'Light theme';
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f4f5ee' : '#111211');
  const guestbook = document.getElementById('cusdis_thread');
  if (guestbook) {
    guestbook.dataset.theme = light ? 'light' : 'dark';
    window.CUSDIS?.renderTo(guestbook);
  }
  document.querySelectorAll('[data-setting="theme"]').forEach(button => {
    const active = button.dataset.value === theme;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function buildNavigation() {
  const container = document.querySelector('.nav-links');
  if (!container) return;
  const home = document.body.classList.contains('home-page') ? '' : 'index.html';
  container.innerHTML = `<a href="${home}#work">Work</a><a href="${home}#about">About</a><a href="${home}#contact">Contact</a>`;
  if (getPreference('navMode', 'terminal') === 'tabs') {
    const menu = document.createElement('details');
    menu.className = 'page-menu';
    menu.innerHTML = '<summary>Explore</summary><div class="menu-panel"></div>';
    const pages = [['Now', 'now.html'], ['Setup', 'uses.html'], ['Skills', 'skills.html'], ['Accomplishments', 'accomplishments.html'], ['Guestbook', 'guestbook.html'], ['Security', 'pentest.html'], ['Proxy', 'proxy.html'], ['Settings', 'settings.html']];
    pages.forEach(([name, href]) => {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = name;
      menu.querySelector('.menu-panel').append(link);
    });
    menu.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); } });
    container.append(menu);
  } else {
    const button = document.createElement('button');
    button.id = 'termBtn';
    button.className = 'term-btn';
    button.textContent = '>_';
    button.setAttribute('aria-label', 'Open terminal');
    button.title = 'Open terminal (Ctrl / ⌘ + K)';
    container.append(button);
  }
  const toggle = document.createElement('button');
  toggle.id = 'themeToggle';
  toggle.className = 'theme-toggle';
  container.append(toggle);
  container.querySelectorAll('a').forEach(link => { if (link.getAttribute('href') === location.pathname.split('/').pop()) link.setAttribute('aria-current', 'page'); });
  applyTheme(getPreference('theme', 'dark'));
}
buildNavigation();
document.addEventListener('click', event => {
  if (event.target.closest('#themeToggle')) {
    const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    setPreference('theme', theme);
    applyTheme(theme);
  }
  document.querySelectorAll('.page-menu[open]').forEach(menu => {
    if (!menu.contains(event.target)) menu.open = false;
  });
});

document.querySelectorAll('[data-copy-target]').forEach(button => {
  button.addEventListener('click', async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    const status = button.closest('.key-card')?.querySelector('.copy-status');
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      if (status) status.textContent = 'Public key copied.';
    } catch (_) {
      target.closest('details').open = true;
      if (status) status.textContent = 'Copy unavailable. Select the key above to copy it manually.';
    }
  });
});

function escapeHtml(value) {
  const node = document.createElement('span');
  node.textContent = String(value ?? '');
  return node.innerHTML;
}
function safeImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch (_) { return ''; }
}
function fmtTime(milliseconds) {
  const seconds = Math.floor(Math.max(0, Number(milliseconds) || 0) / 1000);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

// Lanyard presence. One heartbeat and one progress timer per page.
const DISCORD_ID = '1099818817934331914';
let ws, heartbeat, reconnectTimer, progressTimer;
let reconnectDelay = 5000;
let pageClosing = false;
function setStatus(status, label = status) {
  const dot = document.querySelector('.status-dot');
  if (!dot) return;
  const state = ['online', 'idle', 'dnd', 'offline'].includes(status) ? status : 'offline';
  dot.className = 'status-dot ' + state;
  dot.title = 'Discord: ' + label;
  dot.setAttribute('aria-label', 'Discord: ' + label);
}
function updateProgress() {
  const bar = document.querySelector('.spotify-bar');
  if (bar) {
    const start = Number(bar.dataset.start), end = Number(bar.dataset.end);
    const duration = Math.max(0, end - start);
    const elapsed = Math.max(0, Math.min(Date.now() - start, duration));
    bar.querySelector('.spotify-progress').style.width = (duration ? elapsed / duration * 100 : 0) + '%';
    bar.parentElement.querySelector('.spotify-current').textContent = fmtTime(elapsed);
  }
  const clock = document.querySelector('.game-clock');
  if (clock) clock.textContent = fmtTime(Date.now() - Number(clock.dataset.start));
}
function manageProgress() {
  clearInterval(progressTimer);
  if (!document.hidden && document.querySelector('.spotify-bar, .game-clock')) {
    updateProgress();
    progressTimer = setInterval(updateProgress, 1000);
  }
}
function idleActivity(unavailable = false) {
  const container = document.getElementById('spotify');
  if (container) container.innerHTML = `<div class="activity-idle"><span class="music-note" aria-hidden="true">♫</span><span>${unavailable ? 'Activity unavailable.' : 'No music on right now.'}<small>${unavailable ? 'Check back in a little while.' : 'Probably exploring something else.'}</small></span></div>`;
  manageProgress();
}
function updateUI(data) {
  if (!data || typeof data !== 'object') return;
  setStatus(data.discord_status || 'offline');
  const container = document.getElementById('spotify');
  if (!container) return;
  const game = Array.isArray(data.activities) ? data.activities.find(activity => activity.type === 0) : null;
  const spotify = data.spotify;
  if (!spotify && !game) { idleActivity(); return; }
  let html = '';
  if (spotify) {
    const art = safeImageUrl(spotify.album_art_url);
    html = `<div class="spotify-row">${art ? `<div class="spotify-cover"><img src="${escapeHtml(art)}" alt="Album cover" width="48" height="48" referrerpolicy="no-referrer"></div>` : ''}<div class="spotify-body"><div class="spotify-text"><strong>${escapeHtml(spotify.song)}</strong><br>${escapeHtml(spotify.artist)}</div><div class="spotify-bar" data-start="${Number(spotify.timestamps?.start) || 0}" data-end="${Number(spotify.timestamps?.end) || 0}"><div class="spotify-progress"></div></div><div class="spotify-times"><span class="spotify-current">0:00</span><span>${fmtTime(spotify.timestamps?.end - spotify.timestamps?.start)}</span></div></div></div>`;
  }
  if (game) {
    let image = '';
    if (/^\d+$/.test(game.application_id) && /^\d+$/.test(game.assets?.large_image)) {
      image = `https://cdn.discordapp.com/app-assets/${game.application_id}/${game.assets.large_image}.png`;
    }
    const started = Number(game.timestamps?.start);
    html += `<div class="game-row">${image ? `<div class="spotify-cover"><img src="${image}" alt="" width="40" height="40"></div>` : '<div class="game-icon" aria-hidden="true">⌘</div>'}<div class="game-body"><div class="game-name">${escapeHtml(game.name)}</div>${game.details ? `<div class="game-details">${escapeHtml(game.details)}${game.state ? ' · ' + escapeHtml(game.state) : ''}</div>` : ''}</div>${started > 0 ? `<div class="game-clock" data-start="${started}">${fmtTime(Date.now() - started)}</div>` : ''}</div>`;
  }
  container.innerHTML = html;
  container.querySelectorAll('img').forEach(image => image.addEventListener('error', () => image.parentElement.remove(), {once:true}));
  manageProgress();
}
function connectLanyard() {
  if (pageClosing || !document.querySelector('.status-dot, #spotify')) return;
  clearTimeout(reconnectTimer);
  setStatus('offline', 'connecting');
  try { ws = new WebSocket('wss://api.lanyard.rest/socket'); }
  catch (_) { idleActivity(true); return; }
  ws.onmessage = event => {
    let message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    if (message.op === 1) {
      reconnectDelay = 5000;
      const sendHeartbeat = () => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({op:3})); };
      clearInterval(heartbeat);
      sendHeartbeat();
      heartbeat = setInterval(sendHeartbeat, Math.max(1000, Number(message.d?.heartbeat_interval) || 30000));
      ws.send(JSON.stringify({op:2, d:{subscribe_to_id:DISCORD_ID}}));
    } else if (message.op === 0) { updateUI(message.d); }
  };
  ws.onclose = () => {
    clearInterval(heartbeat);
    setStatus('offline', 'unavailable');
    idleActivity(true);
    if (!pageClosing) {
      reconnectTimer = setTimeout(connectLanyard, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 60000);
    }
  };
}
connectLanyard();

// A small bit of personality; the primary introduction is always readable.
const typingElement = document.getElementById('typing-text');
let typingTimer;
function startTyping() {
  clearTimeout(typingTimer);
  if (!typingElement) return;
  const phrases = ['making computers do what I want', 'automating the boring stuff', 'figuring it out as I go', 'probably should be sleeping'];
  if (motionPreference.matches) { typingElement.textContent = phrases[0]; return; }
  let phrase = 0, character = phrases[0].length, deleting = true;
  typingElement.textContent = phrases[0];
  function type() {
    if (document.hidden) { typingTimer = setTimeout(type, 1000); return; }
    const text = phrases[phrase];
    character += deleting ? -1 : 1;
    typingElement.textContent = text.slice(0, character);
    if (!deleting && character === text.length) {
      deleting = true;
      typingTimer = setTimeout(type, 3500);
    } else if (deleting && character === 0) {
      deleting = false;
      phrase = (phrase + 1) % phrases.length;
      typingTimer = setTimeout(type, 350);
    } else { typingTimer = setTimeout(type, deleting ? 30 : 65); }
  }
  typingTimer = setTimeout(type, 3500);
}
startTyping();

const counter = document.getElementById('visitorCount');
if (counter) {
  counter.hidden = !settings.visitorEnabled;
  if (settings.visitorEnabled) {
    const previous = Number(getPreference('visits', '0'));
    const count = (Number.isFinite(previous) && previous >= 0 ? previous : 0) + 1;
    setPreference('visits', String(count));
    counter.textContent = 'your visits: ' + count;
  }
}
const clockElement = document.getElementById('footerClock');
function updateClock() {
  if (clockElement) clockElement.textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}
updateClock();
if (clockElement) setInterval(updateClock, 10000);
const yearElement = document.getElementById('footerYear');
if (yearElement) yearElement.textContent = new Date().getFullYear();

// Quiet background particles, paused in hidden tabs and omitted for reduced motion.
let particleAnimation = null, particleResize = null;
function stopParticles() {
  if (particleAnimation !== null) cancelAnimationFrame(particleAnimation);
  particleAnimation = null;
  if (particleResize) removeEventListener('resize', particleResize);
  particleResize = null;
  document.getElementById('particle-canvas')?.remove();
}
function startParticles() {
  stopParticles();
  if (motionPreference.matches || document.hidden || getPreference('particles', 'on') === 'off') return;
  const canvas = document.createElement('canvas');
  canvas.id = 'particle-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const context = canvas.getContext('2d');
  if (!context) { canvas.remove(); return; }
  particleResize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  particleResize();
  addEventListener('resize', particleResize);
  const particles = Array.from({length:35}, () => ({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()+.5,dy:Math.random()*.25+.08}));
  function draw() {
    context.clearRect(0,0,canvas.width,canvas.height);
    context.fillStyle = document.documentElement.dataset.theme === 'light' ? '#526d22' : '#d4ef84';
    for (const particle of particles) {
      context.beginPath();context.arc(particle.x,particle.y,particle.r,0,Math.PI*2);context.fill();
      particle.y += particle.dy;
      if (particle.y > canvas.height + 4) { particle.y = -4; particle.x = Math.random()*canvas.width; }
    }
    particleAnimation = requestAnimationFrame(draw);
  }
  draw();
}
startParticles();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopParticles(); else { startParticles(); updateClock(); }
  manageProgress();
});
motionPreference.addEventListener('change', () => { startTyping(); startParticles(); });
window.addEventListener('pagehide', () => {
  pageClosing = true;
  clearTimeout(reconnectTimer); clearInterval(heartbeat); clearInterval(progressTimer);
  clearTimeout(typingTimer); stopParticles(); ws?.close();
});
window.addEventListener('pageshow', event => {
  if (event.persisted) { pageClosing = false; connectLanyard(); startParticles(); startTyping(); manageProgress(); }
});

// The original command-based navigation, with dialog semantics and keyboard support.
(function() {
  const pages = {
    home:{path:'index.html',desc:'go to the home page'}, index:{path:'index.html',desc:'go to the home page'},
    now:{path:'now.html',desc:'what I’m up to'}, uses:{path:'uses.html',desc:'gear and software'},
    skills:{path:'skills.html',desc:'my learning path'}, accomplishments:{path:'accomplishments.html',desc:'things I’ve done'},
    guestbook:{path:'guestbook.html',desc:'leave a note'}, pentest:{path:'pentest.html',desc:'security experiments'},
    proxy:{path:'proxy.html',desc:'web proxy'}, settings:{path:'settings.html',desc:'configure the site'},
    tms:{path:'tms.html',desc:'web platform project'}, ai:{path:'school-ai.html',desc:'self-hosted AI project'},
  };
  const extra = {help:{desc:'show commands'},banner:{desc:'show the banner'},about:{desc:'about this site'},date:{desc:'current date and time'},whoami:{desc:'show current user'},'whois wyatt':{desc:'bio for the site owner'},clear:{desc:'clear the terminal'},exit:{desc:'close the terminal'},ls:{desc:'list pages'},cd:{desc:'go to a page (cd now)'},neofetch:{desc:'system info'}};
  let cwd = 'home';
  const HOME = 'home';
  const history = [];
  let historyIndex = 0, draft = '', previousFocus;
  function promptHtml() { return `<span class="prompt">wyatt@portfolio:~${cwd === HOME ? '' : '/' + cwd}</span>`; }
  const overlay = document.createElement('div');
  overlay.className = 'term-overlay'; overlay.id = 'termOverlay';
  overlay.innerHTML = `<div class="term-window" role="dialog" aria-modal="true" aria-labelledby="terminalTitle" aria-describedby="terminalHint"><div class="term-header"><span class="term-dot" aria-hidden="true"></span><span class="term-dot" aria-hidden="true"></span><span class="term-dot" aria-hidden="true"></span><span class="term-title" id="terminalTitle">wyatt@portfolio:~</span><button class="term-close" type="button" aria-label="Close terminal">esc ×</button></div><div class="term-output" id="termOutput" role="log" aria-live="polite" aria-relevant="additions"><div class="dim" id="terminalHint">Welcome to my corner of the web. Type <span class="highlight">help</span> to explore.<br>↑ ↓ command history · Esc to close</div></div><div class="term-input-line"><span class="prompt" id="termPrompt">wyatt@portfolio:~</span><label class="sr-only" for="termInput">Terminal command</label><input type="text" class="term-input" id="termInput" autocomplete="off" autocapitalize="off" spellcheck="false"></div></div>`;
  document.body.append(overlay);
  const input = overlay.querySelector('#termInput'), output = overlay.querySelector('#termOutput');
  const closeButton = overlay.querySelector('.term-close'), page = document.querySelector('.page');
  function openTerm() {
    if (overlay.classList.contains('open')) return;
    previousFocus = document.activeElement;
    overlay.classList.add('open');
    if (page) page.inert = true;
    document.body.style.overflow = 'hidden';
    input.focus();
  }
  function closeTerm() {
    overlay.classList.remove('open');
    if (page) page.inert = false;
    document.body.style.overflow = '';
    if (previousFocus?.isConnected) previousFocus.focus();
  }
  closeButton.addEventListener('click', closeTerm);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeTerm(); });
  document.addEventListener('click', event => { if (event.target.closest('#termBtn')) openTerm(); });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openTerm(); }
    if (!overlay.classList.contains('open')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeTerm(); }
    if (event.key === 'Tab') {
      if (event.shiftKey && document.activeElement === closeButton) { event.preventDefault(); input.focus(); }
      else if (!event.shiftKey && document.activeElement === input) { event.preventDefault(); closeButton.focus(); }
    }
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex === history.length) draft = input.value;
      historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
      input.value = historyIndex === history.length ? draft : history[historyIndex];
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    const line = document.createElement('div');
    line.innerHTML = `${promptHtml()} ${escapeHtml(value)}`;
    output.append(line);
    history.push(value); historyIndex = history.length; draft = ''; input.value = '';
    processCmd(value.toLowerCase(), output);
    document.getElementById('termPrompt').innerHTML = promptHtml();
    output.scrollTop = output.scrollHeight;
  });
    function processCmd(cmd, output) {
    if (!cmd) return;

    const parts = cmd.split(/\s+/);
    const main = parts[0];

    if (main === 'help') {
      const row = (name, description) => `<div class="command-row"><span class="highlight">${name}</span><span>${description}</span></div>`;
      const groups = [
        { title: 'navigation', cmds: ['ls', 'cd', 'home', 'index', 'now', 'uses', 'skills', 'accomplishments', 'guestbook', 'pentest', 'proxy', 'settings', 'tms', 'ai'] },
        { title: 'system', cmds: ['whoami', 'whois wyatt', 'neofetch', 'date'] },
        { title: 'misc', cmds: ['about', 'banner', 'help', 'clear', 'exit'] },
      ];
      let html = '<div style="margin-bottom:0.25rem;">available commands:</div>';
      for (const g of groups) {
        html += `<div class="dim" style="margin-top:0.5rem;">-- ${g.title} --</div>`;
        for (const c of g.cmds) {
          const d = pages[c] ? pages[c].desc : extra[c]?.desc;
          if (d) html += row(c, d);
        }
      }
      addOutput(html);
    } else if (main === 'clear') {
      output.innerHTML = '';
    } else if (main === 'exit' || main === 'close') {
      closeTerm();
    } else if (main === 'whoami') {
      addOutput('user@portfolio');
    } else if (main === 'whois' || main === 'bio') {
      const target = parts[1];
      if (target && target !== 'wyatt') {
        addOutput(`<span class="error">no user found: ${escapeHtml(target)}</span>`);
        return;
      }
      addOutput(
        'name:&nbsp;&nbsp;&nbsp; wyatt<br>' +
        'role:&nbsp;&nbsp;&nbsp; developer / security researcher<br>' +
        'stack:&nbsp;&nbsp; web, self-hosting, whatever works<br>' +
        'builds:&nbsp;&nbsp; web proxy &amp; game site, self-hosted AI<br>' +
        'status:&nbsp;&nbsp; <span class="highlight">taking build requests</span>'
      );
    } else if (main === 'banner') {
      addOutput('wyatt@portfolio:~<br>welcome to my terminal portfolio.');
    } else if (main === 'about') {
      addOutput(
        'terminal-driven portfolio. dark mode by default.<br>' +
        'built with vanilla html/css/js, hosted on github pages.<br>' +
        'built a web proxy and game site, host my own ai locally via open webui.<br>' +
        'type <span class="highlight">whois wyatt</span> for a bio, <span class="highlight">now</span> for what i\'m up to, or any page name to navigate.'
      );
    } else if (main === 'date') {
      addOutput(new Date().toString());
    } else if (main === 'ls') {
      const names = Object.keys(pages).sort();
      addOutput('<div class="dim">' + names.join('&nbsp;&nbsp;') + '</div>');
    } else if (main === 'cd') {
      const target = parts[1];
      if (!target || target === '~' || target === 'home' || target === '/') {
        cwd = HOME;
        return;
      }
      if (pages[target]) {
        window.location.href = pages[target].path;
      } else {
        addOutput(`<span class="error">cd: no such directory: ${escapeHtml(target)}</span>`);
      }
    } else if (main === 'neofetch') {
      const d = new Date();
      addOutput(
        '<div>' +
        '<div>&nbsp;&nbsp;<span class="highlight">wyatt@portfolio</span></div>' +
        '<div>&nbsp;&nbsp;---------------------</div>' +
        '<div>&nbsp;&nbsp;OS&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; portfolio v1.0</div>' +
        '<div>&nbsp;&nbsp;Host&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; github pages</div>' +
        '<div>&nbsp;&nbsp;Shell&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; this terminal</div>' +
        `<div>&nbsp;&nbsp;Uptime&nbsp;&nbsp;&nbsp;&nbsp; ${d.getFullYear()} (est.)</div>` +
        '<div>&nbsp;&nbsp;Theme&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ' + (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark') + '</div>' +
        '<div>&nbsp;&nbsp;Status&nbsp;&nbsp;&nbsp;&nbsp; <span class="highlight">taking build requests</span></div>' +
        '</div>'
      );
    } else if (pages[main]) {
      cwd = main;
      window.location.href = pages[main].path;
    } else if (main === 'tollsec') {
      window.location.href = 'tollsec.html';
    } else {
      addOutput(`<span class="error">unknown command: ${escapeHtml(main)}</span>`);
    }

    function addOutput(html) {
      const div = document.createElement('div');
      div.innerHTML = html;
      output.appendChild(div);
    }
  }


})();
