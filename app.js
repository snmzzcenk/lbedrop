// LBE Drop web paneli. Statik site; bütün veri sunucudadır (Sunucu/README.md).
// Yükleyici: model yükler, kendi yüklemelerini görür. Yönetici: ayrıca kullanıcıları ve Drive bağlantısını yönetir.
// Model onayı bu panelde yoktur; Windows onay uygulamasındadır (hafifletme ve PC kütüphanesine yazma orada yapılır).
"use strict";

const API = String(window.LBE_API || "").replace(/\/$/, "");
const PANEL_ADRES = location.origin + location.pathname;      // sunucudaki PANEL_ADRESLERI ile birebir aynı olmalı
const MAKS_BOYUT = 50 * 1024 * 1024;
const kok = document.getElementById("kok");
const S = { token: null, ben: null, bildirim: null, yukleme: null, resimler: new Map() };

// ---------- yardımcılar ----------
const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const depo = {
  al(a) { try { return localStorage.getItem(a); } catch { return null; } },
  yaz(a, d) { try { d === null ? localStorage.removeItem(a) : localStorage.setItem(a, d); } catch { /* gizli sekme */ } },
};
const oturumDeposu = {
  al(a) { try { return sessionStorage.getItem(a); } catch { return null; } },
  yaz(a, d) { try { d === null ? sessionStorage.removeItem(a) : sessionStorage.setItem(a, d); } catch { /* gizli sekme */ } },
};
const b64u = (u) => btoa(String.fromCharCode(...new Uint8Array(u))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const boyutYaz = (b) => (b / 1048576).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MB";
const tarihYaz = (iso) => new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const basHarf = (ad) => String(ad || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toLocaleUpperCase("tr") || "?";
const ROL_AD = { yukleyici: "Öğrenci", akademisyen: "Akademisyen", onaylayici: "YUVerse sorumlusu", yonetici: "Sistem yöneticisi" };

const I = {
  ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M4.8 8.2l2.2 2.2 4.2-4.4" fill="none" stroke="var(--bg)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bekle: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  red: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="var(--bg)" stroke-width="2" stroke-linecap="round"/></svg>',
  yukle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  liste: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5h11M9 12h11M9 17.5h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4.5" cy="6.5" r="1.5" fill="currentColor"/><circle cx="4.5" cy="12" r="1.5" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1.5" fill="currentColor"/></svg>',
  kisi: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.500 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.900 7.500 5.500" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  kisiler: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.500 19.500c.6-3 3.100-4.700 6.500-4.700s5.900 1.700 6.500 4.700M16 4.800a3.500 3.500 0 010 6.400M18.500 15.300c1.700.7 2.700 2.100 3 4.200" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  ayar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="7" r="2.200" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="17" r="2.200" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};
const rozet = (sinif, yazi, simge) => `<span class="durum ${sinif}">${simge}${esc(yazi)}</span>`;
// Yükleme aşaması: akademisyen ön onayı → YUVerse sorumlusu onayı → onaylandı / reddedildi.
const yuklemeRozeti = (a) => a === "onaylandi" ? rozet("onaylandi", "Onaylandı", I.ok) : a === "reddedildi" ? rozet("reddedildi", "Reddedildi", I.red) : a === "akademisyen" ? rozet("bekliyor", "Akademisyen onayı bekliyor", I.bekle) : rozet("bekliyor", "YUVerse onayı bekliyor", I.bekle);
const hesapRozeti = (d) => d === "onayli" ? rozet("onaylandi", "Onaylandı", I.ok) : d === "reddedildi" ? rozet("reddedildi", "Reddedildi", I.red) : rozet("bekliyor", "Onay bekliyor", I.bekle);
const bildirimHtml = (b) => b ? `<div class="bildirim ${b.tur}" role="${b.tur === "bad" ? "alert" : "status"}">${(b.tur === "ok" ? I.ok : b.tur === "bad" ? I.red : I.bekle).replace("<svg ", '<svg class="simge" ')}<span>${b.kalin ? `<b>${esc(b.kalin)}</b> ` : ""}${esc(b.yazi)}</span></div>` : "";
const logo = (sinif = "") => `<img class="logo-acik ${sinif}" src="marka/logo/lbe-drop_logo_yatay-siyah_oneri-v1.svg" alt="LBE Drop"><img class="logo-koyu ${sinif}" src="marka/logo/lbe-drop_logo_yatay-beyaz_oneri-v1.svg" alt="">`;

class ApiHata extends Error { constructor(kod, mesaj) { super(mesaj); this.kod = kod; } }
async function api(yol, { yontem = "GET", govde } = {}) {
  let y;
  try {
    y = await fetch(API + yol, { method: yontem, headers: { ...(S.token ? { Authorization: "Bearer " + S.token } : {}), ...(govde ? { "Content-Type": "application/json" } : {}) }, body: govde ? JSON.stringify(govde) : undefined });
  } catch { throw new ApiHata(0, "Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip yeniden dene."); }
  const v = await y.json().catch(() => ({}));
  if (y.status === 401 && S.token) { oturumuUnut(); ciz(); }
  if (!y.ok) throw new ApiHata(y.status, v.error || "Beklenmeyen bir hata oluştu.");
  return v;
}
function oturumuUnut() { S.token = null; S.ben = null; S.resimler.clear(); depo.yaz("lbe-token", null); }

// ---------- 3B ön izleme (kutuphane/model-viewer.min.js; ilk kullanımda yüklenir) ----------
function izleyiciYukle() {
  return S.izleyici || (S.izleyici = new Promise((tamam, olmadi) => {
    const s = document.createElement("script");
    s.type = "module"; s.src = "kutuphane/model-viewer.min.js";
    s.onload = tamam;
    s.onerror = () => { S.izleyici = null; s.remove(); olmadi(new Error("3B ön izleme yüklenemedi; sayfayı yenileyip yeniden dene.")); };
    document.head.append(s);
  }));
}
// Verilen kutuya modeli koyar. kaynak: Blob ya da File. Dönen işlev kaynağı bırakır.
// Ön izlemenin görüntüsünü 320×240'a küçültür (WebP; tarayıcı desteklemezse PNG).
async function kucukResim(m) {
  const t = document.createElement("canvas"), G = 320, Y = 240, c = t.getContext("2d", { willReadFrequently: true });
  t.width = G; t.height = Y;
  // Model henüz çizilmemişse görüntü boş gelir; dolu gelene kadar birkaç kez denenir.
  for (let deneme = 0, dolu = false; !dolu; deneme++) {
    if (deneme === 6 || !m.isConnected) return null;
    await new Promise((s) => setTimeout(s, 350));
    const b = await createImageBitmap(await m.toBlob({ idealAspect: true })), o = Math.min(G / b.width, Y / b.height);
    c.clearRect(0, 0, G, Y);
    c.drawImage(b, (G - b.width * o) / 2, (Y - b.height * o) / 2, b.width * o, b.height * o);
    const v = c.getImageData(0, 0, G, Y).data;
    for (let i = 3; i < v.length; i += 16) if (v[i]) { dolu = true; break; }
  }
  const r = await new Promise((coz) => t.toBlob(coz, "image/webp", 0.82));
  return r && r.size <= 200000 ? r : null;
}
// Büyük modelin hafif ön izleme kopyası (hafif.js): üretilirse Drive'a gider; üretilemezse ön izleme asıl dosyayı açar.
const HAFIF_ESIK = 2 * 1024 * 1024;
async function hafifGonder(id, dosya) {
  const { hafifKopya } = await import("./hafif.js");
  const k = await hafifKopya(await dosya.arrayBuffer());
  if (!k) return;
  const a = await api(`/yuklemeler/${id}/onizleme`, { yontem: "POST", govde: { boyut: k.length } });
  const y = await fetch(a.yukle_url, { method: "PUT", headers: { "Content-Type": "model/gltf-binary" }, body: k });
  if (!y.ok) throw new Error("Ön izleme kopyası yüklenemedi.");
  await api(`/yuklemeler/${id}/onizleme/bitti`, { yontem: "POST" });
}
async function resimGonder(id, resim) {
  const y = await fetch(API + `/yuklemeler/${encodeURIComponent(id)}/resim`, { method: "PUT", headers: { Authorization: "Bearer " + S.token, "Content-Type": resim.type }, body: resim });
  if (!y.ok) throw new Error("Resim kaydedilemedi.");
  S.resimler.delete(id);
}
// Listelerdeki küçük resim kutusu; tıklanınca ön izleme açılır. Resmi olan kutular görünür olunca doldurulur.
const resimKutusu = (m) => `<button type="button" class="yk-resim" data-onizle="${esc(m.id)}" data-ad="${esc(m.model_adi)}" data-resim="${esc(m.id)}"${m.resim ? " data-var" : ""}${m.onizleme ? " data-hafif" : ""} aria-label="Ön izle: ${esc(m.model_adi)}">3B</button>`;
function resimAdresi(id) {
  if (!S.resimler.has(id)) S.resimler.set(id, fetch(API + `/yuklemeler/${encodeURIComponent(id)}/resim`, { headers: { Authorization: "Bearer " + S.token } })
    .then((y) => { if (!y.ok) throw new Error(); return y.blob(); }).then((b) => URL.createObjectURL(b)).catch(() => { S.resimler.delete(id); return null; }));
  return S.resimler.get(id);
}
async function resimDoldur(k) {
  const adres = await resimAdresi(k.dataset.resim);
  if (!adres || !k.isConnected) return;
  const r = new Image(); r.alt = ""; r.src = adres;
  k.replaceChildren(r); k.setAttribute("data-var", "");
}
function resimleriBagla(kap) {
  const g = new IntersectionObserver((kayitlar) => kayitlar.forEach((e) => { if (e.isIntersecting) { g.unobserve(e.target); resimDoldur(e.target); } }), { rootMargin: "200px" });
  kap.querySelectorAll("[data-resim][data-var]").forEach((k) => g.observe(k));
}
async function izleyiciKur(kutu, kaynak, resimHazir, acilamadi) {
  kutu.innerHTML = '<p class="yardim">Ön izleme hazırlanıyor…</p>';
  const adres = URL.createObjectURL(kaynak), birak = () => URL.revokeObjectURL(adres);
  try { await izleyiciYukle(); } catch (x) { birak(); kutu.innerHTML = `<p class="yardim">${esc(x.message)}</p>`; return () => {}; }
  const m = document.createElement("model-viewer");
  m.className = "izleyici"; m.src = adres;
  for (const [ad, deger] of [["loading", "eager"], ["camera-controls", ""], ["auto-rotate", ""], ["shadow-intensity", "0.6"], ["interaction-prompt", "none"], ["alt", "Modelin 3B ön izlemesi"]]) m.setAttribute(ad, deger);
  m.addEventListener("error", () => { if (acilamadi) return acilamadi(); kutu.innerHTML = '<p class="yardim">Model açılamadı. Dosya bozuk olabilir ya da desteklenmeyen sıkıştırma (Draco, meshopt, KTX2) içeriyor olabilir.</p>'; });
  if (resimHazir) m.addEventListener("load", () => { kucukResim(m).then((r) => { if (r) resimHazir(r); }).catch(() => {}); }, { once: true });
  kutu.innerHTML = ""; kutu.append(m);
  const ipucu = document.createElement("p");
  ipucu.className = "yardim"; ipucu.textContent = "Sürükleyerek döndür, kaydırarak yaklaştır.";
  kutu.append(ipucu);
  return birak;
}
// Yüklenmiş bir modeli pencerede gösterir; dosya sunucudan oturumla alınır.
async function onIzle(id, ad) {
  const p = document.getElementById("onizleme"), govde = document.getElementById("onizleme-govde");
  document.getElementById("onizleme-baslik").textContent = ad || "Ön izleme";
  let birak = () => {}, kapandi = false, sira = 0;
  p.onclose = () => { kapandi = true; birak(); govde.innerHTML = ""; };
  document.getElementById("onizleme-kapat").onclick = () => p.close();
  p.showModal();
  const k = document.querySelector(`[data-resim="${CSS.escape(id)}"]`);
  // hafif: panelin ürettiği küçültülmüş kopya. Açılamazsa ya da istenirse asıl dosyaya geçilir.
  const ac = async (hafif) => {
    const bu = ++sira, eskimis = () => kapandi || bu !== sira;
    birak(); birak = () => {};
    govde.innerHTML = '<p class="yardim">Model indiriliyor…</p>';
    try {
      const y = await fetch(API + `/yuklemeler/${encodeURIComponent(id)}/dosya${hafif ? "?onizleme=1" : ""}`, { headers: { Authorization: "Bearer " + S.token } });
      if (y.status === 401) { p.close(); oturumuUnut(); ciz(); return; }
      if (!y.ok) throw new Error((await y.json().catch(() => ({}))).error || "Model alınamadı.");
      const dosya = await y.blob();
      if (eskimis()) return;
      const b = await izleyiciKur(govde, dosya, k && !k.hasAttribute("data-var") ? (r) => resimGonder(id, r).then(() => resimDoldur(k)).catch(() => {}) : null, hafif ? () => { if (!eskimis()) ac(false); } : null);
      if (eskimis()) return b();
      birak = b;
      if (hafif) {
        const not = document.createElement("p");
        not.className = "yardim";
        not.innerHTML = `Hızlı açılması için hafif ön izleme kopyası gösteriliyor (${boyutYaz(dosya.size)}). <button type="button" class="baglanti">Tam modeli göster</button>`;
        not.querySelector("button").onclick = () => ac(false);
        govde.append(not);
      }
    } catch (x) { if (!eskimis()) govde.innerHTML = `<p class="yardim">${esc(x instanceof TypeError ? "Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip yeniden dene." : x.message)}</p>`; }
  };
  ac(!!k && k.hasAttribute("data-hafif"));
}
const onIzleDugmesi = (m) => `<button type="button" class="btn btn-kucuk" data-onizle="${esc(m.id)}" data-ad="${esc(m.model_adi)}">Ön izle</button>`;
const onIzleBagla = (kap) => { kap.querySelectorAll("[data-onizle]").forEach((b) => { b.onclick = () => onIzle(b.dataset.onizle, b.dataset.ad); }); resimleriBagla(kap); };

// Bölüm seçme kutusu. secili: bölüm id'si ya da boş; bos: ilk (boş değerli) seçeneğin yazısı.
const bolumSecenek = (bolumler, secili, bos) => `<option value="">${esc(bos)}</option>${bolumler.map((b) => `<option value="${b.id}"${String(b.id) === String(secili ?? "") ? " selected" : ""}>${esc(b.ad)}</option>`).join("")}`;

// Onay diyaloğu: Promise<boolean>
function sor(baslik, metin, dugme) {
  const d = document.getElementById("soru");
  document.getElementById("soru-baslik").textContent = baslik;
  document.getElementById("soru-metin").textContent = metin;
  document.getElementById("soru-evet").textContent = dugme;
  return new Promise((coz) => {
    const bitir = (v) => { d.close(); d.onclose = null; coz(v); };
    document.getElementById("soru-evet").onclick = () => bitir(true);
    document.getElementById("soru-hayir").onclick = () => bitir(false);
    d.onclose = () => coz(false);
    d.showModal();
  });
}

// ---------- giriş (PKCE): sunucu Google'a yönlendirir, dönüşte ?kod= gelir ----------
async function girisBaslat() {
  const dogrulayici = b64u(crypto.getRandomValues(new Uint8Array(32)));
  oturumDeposu.yaz("lbe-dogrulayici", dogrulayici);
  const ozet = b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(dogrulayici)));
  location.href = `${API}/giris/baslat?donus=${encodeURIComponent(PANEL_ADRES)}&kod_ozeti=${ozet}`;
}
async function girisDonusu() {
  const q = new URLSearchParams(location.search), kod = q.get("kod"), hata = q.get("hata");
  if (!kod && !hata) return;
  history.replaceState(null, "", location.pathname + location.hash);      // kod adres çubuğunda kalmasın
  if (hata) { S.bildirim = { tur: "bad", kalin: "Giriş yapılamadı.", yazi: hata }; return; }
  const dogrulayici = oturumDeposu.al("lbe-dogrulayici");
  oturumDeposu.yaz("lbe-dogrulayici", null);
  try {
    const v = await api("/giris/oturum", { yontem: "POST", govde: { kod, dogrulayici } });
    S.token = v.token; S.ben = v.ben; depo.yaz("lbe-token", v.token);
  } catch (e) { S.bildirim = { tur: "bad", kalin: "Giriş yapılamadı.", yazi: e.message }; }
}
async function cikis() {
  try { await api("/cikis", { yontem: "POST" }); } catch { /* oturum zaten düşmüş olabilir */ }
  oturumuUnut(); S.bildirim = null; location.hash = ""; ciz();
}

