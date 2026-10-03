// version.js
// STATS_URLS / fetchStatsWithFallback sono definiti globalmente in
// config.js, caricato prima di questo file.
const VERSION_FALLBACK = 'v0';

async function updateVersion() {
  try {
    const result = await fetchStatsWithFallback('?_=' + Date.now());
    if (!result) throw new Error('Nessun endpoint stats raggiungibile');
    const data = await result.response.json();
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
