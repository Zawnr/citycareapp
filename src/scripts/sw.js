import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { BASE_URL } from './config'; // Pastikan path ini benar

// Do precaching
// Pastikan self.__WB_MANIFEST diinjeksikan dengan benar oleh build tool Workbox Anda
const manifest = self.__WB_MANIFEST || []; // Berikan array kosong sebagai fallback jika undefined
if (manifest.length > 0) {
  precacheAndRoute(manifest);
} else {
  console.warn('[Service Worker] __WB_MANIFEST kosong atau tidak terdefinisi. Precache tidak akan dilakukan.');
}

// Optimasi: Buat objek URL untuk BASE_URL sekali saja jika BASE_URL adalah string statis
let apiOrigin = '';
if (BASE_URL) {
  try {
    apiOrigin = new URL(BASE_URL).origin;
  } catch (e) {
    console.error('[Service Worker] BASE_URL tidak valid, tidak dapat mengekstrak origin:', BASE_URL, e);
    // apiOrigin akan tetap string kosong, rute yang bergantung padanya tidak akan didaftarkan
  }
} else {
  console.warn('[Service Worker] BASE_URL tidak terdefinisi. Rute caching untuk API internal mungkin tidak berfungsi.');
}

// Runtime caching
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com', // Perbaikan: Menghapus ')' yang berlebih
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200], // 0 untuk opaque responses (CORS), 200 untuk OK
      }),
    ],
  }),
);

registerRoute(
  // Pertimbangkan menggunakan url.href jika 'fontawesome' bisa ada di path dari berbagai origin
  // atau jika selalu dari cdnjs, bisa lebih spesifik:
  // ({ url }) => url.origin === 'https://cdnjs.cloudflare.com' && url.href.includes('fontawesome')
  ({ url }) => url.origin === 'https://cdnjs.cloudflare.com' || url.href.includes('fontawesome'),
  new CacheFirst({
    cacheName: 'fontawesome',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.origin === 'https://ui-avatars.com',
  new CacheFirst({
    cacheName: 'avatars-api',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);

// Hanya daftarkan rute API jika apiOrigin berhasil didapatkan
if (apiOrigin) {
  registerRoute(
    ({ request, url }) => url.origin === apiOrigin && request.destination !== 'image',
    new NetworkFirst({
      cacheName: 'citycare-api-data', // Nama cache bisa lebih spesifik
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200], // Cache respons yang berhasil atau opaque
        }),
      ],
    }),
  );

  registerRoute(
    ({ request, url }) => url.origin === apiOrigin && request.destination === 'image',
    new StaleWhileRevalidate({
      cacheName: 'citycare-api-images',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    }),
  );
} else {
  console.warn('[Service Worker] Rute untuk CityCare API tidak didaftarkan karena apiOrigin tidak valid.');
}

registerRoute(
  // Lebih baik memeriksa domain utama untuk mencakup subdomain jika ada, misal: tile.maptiler.com, api.maptiler.com
  ({ url }) => url.hostname.endsWith('maptiler.com'),
  new CacheFirst({
    cacheName: 'maptiler-api',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);

self.addEventListener('push', (event) => {
  console.log('[Service worker] pushing...');

  async function showNotification() {
    const data = await event.data.json();

    await self.registration.showNotification(data.title, {
      body: data.options.body,
    });
  }

  event.waitUntil(showNotification());
});