// ---------- ekranlar: giriş, ilk giriş, onay bekliyor ----------
// ---------- Tanıtım (giriş yapmamış ziyaretçinin gördüğü ana sayfa) ----------
// İzometrik çizimler: her adım küçük bir sahne. Renkler panel.css'teki --iz-* değişkenlerinden gelir (açık ve koyu tema).
const izo = (() => {
  const N = (x, y, z) => `${(100 + (x - y) * 0.866).toFixed(1)},${(70 + (x + y) * 0.5 - z).toFixed(1)}`;
  const yuz = (n, s) => `<polygon class="${s}" points="${n.map((p) => N(...p)).join(" ")}"/>`;
  const kutu = (x, y, z, w, d, h, r = "n") =>
    yuz([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], `iz-${r}1`) +
    yuz([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], `iz-${r}2`) +
    yuz([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], `iz-${r}3`);
  const tik = (x, z, y) => `<polyline class="iz-ok" points="${[[x, y, z + 9], [x + 7, y, z], [x + 20, y, z + 18]].map((p) => N(...p)).join(" ")}"/>`;
  const sahne = (ic) => `<svg class="izo" viewBox="0 -18 200 150" aria-hidden="true">${kutu(-45, -45, -8, 90, 90, 8, "z")}${ic}</svg>`;
  return {
    yukle: sahne(kutu(-28, -16, 0, 44, 32, 3) + kutu(-28, -16, 3, 3, 32, 28) + kutu(14, 16, 12, 16, 16, 16, "a")),
    sakla: sahne(kutu(-34, -24, 0, 30, 38, 12) + kutu(-34, -24, 14, 30, 38, 12) + kutu(-34, -24, 28, 30, 38, 12) + kutu(10, -2, 0, 26, 30, 14) + kutu(17, 7, 14, 12, 12, 12, "a")),
    onOnay: sahne(kutu(-26, -8, 0, 46, 4, 50) + tik(-13, 18, -3.8) + kutu(16, 16, 0, 14, 14, 14, "a")),
    sonOnay: sahne(kutu(-32, -8, 0, 58, 4, 50) + tik(-25, 18, -3.8) + tik(-1, 18, -3.8) + kutu(18, 16, 0, 14, 14, 14, "a")),
    sahnede: sahne(kutu(8, -34, 0, 14, 26, 32) + kutu(-22, -14, 0, 6, 6, 10) + kutu(-36, -13, 10, 34, 4, 26) + kutu(8, 8, 0, 24, 24, 6) + kutu(13, 13, 6, 14, 14, 14, "a")),
  };
})();
// YUVerse sahnesi: 30 gözlük yeri (4'ü dolu, kalanı soluk), ortada parçalarına ayrılmış matkap modeli, yanında anlatan oturum yöneticisi.
const yuverseSahne = (() => {
  const n = (x, y, z = 0) => [332 + (x - y) * 0.866, 120 + (x + y) * 0.5 - z];
  const N = (x, y, z) => n(x, y, z).map((v) => v.toFixed(1)).join(",");
  const yuz = (k, s) => `<polygon class="${s}" points="${k.map((p) => N(...p)).join(" ")}"/>`;
  const kutu = (x, y, z, w, d, h, r = "n") =>
    yuz([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], `iz-${r}1`) +
    yuz([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], `iz-${r}2`) +
    yuz([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], `iz-${r}3`);
  const kilavuz = (a, b) => `<polyline class="iz-kilavuz" points="${N(...a)} ${N(...b)}"/>`;
  const kisi = (x, y, tur) => {
    const [sx, sy] = n(x, y);
    return `<g class="iz-kisi ${tur}" transform="translate(${sx.toFixed(1)} ${sy.toFixed(1)})"><ellipse class="iz-golge" rx="13" ry="6"/><rect class="iz-beden" x="-8" y="-36" width="16" height="34" rx="8"/>${
      tur === "hoca" ? '<path class="iz-kol" d="M-5 -27 L-27 -47"/><circle class="iz-beden" cx="-28" cy="-48" r="4"/>' : ""}<circle class="iz-beden" cy="-45" r="8"/><rect class="iz-gozluk" x="-9" y="-49" width="18" height="7" rx="3"/></g>`;
  };
  // Yatay silindir ya da koni (ekseni x boyunca): iki uç dairenin dış zarfı gövde, öndeki daire kapak.
  const zarf = (ns) => {
    const s = [...ns].sort((p, q) => p[0] - q[0] || p[1] - q[1]), cap = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
    const yari = (d) => { const h = []; for (const p of d) { while (h.length > 1 && cap(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); } h.pop(); return h; };
    return [...yari(s), ...yari(s.reverse())];
  };
  const cokgen = (ns, s, ek = "") => `<polygon class="${s}"${ek} points="${ns.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}"/>`;
  // Ortadaki model: parçalarına ayrılmış bir akülü matkap. Ekseni x boyunca (ucu öne), y=180, z=Z. Özgün çizimdir.
  // İç parçalar dönel gövdelerdir (profil + ışık geçişi); gövde iki yarım kabuk olarak öne ve arkaya açılmıştır.
  const Z = 262, yuzey = (x, r, a) => n(x, 180 + r * Math.cos(a), Z + r * Math.sin(a)), DER = Math.PI / 180;
  const daire = (x, r) => Array.from({ length: 28 }, (_, i) => yuzey(x, r, i * Math.PI / 14));
  let gecisler = "", gNo = 0;
  const donel = (c, ...pr) => {   // pr: [x, yarıçap] noktaları, arkadan öne
    const [x0] = pr[0], [x1, r1] = pr[pr.length - 1], R = Math.max(...pr.map((q) => q[1])), [cx, cy] = n((x0 + x1) / 2, 180, Z), id = `izg${gNo++}`;
    gecisler += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${(cx + 0.61 * R).toFixed(1)}" y1="${(cy - 1.06 * R).toFixed(1)}" x2="${(cx - 0.61 * R).toFixed(1)}" y2="${(cy + 1.06 * R).toFixed(1)}"><stop offset=".05" class="st-${c}1"/><stop offset=".5" class="st-${c}2"/><stop offset="1" class="st-${c}3"/></linearGradient>`;
    return cokgen(zarf(pr.flatMap(([x, r]) => daire(x, r))), "iz-s", ` fill="url(#${id})"`) + cokgen(daire(x1, r1), `iz-s iz-${c}3`);
  };
  const yol = (ns, s) => `<polyline class="${s}" points="${ns.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ")}"/>`;
  const halka = (x, r, s = "iz-oluk") => yol(Array.from({ length: 13 }, (_, i) => yuzey(x, r, (-45 + i * 15) * DER)), s);          // görünen yarıdaki oluk
  const boyuna = (x0, x1, r0, r1, adim, s = "iz-oluk") => { let c = ""; for (let a = -36; a <= 126; a += adim) c += yol([yuzey(x0, r0, a * DER), yuzey(x1, r1, a * DER)], s); return c; };
  const sarmal = (x0, x1, r, faz) => { const ns = []; for (let x = x0; x <= x1; x += 1.5) { const a = ((x - x0) * 14 + faz) % 360; if (a > 315 || a < 135) ns.push(yuzey(x, r, a * DER)); else if (ns.length) ns.push(null); }
    return ns.reduce((g, q) => (q ? g[g.length - 1].push(q) : g.push([]), g), [[]]).filter((g) => g.length > 1).map((g) => yol(g, "iz-oluk")).join(""); };
  const mat = (y) => `matrix(.866 .5 0 -1 ${(332 - 0.866 * y).toFixed(1)} ${(120 + 0.5 * y - Z).toFixed(1)})`;   // (x, eksenden yükseklik) düzlemini sahneye taşır
  const kalip = (d, y0, y1, yan, yuzS, detay = "") => { let c = ""; for (let y = y0; y < y1; y += 2) c += `<path d="${d}" transform="${mat(y)}" class="${yan}"/>`; return c + `<g transform="${mat(y1)}"><path d="${d}" class="iz-s ${yuzS}"/>${detay}</g>`; };
  const vida = (x, y, z) => { const [cx, cy] = n(x, y, z); return `<path class="iz-s iz-n2" d="M${(cx - 3).toFixed(1)} ${(cy - 6).toFixed(1)}v6a3 1.7 0 0 0 6 0v-6z"/><ellipse class="iz-s iz-n1" cx="${cx.toFixed(1)}" cy="${(cy - 6).toFixed(1)}" rx="3" ry="1.7"/>`; };
  const KABUK = "M150 27H286Q300 27 300 16V-14Q300 -27 288 -27H264L258 -44L250 -96L266 -104V-116H196V-104L212 -98L222 -27H150Q138 -27 138 -15V15Q138 27 150 27Z";
  const bos = [[146, 18], [290, 14], [150, -18], [258, -34], [206, -110], [256, -110]];
  const disYuz = `<path class="iz-a2" d="M226 -38H253L247 -92H219Z"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path class="iz-acik" d="M${224 - i * 0.9} ${-46 - i * 7}H${250 - i * 0.9}"/>`).join("")}`
    + [0, 1, 2, 3].map((i) => `<path class="iz-oluk" d="M${152 + i * 8} -13L${158 + i * 8} 13"/>`).join("") + `<rect class="iz-a2" x="198" y="-9" width="62" height="18" rx="4"/><path class="iz-acik" d="M206 0H252"/>`
    + bos.map(([x, w]) => `<circle class="iz-vida" cx="${x}" cy="${w}" r="2.8"/>`).join("");
  const icYuz = `<path class="iz-oluk" d="M150 20H286Q293 20 293 13V-12Q293 -20 286 -20H229L221 -92H249L256 -44"/>${[176, 214, 262].map((x) => `<path class="iz-oluk" d="M${x} -20V20"/>`).join("")}`
    + bos.map(([x, w]) => `<circle class="iz-s iz-z3" cx="${x}" cy="${w}" r="4.5"/><circle class="iz-vida" cx="${x}" cy="${w}" r="1.8"/>`).join("");
  const model = kutu(218, 138, 0, 84, 84, 10) + kilavuz([241, 180, 10], [241, 180, Z - 170])                  // kaide (sergi)
    + kalip(KABUK, 108, 116, "iz-z3", "iz-z1", icYuz)                                                          // arka yarım kabuk (içi görünür)
    + kilavuz([146, 116, Z + 18], [146, 250, Z + 18]) + kilavuz([290, 116, Z + 14], [290, 250, Z + 14]) + kilavuz([206, 116, Z - 110], [206, 250, Z - 110])
    + kutu(206, 156, Z - 170, 70, 48, 30, "a") + [0, 1, 2, 3].map((i) => kutu(218 + i * 11, 204, Z - 158, 6, 1.5, 5)).join("") + kutu(226, 168, Z - 140, 36, 24, 4)   // batarya, şarj ışıkları, kızak
    + kutu(230, 170, Z - 118, 32, 20, 8)                                                                       // bağlantı soketi
    + `<g transform="${mat(180)}"><path class="iz-kablo" d="M240 -66C236 -84 250 -92 244 -110"/><path class="iz-kablo k2" d="M250 -66C258 -84 242 -94 252 -110"/></g>`   // kablolar
    + kutu(234, 173, Z - 66, 22, 14, 22)                                                                       // anahtar
    + kalip("M257 -28C274 -32 277 -50 268 -64H259Z", 175, 185, "iz-a3", "iz-a2")                               // tetik
    + kilavuz([116, 180, Z], [476, 180, Z])
    + donel("a", [118, 8], [126, 8]) + donel("n", [130, 21], [136, 21]) + boyuna(130, 136, 21, 21, 18)         // arka yatak, fan
    + donel("n", [146, 22], [150, 25], [206, 25], [210, 22]) + halka(158, 25.2) + halka(198, 25.2) + halka(178, 25.6, "iz-bant") + boyuna(163, 172, 25.2, 25.2, 27) + boyuna(184, 193, 25.2, 25.2, 27)   // motor
    + donel("n", [212, 3.5], [224, 3.5]) + donel("a", [222, 8.5], [231, 8.5]) + boyuna(222, 231, 8.6, 8.6, 18, "iz-acik")   // mil, pinyon
    + donel("n", [243, 22], [251, 22]) + boyuna(243, 251, 22.2, 22.2, 9)                                       // halka dişli
    + donel("a", [262, 19], [265, 22], [288, 22], [292, 19]) + halka(270, 22.2, "iz-acik") + halka(284, 22.2, "iz-acik")   // dişli kutusu
    + donel("n", [302, 13], [309, 13])                                                                         // rulman
    + donel("n", [318, 21], [320, 23], [334, 23], [338, 20]) + boyuna(322, 333, 23.2, 23.2, 12) + halka(336, 21.6, "iz-bant")   // tork bileziği
    + donel("a", [350, 13], [354, 19], [372, 19], [384, 12], [388, 11]) + boyuna(356, 371, 19.2, 19.2, 10, "iz-acik") + halka(377, 16.4, "iz-acik")   // mandren
    + donel("n", [394, 8], [404, 4])                                                                           // çeneler
    + donel("n", [410, 3.2], [462, 3.2]) + sarmal(412, 461, 3.3, 0) + sarmal(412, 461, 3.3, 180) + donel("a", [462, 3.2], [470, 0.5])   // matkap ucu
    + kalip(KABUK, 250, 258, "iz-n3", "iz-n1", disYuz)                                                         // ön yarım kabuk (dışı görünür)
    + vida(146, 214, Z + 22) + vida(290, 214, Z + 18) + vida(206, 214, Z - 106) + vida(146, 150, Z + 22) + vida(290, 150, Z + 18);
  const X7 = [40, 113, 187, 260, 333, 407, 480], X6 = X7.filter((x) => x !== 260), X4 = [40, 113, 407, 480];
  const DOLU = new Set(["113,180", "480,180", "187,255", "333,105"]);
  const ogeler = [[30, X7], [105, X6], [180, X4], [255, X6], [330, X7]].flatMap(([y, xs]) => xs.map((x) => ({ d: x + y, s: kisi(x, y, DOLU.has(`${x},${y}`) ? "dolu" : "bos") })));   // 30 yer
  ogeler.push({ d: 441, s: model }, { d: 578, s: kisi(372, 206, "hoca") });
  ogeler.sort((a, b) => a.d - b.d);
  return `<svg class="izo izo-buyuk" viewBox="0 -62 802 647" role="img" aria-label="YUVerse laboratuvarı: ortada parçalarına ayrılmış bir matkap modeli, yanında anlatan oturum yöneticisi, çevresinde VR gözlüklü katılımcılar ve 30 gözlük yeri"><defs>${gecisler}</defs>${kutu(0, 0, -12, 520, 360, 12, "z")}${ogeler.map((o) => o.s).join("")}<polyline class="iz-etiket-cizgi" points="480,92 524,50"/><polyline class="iz-etiket-cizgi" points="476,347 476,330"/><polyline class="iz-etiket-cizgi" points="266,208 236,186"/></svg>`;
})();
const ADIMLAR = [
  [izo.yukle, "Yükle", "Panele gir, .glb dosyanı ve proje bilgilerini gönder."],
  [izo.sakla, "Saklanır", "Dosya laboratuvarın Drive'ına, kayıt sunucuya yazılır."],
  [izo.onOnay, "Akademisyen ön onayı", "Seçtiğin akademisyen modeli inceler; ön onay verir ya da notla reddeder."],
  [izo.sonOnay, "YUVerse son onayı", "YUVerse sorumlusu son kararı verir."],
  [izo.sahnede, "Sahnede", "Model lab bilgisayarına iner; LBE AddPlay'de ad soyadın, proje adın ve yükleme zamanınla görünür."],
];
const ROL_ACIKLAMA = [
  ["Öğrenci", "Model yükler, yüklemelerinin aşamasını ve ret notunu görür."],
  ["Akademisyen", "Öğrenciyle aynı. Ayrıca kendisini seçen yüklemelere ön onay verir."],
  ["YUVerse sorumlusu", "Bütün yüklemeleri görür, son onayı verir, modeli lab bilgisayarına indirtir."],
  ["Sistem yöneticisi", "Hepsini yapar. Ayrıca hesapları onaylar, rolleri atar, Drive ve e-postayı bağlar."],
];

function girisEkrani() {
  if (S.kodAdimi) return kodEkrani();
  const kodlu = S.kodGiris, kip = kodlu && S.girisKipi ? S.girisKipi : "giris";   // giris | kayit | unuttum
  const epostaAlani = `<label class="alan">E-posta<input class="girdi" name="eposta" type="email" inputmode="email" autocomplete="username" placeholder="ad.soyad@ornek.edu.tr" maxlength="200" value="${esc(S.sonEposta || "")}"><span class="alan-hata" id="eposta-hata" hidden></span></label>`;
  const kutuIci = kip === "giris" ? `
    <div><h2>Giriş yap</h2><p class="yardim" style="margin:6px 0 0">3B modelini LBE AddPlay'e göndermek için giriş yap.</p></div>
    ${bildirimHtml(S.bildirim)}
    <form id="sifre-form" novalidate>
      ${epostaAlani}
      <label class="alan">Şifre<input class="girdi" name="sifre" type="password" autocomplete="current-password" maxlength="200"></label>
      <button class="btn btn-birincil btn-tam" id="sifre-gir">Giriş yap</button>
    </form>
    ${kodlu ? `<div class="baglantilar"><button type="button" class="baglanti" data-kip="kayit">Hesabın yok mu? Kayıt ol</button><button type="button" class="baglanti" data-kip="unuttum">Şifremi unuttum</button></div>` : ""}
    <div class="ya-da"><span>ya da</span></div>
    <button type="button" class="btn btn-tam" id="giris">Google ile giriş yap</button>
    <p class="yardim" style="margin:0">Hesabın ilk girişte onay bekler; yönetici onaylayınca model yükleyebilirsin.</p>` : `
    <div><h2>${kip === "kayit" ? "Kayıt ol" : "Şifreni yenile"}</h2><p class="yardim" style="margin:6px 0 0">${kip === "kayit"
      ? "Adresine 6 haneli bir kod göndeririz. Kodu yazıp şifreni belirlersin; sonraki girişlerde yalnız şifren sorulur."
      : "Adresine 6 haneli bir kod göndeririz. Kodu yazıp yeni şifreni belirlersin."}</p></div>
    ${bildirimHtml(S.bildirim)}
    <form id="eposta-form" novalidate>
      ${epostaAlani}
      <button class="btn btn-birincil btn-tam" id="kod-iste">Kod gönder</button>
    </form>
    <div class="baglantilar"><button type="button" class="baglanti" data-kip="giris">Giriş ekranına dön</button></div>`;
  kok.innerHTML = `<div class="tanitim">
  <header class="tn-ust">${logo("logo")}<a class="btn btn-kucuk" href="#giris-kutu">Giriş yap</a></header>
  <section class="tn-kahraman">
  <div><h1>3B modelini yükle, LBE AddPlay'de gör</h1><p class="tn-alt">LBE Drop, Yaşar Üniversitesi YUVerse laboratuvarının model yükleme aracıdır. Modelin iki onaydan geçer ve laboratuvardaki VR oyununda gösterilir.</p></div>
  <div class="kutu" id="giris-kutu">${kutuIci}
  </div></section>
  <section><h2 class="tn-baslik">Nasıl çalışır</h2>
    <ol class="tn-adimlar">${ADIMLAR.map(([c, a, m], i) => `<li>${c}<div><span class="tn-no">${i + 1}. ADIM</span><b>${a}</b><p>${m}</p></div></li>`).join("")}</ol></section>
  <section class="tn-sahne"><h2 class="tn-baslik">YUVerse'te 30 gözlük, tek model</h2>
    <p class="tn-alt">Onaylanan model laboratuvarda aynı anda 30 VR gözlüğünde görünür. Oturum yöneticisi modeli parçalarına ayırarak anlatabilir.</p>
    <div class="tn-cizim">${yuverseSahne}<span class="tn-etiket" style="left:65.3%;top:17.3%">3D model</span><span class="tn-etiket ustte" style="left:59.35%;top:59%">Yönetici</span><span class="tn-etiket sola" style="left:29.4%;top:38.3%">İzleyici <b>×30</b></span></div>
    <ul class="tn-anahtar"><li><i class="an-hoca"></i>Oturum yöneticisi: modeli parçalarına ayırır</li><li><i class="an-kisi"></i>İzleyici: gözlüklü katılımcı</li><li><i class="an-bos"></i>Boş yerler: aynı anda 30 gözlüğe kadar</li></ul></section>
  <section><h2 class="tn-baslik">Roller</h2>
    <div class="tn-roller">${ROL_ACIKLAMA.map(([a, m]) => `<div class="kutu"><b>${a}</b><p>${m}</p></div>`).join("")}</div>
    <p class="yardim" style="margin:16px 0 0">Yeni hesap öğrenci olarak başlar ve yönetici onayını bekler. Rolleri sistem yöneticisi atar.</p></section>
  <footer class="yardim"><a href="gizlilik.html">Gizlilik</a></footer>
  </div>`;
  S.bildirim = null;
  const kutu = document.getElementById("giris-kutu"), hata = document.getElementById("eposta-hata");
  const goster = (m) => { hata.innerHTML = I.red.replace("<svg ", '<svg class="simge" ') + esc(m); hata.hidden = false; kutu.querySelector("[name=eposta]").classList.add("hatali"); };
  const epostaOku = (form) => { const e = form.eposta.value.trim().toLowerCase(); S.sonEposta = e; if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return e; goster("E-posta adresini kontrol et."); return null; };
  kutu.querySelectorAll("[data-kip]").forEach((b) => { b.onclick = () => { const f = kutu.querySelector("form"); if (f) S.sonEposta = f.eposta.value.trim(); S.girisKipi = b.dataset.kip; ciz(); document.getElementById("giris-kutu").querySelector("[name=eposta]").focus(); }; });
  const google = document.getElementById("giris");
  if (google) google.onclick = (e) => { e.currentTarget.disabled = true; girisBaslat(); };
  const sifreForm = document.getElementById("sifre-form");
  if (sifreForm) sifreForm.onsubmit = async (e) => {
    e.preventDefault();
    const eposta = epostaOku(sifreForm), dugme = document.getElementById("sifre-gir");
    if (!eposta) return;
    if (!sifreForm.sifre.value) { sifreForm.sifre.classList.add("hatali"); sifreForm.sifre.focus(); return; }
    dugme.disabled = true; dugme.textContent = "Giriş yapılıyor…";
    try {
      const v = await api("/giris/sifre", { yontem: "POST", govde: { eposta, sifre: sifreForm.sifre.value } });
      S.token = v.token; S.ben = v.ben; depo.yaz("lbe-token", v.token); ciz();
    } catch (x) { dugme.disabled = false; dugme.textContent = "Giriş yap"; sifreForm.sifre.value = ""; goster(x.message); }
  };
  const form = document.getElementById("eposta-form");
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    const eposta = epostaOku(form), dugme = document.getElementById("kod-iste");
    if (!eposta) return;
    dugme.disabled = true; dugme.textContent = "Kod gönderiliyor…";
    try {
      const v = await api("/giris/kod/iste", { yontem: "POST", govde: { eposta } });
      S.kodAdimi = { eposta, kip, yeniden: Date.now() + (v.bekle || 60) * 1000, dakika: v.gecerli_dakika || 10 };
      ciz();
    } catch (x) { dugme.disabled = false; dugme.textContent = "Kod gönder"; goster(x.message); }
  };
}
// Kayıt ve şifre yenilemenin ikinci adımı: gelen 6 haneli kod yazılır ve şifre belirlenir.
function kodEkrani() {
  const k = S.kodAdimi;
  kok.innerHTML = `<div class="orta"><div class="kutu">
    ${logo("logo")}
    <div><h1>Kodu yaz</h1><p class="yardim" style="margin:6px 0 0"><b>${esc(k.eposta)}</b> adresine 6 haneli bir kod gönderdik. Kod ${k.dakika} dakika geçerli. Gelmediyse spam klasörüne bak.</p></div>
    ${bildirimHtml(S.bildirim)}
    <form id="kod-form" novalidate>
      <input type="email" name="eposta" value="${esc(k.eposta)}" autocomplete="username" hidden>
      <label class="alan">Kod<input class="girdi kod-girdi sayisal" name="kod" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" placeholder="000000"><span class="alan-hata" id="kod-hata" hidden></span></label>
      <label class="alan">${k.kip === "unuttum" ? "Yeni şifre" : "Şifre"}<input class="girdi" name="sifre" type="password" autocomplete="new-password" maxlength="200"><span class="ek">En az 8 karakter.</span></label>
      <label class="alan">Şifre (yeniden)<input class="girdi" name="sifre2" type="password" autocomplete="new-password" maxlength="200"><span class="alan-hata" id="sifre-hata" hidden></span></label>
      <button class="btn btn-birincil btn-tam" id="kod-gir">${k.kip === "unuttum" ? "Şifreyi yenile" : "Kaydı tamamla"}</button>
    </form>
    <div class="dugmeler"><button type="button" class="btn btn-kucuk" id="yeni-kod" disabled>Yeni kod iste</button><button type="button" class="btn btn-kucuk" id="adres-degis">Adresi değiştir</button></div>
  </div></div>`;
  S.bildirim = null;
  const form = document.getElementById("kod-form"), hata = document.getElementById("kod-hata"), yeni = document.getElementById("yeni-kod"), gir = document.getElementById("kod-gir");
  const sifreHata = document.getElementById("sifre-hata"), girYazi = gir.textContent;
  const goster = (m, sifre) => {
    hata.hidden = sifreHata.hidden = true; form.kod.classList.remove("hatali"); form.sifre.classList.remove("hatali"); form.sifre2.classList.remove("hatali");
    const yer = sifre ? sifreHata : hata; yer.innerHTML = I.red.replace("<svg ", '<svg class="simge" ') + esc(m); yer.hidden = false; (sifre || form.kod).classList.add("hatali"); (sifre || form.kod).focus();
  };
  const say = () => {
    if (!yeni.isConnected || S.kodAdimi !== k) return;
    const kalan = Math.ceil((k.yeniden - Date.now()) / 1000);
    yeni.disabled = kalan > 0; yeni.textContent = kalan > 0 ? `Yeni kod iste (${kalan} sn)` : "Yeni kod iste";
    if (kalan > 0) setTimeout(say, 500);
  };
  say();
  form.kod.focus();
  form.kod.oninput = () => { form.kod.value = form.kod.value.replace(/\D/g, "").slice(0, 6); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const kod = form.kod.value.trim();
    if (!/^\d{6}$/.test(kod)) return goster("6 haneli kodu yaz.");
    if (form.sifre.value.length < 8) return goster("Şifre en az 8 karakter olmalı.", form.sifre);
    if (form.sifre.value !== form.sifre2.value) return goster("İki şifre aynı değil.", form.sifre2);
    gir.disabled = true; gir.textContent = "Kod doğrulanıyor…";
    try {
      const v = await api("/giris/kod/dogrula", { yontem: "POST", govde: { eposta: k.eposta, kod, yeni_sifre: form.sifre.value } });
      S.token = v.token; S.ben = v.ben; S.kodAdimi = null; S.girisKipi = null; depo.yaz("lbe-token", v.token);
      S.bildirim = { tur: "ok", yazi: k.kip === "unuttum" ? "Şifren yenilendi." : "Kaydın tamamlandı." }; ciz();
    } catch (x) { gir.disabled = false; gir.textContent = girYazi; goster(x.message, /ifre/.test(x.message) && !/kod/i.test(x.message) ? form.sifre : null); }
  };
  yeni.onclick = async () => {
    yeni.disabled = true;
    try {
      const v = await api("/giris/kod/iste", { yontem: "POST", govde: { eposta: k.eposta } });
      k.yeniden = Date.now() + (v.bekle || 60) * 1000;
      S.bildirim = { tur: "ok", yazi: "Yeni kod gönderildi." }; ciz();
    } catch (x) { goster(x.message); yeni.disabled = false; }
  };
  document.getElementById("adres-degis").onclick = () => { S.kodAdimi = null; ciz(); };
}
function ilkGirisEkrani() {
  kok.innerHTML = `<div class="orta"><div class="kutu">
    ${logo("logo")}
    <div><h1>Adını yaz</h1><p class="yardim" style="margin:6px 0 0">Yüklediğin modellerde bu ad görünür.</p></div>
    <div id="hata"></div>
    <form id="form" novalidate>
      <label class="alan">Ad soyad<input class="girdi" name="ad" value="${esc(S.ben.ad)}" autocomplete="name" maxlength="120"></label>
      <label class="alan">Öğrenci no (isteğe bağlı)<input class="girdi" name="ogrenci_no" inputmode="numeric" placeholder="Sonra Profil'den de ekleyebilirsin" maxlength="20"><span class="ek">Oyunda görünmez.</span></label>
      <button class="btn btn-birincil btn-tam">Kaydet</button>
    </form>
  </div></div>`;
  document.getElementById("form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      S.ben = (await api("/ben", { yontem: "PUT", govde: { ad: f.get("ad"), ogrenci_no: f.get("ogrenci_no") } })).ben;
      ciz();
    } catch (x) { document.getElementById("hata").innerHTML = bildirimHtml({ tur: "bad", yazi: x.message }); }
  };
}
function bekliyorEkrani() {
  const red = S.ben.durum === "reddedildi";
  kok.innerHTML = `<div class="orta"><div class="kutu" style="justify-items:start">
    ${logo("logo")}
    ${hesapRozeti(S.ben.durum)}
    <div><h1>${red ? "Hesabın onaylanmadı" : "Hesabın onay bekliyor"}</h1><p class="yardim" style="margin:6px 0 0">${red ? "Yanlışlık olduğunu düşünüyorsan yöneticiye başvur." : "Yönetici hesabını onaylayınca model yükleyebilirsin."}</p></div>
    <div class="kisi-satiri" style="width:100%"><span class="avatar-b">${esc(basHarf(S.ben.ad))}</span><span><b>${esc(S.ben.ad)}</b><span class="yardim">${esc(S.ben.eposta)}</span></span><span></span></div>
    ${red ? "" : '<button type="button" class="btn btn-tam" id="yenile">Yeniden dene</button>'}
    <button type="button" class="btn btn-tam" id="cik">Başka hesapla gir</button>
  </div></div>`;
  document.getElementById("cik").onclick = cikis;
  const y = document.getElementById("yenile");
  if (y) y.onclick = async () => { y.disabled = true; try { S.ben = (await api("/ben")).ben; } catch { /* aşağıda yeniden çizilir */ } ciz(); };
}

// ---------- kabuk ----------
const SAYFALAR = [
  { id: "yukle", ad: "Model yükle", kisa: "Yükle", simge: I.yukle },
  { id: "yuklemelerim", ad: "Yüklemelerim", kisa: "Yüklemeler", simge: I.liste },
  { id: "onay", ad: "Onay", simge: I.ok, rol: ["akademisyen", "onaylayici", "yonetici"] },
  { id: "kullanicilar", ad: "Kullanıcılar", kisa: "Kişiler", simge: I.kisiler, rol: ["yonetici"] },
  { id: "ayarlar", ad: "Ayarlar", simge: I.ayar, rol: ["yonetici"] },
  { id: "profil", ad: "Profil", simge: I.kisi },
];
const gorunenSayfalar = () => SAYFALAR.filter((s) => !s.rol || s.rol.includes(S.ben.rol));
const simdikiSayfa = () => { const id = location.hash.replace("#", ""); return gorunenSayfalar().find((s) => s.id === id) || SAYFALAR[0]; };
const ROL_NOTU = {
  yukleyici: "Öğrenci: model yükler, kendi modellerinin durumunu görür.",
  akademisyen: "Akademisyen: model yükler; kendisini seçen yüklemelere ön onay verir ya da reddeder.",
  onaylayici: "YUVerse sorumlusu: ön onayı verilen modelleri onaylar, hoca adına ön onay verebilir, modelleri lab bilgisayarına indirir.",
  yonetici: "Sistem yöneticisi: bütün onay adımları, hesaplar, roller ve Drive bağlantısı.",
};
function kabuk(sayfa, icerik) {
  const bag = (s, kisa) => `<a href="#${s.id}"${s.id === sayfa.id ? ' aria-current="page"' : ""}>${kisa ? s.simge + esc(s.kisa || s.ad) : esc(s.ad)}</a>`;
  kok.innerHTML = `<div class="panel">
    <aside class="yan">
      ${logo().replace(/<img /g, '<img style="height:40px;align-self:flex-start" ')}
      <nav aria-label="Panel menüsü">${gorunenSayfalar().map((s) => bag(s)).join("")}</nav>
      <p class="rol-notu">${esc(ROL_NOTU[S.ben.rol])}</p>
    </aside>
    <div class="sutun">
      <header class="ust-bar">${logo("mobil-logo")}<span class="yardim">LBE AddPlay için model paneli</span>
        <span class="kisi"><span class="avatar">${esc(basHarf(S.ben.ad))}</span><span class="ad">${esc(S.ben.ad)}</span> <span class="rol">${esc(ROL_AD[S.ben.rol])}</span></span></header>
      <main class="icerik" id="icerik">${icerik}</main>
    </div>
    <nav class="alt-sekme" aria-label="Sekmeler">${gorunenSayfalar().map((s) => bag(s, true)).join("")}</nav>
  </div>`;
  document.title = sayfa.ad + " · LBE Drop";
}
const baslik = (ad, alt, sag = "") => `<div class="baslik-satiri"><div><h1>${esc(ad)}</h1><p class="yardim">${esc(alt)}</p></div>${sag}</div>`;
const hataKutusu = (x) => bildirimHtml({ tur: "bad", yazi: x.message });

// ---------- Model yükle ----------
function yukleSayfasi(sayfa) {
  if (S.yukleme) return yukleniyorCiz(sayfa);
  kabuk(sayfa, `${baslik("Model yükle", "Yüklediğin model onaylanınca LBE AddPlay'de seçilebilir olur.")}
    <div id="hata">${bildirimHtml(S.bildirim)}</div>
    <div class="iki-sutun">
      <div style="display:grid;gap:16px">
        <div class="birak" id="birak" role="button" tabindex="0" aria-describedby="birak-yardim"><div class="ic">
          <img src="marka/logo/lbe-drop_isaret_oneri-v1.svg" alt="">
          <b>Model dosyasını buraya bırak</b><span class="yardim">ya da</span>
          <span class="btn btn-kucuk">Dosya seç</span>
          <span class="yardim" id="birak-yardim">Yalnız .glb · en çok 50 MB</span>
        </div></div>
        <input type="file" id="dosya" accept=".glb,model/gltf-binary" hidden>
        <div class="kutu" id="secili" hidden></div>
        <div class="kutu kosullar">
          <h2>İdeal yükleme koşulları</h2>
          <dl>
            <dt>Biçim</dt><dd>.glb (glTF 2.0), tek dosya; dokular dosyanın içinde gömülü</dd>
            <dt>Boyut sınırı</dt><dd>En çok 50 MB; daha büyük dosya yüklenmez. İdeali 20 MB'ın altı</dd>
            <dt>Üçgen</dt><dd>150 binin altı</dd>
            <dt>Doku</dt><dd>En çok 1024 px, PNG ya da JPEG</dd>
            <dt>Sıkıştırma</dt><dd>Draco, meshopt ve KTX2 kullanma; oyun açamaz</dd>
            <dt>Ölçek ve eksen</dt><dd>Fark etmez; oyun modeli kendisi sığdırır ve zemine oturtur</dd>
          </dl>
          <p class="yardim">Üçgen ya da doku sınırını aşan model reddedilmez; onay ekranında "Ağır model" uyarısıyla görünür ve gözlükte yavaş çalışabilir.</p>
        </div>
      </div>
      <form class="kutu" id="form" novalidate>
        <label class="alan">Ad soyad<input class="girdi" name="yukleyen_ad" autocomplete="name" maxlength="80" value="${esc(S.ben.ad || "")}"><span class="alan-hata" id="kisi-hata" hidden>${I.red.replace("<svg ", '<svg class="simge" ')}Ad soyadını yaz.</span></label>
        <label class="alan">Proje adı<input class="girdi" name="model_adi" placeholder="Örn. Kule maketi" maxlength="80"><span class="alan-hata" id="ad-hata" hidden>${I.red.replace("<svg ", '<svg class="simge" ')}Proje adını yaz.</span></label>
        <div id="akademisyen-alan"></div>
        <label class="alan">Ders kodu<input class="girdi" name="ders_kodu" placeholder="Örn. ARCH 201" maxlength="20" value="${esc(depo.al("lbe-ders") || "")}"></label>
        <div class="alan">Yükleme zamanı<span class="girdi salt sayisal" id="zaman"></span><span class="ek">Kendiliğinden eklenir: "Yükle"ye bastığın tarih, saat ve dakika.</span></div>
        <div class="bildirim bilgi"><span><b>Bu bilgiler modelin altında gösterilir.</b> Ad soyad, proje adı ve yükleme zamanı LBE AddPlay'de modelle birlikte herkese görünür; doğru yaz.</span></div>
        <button class="btn btn-birincil btn-tam">Yükle</button>
        <p class="yardim">Model önce ilgili akademisyenin, sonra YUVerse sorumlusunun onayından geçer; onaylanınca lab bilgisayarına iner.</p>
      </form>
    </div>`);
  S.bildirim = null;
  let dosya = null, resim = null, onizleBirak = () => {};
  // İlgili akademisyen: sistemde akademisyen varsa seçmek zorunlu; ön onayı o verir.
  let akademisyenVar = false;
  api("/akademisyenler").then((v) => {
    const alan = document.getElementById("akademisyen-alan");
    if (!alan || !v.akademisyenler.length) return;
    akademisyenVar = true;
    const son = depo.al("lbe-akademisyen");
    alan.innerHTML = `<label class="alan">İlgili akademisyen<select class="girdi tam" name="akademisyen_id"><option value="">Seç…</option>${v.akademisyenler.map((a) => `<option value="${a.id}"${String(a.id) === son ? " selected" : ""}>${esc(a.ad)}${a.bolum ? " · " + esc(a.bolum) : ""}</option>`).join("")}</select><span class="ek">Modelin önce bu akademisyenin ön onayına, sonra YUVerse sorumlusuna gider.</span><span class="alan-hata" id="akademisyen-hata" hidden>${I.red.replace("<svg ", '<svg class="simge" ')}İlgili akademisyeni seç.</span></label>`;
  }).catch(() => {});
  const zaman = document.getElementById("zaman"), zamanYaz = () => { if (zaman.isConnected) { zaman.textContent = tarihYaz(new Date()); setTimeout(zamanYaz, 15000); } };
  zamanYaz();
  const birak = document.getElementById("birak"), girdi = document.getElementById("dosya"), secili = document.getElementById("secili"), hata = document.getElementById("hata"), form = document.getElementById("form");
  const sec = (f) => {
    hata.innerHTML = ""; birak.classList.remove("hatali");
    if (!f) return;
    const sorun = !/\.glb$/i.test(f.name) ? "Yalnız .glb dosyası yüklenir." : f.size > MAKS_BOYUT ? `Dosya 50 MB'tan büyük (${boyutYaz(f.size)}).` : f.size < 12 ? "Dosya boş görünüyor." : null;
    resim = null;
    if (sorun) { dosya = null; secili.hidden = true; birak.hidden = false; birak.classList.add("hatali"); hata.innerHTML = bildirimHtml({ tur: "bad", kalin: f.name + ":", yazi: sorun }); return; }
    dosya = f; birak.hidden = true; secili.hidden = false;
    secili.innerHTML = `<div class="dosya"><span class="kucuk-resim">3B</span><span><b>${esc(f.name)}</b><span class="yardim sayisal">${boyutYaz(f.size)}</span></span><button type="button" class="btn btn-kucuk" id="degistir">Değiştir</button></div><div id="yukle-onizle" class="izleyici-kutu"></div>`;
    document.getElementById("degistir").onclick = () => girdi.click();
    onizleBirak(); onizleBirak = () => {};
    izleyiciKur(document.getElementById("yukle-onizle"), f, (r) => { if (dosya === f) resim = r; }).then((b) => { if (dosya === f && document.getElementById("yukle-onizle")) onizleBirak = b; else b(); });
    if (!form.model_adi.value) form.model_adi.value = f.name.replace(/\.glb$/i, "").replace(/[-_]+/g, " ").slice(0, 80);
  };
  birak.onclick = () => girdi.click();
  birak.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); girdi.click(); } };
  girdi.onchange = () => { sec(girdi.files[0]); girdi.value = ""; };
  for (const ad of ["dragenter", "dragover"]) birak.addEventListener(ad, (e) => { e.preventDefault(); birak.classList.add("ustunde"); });
  for (const ad of ["dragleave", "drop"]) birak.addEventListener(ad, (e) => { e.preventDefault(); birak.classList.remove("ustunde"); });
  birak.addEventListener("drop", (e) => sec(e.dataTransfer.files[0]));
  form.onsubmit = (e) => {
    e.preventDefault();
    const ad = form.model_adi.value.trim(), ders = form.ders_kodu.value.trim(), kisi = form.yukleyen_ad.value.trim();
    document.getElementById("ad-hata").hidden = !!ad; form.model_adi.classList.toggle("hatali", !ad);
    document.getElementById("kisi-hata").hidden = !!kisi; form.yukleyen_ad.classList.toggle("hatali", !kisi);
    if (!dosya) { birak.classList.add("hatali"); hata.innerHTML = bildirimHtml({ tur: "bad", yazi: "Model dosyasını seç." }); }
    const akademisyen = akademisyenVar ? form.akademisyen_id.value : "";
    if (akademisyenVar) { document.getElementById("akademisyen-hata").hidden = !!akademisyen; form.akademisyen_id.classList.toggle("hatali", !akademisyen); }
    if (!ad || !kisi || !dosya || (akademisyenVar && !akademisyen)) return;
    depo.yaz("lbe-ders", ders); if (akademisyen) depo.yaz("lbe-akademisyen", akademisyen);
    yuklemeBaslat(dosya, ad, ders, kisi, akademisyen, resim);
  };
  yukleSayfasi.sec = sec;      // sürükle-bırak dışında dosya vermek için (deneme)
}
function yukleniyorCiz(sayfa) {
  const y = S.yukleme;
  kabuk(sayfa, `${baslik("Model yükle", "Yüklediğin model onaylanınca LBE AddPlay'de seçilebilir olur.")}
    <div class="kutu dar">
      <div class="ilerleme-ust"><span id="asama">${esc(y.asama)}</span><span class="sayisal" id="yuzde">%${y.yuzde}</span></div>
      <div class="ilerleme" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${y.yuzde}" id="cubuk"><span style="width:${y.yuzde}%"></span></div>
      <div class="dosya"><span class="kucuk-resim">3B</span><span><b>${esc(y.dosya.name)}</b><span class="yardim sayisal" id="gecen">${boyutYaz(y.gecen)} / ${boyutYaz(y.dosya.size)}</span></span><span></span></div>
      <p class="yardim">Yükleme bitene kadar bu sayfayı kapatma.</p>
      <button type="button" class="btn btn-tam" id="vazgec">Vazgeç</button>
    </div>`);
  document.getElementById("vazgec").onclick = () => { y.iptal = true; if (y.xhr) y.xhr.abort(); };
}
async function yuklemeBaslat(dosya, modelAdi, dersKodu, yukleyenAd, akademisyenId, resim) {
  const y = S.yukleme = { dosya, asama: "Hazırlanıyor", yuzde: 0, gecen: 0, xhr: null, iptal: false };
  ciz();
  const guncelle = () => {
    if (simdikiSayfa().id !== "yukle" || !document.getElementById("cubuk")) return;
    document.getElementById("asama").textContent = y.asama;
    document.getElementById("yuzde").textContent = "%" + y.yuzde;
    document.getElementById("cubuk").setAttribute("aria-valuenow", y.yuzde);
    document.getElementById("cubuk").firstElementChild.style.width = y.yuzde + "%";
    document.getElementById("gecen").textContent = `${boyutYaz(y.gecen)} / ${boyutYaz(dosya.size)}`;
  };
  try {
    const a = await api("/yuklemeler", { yontem: "POST", govde: { model_adi: modelAdi, yukleyen_ad: yukleyenAd, ders_kodu: dersKodu, ...(akademisyenId ? { akademisyen_id: Number(akademisyenId) } : {}), dosya_adi: dosya.name, boyut: dosya.size } });
    if (y.iptal) throw new ApiHata(-1, "");
    y.asama = "Yükleniyor"; guncelle();
    // Dosya sunucudan geçmez: doğrudan Drive'ın verdiği yükleme adresine gider.
    await new Promise((coz, reddet) => {
      const x = y.xhr = new XMLHttpRequest();
      x.open("PUT", a.yukle_url);
      x.setRequestHeader("Content-Type", "model/gltf-binary");
      x.upload.onprogress = (e) => { if (e.lengthComputable) { y.gecen = e.loaded; y.yuzde = Math.min(99, Math.floor((e.loaded / e.total) * 100)); guncelle(); } };
      x.onload = () => (x.status >= 200 && x.status < 300 ? coz() : reddet(new ApiHata(x.status, "Dosya Drive'a yüklenemedi. Yeniden dene.")));
      x.onerror = () => reddet(new ApiHata(0, "Bağlantı koptu. İnternet bağlantını kontrol edip yeniden dene."));
      x.onabort = () => reddet(new ApiHata(-1, ""));
      x.send(dosya);
    });
    y.asama = "Doğrulanıyor"; y.gecen = dosya.size; y.yuzde = 99; guncelle();
    await api(`/yuklemeler/${a.id}/bitti`, { yontem: "POST" });
    if (resim) await resimGonder(a.id, resim).catch(() => {});   // resim gitmezse yükleme yine tamamdır
    if (dosya.size > HAFIF_ESIK && !y.iptal) {
      y.asama = "Ön izleme kopyası hazırlanıyor"; guncelle();
      await new Promise((s) => setTimeout(s, 60));
      await hafifGonder(a.id, dosya).catch(() => {});             // kopya olmazsa ön izleme asıl dosyayı açar
    }
    S.yukleme = null;
    S.bildirim = { tur: "ok", kalin: "Gönderildi.", yazi: "Onaylanınca LBE AddPlay'de görünür." };
    if (location.hash === "#yuklemelerim") ciz(); else location.hash = "#yuklemelerim";
  } catch (x) {
    S.yukleme = null;
    S.bildirim = x.kod === -1 ? { tur: "warn", yazi: "Yükleme iptal edildi." } : { tur: "bad", kalin: "Yüklenemedi.", yazi: x.message };
    if (location.hash === "#yukle" || location.hash === "") ciz(); else location.hash = "#yukle";
  }
}

