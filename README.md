# our-memories

Files added/changed in this update (upload ALL of them next to index.html):
- tailwind.css        – built stylesheet (replaces the slow Tailwind CDN script)
- effects.css / effects.js – drifting hearts, tap bursts, card animations, live "together" clock
- firebase-messaging-sw.js – now also caches the app for instant/offline opening
- index.html          – uses the files above + Firestore offline cache

If you add new Tailwind classes to index.html/bible.js later, rebuild tailwind.css:
  tailwindcss -c tailwind.config.js -i in.css -o tailwind.css --minify
(tailwind.config.js and in.css are included in /tools)
