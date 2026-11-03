'use strict';

// Firebase Cloud Functions (2nd gen). Deploy this trigger alongside any existing
// notification triggers; it only listens to documents in the `bible` collection.
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
initializeApp();

const PEOPLE = ['Kero', 'Tota'];
const partnerOf = (name) => PEOPLE.includes(name) ? PEOPLE.find(p => p !== name) : null;
const clip = (s, length = 100) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, length);
const indexed = (items) => Object.fromEntries((Array.isArray(items) ? items : []).filter(n => n && n.id != null).map(n => [String(n.id), n]));
const reacts = (obj) => obj && typeof obj === 'object' ? obj : {};

function changedEvents(before, after) {
  if (!after) return [];
  const events = [];
  const ref = `${after.book || ''}:${after.chapter || ''}:${after.verse || ''}`;
  const noteBefore = indexed(before && before.notes);
  const noteAfter = indexed(after.notes);
  function add(actor, title, body, noteId) {
    if (!partnerOf(actor)) return;
    events.push({ actor, title, body: clip(body), noteId: String(noteId || '') });
  }
  for (const actor of PEOPLE) {
    if (!(before && before.fav && before.fav[actor]) && after.fav && after.fav[actor]) {
      add(actor, '⭐ Bible verse saved', `${actor} saved a Bible verse (${ref})`);
    }
  }
  for (const [nid, note] of Object.entries(noteAfter)) {
    const old = noteBefore[nid];
    if (!old) {
      add(note.by, '💌 New Bible note', `${note.by} wrote on ${ref}: ${clip(note.text, 70)}`, nid);
      continue;
    }
    for (const [actor, emoji] of Object.entries(reacts(note.reactions))) {
      if (emoji && reacts(old.reactions)[actor] !== emoji) {
        add(actor, '❤️ Bible note reaction', `${actor} reacted ${emoji} to a note on ${ref}`, nid);
      }
    }
    const oldReplies = indexed(old.replies);
    for (const [rid, reply] of Object.entries(indexed(note.replies))) {
      const oldReply = oldReplies[rid];
      if (!oldReply) {
        add(reply.by, '💬 New Bible reply', `${reply.by} replied on ${ref}: ${clip(reply.text, 70)}`, nid);
        continue;
      }
      for (const [actor, emoji] of Object.entries(reacts(reply.reactions))) {
        if (emoji && reacts(oldReply.reactions)[actor] !== emoji) {
          add(actor, '❤️ Bible reply reaction', `${actor} reacted ${emoji} to a reply on ${ref}`, nid);
        }
      }
    }
  }
  return events;
}

exports.notifyBibleChanges = onDocumentWritten('bible/{verseId}', async (event) => {
  // Only Firestore's committed changes produce pushes. No local browser/app
  // is needed to be open for this function to run.
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  const changes = changedEvents(before, after);
  if (!changes.length) return;

  const db = getFirestore();
  const tokens = await db.collection('fcmTokens').where('user', 'in', PEOPLE).get();
  const byUser = { Kero: [], Tota: [] };
  tokens.forEach(doc => {
    const u = doc.data().user;
    if (byUser[u]) byUser[u].push(doc.id);
  });
  const messenger = getMessaging();
  for (const change of changes.slice(0, 15)) {
    const recipient = partnerOf(change.actor);
    const targets = byUser[recipient] || [];
    if (!targets.length) continue;
    // data-only FCM so existing firebase-messaging-sw.js displays one notification.
    const result = await messenger.sendEachForMulticast({
      tokens: targets,
      data: {
        title: change.title,
        body: change.body,
        url: `?bibleVerse=${encodeURIComponent(event.params.verseId)}&bibleNote=${encodeURIComponent(change.noteId)}`,
        tag: `bible-${event.id}-${change.noteId || 'save'}`
      },
      webpush: { headers: { Urgency: 'high' } }
    });
    // Remove only known-dead FCM token records, not transient failures.
    await Promise.all(result.responses.map((response, i) => {
      const code = response.error && response.error.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        return db.collection('fcmTokens').doc(targets[i]).delete();
      }
      if (!response.success) console.error('Bible push failed:', code, response.error && response.error.message);
      return Promise.resolve();
    }));
  }
});

// Exported for local smoke tests.
exports._changedEvents = changedEvents;
