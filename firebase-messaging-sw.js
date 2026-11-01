// Service worker for push notifications. Keep this file in the SAME folder as work.html.
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

// Tapping a notification opens the app itself (not the site root).
// Registered BEFORE firebase.messaging() so it runs first and replaces Firebase's own link handling.
self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  const appPath = new URL(self.location.href).searchParams.get('app');
  const target = new URL(appPath || self.registration.scope, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.split('#')[0].split('?')[0] === target.split('#')[0].split('?')[0] && 'focus' in c) return c.focus();
      }
      return clients.openWindow(target);
    })
  );
});

firebase.initializeApp({
  apiKey: "AIzaSyBkZws6uuVSvWnqV0WgvliL1DC5HwKgk4E",
  authDomain: "keroandtota-f0393.firebaseapp.com",
  projectId: "keroandtota-f0393",
  storageBucket: "keroandtota-f0393.firebasestorage.app",
  messagingSenderId: "664802885467",
  appId: "1:664802885467:web:c48bf52856f63ccf18a47e"
});

// Notifications that include a title/body are shown automatically by the browser.
firebase.messaging();