// ---------- Yüklemelerim ----------
async function yuklemelerimSayfasi(sayfa) {
  const ust = `${baslik("Yüklemelerim", "Gönderdiğin modeller ve durumları.", '<a class="btn btn-birincil" href="#yukle">Model yükle</a>')}${bildirimHtml(S.bildirim)}`;
  S.bildirim = null;
  kabuk(sayfa, ust + '<p class="yardim">Yükleniyor…</p>');
  let liste;
  try { liste = (await api("/yuklemeler")).yuklemeler; } catch (x) { return bitir(ust + hataKutusu(x)); }
  bitir(ust + (liste.length ? `<div class="kutu dar" style="gap:0">${liste.map((m) => `<div class="yukleme"><div class="yk-govde">
      <div class="ust"><b>${esc(m.model_adi)}</b>${yuklemeRozeti(m.asama)}</div>
      <span class="yardim sayisal">${[m.yukleyen_ad, m.akademisyen_ad && "Akademisyen: " + m.akademisyen_ad, m.bolum && "Bölüm: " + m.bolum, m.ders_kodu, tarihYaz(m.tarih), boyutYaz(m.boyut)].filter(Boolean).map(esc).join(" · ")}</span>
      ${m.durum === "reddedildi" && m.ret_notu ? `<div class="ek-not"><b>Ret notu:</b> ${esc(m.ret_notu)}</div>` : ""}
      <div class="dugmeler">${onIzleDugmesi(m)}</div>
    </div>${resimKutusu(m)}</div>`).join("")}</div>` : '<div class="kutu dar"><p class="yardim">Henüz yüklediğin model yok.</p></div>'));
  function bitir(html) { if (simdikiSayfa().id !== sayfa.id) return; const ic = document.getElementById("icerik"); ic.innerHTML = html; onIzleBagla(ic); }
}

