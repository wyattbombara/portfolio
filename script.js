// --- config ---
const DISCORD_ID = '1099818817934331914';

// --- fetch status from lanyard ---
async function fetchStatus() {
  if (!DISCORD_ID) return;

  try {
    const res = await fetch('https://api.lanyard.rest/v1/users/' + DISCORD_ID);
    const json = await res.json();
    const data = json.data;

    // status dot
    const dot = document.querySelector('.status-dot');
    if (dot) {
      const colors = { online: '#22c55e', idle: '#f59e0b', dnd: '#ef4444', offline: '#555' };
      dot.style.background = colors[data.discord_status] || '#555';
    }

    // spotify
    const spotifyEl = document.getElementById('spotify');
    if (spotifyEl) {
      if (data.spotify) {
        spotifyEl.innerHTML = `
          <span class="spotify-icon playing">&#9835;</span>
          <span class="spotify-text">listening to <strong>${data.spotify.song}</strong> by ${data.spotify.artist}</span>
        `;
      } else {
        spotifyEl.innerHTML = `
          <span class="spotify-icon">&#9835;</span>
          <span class="spotify-text">not playing anything</span>
        `;
      }
    }
  } catch {}
}

fetchStatus();
setInterval(fetchStatus, 30000);

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
