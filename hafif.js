// LBE Drop paneli · hafif ön izleme kopyası.
// Yüklenen .glb'den yalnız panelde ön izleme için küçük bir kopya üretir: üçgen sayısı azaltılır, dokular küçültülür.
// Asıl dosyaya dokunmaz; oyuna giden dosya değildir. Emin olunmayan her durumda null döner (ön izleme asıl dosyayı açar).
import { MeshoptSimplifier } from "./kutuphane/meshopt_simplifier.js";

const UCGEN_HEDEF = 60000;   // kopyadaki toplam üçgen (yaklaşık)
const DOKU_KENAR = 512;      // kopyadaki en büyük doku kenarı (piksel)
const EN_COK_ORAN = 0.6;     // kopya asıl dosyanın bu oranından büyükse saklamaya değmez
const DIZI = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const ADET = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const SIKISTIRMA = ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_meshopt_compression"];

function ayir(ab) {
  const v = new DataView(ab);
  if (ab.byteLength < 20 || v.getUint32(0, true) !== 0x46546c67 || v.getUint32(4, true) !== 2) return null;
  let json = null, bin = null;
  for (let i = 12; i + 8 <= ab.byteLength;) {
    const boy = v.getUint32(i, true), tur = v.getUint32(i + 4, true);
    if (i + 8 + boy > ab.byteLength) return null;
    if (tur === 0x4e4f534a && !json) json = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, i + 8, boy)));
    else if (tur === 0x004e4942 && !bin) bin = new Uint8Array(ab, i + 8, boy);
    i += 8 + boy + ((4 - (boy % 4)) % 4);
  }
  return json && bin ? { json, bin } : null;
}

function birlestir(json, parcalar) {
  const metin = new TextEncoder().encode(JSON.stringify(json));
  const jBoy = metin.length + ((4 - (metin.length % 4)) % 4);
  let bBoy = 0;
  for (const p of parcalar) bBoy += p.length + ((4 - (p.length % 4)) % 4);
  const cikti = new Uint8Array(12 + 8 + jBoy + 8 + bBoy), v = new DataView(cikti.buffer);
  v.setUint32(0, 0x46546c67, true); v.setUint32(4, 2, true); v.setUint32(8, cikti.length, true);
  v.setUint32(12, jBoy, true); v.setUint32(16, 0x4e4f534a, true);
  cikti.fill(0x20, 20, 20 + jBoy); cikti.set(metin, 20);
  let i = 20 + jBoy;
  v.setUint32(i, bBoy, true); v.setUint32(i + 4, 0x004e4942, true); i += 8;
  for (const p of parcalar) { cikti.set(p, i); i += p.length + ((4 - (p.length % 4)) % 4); }
  return cikti;
}

// Erişimcinin verisini bitişik bir dizi olarak okur (byteStride ve hizasız veri dahil).
function oku(json, bin, ei) {
  const e = json.accessors[ei], g = json.bufferViews[e.bufferView], T = DIZI[e.componentType], n = ADET[e.type];
  const eleman = T.BYTES_PER_ELEMENT * n, adim = g.byteStride || eleman, bas = (g.byteOffset || 0) + (e.byteOffset || 0);
  if (bas + adim * (e.count - 1) + eleman > bin.length) throw new Error("erişimci taşıyor");
  const c = new T(e.count * n), v = new DataView(bin.buffer, bin.byteOffset + bas);
  const al = { 5120: "getInt8", 5121: "getUint8", 5122: "getInt16", 5123: "getUint16", 5125: "getUint32", 5126: "getFloat32" }[e.componentType];
  for (let i = 0; i < e.count; i++) for (let k = 0; k < n; k++) c[i * n + k] = v[al](i * adim + k * T.BYTES_PER_ELEMENT, true);
  return c;
}
const duz = (json, ei) => {
  const e = json.accessors[ei];
  return e && e.bufferView !== undefined && !e.sparse && DIZI[e.componentType] && ADET[e.type];
};

async function resimKucult(bayt, tur) {
  const b = await createImageBitmap(new Blob([bayt], { type: tur }));
  const o = DOKU_KENAR / Math.max(b.width, b.height);
  if (o >= 1) return null;
  const t = document.createElement("canvas");
  t.width = Math.max(1, Math.round(b.width * o)); t.height = Math.max(1, Math.round(b.height * o));
  t.getContext("2d").drawImage(b, 0, 0, t.width, t.height);
  const r = await new Promise((coz) => t.toBlob(coz, tur, 0.8));
  if (!r || r.type !== tur || r.size >= bayt.length) return null;
  return new Uint8Array(await r.arrayBuffer());
}

