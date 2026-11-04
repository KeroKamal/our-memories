/* Kero & Tota – shows phone notifications when the app is closed.
   This file must sit in the SAME folder as index.html (same website). */
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBkZws6uuVSvWnqV0WgvliL1DC5HwKgk4E",
  authDomain: "keroandtota-f0393.firebaseapp.com",
  projectId: "keroandtota-f0393",
  storageBucket: "keroandtota-f0393.firebasestorage.app",
  messagingSenderId: "664802885467",
  appId: "1:664802885467:web:c48bf52856f63ccf18a47e"
});

const messaging = firebase.messaging();
const ICON = 'https://img.icons8.com/emoji/192/heart-suit.png';

// ---- Speed + offline: remember the app's files on the phone ----------------
// Bump this number when you want every phone to drop its old copy.
const CACHE = 'kt-app-v1';
const BADGE_CACHE = 'kt-badge';   // remembers the unread number even if the phone stops this worker

// Red number on the app icon (iPhone: needs the app added to the Home Screen, iOS 16.4 or newer)
async function bumpBadge() {
  try {
    const c = await caches.open(BADGE_CACHE);
    const hit = await c.match('count');
    const n = (hit ? parseInt(await hit.text(), 10) || 0 : 0) + 1;
    await c.put('count', new Response(String(n)));
    if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(n);
  } catch (e) { /* badges are a bonus, never block the notification */ }
}

const SHELL = ['./', 'index.html', 'tailwind.css', 'effects.css', 'effects.js', 'bible.js'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  // best effort: a missing file must never block the install
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== BADGE_CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

function putCopy(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
  }
  return res;
}

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // The page itself: always try the network first so updates arrive, fall back to the saved copy.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) { return putCopy(new Request('index.html'), res); })
        .catch(function () { return caches.match('index.html').then(function (m) { return m || caches.match('./'); }); })
    );
    return;
  }

  // Our own files: show the saved copy instantly, refresh it in the background.
  if (sameOrigin) {
    if (url.pathname.endsWith('firebase-messaging-sw.js')) return;
    event.respondWith(
      caches.match(req).then(function (hit) {
        const net = fetch(req).then(function (res) { return putCopy(req, res); }).catch(function () { return hit; });
        return hit || net;
      })
    );
    return;
  }

  // Fonts, icons, Firebase SDK and Bible chapters never change: saved copy first.
  if (/(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|api\.getbible\.net)$/.test(url.hostname) ||
      (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0)) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { return putCopy(req, res); });
      })
    );
  }
  // Everything else (Firestore, photo upload script) goes straight to the network.
});

// A push arrived while the app is closed / in the background
messaging.onBackgroundMessage(function (payload) {
  const d = (payload && payload.data) || {};
  const options = {
    body: d.body || '',
    icon: ICON,
    badge: ICON,
    data: { url: d.url ? new URL(d.url, self.registration.scope).href : self.registration.scope }
  };
  if (d.tag) options.tag = d.tag;               // same tag = replaces the older one (no spam when 5 photos are added)
  return Promise.all([self.registration.showNotification(d.title || 'Kero & Tota 💖', options), bumpBadge()]);
});

// Tapping the notification opens (or focuses) the app
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      // Navigate existing app window as well: otherwise tapping a Bible push
      // focuses the app but loses its verse deep link.
      for (const c of list) {
        if ('focus' in c) {
          return Promise.resolve(c.navigate ? c.navigate(url) : c).then(function (target) {
            return (target || c).focus();
          });
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
