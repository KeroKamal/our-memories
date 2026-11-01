// Service worker for push notifications. Keep this file in the SAME folder as work.html.
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

// Notifications that include a title/body are shown automatically by the browser.
firebase.messaging();
