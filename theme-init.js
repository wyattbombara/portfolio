// Apply the saved theme before the first paint, including when storage is blocked.
try {
  if (localStorage.getItem('theme') === 'light') {
    document.documentElement.dataset.theme = 'light';
  }
} catch (_) { /* The default dark theme works without storage. */ }