// ---------- Profil ----------
function profilSayfasi(sayfa) {
  kabuk(sayfa, `${baslik("Profil", "Ad ve öğrenci no her yüklemede kendiliğinden kullanılır.")}
    <div id="hata">${bildirimHtml(S.bildirim)}</div>
    <div class="kutu dar"><div class="kisi-satiri"><span class="avatar-b">${esc(basHarf(S.ben.ad))}</span><span><b>${esc(S.ben.ad)}</b><span class="yardim">${esc(S.ben.eposta)}</span></span><span class="rol">${esc(ROL_AD[S.ben.rol])}</span></div></div>
    <form class="kutu dar" id="form" novalidate>
      <label class="alan">Ad soyad<input class="girdi" name="ad" value="${esc(S.ben.ad)}" autocomplete="name" maxlength="120"></label>
      <label class="alan">Öğrenci no (isteğe bağlı)<input class="girdi" name="ogrenci_no" inputmode="numeric" value="${esc(S.ben.ogrenci_no)}" maxlength="20"><span class="ek">Oyunda görünmez.</span></label>
      <div id="bolum-alan"></div>
      <button class="btn btn-tam">Kaydet</button>
    </form>
    <form class="kutu dar" id="sifre-form" novalidate>
      <b>${S.ben.sifre_var ? "Şifreyi değiştir" : "Şifre belirle"}</b>
      <input type="email" name="eposta" value="${esc(S.ben.eposta)}" autocomplete="username" hidden>
      ${S.ben.sifre_var ? '<label class="alan">Şimdiki şifre<input class="girdi" name="eski" type="password" autocomplete="current-password" maxlength="200"></label>'
        : '<p class="yardim" style="margin:0">Şifre belirlersen Google yerine e-posta ve şifreyle de girebilirsin.</p>'}
      <label class="alan">Yeni şifre<input class="girdi" name="sifre" type="password" autocomplete="new-password" maxlength="200"><span class="ek">En az 8 karakter.</span></label>
      <label class="alan">Yeni şifre (yeniden)<input class="girdi" name="sifre2" type="password" autocomplete="new-password" maxlength="200"></label>
      <div id="sifre-hata"></div>
      <button class="btn btn-tam">${S.ben.sifre_var ? "Şifreyi değiştir" : "Şifre belirle"}</button>
      <p class="yardim" style="margin:0">Şifre değişince öbür cihazlardaki oturumların kapanır.</p>
    </form>
    <div class="kutu dar">
      <button type="button" class="btn btn-tam" id="cik">Çıkış yap</button>
      <button type="button" class="btn btn-tam btn-red" id="sil">Hesabımı sil</button>
      <p class="yardim">Hesabını silersen profilin silinir. Onaylanmış modellerin kütüphanede kalır.</p>
    </div>`);
  S.bildirim = null;
  const hata = document.getElementById("hata");
  if (S.ben.rol !== "yukleyici") api("/bolumler").then((v) => {
    const alan = document.getElementById("bolum-alan");
    if (!alan || simdikiSayfa().id !== sayfa.id) return;
    alan.innerHTML = v.bolumler.length
      ? `<label class="alan">Bölüm<select class="girdi tam" name="bolum_id">${bolumSecenek(v.bolumler, S.ben.bolum_id, "Seçilmedi")}</select><span class="ek">Seni ilgili akademisyen olarak seçen modeller bu bölüme düşer.</span></label>`
      : "";
  }).catch(() => {});
  document.getElementById("form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { S.ben = (await api("/ben", { yontem: "PUT", govde: { ad: f.get("ad"), ogrenci_no: f.get("ogrenci_no"), ...(f.has("bolum_id") ? { bolum_id: f.get("bolum_id") ? Number(f.get("bolum_id")) : null } : {}) } })).ben; S.bildirim = { tur: "ok", yazi: "Kaydedildi." }; ciz(); }
    catch (x) { hata.innerHTML = hataKutusu(x); }
  };
  document.getElementById("sifre-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, yer = document.getElementById("sifre-hata"), uyar = (m) => { yer.innerHTML = hataKutusu(new Error(m)); };
    if (f.sifre.value.length < 8) return uyar("Şifre en az 8 karakter olmalı.");
    if (f.sifre.value !== f.sifre2.value) return uyar("İki şifre aynı değil.");
    try { S.ben = (await api("/ben/sifre", { yontem: "PUT", govde: { sifre: f.sifre.value, eski: f.eski ? f.eski.value : undefined } })).ben; S.bildirim = { tur: "ok", yazi: "Şifren kaydedildi." }; ciz(); }
    catch (x) { yer.innerHTML = hataKutusu(x); }
  };
  document.getElementById("cik").onclick = cikis;
  document.getElementById("sil").onclick = async () => {
    if (!(await sor("Hesabını sil", "Profilin ve oturumların silinir; bu geri alınamaz. Onaylanmış modellerin kütüphanede kalır.", "Hesabımı sil"))) return;
    try { await api("/ben", { yontem: "DELETE" }); oturumuUnut(); S.bildirim = { tur: "ok", yazi: "Hesabın silindi." }; location.hash = ""; ciz(); }
    catch (x) { hata.innerHTML = hataKutusu(x); }
  };
}

