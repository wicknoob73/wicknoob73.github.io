// version.js
// STATS_URL è definito globalmente in config.js, caricato prima di questo file.
const VERSION_FALLBACK = 'v0';

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