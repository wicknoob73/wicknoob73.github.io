// version.js
const VERSION_FALLBACK = 'v0';
const STATS_URL = 'https://florists-smaller-toll-platform.trycloudflare.com/stats'; // o /version

async function updateVersion() {
  try {
    const res = await fetch(STATS_URL + '?_=' + Date.now()); // anti-cache
    if (!res.ok) throw new Error();
    const data = await res.json();
    const version = data.version || VERSION_FALLBACK;
    
    document.querySelectorAll('.bot-version').forEach(el => {
      el.textContent = version;
    });
  } catch {
    // Se il bot è offline, usa il fallback
    document.querySelectorAll('.bot-version').forEach(el => {
      el.textContent = VERSION_FALLBACK;
    });
  }
}

document.addEventListener('DOMContentLoaded', updateVersion);