// ---------- Onay (akademisyen: ön onay · YUVerse sorumlusu ve sistem yöneticisi: son onay, hoca adına ön onay, indirme) ----------
async function onaySayfasi(sayfa) {
  const hoca = S.ben.rol === "akademisyen";
  const ust = baslik("Onay", hoca ? "Seni ilgili akademisyen olarak seçen yüklemeler. Ön onay verdiğin model YUVerse sorumlusuna düşer." : "Model önce akademisyen ön onayından, sonra senin onayından geçer. Onayladığın model lab bilgisayarına iner.") + `<div id="hata">${bildirimHtml(S.bildirim)}</div>`;
  S.bildirim = null;
  kabuk(sayfa, ust + '<p class="yardim">Yükleniyor…</p>');
  let liste, bolumler;
  try { [liste, bolumler] = await Promise.all([api("/onay/yuklemeler?durum=gelen,hafifletildi,onaylandi,reddedildi").then((v) => v.yuklemeler), api("/bolumler").then((v) => v.bolumler)]); }
  catch (x) { if (simdikiSayfa().id === sayfa.id) document.getElementById("icerik").innerHTML = ust + hataKutusu(x); return; }
  if (simdikiSayfa().id !== sayfa.id) return;
  const kart = (m) => {
    const d = [onIzleDugmesi(m)];
    if (m.asama === "akademisyen") d.push(`<button type="button" class="btn btn-birincil btn-kucuk" data-is="on-onay" data-id="${m.id}">${hoca ? "Ön onay ver" : "Hoca adına ön onay ver"}</button>`);
    if (m.asama === "sorumlu" && !hoca) d.push(`<button type="button" class="btn btn-birincil btn-kucuk" data-is="onayla" data-id="${m.id}">Onayla</button>`);
    if (m.asama === "akademisyen" || (m.asama === "sorumlu" && !hoca)) d.push(`<button type="button" class="btn btn-kucuk btn-red" data-ret="${m.id}">Reddet</button>`);
    if (m.asama === "onaylandi" && !hoca) d.push(`<button type="button" class="btn btn-kucuk" data-is="indir" data-id="${m.id}">Sunucuya indir</button>`);
    const indirme = m.asama !== "onaylandi" ? "" : m.indirme.istendi || !m.indirme.tarih ? "Lab bilgisayarına indirilmeyi bekliyor" : "Lab bilgisayarına indirildi: " + tarihYaz(m.indirme.tarih);
    return `<div class="yukleme"><div class="yk-govde">
      <div class="ust"><b>${esc(m.model_adi)}</b>${yuklemeRozeti(m.asama)}</div>
      <span class="yardim sayisal">${[m.yukleyen_ad, m.ogrenci_no, m.ders_kodu, tarihYaz(m.tarih), boyutYaz(m.ozgun.boyut || m.hafif.boyut)].filter(Boolean).map(esc).join(" · ")}</span>
      ${m.akademisyen ? `<span class="yardim">Akademisyen: ${esc(m.akademisyen.ad)}${m.on_onay ? ` · ön onay ${esc(tarihYaz(m.on_onay.tarih))}${m.on_onay.hoca_adina ? " (hoca adına)" : ""}` : ""}</span>` : '<span class="yardim">Akademisyen seçilmedi</span>'}
      ${bolumler.length ? `<span class="yardim">Bölüm: ${m.bolum ? esc(m.bolum.ad) : "yok"}</span>` : ""}
      ${indirme ? `<span class="yardim">${esc(indirme)}</span>` : ""}
      ${m.asama === "reddedildi" && m.ret_notu ? `<div class="ek-not"><b>Ret notu:</b> ${esc(m.ret_notu)}</div>` : ""}
      ${d.length ? `<div class="dugmeler">${d.join("")}</div>` : ""}
      ${!hoca && bolumler.length && (m.asama === "akademisyen" || m.asama === "sorumlu") ? `<div class="bolum-tasi"><select class="girdi" data-bolum-sec="${m.id}" aria-label="${esc(m.model_adi)} için bölüm">${bolumSecenek(bolumler, m.bolum && m.bolum.id, "Bölümsüz")}</select><button type="button" class="btn btn-kucuk" data-tasi="${m.id}">Taşı</button><button type="button" class="btn btn-kucuk" data-cogalt="${m.id}">Çoğalt</button></div>` : ""}
      <form class="ret-form" data-ret-form="${m.id}" hidden novalidate><label class="alan">Ret notu<input class="girdi" name="not" maxlength="500" placeholder="Yükleyen bu notu görür"></label><div class="dugmeler"><button class="btn btn-kucuk btn-red">Reddet</button><button type="button" class="btn btn-kucuk" data-ret-vazgec="${m.id}">Vazgeç</button></div></form>
    </div>${resimKutusu(m)}</div>`;
  };
  const bolum = (ad, satirlar, bos) => `<h2 class="bolum-baslik">${esc(ad)} <span class="yardim sayisal">${satirlar.length}</span></h2><div class="kutu" style="gap:0">${satirlar.length ? satirlar.map(kart).join("") : `<p class="yardim">${esc(bos)}</p>`}</div>`;
  // Bölüme göre süzme: "" hepsi · "0" bölümsüz · bölüm id'si
  const suz = S.onayBolum && (S.onayBolum === "0" || bolumler.some((b) => String(b.id) === S.onayBolum)) ? S.onayBolum : "";
  const gorunen = liste.filter((m) => !suz || (suz === "0" ? !m.bolum : m.bolum && String(m.bolum.id) === suz));
  const sec = (a) => gorunen.filter((m) => m.asama === a);
  const suzgec = bolumler.length ? `<label class="alan bolum-suz">Bölüm<select class="girdi" id="bolum-suz"><option value="">Tüm bölümler (${liste.length})</option>${bolumler.map((b) => `<option value="${b.id}"${String(b.id) === suz ? " selected" : ""}>${esc(b.ad)} (${liste.filter((m) => m.bolum && m.bolum.id === b.id).length})</option>`).join("")}<option value="0"${suz === "0" ? " selected" : ""}>Bölümsüz (${liste.filter((m) => !m.bolum).length})</option></select></label>` : "";
  document.getElementById("icerik").innerHTML = ust + suzgec + `<div class="dar-genis">${hoca
    ? bolum("Ön onayını bekleyenler", sec("akademisyen"), "Ön onayını bekleyen model yok.") + bolum("Ön onay verdiklerin", sec("sorumlu"), "YUVerse sorumlusunu bekleyen model yok.")
    : bolum("Onayını bekleyenler", sec("sorumlu"), "Onayını bekleyen model yok.") + bolum("Akademisyen ön onayı bekleyenler", sec("akademisyen"), "Akademisyen ön onayı bekleyen model yok.")}
    ${bolum("Onaylananlar", sec("onaylandi"), "Onaylanan model yok.")}${bolum("Reddedilenler", sec("reddedildi"), "Reddedilen model yok.")}</div>`;
  const icerik = document.getElementById("icerik");
  onIzleBagla(icerik);
  const yap = async (yol, govde, tamam) => {
    try { await api(yol, { yontem: "POST", govde }); S.bildirim = { tur: "ok", yazi: tamam }; }
    catch (x) { S.bildirim = { tur: "bad", yazi: x.message }; }
    if (simdikiSayfa().id === sayfa.id) onaySayfasi(sayfa);
  };
  const suzKutu = document.getElementById("bolum-suz");
  if (suzKutu) suzKutu.onchange = () => { S.onayBolum = suzKutu.value; onaySayfasi(sayfa); };
  const secilen = (id) => icerik.querySelector(`[data-bolum-sec="${CSS.escape(id)}"]`).value;
  icerik.querySelectorAll("[data-tasi]").forEach((b) => { b.onclick = () => { b.disabled = true; yap(`/onay/yuklemeler/${b.dataset.tasi}/bolum`, { bolum_id: secilen(b.dataset.tasi) ? Number(secilen(b.dataset.tasi)) : null }, "Model taşındı."); }; });
  icerik.querySelectorAll("[data-cogalt]").forEach((b) => { b.onclick = () => {
    const s = secilen(b.dataset.cogalt);
    if (!s) { S.bildirim = { tur: "warn", yazi: "Çoğaltmak için listeden bir bölüm seç." }; onaySayfasi(sayfa); return; }
    b.disabled = true; yap(`/onay/yuklemeler/${b.dataset.cogalt}/cogalt`, { bolum_id: Number(s) }, "Model çoğaltıldı; kopya seçilen bölümde ayrı bir kayıt olarak onay bekliyor.");
  }; });
  const TAMAM = { "on-onay": "Ön onay verildi; model YUVerse sorumlusuna düştü.", onayla: "Onaylandı; model lab bilgisayarına indirilecek.", indir: "İndirme sırasına alındı." };
  icerik.querySelectorAll("[data-is]").forEach((b) => { b.onclick = () => { b.disabled = true; yap(`/onay/yuklemeler/${b.dataset.id}/${b.dataset.is}`, undefined, TAMAM[b.dataset.is]); }; });
  icerik.querySelectorAll("[data-ret]").forEach((b) => { b.onclick = () => { const f = icerik.querySelector(`[data-ret-form="${b.dataset.ret}"]`); f.hidden = false; f.not.focus(); }; });
  icerik.querySelectorAll("[data-ret-vazgec]").forEach((b) => { b.onclick = () => { icerik.querySelector(`[data-ret-form="${b.dataset.retVazgec}"]`).hidden = true; }; });
  icerik.querySelectorAll("[data-ret-form]").forEach((f) => { f.onsubmit = (e) => {
    e.preventDefault();
    const not = f.not.value.trim();
    if (!not) { f.not.classList.add("hatali"); f.not.focus(); return; }
    yap(`/onay/yuklemeler/${f.dataset.retForm}/reddet`, { not }, "Reddedildi; yükleyen notu görür.");
  }; });
}