// ab: .glb dosyasının tamamı (ArrayBuffer). Dönen: hafif kopya (Uint8Array) ya da null.
export async function hafifKopya(ab) {
  try {
    const a = ayir(ab);
    if (!a) return null;
    const { json, bin } = a;
    if ((json.buffers || []).length !== 1 || json.buffers[0].uri) return null;
    if ((json.extensionsUsed || []).some((x) => SIKISTIRMA.includes(x))) return null;
    json.bufferViews = json.bufferViews || []; json.accessors = json.accessors || [];
    const eskiGorunum = json.bufferViews.length, yeniVeri = [];   // yeniVeri[i]: (eskiGorunum + i). görünümün baytları
    const gorunumEkle = (bayt, hedef) => { yeniVeri.push(bayt); json.bufferViews.push({ buffer: 0, byteOffset: 0, byteLength: bayt.length, ...(hedef ? { target: hedef } : {}) }); return json.bufferViews.length - 1; };
    const kullanilan = () => {
      const s = new Set();
      for (const m of json.meshes || []) for (const p of m.primitives || []) {
        if (p.indices !== undefined) s.add(p.indices);
        for (const e of Object.values(p.attributes || {})) s.add(e);
        for (const h of p.targets || []) for (const e of Object.values(h)) s.add(e);
      }
      return s;
    };
    const onceki = kullanilan();

    // --- üçgen azaltma ---
    const uygun = (p) => (p.mode === undefined || p.mode === 4) && !p.targets && !p.extensions && p.attributes && duz(json, p.attributes.POSITION)
      && json.accessors[p.attributes.POSITION].componentType === 5126 && json.accessors[p.attributes.POSITION].type === "VEC3"
      && Object.values(p.attributes).every((e) => duz(json, e) && json.accessors[e].count === json.accessors[p.attributes.POSITION].count)
      && (p.indices === undefined || (duz(json, p.indices) && json.accessors[p.indices].type === "SCALAR"));
    let toplam = 0;
    for (const m of json.meshes || []) for (const p of m.primitives || []) if (p.mode === undefined || p.mode === 4) {
      const e = json.accessors[p.indices !== undefined ? p.indices : p.attributes && p.attributes.POSITION];
      toplam += e ? Math.floor(e.count / 3) : 0;
    }
    const oran = Math.min(1, UCGEN_HEDEF / Math.max(1, toplam));
    if (oran < 0.9) {
      await MeshoptSimplifier.ready;
      const yapilan = new Map();
      for (const m of json.meshes) for (const p of m.primitives) {
        if (!uygun(p)) continue;
        const anahtar = JSON.stringify([p.indices, p.attributes]);
        if (!yapilan.has(anahtar)) {
          let sonuc = null;
          const konum = oku(json, bin, p.attributes.POSITION), kose = konum.length / 3;
          let sira = p.indices !== undefined ? Uint32Array.from(oku(json, bin, p.indices)) : Uint32Array.from({ length: kose - (kose % 3) }, (_, i) => i);
          sira = sira.subarray(0, sira.length - (sira.length % 3));
          let gecerli = sira.length >= 3;
          for (let i = 0; gecerli && i < sira.length; i++) if (sira[i] >= kose) gecerli = false;
          if (gecerli) {
            const hedef = Math.max(3, Math.floor((sira.length * oran) / 3) * 3);
            const [az] = MeshoptSimplifier.simplify(sira, konum, 3, hedef, 0.08);
            if (az.length >= 3 && az.length < sira.length * 0.95) {
              const yeniSira = Uint32Array.from(az), [esle, adet] = MeshoptSimplifier.compactMesh(yeniSira);
              const ozellik = {};
              for (const [ad, ei] of Object.entries(p.attributes)) {
                const e = json.accessors[ei], n = ADET[e.type], eski = ei === p.attributes.POSITION ? konum : oku(json, bin, ei), c = new eski.constructor(adet * n);
                for (let v = 0; v < kose; v++) if (esle[v] !== 0xffffffff) for (let k = 0; k < n; k++) c[esle[v] * n + k] = eski[v * n + k];
                const yeni = { bufferView: gorunumEkle(new Uint8Array(c.buffer), 34962), componentType: e.componentType, count: adet, type: e.type, ...(e.normalized ? { normalized: true } : {}) };
                if (ad === "POSITION") {
                  const enAz = [Infinity, Infinity, Infinity], enCok = [-Infinity, -Infinity, -Infinity];
                  for (let v = 0; v < adet; v++) for (let k = 0; k < 3; k++) { const d = c[v * 3 + k]; if (d < enAz[k]) enAz[k] = d; if (d > enCok[k]) enCok[k] = d; }
                  yeni.min = enAz; yeni.max = enCok;
                }
                json.accessors.push(yeni); ozellik[ad] = json.accessors.length - 1;
              }
              const dar = adet <= 65535, s = dar ? Uint16Array.from(yeniSira) : yeniSira;
              json.accessors.push({ bufferView: gorunumEkle(new Uint8Array(s.buffer), 34963), componentType: dar ? 5123 : 5125, count: s.length, type: "SCALAR" });
              sonuc = { attributes: ozellik, indices: json.accessors.length - 1 };
            }
          }
          yapilan.set(anahtar, sonuc);
        }
        const s = yapilan.get(anahtar);
        if (s) { p.attributes = { ...s.attributes }; p.indices = s.indices; }
      }
    }

    // --- doku küçültme ---
    for (const r of json.images || []) {
      if (r.bufferView === undefined || !["image/png", "image/jpeg"].includes(r.mimeType)) continue;
      const g = json.bufferViews[r.bufferView], bas = g.byteOffset || 0;
      if (r.bufferView >= eskiGorunum || bas + g.byteLength > bin.length) continue;
      const kucuk = await resimKucult(bin.subarray(bas, bas + g.byteLength), r.mimeType).catch(() => null);
      if (kucuk) r.bufferView = gorunumEkle(kucuk);
    }
    if (!yeniVeri.length) return null;

    // --- artık kullanılmayan erişimcileri boşalt, kullanılmayan görünümleri at ---
    const sonraki = kullanilan(), baska = new Set();
    for (const an of json.animations || []) for (const s of an.samplers || []) { baska.add(s.input); baska.add(s.output); }
    for (const s of json.skins || []) if (s.inverseBindMatrices !== undefined) baska.add(s.inverseBindMatrices);
    for (const ei of onceki) if (!sonraki.has(ei) && !baska.has(ei)) { const e = json.accessors[ei]; delete e.bufferView; delete e.byteOffset; delete e.sparse; }
    const tutulan = new Set();
    for (const e of json.accessors) {
      if (e.bufferView !== undefined) tutulan.add(e.bufferView);
      if (e.sparse) { tutulan.add(e.sparse.indices.bufferView); tutulan.add(e.sparse.values.bufferView); }
    }
    for (const r of json.images || []) if (r.bufferView !== undefined) tutulan.add(r.bufferView);
    // Erişimci ya da resim dışında bir yerden (uzantı) anılan görünüm olabilir: yalnız bu çalışmada boşa çıkanlar atılır.
    const ilkTutulan = new Set(), ilk = ayir(ab).json;
    for (const e of ilk.accessors || []) { if (e.bufferView !== undefined) ilkTutulan.add(e.bufferView); if (e.sparse) { ilkTutulan.add(e.sparse.indices.bufferView); ilkTutulan.add(e.sparse.values.bufferView); } }
    for (const r of ilk.images || []) if (r.bufferView !== undefined) ilkTutulan.add(r.bufferView);
    const yeniNo = new Map(), parcalar = [], gorunumler = [];
    let konum = 0;
    json.bufferViews.forEach((g, i) => {
      if (i < eskiGorunum ? ilkTutulan.has(i) && !tutulan.has(i) : !tutulan.has(i)) return;
      const bayt = i < eskiGorunum ? bin.subarray(g.byteOffset || 0, (g.byteOffset || 0) + g.byteLength) : yeniVeri[i - eskiGorunum];
      yeniNo.set(i, gorunumler.length);
      gorunumler.push({ ...g, byteOffset: konum, byteLength: bayt.length });
      parcalar.push(bayt);
      konum += bayt.length + ((4 - (bayt.length % 4)) % 4);
    });
    const cevir = (o, alan) => { if (o && o[alan] !== undefined) o[alan] = yeniNo.get(o[alan]); };
    for (const e of json.accessors) { cevir(e, "bufferView"); if (e.sparse) { cevir(e.sparse.indices, "bufferView"); cevir(e.sparse.values, "bufferView"); } }
    for (const r of json.images || []) cevir(r, "bufferView");
    // Uzantıların andığı görünümler yeniden numaralanamaz; numarası değişen varsa vazgeç.
    for (const [eski, yeni] of yeniNo) if (eski < eskiGorunum && eski !== yeni && !ilkTutulan.has(eski)) return null;
    json.bufferViews = gorunumler;
    json.buffers = [{ byteLength: konum }];
    const cikti = birlestir(json, parcalar);
    return cikti.length <= ab.byteLength * EN_COK_ORAN ? cikti : null;
  } catch {
    return null;
  }
}
