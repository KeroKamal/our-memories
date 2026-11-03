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

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

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
  return self.registration.showNotification(d.title || 'Kero & Tota 💖', options);
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