// ---------- Kullanıcılar (yalnız sistem yöneticisi) ----------
async function kullanicilarSayfasi(sayfa) {
  const ust = baslik("Kullanıcılar", "Yeni hesap onay bekleyerek başlar. Onaylanan hesap model yükleyebilir.");
  kabuk(sayfa, ust + '<p class="yardim">Yükleniyor…</p>');
  const icerik = () => document.getElementById("icerik");
  let liste, bolumler;
  try { [liste, bolumler] = await Promise.all([api("/kullanicilar").then((v) => v.kullanicilar), api("/bolumler").then((v) => v.bolumler)]); } catch (x) { if (simdikiSayfa().id === sayfa.id) icerik().innerHTML = ust + hataKutusu(x); return; }
  if (simdikiSayfa().id !== sayfa.id) return;
  const satir = (u) => {
    const ben = u.id === S.ben.id;
    const rol = `<select class="girdi" data-rol="${u.id}" aria-label="${esc(u.ad)} rolü"${ben ? " disabled" : ""}>${Object.entries(ROL_AD).map(([d, a]) => `<option value="${d}"${d === u.rol ? " selected" : ""}>${a}</option>`).join("")}</select>`;
    const bolumu = u.rol === "yukleyici" || !bolumler.length ? '<span class="yardim">—</span>' : `<select class="girdi" data-kisi-bolum="${u.id}" aria-label="${esc(u.ad)} bölümü">${bolumSecenek(bolumler, u.bolum_id, "Seçilmedi")}</select>`;
    const islem = ben ? '<span class="yardim">Sen</span>'
      : u.durum === "beklemede" ? `<div class="dugmeler"><button type="button" class="btn btn-birincil btn-kucuk" data-durum="onayli" data-id="${u.id}">Onayla</button><button type="button" class="btn btn-kucuk btn-red" data-durum="reddedildi" data-id="${u.id}">Reddet</button></div>`
      : u.durum === "onayli" ? `<button type="button" class="btn btn-kucuk" data-durum="reddedildi" data-id="${u.id}">Erişimi kapat</button>`
      : `<button type="button" class="btn btn-kucuk" data-durum="onayli" data-id="${u.id}">Onayla</button>`;
    return `<tr><td><span class="avatar-b kucuk">${esc(basHarf(u.ad))}</span></td><td><b>${esc(u.ad || "Adsız")}</b><div class="yardim">${esc(u.eposta)}</div></td>
      <td class="sayisal">${u.ogrenci_no ? esc(u.ogrenci_no) : '<span class="yardim">yok</span>'}</td><td class="sayisal">${esc(tarihYaz(u.olusturma))}</td><td>${rol}</td><td>${bolumu}</td><td>${hesapRozeti(u.durum)}</td><td>${islem}</td></tr>`;
  };
  const bekleyen = liste.filter((u) => u.durum === "beklemede").length;
  icerik().innerHTML = `${ust}<div id="hata"></div>
    <div class="kutu tablolu"><table class="tablo"><thead><tr><th></th><th>Kullanıcı</th><th>Öğrenci no</th><th>Kayıt</th><th>Rol</th><th>Bölüm</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>${liste.map(satir).join("")}</tbody></table></div>
    <p class="yardim">${liste.length} hesap${bekleyen ? ` · ${bekleyen} onay bekliyor` : ""}. Kendi rolünü ve durumunu değiştiremezsin.</p>`;
  const degistir = async (id, govde) => {
    try { await api("/kullanicilar/" + id, { yontem: "PUT", govde }); kullanicilarSayfasi(sayfa); }
    catch (x) { document.getElementById("hata").innerHTML = hataKutusu(x); }
  };
  icerik().querySelectorAll("[data-durum]").forEach((b) => (b.onclick = () => degistir(b.dataset.id, { durum: b.dataset.durum })));
  icerik().querySelectorAll("[data-rol]").forEach((s) => (s.onchange = () => degistir(s.dataset.rol, { rol: s.value })));
  icerik().querySelectorAll("[data-kisi-bolum]").forEach((s) => (s.onchange = () => degistir(s.dataset.kisiBolum, { bolum_id: s.value ? Number(s.value) : null })));
}

