// version.js
const VERSION_FALLBACK = 'v0';
const STATS_URL = 'https://attribute-signals-circuits-rangers.trycloudflare.com/stats';

async function updateVersion() {
  try {
    const res = await fetch(STATS_URL + '?_=' + Date.now());
    if (!res.ok) throw new Error();
    const data = await res.json();
    const version = data.version || VERSION_FALLBACK;
    
    document.querySelectorAll('.bot-version').forEach(el => {
      el.textContent = version;
    });
  } catch {
    document.querySelectorAll('.bot-version').forEach(el => {
      el.textContent = VERSION_FALLBACK;
    });
  }
}

document.addEventListener('DOMContentLoaded', updateVersion);
