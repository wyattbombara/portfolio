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
      html += `
        <div class="game-info">
          <span class="game-icon">&#127918;</span>
          <span class="game-name">${game.name}</span>
          ${game.details ? `<span class="game-details">${game.details}</span>` : ''}
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
  if (!bar) return;
  const start = parseInt(bar.dataset.start);
  const end = parseInt(bar.dataset.end);
  const elapsed = Date.now() - start;
  const pct = Math.min((elapsed / (end - start)) * 100, 100);
  bar.querySelector('.spotify-progress').style.width = pct + '%';
  const cur = bar.parentElement.querySelector('.spotify-current');
  if (cur) cur.textContent = fmtTime(elapsed);
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
  });
}

// typing effect
const el = document.getElementById('typing-text');
if (el) {
  const text = 'does stuff with code';
  let i = 0;
  function type() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(type, 50);
    }
  }
  type();
}

// visit counter
const counter = document.getElementById('visitorCount');
if (counter) {
  const key = 'visits';
  let count = localStorage.getItem(key);
  if (count) {
    count = parseInt(count) + 1;
  } else {
    count = 1;
  }
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

// --- guestbook ---
const GB_REPO = 'wyattbombara/portfolio';
const GB_ISSUE = 1;

async function loadGuestbook() {
  const el = document.getElementById('gb-entries');
  if (!el) return;

  try {
    const r = await fetch(`https://api.github.com/repos/${GB_REPO}/issues/${GB_ISSUE}/comments`);
    const comments = await r.json();
    el.innerHTML = comments.toReversed().map(c => {
      const body = c.body.split('\n');
      const name = body[0] || 'anon';
      const msg = body.slice(1).join('\n').trim();
      return `<div style="padding:0.5rem 0;border-bottom:1px solid var(--project-divider);font-size:0.82rem;"><strong style="color:var(--text);">${name}</strong><span style="color:var(--text-muted);margin-left:0.5rem;">${msg}</span></div>`;
    }).join('');
  } catch {}
}

const gbForm = document.getElementById('gb-form');
if (gbForm) {
  gbForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('gb-name').value.trim();
    const msg = document.getElementById('gb-msg').value.trim();
    if (!name || !msg) return;
    window.open(`https://github.com/${GB_REPO}/issues/new?title=guestbook:+${encodeURIComponent(name)}&body=${encodeURIComponent(msg)}`, '_blank');
    gbForm.reset();
  });

  loadGuestbook();
}
