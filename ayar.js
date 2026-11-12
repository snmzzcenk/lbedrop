// LBE Drop web paneli · ayar: sunucunun (Cloudflare Worker) adresi.
// Yerelde (127.0.0.1 / localhost) yerel sunucuya, yayında canlı sunucuya bağlanır. Yerel deneme: README.md.
window.LBE_API = ["127.0.0.1", "localhost"].includes(location.hostname)
  ? "http://127.0.0.1:8788"
  : "https://lbe-drop-api.evren-vekil.workers.dev";