// ---------- Ayarlar: Drive bağlantısı (yalnız yönetici) ----------
async function ayarlarSayfasi(sayfa) {
  const ust = baslik("Ayarlar", "Google Drive bağlantısı, giriş kodu e-postası ve bölümler.");
  kabuk(sayfa, ust + '<p class="yardim">Yükleniyor…</p>');
  const icerik = () => document.getElementById("icerik");
  let d, p, bolumler;
  try { [d, p, bolumler] = await Promise.all([api("/drive/durum"), api("/posta/durum"), api("/bolumler").then((v) => v.bolumler)]); } catch (x) { if (simdikiSayfa().id === sayfa.id) icerik().innerHTML = ust + hataKutusu(x); return; }
  if (simdikiSayfa().id !== sayfa.id) return;
  icerik().innerHTML = `${ust}<div id="hata"></div>
    <div class="kutu dar">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2>Google Drive</h2>${d.bagli ? rozet("onaylandi", "Bağlı", I.ok) : rozet("bekliyor", "Bağlı değil", I.bekle)}</div>
      <p class="yardim">${d.bagli ? "Yüklenen modeller bağlı hesabın Drive'ındaki LBE_Drop klasörüne gider." : "Drive bağlanmadan kimse model yükleyemez. Bağlayan hesabın Drive'ında LBE_Drop klasörü açılır; yer o hesabın kotasından düşer."}</p>
      <div class="dugmeler">
        <button type="button" class="btn ${d.bagli ? "" : "btn-birincil"}" id="bagla">${d.bagli ? "Drive'ı yeniden bağla" : "Drive'ı bağla"}</button>
        ${d.bagli ? '<button type="button" class="btn btn-red" id="kes">Bağlantıyı kes</button>' : ""}
        <button type="button" class="btn" id="yenile">Yenile</button>
      </div>
      <p class="yardim">Yetki sunucuda şifreli durur. Sunucu yalnız kendi açtığı LBE_Drop klasörünü görür; Drive'daki başka dosyalara erişemez.</p>
    </div>
    <div class="kutu dar" style="margin-top:var(--s-5)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2>Giriş kodu e-postası</h2>${p.bagli ? rozet("onaylandi", "Bağlı", I.ok) : p.brevo ? rozet("onaylandi", "Brevo ile açık", I.ok) : rozet("bekliyor", "Bağlı değil", I.bekle)}</div>
      <p class="yardim">${p.bagli ? "Giriş ekranında e-posta koduyla giriş açık. Kodlar bağlı Gmail hesabından gönderilir." : "Bir Gmail hesabı bağlanırsa giriş ekranında \"e-posta koduyla giriş\" açılır; Google hesabı olmayanlar da girebilir. Kodlar bağlanan hesabın adresinden gider."}</p>
      <div class="dugmeler">
        <button type="button" class="btn ${p.bagli ? "" : "btn-birincil"}" id="posta-bagla">${p.bagli ? "E-postayı yeniden bağla" : "Gmail'i bağla"}</button>
        ${p.bagli ? '<button type="button" class="btn btn-red" id="posta-kes">Bağlantıyı kes</button>' : ""}
      </div>
      <p class="yardim">Yalnız e-posta gönderme izni istenir; sunucu posta kutusunu okuyamaz. Gönderilen kodlar o hesabın "Gönderilmiş" klasöründe görünür. Gmail günde yaklaşık 500 e-postaya izin verir; sunucu günde 250 kodla sınırlar.</p>
    </div>
    <div class="kutu dar" style="margin-top:var(--s-5)">
      <h2>Bölümler</h2>
      <p class="yardim">Akademisyen Profil'den bölümünü seçer; Kullanıcılar sayfasından onun yerine sen de seçebilirsin. Ona gönderilen model o bölüme düşer ve lab bilgisayarında bölümün klasörüne iner.</p>
      ${bolumler.length ? `<div class="bolum-liste">${bolumler.map((b) => `<form class="bolum-duzen" data-bolum-duzen="${b.id}" novalidate>
        <label class="alan"><span class="yardim">Klasör: ${esc(b.klasor)}</span><input class="girdi" name="ad" value="${esc(b.ad)}" maxlength="80" aria-label="${esc(b.ad)} bölümünün adı"></label>
        <button class="btn btn-kucuk">Kaydet</button><button type="button" class="btn btn-kucuk btn-red" data-bolum-sil="${b.id}" data-ad="${esc(b.ad)}">Sil</button></form>`).join("")}</div>` : '<p class="yardim">Henüz bölüm yok.</p>'}
      <form class="bolum-duzen" id="bolum-ekle" novalidate>
        <label class="alan">Yeni bölüm<input class="girdi" name="ad" maxlength="80" placeholder="ör. Mimarlık"></label>
        <button class="btn btn-birincil btn-kucuk">Ekle</button>
      </form>
      <p class="yardim">Klasör adı bölüm eklenirken bir kez belirlenir; ad sonradan değişse de klasör aynı kalır. İçinde hesap ya da model olan bölüm silinmez.</p>
    </div>`;
  const hata = document.getElementById("hata");
  const bolumIs = async (yol, yontem, govde) => {
    try { await api(yol, { yontem, govde }); ayarlarSayfasi(sayfa); } catch (x) { hata.innerHTML = hataKutusu(x); hata.scrollIntoView({ block: "center" }); }
  };
  document.getElementById("bolum-ekle").onsubmit = (e) => { e.preventDefault(); const ad = e.target.ad.value.trim(); if (!ad) { e.target.ad.focus(); return; } bolumIs("/bolumler", "POST", { ad }); };
  icerik().querySelectorAll("[data-bolum-duzen]").forEach((f) => { f.onsubmit = (e) => { e.preventDefault(); bolumIs("/bolumler/" + f.dataset.bolumDuzen, "PUT", { ad: f.ad.value.trim() }); }; });
  icerik().querySelectorAll("[data-bolum-sil]").forEach((b) => { b.onclick = async () => {
    if (await sor("Bölümü sil", `"${b.dataset.ad}" bölümü listeden kalkar. İçinde hesap ya da model varsa silinmez.`, "Sil")) bolumIs("/bolumler/" + b.dataset.bolumSil, "DELETE");
  }; });
  document.getElementById("yenile").onclick = () => ayarlarSayfasi(sayfa);
  document.getElementById("bagla").onclick = async () => {
    try { const v = await api("/drive/baglan"); window.open(v.url, "_blank", "noopener"); hata.innerHTML = bildirimHtml({ tur: "warn", yazi: "Açılan sekmede izin ver, sonra buraya dönüp Yenile'ye bas." }); }
    catch (x) { hata.innerHTML = hataKutusu(x); }
  };
  document.getElementById("posta-bagla").onclick = async () => {
    try { const v = await api("/posta/baglan"); window.open(v.url, "_blank", "noopener"); hata.innerHTML = bildirimHtml({ tur: "warn", yazi: "Açılan sekmede e-posta gönderme iznini işaretleyip izin ver, sonra buraya dönüp Yenile'ye bas." }); }
    catch (x) { hata.innerHTML = hataKutusu(x); }
  };
  const postaKes = document.getElementById("posta-kes");
  if (postaKes) postaKes.onclick = async () => {
    if (!(await sor("E-posta bağlantısını kes", "Giriş ekranından e-posta koduyla giriş kalkar; Google ile giriş çalışmaya devam eder.", "Bağlantıyı kes"))) return;
    try { await api("/posta/baglanti", { yontem: "DELETE" }); ayarlarSayfasi(sayfa); } catch (x) { hata.innerHTML = hataKutusu(x); }
  };
  const kes = document.getElementById("kes");
  if (kes) kes.onclick = async () => {
    if (!(await sor("Drive bağlantısını kes", "Yeniden bağlanana kadar kimse model yükleyemez ve bekleyen modeller onaylanamaz. Drive'daki dosyalar silinmez.", "Bağlantıyı kes"))) return;
    try { await api("/drive/baglanti", { yontem: "DELETE" }); ayarlarSayfasi(sayfa); } catch (x) { hata.innerHTML = hataKutusu(x); }
  };
}

