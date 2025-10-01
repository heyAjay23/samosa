// Chat.js — spectator chat module
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc,
  onSnapshot, serverTimestamp, deleteDoc, increment, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// --- CONFIG: keep same as other files ---
const firebaseConfig = {
  apiKey: "AIzaSyDOrok6tfuLqymYsADST7Pck9RavUx2Sfc",
  authDomain: "scoopygames-60456.firebaseapp.com",
  databaseURL: "https://scoopygames-60456-default-rtdb.firebaseio.com",
  projectId: "scoopygames-60456",
  storageBucket: "scoopygames-60456.firebasestorage.app",
  messagingSenderId: "562779988237",
  appId: "1:562779988237:web:e4ad36fbe1cc926f015044"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM
const chatPanel = document.getElementById('chatPanel');
const chatList = document.getElementById('chatList');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const spectatorSummary = document.getElementById('spectatorSummary');
const spectatorCorrectCountEl = document.getElementById('spectatorCorrectCount');

// Read URL params
const url = new URL(location.href);
const room = (url.searchParams.get('room') || '').toUpperCase();
const name = url.searchParams.get('name') || localStorage.getItem('playerName') || 'Spectator';
const mode = (url.searchParams.get('mode') || '').toLowerCase();

// Utility normalize function for guesses
function normalizeGuess(s){
  return (s||'').toString().toLowerCase().trim().replace(/[^a-z0-9 ]+/gi,'').replace(/\s+/g,' ').trim();
}

let myUid = null;
let mySpectatorDocRef = null;
let currentFrameIndex = null;
let currentMovieName = null;
let chatUnsub = null;
let roomUnsub = null;

// If not spectator mode, show spectator summary for players only
if (!mode || mode !== 'spectator') {
  // players should see spectator summary; subscribe to room spectatorCorrectCount updates
  if (room && spectatorSummary) {
    spectatorSummary.style.display = 'block';
    const roomRef = doc(db, 'rooms', room);
    roomUnsub = onSnapshot(roomRef, snap => {
      const d = snap.data() || {};
      const cnt = d.spectatorCorrectCount || 0;
      spectatorCorrectCountEl.textContent = String(cnt);
    });
  }
  // no further chat setup for players
} else {
  // Spectator flow: sign in and then set presence and chat UI
  chatPanel.classList.remove('hidden');

  signInAnonymously(auth).catch(console.warn);

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    myUid = user.uid;

    // create a spectator doc in rooms/{room}/spectators/{uid}
    mySpectatorDocRef = doc(db, 'rooms', room, 'spectators', myUid);
    try {
      await setDoc(mySpectatorDocRef, { name, joinedAt: serverTimestamp(), lastCorrectFrame: -1 }, { merge: true });
    } catch (e) {
      console.warn('Could not create spectator presence', e);
    }

    // subscribe to chat list (spectatorChats collection)
    const chatCol = collection(db, 'rooms', room, 'spectatorChats');
    const q = query(chatCol, orderBy('ts', 'asc'));
    chatUnsub = onSnapshot(q, snap => {
      chatList.innerHTML = '';
      snap.forEach(docSnap => {
        const m = docSnap.data();
        const el = document.createElement('div');
        el.className = 'msg';
        if (m.correct) el.classList.add('correct');
        else if (m.correct === false && typeof m.correct === 'boolean') el.classList.add('wrong');

        const who = document.createElement('div');
        who.className = 'msg-who';
        who.textContent = m.name || 'Spectator';

        const text = document.createElement('div');
        text.className = 'msg-text';
        text.textContent = m.text || '';

        const meta = document.createElement('div');
        meta.className = 'msg-meta';
        const t = m.ts && m.ts.toDate ? m.ts.toDate().toLocaleTimeString() : '';
meta.textContent = m.correct 
  ? `✅ ${t}` 
  : (m.correct === false 
      ? `❌ ${t}` 
      : t);

        el.appendChild(who);
        el.appendChild(text);
        el.appendChild(meta);
        chatList.appendChild(el);

        // auto-scroll
        chatList.scrollTop = chatList.scrollHeight;
      });
    });

    // subscribe to room doc to track current frame and movie name
    const roomRef = doc(db, 'rooms', room);
    roomUnsub = onSnapshot(roomRef, snap => {
      const d = snap.data() || {};
      currentFrameIndex = d.index ?? 0;
      // determine currentMovieName from playlist if present
      const pl = d.playlist || [];
      const item = pl[currentFrameIndex];
      if (item) {
        currentMovieName = (typeof item === 'string' ? '' : (item.name || ''));
      } else {
        currentMovieName = '';
      }
      // when frame changes, ensure chat input enabled
      if (chatInput) chatInput.disabled = false;
    });

    // cleanup on exit
    window.addEventListener('beforeunload', async () => {
      try {
        if (mySpectatorDocRef) await deleteDoc(mySpectatorDocRef);
      } catch (e) { /* best effort */ }
    });
  });

  // chat send handler
  chatForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const raw = chatInput.value || '';
    if (!raw.trim()) return;
    const text = raw.trim();
    chatInput.value = '';

    // read current room snapshot to double-check frame & the movie name
    try {
      const roomRef = doc(db, 'rooms', room);
      const snap = await getDoc(roomRef);
      const d = snap.exists() ? snap.data() : {};
      const idx = d.index ?? 0;
      const pl = d.playlist || [];
      const item = pl[idx];
      const movieName = item && typeof item !== 'string' ? (item.name || '') : '';
      const normGuess = normalizeGuess(text);
      const normMovie = normalizeGuess(movieName);

      // build message payload
      const payload = {
        uid: myUid,
        name,
        text,
        ts: serverTimestamp()
      };

      // if match -> correct
      if (normMovie && normGuess && normGuess === normMovie) {
        // Prevent double-increment for same spectator/frame:
        // We'll set field lastCorrectFrame on spectator doc and only increment once per spectator per frame
        const specRef = doc(db, 'rooms', room, 'spectators', myUid);
        const specSnap = await getDoc(specRef);
        const lastCorrectFrame = specSnap.exists() ? (specSnap.data().lastCorrectFrame ?? -1) : -1;
        if (lastCorrectFrame !== idx) {
          // 1) write chat message with correct:true
          payload.correct = true;
          payload.frame = idx;
          await addDoc(collection(db, 'rooms', room, 'spectatorChats'), payload);

          // 2) update spectator doc lastCorrectFrame
          await setDoc(specRef, { lastCorrectFrame: idx }, { merge: true });

          // 3) increment spectatorCorrectCount in room doc (reset elsewhere)
          await updateDoc(roomRef, { spectatorCorrectCount: increment(1) });
        } else {
          // already counted for this spectator & frame — still write a success message but don't increment
          payload.correct = true;
          payload.frame = idx;
          await addDoc(collection(db, 'rooms', room, 'spectatorChats'), payload);
        }
      } else {
        // wrong guess — write message with correct:false
        payload.correct = false;
        payload.frame = idx;
        await addDoc(collection(db, 'rooms', room, 'spectatorChats'), payload);
      }
    } catch (e) {
      console.warn('Failed to send chat', e);
      // fallback: still add local message (best-effort)
      try { await addDoc(collection(db, 'rooms', room, 'spectatorChats'), { uid: myUid, name, text, ts: serverTimestamp(), correct: false }); } catch(_){}
    }
  });
}