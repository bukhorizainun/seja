// Service worker Seja: halaman yang pernah dibuka tetap bisa dibaca tanpa internet.
// - Aset /_next/static (nama berkas memuat hash) dan huruf: cache-first.
// - Halaman & data navigasi (.txt): network-first tanpa cache HTTP, jatuh ke cache saat offline.
// - Permintaan ke domain lain (mis. audio murottal) tidak disentuh.
// Naikkan versi bila strategi cache berubah; cache lama dihapus saat SW baru aktif.
const CACHE = "seja-v2";
const BASE = new URL(self.registration.scope).pathname; // mis. "/seja/"
const INTI = ["", "ibadah/", "hadits/", "quran/", "infaq/"].map((p) => BASE + p);

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(INTI.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    // no-cache: selalu cek ulang ke server (ETag), agar versi baru langsung tampil setelah deploy.
    // Request navigasi tidak boleh dibuat ulang dengan opsi, jadi dipakai URL-nya.
    const res = await fetch(req.mode === "navigate" ? req.url : req, { cache: "no-cache", credentials: "same-origin" });
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch {
    const hit = (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    if (req.mode === "navigate") {
      const home = await caches.match(BASE);
      if (home) return home;
    }
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) return;
  if (url.pathname.includes("/_next/static/") || /\.(woff2?|png|svg|jpe?g|webmanifest)$/.test(url.pathname)) {
    e.respondWith(cacheFirst(req));
  } else {
    e.respondWith(networkFirst(req));
  }
});