// ---------- çizim ----------
const CIZ = { yukle: yukleSayfasi, yuklemelerim: yuklemelerimSayfasi, onay: onaySayfasi, profil: profilSayfasi, kullanicilar: kullanicilarSayfasi, ayarlar: ayarlarSayfasi };
function ciz() {
  if (!API) { kok.innerHTML = '<p class="yukleniyor">Sunucu adresi ayarlanmamış (ayar.js).</p>'; return; }
  if (!S.token || !S.ben) return girisEkrani();
  if (!S.ben.ad) return ilkGirisEkrani();      // öğrenci no girişte sorulmaz; isteyen Profil'den ekler
  if (S.ben.durum !== "onayli") return bekliyorEkrani();
  const sayfa = simdikiSayfa();
  CIZ[sayfa.id](sayfa);
}
window.addEventListener("hashchange", ciz);
window.addEventListener("beforeunload", (e) => { if (S.yukleme) e.preventDefault(); });

(async function basla() {
  S.token = depo.al("lbe-token");
  await girisDonusu();
  try { S.kodGiris = !!(await api("/saglik")).kod_giris; } catch { S.kodGiris = false; }      // e-posta koduyla giriş sunucuda açık mı
  if (S.token && !S.ben) { try { S.ben = (await api("/ben")).ben; } catch (x) { if (x.kod !== 401) S.bildirim = { tur: "bad", yazi: x.message }; if (x.kod !== 401) { kok.innerHTML = `<div class="orta"><div class="kutu">${logo("logo")}${bildirimHtml(S.bildirim)}<button type="button" class="btn btn-tam" onclick="location.reload()">Yeniden dene</button></div></div>`; return; } } }
  ciz();
})();
