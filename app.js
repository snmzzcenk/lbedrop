// LBE Drop web paneli. Statik site; bütün veri sunucudadır (Sunucu/README.md).
// Yükleyici: model yükler, kendi yüklemelerini görür. Yönetici: ayrıca kullanıcıları ve Drive bağlantısını yönetir.
// Model onayı bu panelde yoktur; Windows onay uygulamasındadır (hafifletme ve PC kütüphanesine yazma orada yapılır).
"use strict";

const API = String(window.LBE_API || "").replace(/\/$/, "");
const PANEL_ADRES = location.origin + location.pathname;      // sunucudaki PANEL_ADRESLERI ile birebir aynı olmalı
const MAKS_BOYUT = 50 * 1024 * 1024;
const kok = document.getElementById("kok");
const S = { token: null, ben: null, bildirim: null, yukleme: null };

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
function oturumuUnut() { S.token = null; S.ben = null; depo.yaz("lbe-token", null); }

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
// YUVerse sahnesi: 30 gözlük yeri (4'ü dolu, kalanı soluk), ortada parçalarına ayrılmış model, yanında anlatan hoca.
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
  const model = kilavuz([260, 180, 10], [260, 180, 232]) + kutu(218, 138, 0, 84, 84, 10) + kutu(227, 147, 30, 66, 66, 10, "a") + kutu(236, 156, 62, 48, 48, 36)
    + kilavuz([260, 204, 80], [260, 232, 80]) + kutu(248, 232, 70, 24, 9, 21, "a") + kutu(240, 160, 124, 40, 40, 30) + kutu(234, 154, 182, 52, 52, 7, "a") + kutu(254, 174, 210, 12, 12, 20, "a");
  const X7 = [40, 113, 187, 260, 333, 407, 480], X6 = X7.filter((x) => x !== 260), X4 = [40, 113, 407, 480];
  const DOLU = new Set(["113,180", "407,180", "187,255", "333,105"]);
  const ogeler = [[30, X7], [105, X6], [180, X4], [255, X6], [330, X7]].flatMap(([y, xs]) => xs.map((x) => ({ d: x + y, s: kisi(x, y, DOLU.has(`${x},${y}`) ? "dolu" : "bos") })));   // 30 yer
  ogeler.push({ d: 441, s: model }, { d: 540, s: kisi(350, 190, "hoca") });
  ogeler.sort((a, b) => a.d - b.d);
  return `<svg class="izo izo-buyuk" viewBox="0 40 802 545" role="img" aria-label="YUVerse laboratuvarı: ortada parçalarına ayrılmış bir model, yanında anlatan hoca, çevresinde VR gözlüklü katılımcılar ve 30 gözlük yeri">${kutu(0, 0, -12, 520, 360, 12, "z")}${ogeler.map((o) => o.s).join("")}</svg>`;
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
  const kodlu = S.kodGiris;
  kok.innerHTML = `<div class="tanitim">
  <header class="tn-ust">${logo("logo")}<a class="btn btn-kucuk" href="#giris-kutu">Giriş yap</a></header>
  <section class="tn-kahraman">
  <div><h1>3B modelini yükle, LBE AddPlay'de gör</h1><p class="tn-alt">LBE Drop, Yaşar Üniversitesi YUVerse laboratuvarının model yükleme aracıdır. Modelin iki onaydan geçer ve laboratuvardaki VR oyununda gösterilir.</p></div>
  <div class="kutu" id="giris-kutu">
    <div><h2>Giriş yap</h2><p class="yardim" style="margin:6px 0 0">3B modelini LBE AddPlay'e göndermek için giriş yap.</p></div>
    ${bildirimHtml(S.bildirim)}
    ${kodlu ? `<form id="eposta-form" novalidate>
      <label class="alan">E-posta<input class="girdi" name="eposta" type="email" inputmode="email" autocomplete="email" placeholder="ad.soyad@ornek.edu.tr" maxlength="200" value="${esc(S.sonEposta || "")}"><span class="alan-hata" id="eposta-hata" hidden></span></label>
      <button class="btn btn-birincil btn-tam" id="kod-iste">Kod gönder</button>
      <p class="yardim" style="margin:0">Adresine 6 haneli bir giriş kodu göndeririz. Şifre gerekmez.</p>
    </form>
    <div class="ya-da"><span>ya da</span></div>` : ""}
    <button type="button" class="btn ${kodlu ? "" : "btn-birincil"} btn-tam" id="giris">Google ile giriş yap</button>
    <p class="yardim" style="margin:0">Hesabın ilk girişte onay bekler; yönetici onaylayınca model yükleyebilirsin.</p>
  </div></section>
  <section><h2 class="tn-baslik">Nasıl çalışır</h2>
    <ol class="tn-adimlar">${ADIMLAR.map(([c, a, m], i) => `<li>${c}<div><span class="tn-no">${i + 1}. ADIM</span><b>${a}</b><p>${m}</p></div></li>`).join("")}</ol></section>
  <section class="tn-sahne"><h2 class="tn-baslik">YUVerse'te 30 gözlük, tek model</h2>
    <p class="tn-alt">Onaylanan model laboratuvarda aynı anda 30 VR gözlüğünde görünür. Hoca modeli parçalarına ayırarak anlatabilir.</p>
    ${yuverseSahne}
    <ul class="tn-anahtar"><li><i class="an-hoca"></i>Hoca: modeli parçalarına ayırır</li><li><i class="an-kisi"></i>Gözlüklü katılımcı</li><li><i class="an-bos"></i>Boş yerler: aynı anda 30 gözlüğe kadar</li></ul></section>
  <section><h2 class="tn-baslik">Roller</h2>
    <div class="tn-roller">${ROL_ACIKLAMA.map(([a, m]) => `<div class="kutu"><b>${a}</b><p>${m}</p></div>`).join("")}</div>
    <p class="yardim" style="margin:16px 0 0">Yeni hesap öğrenci olarak başlar ve yönetici onayını bekler. Rolleri sistem yöneticisi atar.</p></section>
  <footer class="yardim"><a href="gizlilik.html">Gizlilik</a></footer>
  </div>`;
  S.bildirim = null;
  document.getElementById("giris").onclick = (e) => { e.currentTarget.disabled = true; girisBaslat(); };
  const form = document.getElementById("eposta-form");
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const eposta = form.eposta.value.trim().toLowerCase(), hata = document.getElementById("eposta-hata"), dugme = document.getElementById("kod-iste");
    const goster = (m) => { hata.innerHTML = I.red.replace("<svg ", '<svg class="simge" ') + esc(m); hata.hidden = false; form.eposta.classList.add("hatali"); };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(eposta)) return goster("E-posta adresini kontrol et.");
    dugme.disabled = true; dugme.textContent = "Kod gönderiliyor…";
    try {
      const v = await api("/giris/kod/iste", { yontem: "POST", govde: { eposta } });
      S.sonEposta = eposta; S.kodAdimi = { eposta, yeniden: Date.now() + (v.bekle || 60) * 1000, dakika: v.gecerli_dakika || 10 };
      ciz();
    } catch (x) { dugme.disabled = false; dugme.textContent = "Kod gönder"; goster(x.message); }
  };
}
// E-posta koduyla girişin ikinci adımı: gelen 6 haneli kod yazılır.
function kodEkrani() {
  const k = S.kodAdimi;
  kok.innerHTML = `<div class="orta"><div class="kutu">
    ${logo("logo")}
    <div><h1>Kodu yaz</h1><p class="yardim" style="margin:6px 0 0"><b>${esc(k.eposta)}</b> adresine 6 haneli bir kod gönderdik. Kod ${k.dakika} dakika geçerli. Gelmediyse spam klasörüne bak.</p></div>
    ${bildirimHtml(S.bildirim)}
    <form id="kod-form" novalidate>
      <label class="alan">Giriş kodu<input class="girdi kod-girdi sayisal" name="kod" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" placeholder="000000"><span class="alan-hata" id="kod-hata" hidden></span></label>
      <button class="btn btn-birincil btn-tam" id="kod-gir">Giriş yap</button>
    </form>
    <div class="dugmeler"><button type="button" class="btn btn-kucuk" id="yeni-kod" disabled>Yeni kod iste</button><button type="button" class="btn btn-kucuk" id="adres-degis">Adresi değiştir</button></div>
  </div></div>`;
  S.bildirim = null;
  const form = document.getElementById("kod-form"), hata = document.getElementById("kod-hata"), yeni = document.getElementById("yeni-kod"), gir = document.getElementById("kod-gir");
  const goster = (m) => { hata.innerHTML = I.red.replace("<svg ", '<svg class="simge" ') + esc(m); hata.hidden = false; form.kod.classList.add("hatali"); };
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
    gir.disabled = true; gir.textContent = "Kod doğrulanıyor…";
    try {
      const v = await api("/giris/kod/dogrula", { yontem: "POST", govde: { eposta: k.eposta, kod } });
      S.token = v.token; S.ben = v.ben; S.kodAdimi = null; depo.yaz("lbe-token", v.token); ciz();
    } catch (x) { gir.disabled = false; gir.textContent = "Giriş yap"; goster(x.message); }
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
  let dosya = null;
  // İlgili akademisyen: sistemde akademisyen varsa seçmek zorunlu; ön onayı o verir.
  let akademisyenVar = false;
  api("/akademisyenler").then((v) => {
    const alan = document.getElementById("akademisyen-alan");
    if (!alan || !v.akademisyenler.length) return;
    akademisyenVar = true;
    const son = depo.al("lbe-akademisyen");
    alan.innerHTML = `<label class="alan">İlgili akademisyen<select class="girdi tam" name="akademisyen_id"><option value="">Seç…</option>${v.akademisyenler.map((a) => `<option value="${a.id}"${String(a.id) === son ? " selected" : ""}>${esc(a.ad)}</option>`).join("")}</select><span class="ek">Modelin önce bu akademisyenin ön onayına, sonra YUVerse sorumlusuna gider.</span><span class="alan-hata" id="akademisyen-hata" hidden>${I.red.replace("<svg ", '<svg class="simge" ')}İlgili akademisyeni seç.</span></label>`;
  }).catch(() => {});
  const zaman = document.getElementById("zaman"), zamanYaz = () => { if (zaman.isConnected) { zaman.textContent = tarihYaz(new Date()); setTimeout(zamanYaz, 15000); } };
  zamanYaz();
  const birak = document.getElementById("birak"), girdi = document.getElementById("dosya"), secili = document.getElementById("secili"), hata = document.getElementById("hata"), form = document.getElementById("form");
  const sec = (f) => {
    hata.innerHTML = ""; birak.classList.remove("hatali");
    if (!f) return;
    const sorun = !/\.glb$/i.test(f.name) ? "Yalnız .glb dosyası yüklenir." : f.size > MAKS_BOYUT ? `Dosya 50 MB'tan büyük (${boyutYaz(f.size)}).` : f.size < 12 ? "Dosya boş görünüyor." : null;
    if (sorun) { dosya = null; secili.hidden = true; birak.hidden = false; birak.classList.add("hatali"); hata.innerHTML = bildirimHtml({ tur: "bad", kalin: f.name + ":", yazi: sorun }); return; }
    dosya = f; birak.hidden = true; secili.hidden = false;
    secili.innerHTML = `<div class="dosya"><span class="kucuk-resim">3B</span><span><b>${esc(f.name)}</b><span class="yardim sayisal">${boyutYaz(f.size)}</span></span><button type="button" class="btn btn-kucuk" id="degistir">Değiştir</button></div>`;
    document.getElementById("degistir").onclick = () => girdi.click();
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
    yuklemeBaslat(dosya, ad, ders, kisi, akademisyen);
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
async function yuklemeBaslat(dosya, modelAdi, dersKodu, yukleyenAd, akademisyenId) {
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
  bitir(ust + (liste.length ? `<div class="kutu dar" style="gap:0">${liste.map((m) => `<div class="yukleme">
      <div class="ust"><b>${esc(m.model_adi)}</b>${yuklemeRozeti(m.asama)}</div>
      <span class="yardim sayisal">${[m.yukleyen_ad, m.akademisyen_ad && "Akademisyen: " + m.akademisyen_ad, m.ders_kodu, tarihYaz(m.tarih), boyutYaz(m.boyut)].filter(Boolean).map(esc).join(" · ")}</span>
      ${m.durum === "reddedildi" && m.ret_notu ? `<div class="ek-not"><b>Ret notu:</b> ${esc(m.ret_notu)}</div>` : ""}
    </div>`).join("")}</div>` : '<div class="kutu dar"><p class="yardim">Henüz yüklediğin model yok.</p></div>'));
  function bitir(html) { if (simdikiSayfa().id === sayfa.id) document.getElementById("icerik").innerHTML = html; }
}

// ---------- Profil ----------
function profilSayfasi(sayfa) {
  kabuk(sayfa, `${baslik("Profil", "Ad ve öğrenci no her yüklemede kendiliğinden kullanılır.")}
    <div id="hata">${bildirimHtml(S.bildirim)}</div>
    <div class="kutu dar"><div class="kisi-satiri"><span class="avatar-b">${esc(basHarf(S.ben.ad))}</span><span><b>${esc(S.ben.ad)}</b><span class="yardim">${esc(S.ben.eposta)}</span></span><span class="rol">${esc(ROL_AD[S.ben.rol])}</span></div></div>
    <form class="kutu dar" id="form" novalidate>
      <label class="alan">Ad soyad<input class="girdi" name="ad" value="${esc(S.ben.ad)}" autocomplete="name" maxlength="120"></label>
      <label class="alan">Öğrenci no (isteğe bağlı)<input class="girdi" name="ogrenci_no" inputmode="numeric" value="${esc(S.ben.ogrenci_no)}" maxlength="20"><span class="ek">Oyunda görünmez.</span></label>
      <button class="btn btn-tam">Kaydet</button>
    </form>
    <div class="kutu dar">
      <button type="button" class="btn btn-tam" id="cik">Çıkış yap</button>
      <button type="button" class="btn btn-tam btn-red" id="sil">Hesabımı sil</button>
      <p class="yardim">Hesabını silersen profilin silinir. Onaylanmış modellerin kütüphanede kalır.</p>
    </div>`);
  S.bildirim = null;
  const hata = document.getElementById("hata");
  document.getElementById("form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { S.ben = (await api("/ben", { yontem: "PUT", govde: { ad: f.get("ad"), ogrenci_no: f.get("ogrenci_no") } })).ben; S.bildirim = { tur: "ok", yazi: "Kaydedildi." }; ciz(); }
    catch (x) { hata.innerHTML = hataKutusu(x); }
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
  let liste;
  try { liste = (await api("/onay/yuklemeler?durum=gelen,hafifletildi,onaylandi,reddedildi")).yuklemeler; }
  catch (x) { if (simdikiSayfa().id === sayfa.id) document.getElementById("icerik").innerHTML = ust + hataKutusu(x); return; }
  if (simdikiSayfa().id !== sayfa.id) return;
  const kart = (m) => {
    const d = [];
    if (m.asama === "akademisyen") d.push(`<button type="button" class="btn btn-birincil btn-kucuk" data-is="on-onay" data-id="${m.id}">${hoca ? "Ön onay ver" : "Hoca adına ön onay ver"}</button>`);
    if (m.asama === "sorumlu" && !hoca) d.push(`<button type="button" class="btn btn-birincil btn-kucuk" data-is="onayla" data-id="${m.id}">Onayla</button>`);
    if (m.asama === "akademisyen" || (m.asama === "sorumlu" && !hoca)) d.push(`<button type="button" class="btn btn-kucuk btn-red" data-ret="${m.id}">Reddet</button>`);
    if (m.asama === "onaylandi" && !hoca) d.push(`<button type="button" class="btn btn-kucuk" data-is="indir" data-id="${m.id}"${m.indirme.istendi || !m.indirme.tarih ? " disabled" : ""}>Sunucuya indir</button>`);
    const indirme = m.asama !== "onaylandi" ? "" : m.indirme.istendi || !m.indirme.tarih ? "Lab bilgisayarına indirilmeyi bekliyor" : "Lab bilgisayarına indirildi: " + tarihYaz(m.indirme.tarih);
    return `<div class="yukleme">
      <div class="ust"><b>${esc(m.model_adi)}</b>${yuklemeRozeti(m.asama)}</div>
      <span class="yardim sayisal">${[m.yukleyen_ad, m.ogrenci_no, m.ders_kodu, tarihYaz(m.tarih), boyutYaz(m.ozgun.boyut || m.hafif.boyut)].filter(Boolean).map(esc).join(" · ")}</span>
      ${m.akademisyen ? `<span class="yardim">Akademisyen: ${esc(m.akademisyen.ad)}${m.on_onay ? ` · ön onay ${esc(tarihYaz(m.on_onay.tarih))}${m.on_onay.hoca_adina ? " (hoca adına)" : ""}` : ""}</span>` : '<span class="yardim">Akademisyen seçilmedi</span>'}
      ${indirme ? `<span class="yardim">${esc(indirme)}</span>` : ""}
      ${m.asama === "reddedildi" && m.ret_notu ? `<div class="ek-not"><b>Ret notu:</b> ${esc(m.ret_notu)}</div>` : ""}
      ${d.length ? `<div class="dugmeler">${d.join("")}</div>` : ""}
      <form class="ret-form" data-ret-form="${m.id}" hidden novalidate><label class="alan">Ret notu<input class="girdi" name="not" maxlength="500" placeholder="Yükleyen bu notu görür"></label><div class="dugmeler"><button class="btn btn-kucuk btn-red">Reddet</button><button type="button" class="btn btn-kucuk" data-ret-vazgec="${m.id}">Vazgeç</button></div></form>
    </div>`;
  };
  const bolum = (ad, satirlar, bos) => `<h2 class="bolum-baslik">${esc(ad)} <span class="yardim sayisal">${satirlar.length}</span></h2><div class="kutu" style="gap:0">${satirlar.length ? satirlar.map(kart).join("") : `<p class="yardim">${esc(bos)}</p>`}</div>`;
  const sec = (a) => liste.filter((m) => m.asama === a);
  document.getElementById("icerik").innerHTML = ust + `<div class="dar-genis">${hoca
    ? bolum("Ön onayını bekleyenler", sec("akademisyen"), "Ön onayını bekleyen model yok.") + bolum("Ön onay verdiklerin", sec("sorumlu"), "YUVerse sorumlusunu bekleyen model yok.")
    : bolum("Onayını bekleyenler", sec("sorumlu"), "Onayını bekleyen model yok.") + bolum("Akademisyen ön onayı bekleyenler", sec("akademisyen"), "Akademisyen ön onayı bekleyen model yok.")}
    ${bolum("Onaylananlar", sec("onaylandi"), "Onaylanan model yok.")}${bolum("Reddedilenler", sec("reddedildi"), "Reddedilen model yok.")}</div>`;
  const icerik = document.getElementById("icerik");
  const yap = async (yol, govde, tamam) => {
    try { await api(yol, { yontem: "POST", govde }); S.bildirim = { tur: "ok", yazi: tamam }; }
    catch (x) { S.bildirim = { tur: "bad", yazi: x.message }; }
    if (simdikiSayfa().id === sayfa.id) onaySayfasi(sayfa);
  };
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
  let liste;
  try { liste = (await api("/kullanicilar")).kullanicilar; } catch (x) { if (simdikiSayfa().id === sayfa.id) icerik().innerHTML = ust + hataKutusu(x); return; }
  if (simdikiSayfa().id !== sayfa.id) return;
  const satir = (u) => {
    const ben = u.id === S.ben.id;
    const rol = `<select class="girdi" data-rol="${u.id}" aria-label="${esc(u.ad)} rolü"${ben ? " disabled" : ""}>${Object.entries(ROL_AD).map(([d, a]) => `<option value="${d}"${d === u.rol ? " selected" : ""}>${a}</option>`).join("")}</select>`;
    const islem = ben ? '<span class="yardim">Sen</span>'
      : u.durum === "beklemede" ? `<div class="dugmeler"><button type="button" class="btn btn-birincil btn-kucuk" data-durum="onayli" data-id="${u.id}">Onayla</button><button type="button" class="btn btn-kucuk btn-red" data-durum="reddedildi" data-id="${u.id}">Reddet</button></div>`
      : u.durum === "onayli" ? `<button type="button" class="btn btn-kucuk" data-durum="reddedildi" data-id="${u.id}">Erişimi kapat</button>`
      : `<button type="button" class="btn btn-kucuk" data-durum="onayli" data-id="${u.id}">Onayla</button>`;
    return `<tr><td><span class="avatar-b kucuk">${esc(basHarf(u.ad))}</span></td><td><b>${esc(u.ad || "Adsız")}</b><div class="yardim">${esc(u.eposta)}</div></td>
      <td class="sayisal">${u.ogrenci_no ? esc(u.ogrenci_no) : '<span class="yardim">yok</span>'}</td><td class="sayisal">${esc(tarihYaz(u.olusturma))}</td><td>${rol}</td><td>${hesapRozeti(u.durum)}</td><td>${islem}</td></tr>`;
  };
  const bekleyen = liste.filter((u) => u.durum === "beklemede").length;
  icerik().innerHTML = `${ust}<div id="hata"></div>
    <div class="kutu tablolu"><table class="tablo"><thead><tr><th></th><th>Kullanıcı</th><th>Öğrenci no</th><th>Kayıt</th><th>Rol</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>${liste.map(satir).join("")}</tbody></table></div>
    <p class="yardim">${liste.length} hesap${bekleyen ? ` · ${bekleyen} onay bekliyor` : ""}. Kendi rolünü ve durumunu değiştiremezsin.</p>`;
  const degistir = async (id, govde) => {
    try { await api("/kullanicilar/" + id, { yontem: "PUT", govde }); kullanicilarSayfasi(sayfa); }
    catch (x) { document.getElementById("hata").innerHTML = hataKutusu(x); }
  };
  icerik().querySelectorAll("[data-durum]").forEach((b) => (b.onclick = () => degistir(b.dataset.id, { durum: b.dataset.durum })));
  icerik().querySelectorAll("[data-rol]").forEach((s) => (s.onchange = () => degistir(s.dataset.rol, { rol: s.value })));
}

// ---------- Ayarlar: Drive bağlantısı (yalnız yönetici) ----------
async function ayarlarSayfasi(sayfa) {
  const ust = baslik("Ayarlar", "Google Drive bağlantısı ve giriş kodu e-postası.");
  kabuk(sayfa, ust + '<p class="yardim">Yükleniyor…</p>');
  const icerik = () => document.getElementById("icerik");
  let d, p;
  try { [d, p] = await Promise.all([api("/drive/durum"), api("/posta/durum")]); } catch (x) { if (simdikiSayfa().id === sayfa.id) icerik().innerHTML = ust + hataKutusu(x); return; }
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
    </div>`;
  const hata = document.getElementById("hata");
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
