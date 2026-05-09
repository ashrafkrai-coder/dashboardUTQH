# PWA Setup (Dashboard UTQH)

Fail PWA minimum yang telah disediakan:

- `manifest.webmanifest`
- `sw.js`
- `pwa-register.js`
- `offline.html`
- `icons/icon-192.svg`
- `icons/icon-512.svg`
- `index.html` (contoh asas)

## Cara guna jika anda ada projek sedia ada

1. Pastikan `manifest.webmanifest`, `sw.js`, `offline.html`, dan folder `icons/` berada dalam folder static/public app anda.
2. Pastikan halaman utama ada:
   - `<link rel="manifest" href="/manifest.webmanifest" />`
   - `<meta name="theme-color" content="#0f172a" />`
3. Import atau letak skrip `pwa-register.js` di halaman utama untuk daftar service worker.

## Ujian ringkas

1. Jalankan app di `https` atau `localhost`.
2. Buka DevTools > Application:
   - Manifest dibaca tanpa ralat.
   - Service Worker status `activated`.
3. Cuba `Offline` mode dalam DevTools dan refresh: halaman `offline.html` dipaparkan.
