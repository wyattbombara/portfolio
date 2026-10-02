# Wyatt's portfolio

A static HTML, CSS, and JavaScript portfolio for GitHub Pages. No build step is required.

## Preview locally

Serve the repository with any static HTTP server. For example, if Python is available:

```sh
python -m http.server 8000
```

Open `http://localhost:8000`.

## Pages and features

- `index.html`: selected projects, background, toolbox, contact, and live activity.
- `tms.html` and `school-ai.html`: project overviews.
- Existing setup, skills, guestbook, security, proxy, now, and settings pages remain available through the terminal or Explore navigation.
- Terminal: click `>_` or press Ctrl/Command + K. Type `help`, use Up/Down for history, and Escape or `exit` to close.
- Dark/light themes and settings are saved locally when browser storage is available. Reduced-motion preferences disable automatic motion.

Live Discord/Spotify presence uses [Lanyard](https://github.com/Phineas/lanyard). The guestbook uses Cusdis. These external services can be temporarily unavailable; the portfolio displays a fallback when live activity cannot load.

## Validation

Run `npm ci` and `npm test` to check internal links, storage fallbacks, theme and navigation changes, terminal focus restoration, reduced motion, presence heartbeats, and safe activity rendering. The test dependency is development-only; the deployed site needs no npm packages.
