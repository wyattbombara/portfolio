// --- config ---
const _ = [49, 48, 57, 57, 56, 49, 56, 56, 49, 55, 57, 51, 52, 51, 51, 49, 57, 49, 52].map(c => String.fromCharCode(c)).join('');
const DISCORD_ID = _;

// --- lanyard websocket ---
let ws;

function connectLanyard() {
  if (ws) ws.close();
  ws = new WebSocket('wss://api.lanyard.rest/socket');

  ws.onopen = () => {
    ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: DISCORD_ID } }));
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.op === 0) {
      updateUI(msg.d);
    }
  };

  ws.onclose = () => setTimeout(connectLanyard, 5000);
}

function updateUI(data) {
  // status dot
  const dot = document.querySelector('.status-dot');
  if (dot) {
    const colors = { online: '#22c55e', idle: '#f59e0b', dnd: '#ef4444', offline: '#555' };
    dot.style.background = colors[data.discord_status] || '#555';
  }

  // spotify + game
  const spotifyEl = document.getElementById('spotify');
  if (spotifyEl) {
    const game = data.activities?.find(a => a.type === 0);
    let html = '';
    if (data.spotify) {
      const s = data.spotify;
      html = `
        <div class="spotify-row">
          <div class="spotify-cover">
            <img src="${s.album_art_url}" alt="" width="110" height="110">
          </div>
          <div class="spotify-body">
            <div class="spotify-text">
              <span class="spotify-icon playing">&#9835;</span>
              <strong>${s.song}</strong> &middot; ${s.artist}
            </div>
            <div class="spotify-bar" data-start="${s.timestamps.start}" data-end="${s.timestamps.end}">
              <div class="spotify-progress"></div>
            </div>
            <div class="spotify-times">
              <span class="spotify-current">0:00</span>
              <span class="spotify-duration">${fmtTime(s.timestamps.end - s.timestamps.start)}</span>
            </div>
          </div>
        </div>
      `;
      updateProgress();
    }
    if (game) {
      let imgUrl = '';
      if (game.assets?.large_image && game.application_id) {
        const img = game.assets.large_image;
        if (img.startsWith('external:')) {
          imgUrl = 'https://media.discordapp.net/external/' + encodeURIComponent(img.slice(9));
        } else if (!img.startsWith('spotify:')) {
          imgUrl = `https://cdn.discordapp.com/app-assets/${game.application_id}/${img}.png`;
        }
      }
      if (!imgUrl) {
        const icons = { 'ROBLOX': 'https://cdn.discordapp.com/app-icons/363445589247131668/f2b60e350a2097289b3b0b877495e55f.png' };
        if (icons[game.name]) imgUrl = icons[game.name];
      }
      if (!imgUrl && game.application_id && !window._gameIcons?.[game.application_id]) {
        if (!window._gameIcons) window._gameIcons = {};
        fetch(`https://discord.com/api/v10/applications/${game.application_id}/rpc`)
          .then(r => r.json()).then(d => {
            if (d.icon) {
              window._gameIcons[game.application_id] = `https://cdn.discordapp.com/app-icons/${game.application_id}/${d.icon}.png`;
            }
          }).catch(() => {});
      }
      if (!imgUrl) imgUrl = window._gameIcons?.[game.application_id];
      const elapsed = game.timestamps ? Date.now() - game.timestamps.start : 0;
      html += `
        <div class="game-row">
          ${imgUrl ? `<div class="spotify-cover"><img src="${imgUrl}" alt="" width="40" height="40" onerror="this.parentElement.innerHTML='<span class=game-icon>&#127918;</span>'"></div>` : `<div class="game-icon">&#127918;</div>`}
          <div class="game-body">
            <div class="game-name">${game.name}</div>
            ${game.details ? `<div class="game-details">${game.details}${game.state ? ' &middot; ' + game.state : ''}</div>` : ''}
          </div>
          ${game.timestamps ? `<div class="game-clock" data-start="${game.timestamps.start}">${fmtTime(elapsed)}</div>` : ''}
        </div>
      `;
    }
    if (!data.spotify && !game) {
      html = `
        <span class="spotify-icon">&#9835;</span>
        <span class="spotify-text">not playing anything</span>
      `;
    }
    spotifyEl.innerHTML = html;
  }
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function updateProgress() {
  const bar = document.querySelector('.spotify-bar');
  if (bar) {
    const start = parseInt(bar.dataset.start);
    const end = parseInt(bar.dataset.end);
    const elapsed = Date.now() - start;
    const pct = Math.min((elapsed / (end - start)) * 100, 100);
    bar.querySelector('.spotify-progress').style.width = pct + '%';
    const cur = bar.parentElement.querySelector('.spotify-current');
    if (cur) cur.textContent = fmtTime(elapsed);
  }
  const gc = document.querySelector('.game-clock');
  if (gc) {
    const start = parseInt(gc.dataset.start);
    gc.textContent = fmtTime(Date.now() - start);
  }
  requestAnimationFrame(updateProgress);
}

connectLanyard();

// theme toggle
const toggle = document.getElementById('themeToggle');
if (toggle) {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    toggle.textContent = 'dark';
  }
  // set initial cusdis theme
  const cusdis = document.querySelector('#cusdis_thread');
  if (cusdis) cusdis.setAttribute('data-theme', saved === 'light' ? 'light' : 'dark');

  toggle.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      toggle.textContent = 'light';
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      toggle.textContent = 'dark';
      localStorage.setItem('theme', 'light');
    }
    // update cusdis theme
    const cusdis = document.querySelector('#cusdis_thread');
    if (cusdis) {
      cusdis.setAttribute('data-theme', isLight ? 'dark' : 'light');
      if (window.CUSDIS) window.CUSDIS.renderTo(cusdis);
    }
  });
}

// typing effect
const el = document.getElementById('typing-text');
if (el) {
  const phrases = [
    'breaking things for fun',
    'hacktivist at heart',
    'probably pentesting something',
    'probably doing something sketchy',
    'prob coding an exploit',
    'automating the boring stuff',
    'making computers do what I want',
    'writing code that probably works',
    'figuring it out as I go',
    'code, monster, chaos',
    "for legal reasons, that's a joke",
    'doing stuff, idk yet',
    'probably should be sleeping',
    'I do stuff sometimes',
    "not sure what I'm doing, but it's fine",
  ];
  let pi = Math.floor(Math.random() * phrases.length), ci = 0, deleting = false;

  function type() {
    const text = phrases[pi];
    if (!deleting) {
      el.textContent = text.slice(0, ci + 1);
      ci++;
      if (ci === text.length) {
        setTimeout(() => { deleting = true; setTimeout(type, 300); }, 2000);
        return;
      }
      setTimeout(type, 60);
    } else {
      el.textContent = text.slice(0, ci - 1);
      ci--;
      if (ci === 0) {
        deleting = false;
        let np;
        do { np = Math.floor(Math.random() * phrases.length); } while (np === pi);
        pi = np;
        setTimeout(type, 200);
        return;
      }
      setTimeout(type, 30);
    }
  }
  type();
}

// visit counter
const counter = document.getElementById('visitorCount');
if (counter) {
  const key = 'visits';
  let count = localStorage.getItem(key);
  count = count ? parseInt(count) + 1 : 1;
  localStorage.setItem(key, count);
  counter.textContent = 'visits: ' + count;
}

// footer clock
const clockEl = document.getElementById('footerClock');
if (clockEl) {
  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  updateClock();
  setInterval(updateClock, 10000);
}

// particle background
(function() {
  const c = document.createElement('canvas');
  c.id = 'particle-canvas';
  document.body.prepend(c);
  const ctx = c.getContext('2d');
  let particles = [];
  const COUNT = 60;

  function resize() { c.width = innerWidth; c.height = innerHeight; }
  resize();
  addEventListener('resize', resize);

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: Math.random() * 2 + 1,
      dy: Math.random() * 0.3 + 0.1,
      o: Math.random() * 0.5 + 0.1,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,200,200,${p.o})`;
      ctx.fill();
      p.y += p.dy;
      if (p.y > c.height + 5) { p.y = -5; p.x = Math.random() * c.width; }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// terminal navigation
(function() {
  const btn = document.getElementById('termBtn');
  if (!btn) return;

  const pages = {
    home: { path: 'index.html', desc: 'go to the home page' },
    index: { path: 'index.html', desc: 'go to the home page' },
    now: { path: 'now.html', desc: 'what i\'m up to right now' },
    uses: { path: 'uses.html', desc: 'gear and software i use' },
    skills: { path: 'skills.html', desc: 'dev path and skills' },
    accomplishments: { path: 'accomplishments.html', desc: 'things i\'ve done' },
    guestbook: { path: 'guestbook.html', desc: 'sign the guestbook' },
    pentest: { path: 'pentest.html', desc: 'pen testing experience' },
    proxy: { path: 'proxy.html', desc: 'barebones web proxy' },
  };

  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'term-overlay';
    overlay.id = 'termOverlay';
    overlay.innerHTML = `
      <div class="term-window">
        <div class="term-header">
          <span class="term-dot"></span><span class="term-dot"></span><span class="term-dot"></span>
          <span class="term-title">wyatt@portfolio:~</span>
        </div>
        <div class="term-output" id="termOutput">
          <div>type <span class="highlight">help</span> for available commands</div>
        </div>
        <div class="term-input-line">
          <span class="prompt">$</span>
          <input type="text" class="term-input" id="termInput" autocomplete="off" spellcheck="false" autofocus>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#termInput');
    const output = overlay.querySelector('#termOutput');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeTerm();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeTerm();
    });

    function closeTerm() {
      overlay.classList.remove('open');
      input.blur();
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = input.value.trim().toLowerCase();
        const line = document.createElement('div');
        line.innerHTML = `<span class="prompt">$</span> ${escapeHtml(input.value.trim())}`;
        output.appendChild(line);
        input.value = '';
        processCmd(cmd, output);
        output.scrollTop = output.scrollHeight;
      }
    });

    btn.addEventListener('click', () => {
      overlay.classList.add('open');
      setTimeout(() => input.focus(), 100);
    });
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function processCmd(cmd, output) {
    if (!cmd) return;

    const parts = cmd.split(/\s+/);
    const main = parts[0];

    if (main === 'help') {
      const names = Object.keys(pages);
      const maxLen = Math.max(...names.map(n => n.length));
      let html = '<div style="margin-bottom:0.25rem;">available commands:</div>';
      for (const name of names) {
        const pad = '&nbsp;'.repeat(maxLen - name.length + 2);
        html += `<div>&nbsp;&nbsp;<span class="highlight">${name}</span>${pad}${pages[name].desc}</div>`;
      }
      html += `<div>&nbsp;&nbsp;<span class="highlight">clear</span>${'&nbsp;'.repeat(maxLen - 4)}clear the terminal</div>`;
      html += `<div>&nbsp;&nbsp;<span class="highlight">exit</span>${'&nbsp;'.repeat(maxLen - 3)}close the terminal</div>`;
      html += `<div>&nbsp;&nbsp;<span class="highlight">whoami</span>${'&nbsp;'.repeat(maxLen - 5)}display user info</div>`;
      addOutput(html);
    } else if (main === 'clear') {
      output.innerHTML = '';
    } else if (main === 'exit' || main === 'close') {
      document.getElementById('termOverlay').classList.remove('open');
    } else if (main === 'whoami') {
      addOutput('wyatt &mdash; hacktivist, developer, pentester');
    } else if (pages[main]) {
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

  buildOverlay();
})();
