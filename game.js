// game.js
// Firebase v10 imports (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection, onSnapshot,
  serverTimestamp, deleteDoc, runTransaction, query, orderBy, increment, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// --- Firebase config (keep your config) ---
const firebaseConfig = {
  apiKey: "AIzaSyDOrok6tfuLqymYsADST7Pck9RavUx2Sfc",
  authDomain: "scoopygames-60456.firebaseapp.com",
  databaseURL: "https://scoopygames-60456-default-rtdb.firebaseio.com",
  projectId: "scoopygames-60456",
  storageBucket: "scoopygames-60456.firebasestorage.app",
  messagingSenderId: "562779988237",
  appId: "1:562779988237:web:e4ad36fbe1cc926f015044"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// -------------------- constants & rounds --------------------
const FRAMES_PER_ROUND = 10;
const ROUNDS = [
  { id: "hollywood", label: "Hollywood Movies" },
  { id: "indian", label: "Indian Movies" },
  { id: "dialogue", label: "Guess the Dialogue" }
];

// Characters/logo base (same repo used by HomePage)
const CHAR_RAW_BASE = "https://raw.githubusercontent.com/heyAjay23/logos/main/";
const CHARACTERS = [
  { id:'supersuper', name:'SuperSuper', file:'SuperSuper.jpg', emoji:'🥇' },
  { id:'wvish',      name:'Wvish',      file:'Wvish.jpg',      emoji:'✨' },
  { id:'moviestalk', name:'Moviestalk', file:'Moviestalk.jpg', emoji:'🎬' },
  { id:'desinerd',   name:'DesiNerd',   file:'Desi ners.jpg',  emoji:'🧠' },
  { id:'bnftb',      name:'Bnftb',      file:'bnftv.jpeg',    emoji:'🎧' },
  { id:'thepj',      name:'ThePJ',      file:'pj.jpg',         emoji:'🎭' },
  { id:'comicverse', name:'Comicverse', file:'comicverse.jpeg',emoji:'🖼' },
  { id:'abhireview', name:'Abhi Review',file:'abhi review.jpeg',emoji:'📝' },
  { id:'surajkumar', name:'Suraj Kumar',file:'images.jpeg',    emoji:'🎤' },
  { id:'yogi',       name:'Yogi Bolta Hai', file:'yogi.jpg',    emoji:'🗣' }
].map(c => ({ ...c, url: CHAR_RAW_BASE + encodeURIComponent(c.file) }));

// Repo raw bases mapping (optional)
const REPO_RAW_BASES = {
  hollywood: "https://raw.githubusercontent.com/heyAjay23/hollywood-/main/",
  indian:    "https://raw.githubusercontent.com/heyAjay23/bollywood-frame/main/",
  dialogue:  "https://raw.githubusercontent.com/heyAjay23/dialogue/main/"
};

// -------------------- DOM refs --------------------
const $ = s => document.querySelector(s);

const roomVal   = $("#roomVal");
const nameVal   = $("#nameVal");
const roundVal  = $("#roundVal");
const roundNameEl = $("#roundName");
const pcountEl  = $("#pcount");
const playersEl = $("#players");
const statusEl  = $("#status");
const copyCode  = $("#copyCode");
const copyInvite= $("#copyInvite");

const nextFrameBtn = $("#nextFrameBtn");
const prevFrameBtn = $("#prevFrameBtn");
const revealBtn    = $("#revealBtn");
const showMovieBtn = $("#showMovieBtn");

const buzzerBtn    = $("#buzzerBtn");
const buzzerStatus = $("#buzzerStatus");

const frameVal  = $("#frameVal");
const frameVal2 = $("#frameVal2");
const buzzList  = $("#buzzList");
const movieFrame= $("#movieFrame");

const movieBox      = $("#movieBox");
const revealOverlay = $("#revealOverlay");
const waitMsg       = $("#waitMsg");
const roundDoneMsg  = $("#roundDoneMsg");
const movieNameCard = $("#movieNameCard");
const movieNameText = $("#movieNameText");

const roundBanner   = $("#roundBanner");
const roundBannerText = $("#roundBannerText");

// winner modal (we will create if not present)
let winnerModalEl = $("#winnerModal");

// small toast for actions / copy feedback
function makeToastEl(){
  let t = $("#actionToast");
  if (t) return t;
  t = document.createElement("div");
  t.id = "actionToast";
  t.style.position = "fixed";
  t.style.left = "50%";
  t.style.transform = "translateX(-50%)";
  t.style.bottom = "18px";
  t.style.background = "rgba(10,12,20,0.95)";
  t.style.color = "#dfe9ff";
  t.style.padding = "10px 14px";
  t.style.borderRadius = "10px";
  t.style.boxShadow = "0 10px 30px rgba(2,6,23,0.6)";
  t.style.zIndex = 9999;
  t.style.display = "none";
  document.body.appendChild(t);
  return t;
}
const actionToast = makeToastEl();
function showActionToast(text, ms=2500){
  actionToast.textContent = text;
  actionToast.style.display = "block";
  clearTimeout(actionToast._timer);
  actionToast._timer = setTimeout(()=> actionToast.style.display = "none", ms);
}

// small corner status for "Host changing frame" etc.
function showCornerStatus(text){
  let el = $("#cornerStatus");
  if(!el){
    el = document.createElement("div");
    el.id = "cornerStatus";
    el.style.position = "fixed";
    el.style.top = "84px";
    el.style.right = "20px";
    el.style.background = "rgba(10,12,20,0.85)";
    el.style.color = "#dfe9ff";
    el.style.padding = "8px 12px";
    el.style.borderRadius = "8px";
    el.style.zIndex = 9999;
    document.body.appendChild(el);
  }
  if(!text){ el.style.display = "none"; return; }
  el.textContent = text;
  el.style.display = "block";
}

// -------------------- session / url --------------------
const url = new URL(location.href);
let room = (url.searchParams.get("room") || "").toUpperCase();
let name = url.searchParams.get("name") || localStorage.getItem("playerName") || "";
const mode = (url.searchParams.get("mode") || "").toLowerCase();
const qCharacter = url.searchParams.get("character") || null;

if (!room) room = (prompt("Enter room code") || "").toUpperCase();
if (!name) name = prompt("Enter your name") || "Player";
localStorage.setItem("playerName", name);

if (roomVal) roomVal.textContent = room || "—";
if (nameVal) nameVal.textContent = name;

// -------------------- state --------------------
let myUid = null;
let iAmHost = false;
let currentMovieName = "Unknown";
let listenersInitialized = false;
let buzzUnsub = null;

// -------------------- firestore helpers --------------------
const playersCol     = (code)=> collection(db, "rooms", code, "players");
const frameBuzzesCol = (code, frame)=> collection(db, "rooms", code, "frames", String(frame), "buzzes");
const roomDoc        = (code)=> doc(db, "rooms", code);

// Ensure room exists and populate defaults if missing
async function ensureRoomAndMaybeClaimHost(roomCode, uid){
  const ref = roomDoc(roomCode);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const exists = snap.exists();
    if (!exists) {
      const r0 = ROUNDS[0];
      tx.set(ref, {
        createdAt: serverTimestamp(),
        currentFrame: 1,
        index: 0,
        round: 1,
        roundIndex: 0,
        roundId: r0.id,
        roundLabel: r0.label,
        framesPerRound: FRAMES_PER_ROUND,
        frameRevealed: false,
        endOfRound: false,
        movieNameRevealed: false,
        revealedMovieName: "",
        hostUid: uid,
        playlist: []
      });
      return;
    }
    const data = snap.data() || {};
    const patch = {};
    if (data.currentFrame == null) patch.currentFrame = 1;
    if (data.index == null) patch.index = 0;
    if (data.round == null) patch.round = 1;
    if (data.roundIndex == null) patch.roundIndex = 0;
    if (!data.roundId) patch.roundId = ROUNDS[0].id;
    if (!data.roundLabel) patch.roundLabel = ROUNDS[0].label;
    if (data.framesPerRound == null) patch.framesPerRound = FRAMES_PER_ROUND;
    if (data.frameRevealed == null) patch.frameRevealed = false;
    if (data.endOfRound == null) patch.endOfRound = false;
    if (data.movieNameRevealed == null) patch.movieNameRevealed = false;
    if (data.revealedMovieName == null) patch.revealedMovieName = "";
    if (!data.hostUid && uid) patch.hostUid = uid;
    if (Object.keys(patch).length) tx.update(ref, patch);
  });
  return ref;
}

// Load pack/documents: try Firestore packs/{roundId}, then repo mapping, then fallback
async function loadPackToRoom(roomCode, roundIndex){
  const roundMeta = ROUNDS[roundIndex] || ROUNDS[0];
  const packRef = doc(db, "packs", roundMeta.id);
  let pickedFiles = [];

  // 1) try Firestore pack (admin upload)
  try {
    const snap = await getDoc(packRef);
    if (snap.exists()) {
      const data = snap.data() || {};
      const files = data.files || [];
      pickedFiles = files.map((f, i) => {
        if (typeof f === "string") {
          return { url: f, name: `Frame ${i + 1}` };
        }
        return { url: f.url || f, name: f.name || `Frame ${i + 1}` };
      });
      console.log(`Loaded pack from packs/${roundMeta.id}, count=${pickedFiles.length}`);
    }
  } catch (e) {
    console.warn("Could not read packs from Firestore:", e);
  }

  // 2) repo fallback (frame1.jpg ... frameN.jpg)
  if (!pickedFiles.length) {
    const repoBase = REPO_RAW_BASES[roundMeta.id];
    if (repoBase) {
      pickedFiles = Array.from({ length: FRAMES_PER_ROUND }, (_, i) => ({
        url: `${repoBase}${encodeURIComponent(`frame${i + 1}.jpg`)}`,
        name: `Frame ${i + 1}`
      }));
      console.log(`Using repo fallback for '${roundMeta.id}' base=${repoBase}`);
    }
  }

  // 3) local placeholder fallback
  if (!pickedFiles.length) {
    pickedFiles = Array.from({ length: FRAMES_PER_ROUND }, (_, i) => ({
      url: "movie1.jpg",
      name: `Frame ${i + 1}`
    }));
    console.log("Using local placeholder frames as fallback.");
  }

  // 4) write playlist to room doc so clients will react
  try {
    await updateDoc(roomDoc(roomCode), {
      playlist: pickedFiles,
      index: 0,
      frameRevealed: false,
      endOfRound: false,
      movieNameRevealed: false,
      revealedMovieName: "",
      roundIndex,
      round: roundIndex + 1,
      roundId: roundMeta.id,
      roundLabel: roundMeta.label,
      roundBanner: `Starting ${roundMeta.label}`,
      roundBannerAt: serverTimestamp(),
      action: `Host loaded ${roundMeta.label}`
    });
  } catch (e) {
    console.warn("Could not update room playlist:", e);
  }
}

// Host assignment utility if host left
async function assignNewHostIfNeeded(players){
  const ref = roomDoc(room);
  const s = await getDoc(ref);
  const d = s.data() || {};
  if (!d.hostUid && players.length > 0) {
    const newHost = players[0];
    await updateDoc(ref, { hostUid: newHost.id });
    if (newHost.id === myUid) iAmHost = true;
  }
}

// -------------------- Frame controls --------------------
async function nextFrame(roomCode){
  // We'll use a transaction and return whether round changed & the new roundIndex
  const txResult = await runTransaction(db, async (tx) => {
    const ref = roomDoc(roomCode);
    const snap = await tx.get(ref);
    const d = snap.data() || {};
    const fpr = d.framesPerRound || FRAMES_PER_ROUND;
    const idx = d.index || 0;
    const currentRoundIndex = d.roundIndex || 0;

    // If last frame of this round, switch or mark endOfRound
    if (idx >= fpr - 1) {
      const nextRoundIndex = Math.min(currentRoundIndex + 1, ROUNDS.length - 1);
      if (nextRoundIndex !== currentRoundIndex) {
        tx.update(ref, {
          currentFrame: (d.currentFrame || 1) + 1,
          index: 0,
          frameRevealed: false,
          endOfRound: false,
          movieNameRevealed: false,
          revealedMovieName: "",
          roundIndex: nextRoundIndex,
          round: nextRoundIndex + 1,
          roundId: ROUNDS[nextRoundIndex].id,
          roundLabel: ROUNDS[nextRoundIndex].label,
         roundBanner: `Starting ${ROUNDS[nextRoundIndex].label}`,
roundBannerAt: serverTimestamp(),
action: `Host moved to next round: ${ROUNDS[nextRoundIndex].label}`

        });
        return { roundChanged: true, nextRoundIndex };
      } else {
        tx.update(ref, {
          currentFrame: (d.currentFrame || 1) + 1,
          frameRevealed: false,
          endOfRound: true,
          movieNameRevealed: false,
          revealedMovieName: "",
          action: "Host ended the round"
        });
        return { roundChanged: false };
      }
    }

    // Normal advance
    tx.update(ref, {
      index: idx + 1,
      currentFrame: (d.currentFrame || 1) + 1,
      frameRevealed: false,
      endOfRound: false,
      movieNameRevealed: false,
      revealedMovieName: "",
      action: "Host changed the frame"
    });
    return { roundChanged: false };
  });

  // After transaction completes, if the round changed load the new pack
  if (txResult && txResult.roundChanged) {
    try {
      // attempt to load the pack for the new round index
      await loadPackToRoom(roomCode, txResult.nextRoundIndex);
    } catch (e) {
      console.warn("Failed to load new round's pack:", e);
    }
  }
}

async function prevFrame(roomCode){
  const txResult = await runTransaction(db, async (tx) => {
    const ref = roomDoc(roomCode);
    const snap = await tx.get(ref);
    const d = snap.data() || {};
    const idx = d.index || 0;
    const size = (d.playlist || []).length;
    const prevIndex = size ? Math.max(idx - 1, 0) : 0;
    tx.update(ref, {
      index: prevIndex,
      currentFrame: Math.max((d.currentFrame || 1) - 1, 1),
      frameRevealed: false,
      endOfRound: false,
      movieNameRevealed: false,
      revealedMovieName: "",
      action: "Host moved to previous frame"
    });
    return { roundChanged: false };
  });

  // no round change handling required for prevFrame
}

// -------------------- buzz handling --------------------
async function awardScore(targetUid, points=10){
  if (!iAmHost) return;
  const ref = doc(db, "rooms", room, "players", targetUid);
  await updateDoc(ref, { score: increment(points) });
}

async function pressBuzzerOnce(roomCode, currentFrame, uid, playerName){
  const key = doc(db, "rooms", roomCode, "frames", String(currentFrame), "buzzes", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(key);
    if (snap.exists()) { throw new Error("Already buzzed."); }
    tx.set(key, { name: playerName || "Player", ts: serverTimestamp(), uid });
  });
}

function attachBuzzListener(roomCode, currentFrame){
  if (buzzUnsub){ try{ buzzUnsub(); } catch(_){} buzzUnsub = null; }
  const q = query(frameBuzzesCol(roomCode, currentFrame), orderBy("ts","asc"));
  buzzUnsub = onSnapshot(q, (snap) => {
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...(d.data()||{}) }));
    renderBuzzOrder(list);
  });
}

// -------------------- rendering --------------------
function makePlayerLogoElement(player){
  const wrapper = document.createElement("div");
  wrapper.style.width = "40px";
  wrapper.style.height = "40px";
  wrapper.style.borderRadius = "999px";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "center";
  wrapper.style.flex = "0 0 40px";
  wrapper.style.overflow = "hidden";
  wrapper.style.marginRight = "12px";

  if (player && player.character) {
    const ch = CHARACTERS.find(c => c.id === player.character);
    if (ch) {
      const img = document.createElement("img");
      img.src = ch.url;
      img.alt = ch.name;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.onerror = () => { wrapper.textContent = ch.emoji; wrapper.style.fontSize = "18px"; };
      wrapper.appendChild(img);
      return wrapper;
    }
  }

  const initial = document.createElement("div");
  initial.textContent = (player && player.name ? player.name : "P").charAt(0).toUpperCase();
  initial.style.width = "100%";
  initial.style.height = "100%";
  initial.style.display = "flex";
  initial.style.alignItems = "center";
  initial.style.justifyContent = "center";
  initial.style.background = "#475569";
  initial.style.color = "#fff";
  initial.style.fontWeight = 800;
  wrapper.appendChild(initial);
  return wrapper;
}

function renderPlayers(arr){
  // sort host first then by score desc then name
  arr.sort((a,b) => (b.host?1:0)-(a.host?1:0) || (b.score||0)-(a.score||0) || ((a.name||"").localeCompare(b.name||"")));
  if (playersEl) playersEl.innerHTML = "";
  for (const p of arr){
    const li = document.createElement("li");
    li.className = "player-row";
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    li.style.padding = "8px";
    li.style.borderRadius = "8px";
    li.style.background = "linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.005))";
    li.style.border = "1px solid rgba(255,255,255,0.02)";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";

    // logo / initial
    const logoEl = makePlayerLogoElement(p);
    left.appendChild(logoEl);

    const nameWrap = document.createElement("div");
    nameWrap.style.display = "flex";
    nameWrap.style.flexDirection = "column";
    nameWrap.style.justifyContent = "center";

    const nameLine = document.createElement("div");
    nameLine.style.fontWeight = "700";
    nameLine.style.color = "#f0f9ff";
nameLine.textContent = `${p.name || "Player"}${p.host ? " 👑" : ""}`;

    nameWrap.appendChild(nameLine);
    left.appendChild(nameWrap);

    const right = document.createElement("div");
    right.className = "p-right";
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "8px";

    const scoreEl = document.createElement("span");
    scoreEl.className = "score-badge";
    scoreEl.textContent = Number(p.score||0);
    right.appendChild(scoreEl);

    if (iAmHost) {
      const btn = document.createElement("button");
      btn.className = "awardBtn";
      btn.textContent = "+10";
btn.title = `Give +10 to ${p.name || "Player"}`;
      btn.addEventListener("click", ()=> awardScore(p.id, 10));
      right.appendChild(btn);
    }

    li.appendChild(left);
    li.appendChild(right);
    playersEl.appendChild(li);
  }
  if (pcountEl) pcountEl.textContent = String(arr.length);
}

function renderBuzzOrder(list){
  if (buzzList) buzzList.innerHTML = "";
  list.forEach((b, idx) => {
    const li = document.createElement("li");
    li.className = "buzz-row";
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    li.style.padding = "6px 8px";
    li.style.borderRadius = "8px";
    li.style.background = "rgba(255,255,255,0.02)";
    li.style.marginBottom = "6px";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";

    // small logo / initial
    const smallLogo = makePlayerLogoElement(b);
    smallLogo.style.width = "32px";
    smallLogo.style.height = "32px";
    smallLogo.style.marginRight = "8px";
    left.appendChild(smallLogo);

    const nameSpan = document.createElement("span");
nameSpan.textContent = `${idx + 1}. ${b.name || "Player"}`;
    left.appendChild(nameSpan);

    li.appendChild(left);

    if (iAmHost && b.id) {
      const btn = document.createElement("button");
      btn.className = "awardBtn small";
      btn.textContent = "+10";
      btn.title = `Give +10 to ${b.name || "Player"}`;
      btn.addEventListener("click", ()=> awardScore(b.id, 10));
      li.appendChild(btn);
    }

    buzzList.appendChild(li);
  });
}

// -------------------- winner modal --------------------
function showWinnerModal(topPlayers){
  if (!winnerModalEl) {
    winnerModalEl = document.createElement("div");
    winnerModalEl.id = "winnerModal";
    Object.assign(winnerModalEl.style, {
      position: "fixed",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(6,8,15,0.6)",
      zIndex: 1200
    });
    document.body.appendChild(winnerModalEl);
  }

  winnerModalEl.innerHTML = "";
  const card = document.createElement("div");
  card.className = "winner-card";
  card.style.background = "linear-gradient(180deg,#0b1220,#09101a)";
  card.style.padding = "22px";
  card.style.borderRadius = "14px";
  card.style.color = "#fff";
  card.style.minWidth = "320px";
  card.style.maxWidth = "680px";
  card.style.boxShadow = "0 20px 60px rgba(2,6,23,0.8)";

  const h = document.createElement("h2");
  h.textContent = "🏆 Round Winners";
  card.appendChild(h);

  // top area like image you shared (center big winner)
  if (topPlayers[0]) {
    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "center";
    top.style.alignItems = "center";
    top.style.gap = "14px";
    top.style.margin = "12px 0";
    const big = document.createElement("div");
    big.style.display = "flex";
    big.style.flexDirection = "column";
    big.style.alignItems = "center";
    big.style.gap = "8px";

    // big logo
    const logoWrap = document.createElement("div");
    logoWrap.style.width = "120px";
    logoWrap.style.height = "120px";
    logoWrap.style.borderRadius = "999px";
    logoWrap.style.overflow = "hidden";
    logoWrap.style.display = "flex";
    logoWrap.style.alignItems = "center";
    logoWrap.style.justifyContent = "center";
    logoWrap.style.background = "linear-gradient(90deg,#ffd36b,#ff9a6b)";
    logoWrap.style.border = "8px solid rgba(255,255,255,0.06)";

    // find character image if exists (we assume winner object has character)
    const winner = topPlayers[0];
    if (winner.character) {
      const ch = CHARACTERS.find(c=>c.id===winner.character);
      if (ch) {
        const img = document.createElement("img");
        img.src = ch.url;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        img.onerror = ()=> { logoWrap.textContent = ch.emoji; };
        logoWrap.appendChild(img);
      } else {
        const init = document.createElement("div");
        init.textContent = (winner.name||"P").charAt(0).toUpperCase();
        logoWrap.appendChild(init);
      }
    } else {
      const init = document.createElement("div");
      init.textContent = (winner.name||"P").charAt(0).toUpperCase();
      init.style.fontWeight = 900;
      logoWrap.appendChild(init);
    }

    const winnerName = document.createElement("div");
    winnerName.style.fontWeight = 900;
    winnerName.style.marginTop = "6px";
winnerName.textContent = `${winner.name} — ${winner.score} pts`;

    big.appendChild(logoWrap);
    big.appendChild(winnerName);
    top.appendChild(big);
    card.appendChild(top);
  }

  // list remaining winners
  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gridTemplateColumns = "1fr 1fr";
  list.style.gap = "8px";
  for (let i=1;i<Math.max(3, topPlayers.length); i++){
const p = topPlayers[i] || { name: `Player ${i + 1}`, score: 0, character: null };
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.padding = "8px";
    row.style.borderRadius = "10px";
    row.style.background = "rgba(255,255,255,0.02)";
    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "10px";

    const logo = makePlayerLogoElement(p);
    logo.style.width = "40px";
    logo.style.height = "40px";
    left.appendChild(logo);

    const nameEl = document.createElement("div");
    nameEl.textContent = p.name;
    nameEl.style.fontWeight = 800;
    left.appendChild(nameEl);

    const scoreEl = document.createElement("div");
scoreEl.textContent = `${p.score} pts`;
    scoreEl.style.fontWeight = 800;

    row.appendChild(left);
    row.appendChild(scoreEl);
    list.appendChild(row);
  }
  card.appendChild(list);

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.justifyContent = "flex-end";
  actions.style.gap = "8px";
  actions.style.marginTop = "12px";

  const leaveBtn = document.createElement("button");
  leaveBtn.className = "mini warn";
  leaveBtn.textContent = "Leave Room";
  leaveBtn.addEventListener("click", ()=> location.href = "HomePage.html");

  const closeBtn = document.createElement("button");
  closeBtn.className = "mini";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", ()=> winnerModalEl.style.display = "none");

  actions.appendChild(leaveBtn);
  actions.appendChild(closeBtn);
  card.appendChild(actions);

  winnerModalEl.appendChild(card);
  winnerModalEl.style.display = "flex";
}

// -------------------- utilities --------------------
function showHostControls(on){
  const disp = on ? "inline-block" : "none";
  if (nextFrameBtn) nextFrameBtn.style.display = disp;
  if (prevFrameBtn) prevFrameBtn.style.display = disp;
  if (revealBtn)    revealBtn.style.display = disp;
  if (showMovieBtn) showMovieBtn.style.display = disp;
}

// -------------------- UI actions --------------------
copyCode?.addEventListener("click", async ()=>{
  try {
    await navigator.clipboard.writeText(room);
    showActionToast("Room code copied");
  } catch {
    showActionToast("Copy failed");
  }
});
copyInvite?.addEventListener("click", async ()=>{
  try {
    const inviteBase = location.origin + location.pathname.replace(/[^/]*$/, '') + 'Game.html';
    const link = inviteBase + '?mode=join&room=' + encodeURIComponent(room) + '&name=';
    await navigator.clipboard.writeText(link);
    showActionToast("Invite link copied");
  } catch {
    showActionToast("Copy failed");
  }
});

nextFrameBtn?.addEventListener("click", ()=> { if(iAmHost) nextFrame(room); });
prevFrameBtn?.addEventListener("click", ()=> { if(iAmHost) prevFrame(room); });
revealBtn?.addEventListener("click", async ()=>{ if(!iAmHost) return; try{ await updateDoc(roomDoc(room), { action: "Host is revealing the frame" }); }catch(_){}
  await updateDoc(roomDoc(room), { frameRevealed: true, action: "Host revealed the frame" }); });
showMovieBtn?.addEventListener("click", async ()=>{ if(!iAmHost) return; try{ await updateDoc(roomDoc(room), { action: "Host is revealing the movie name" }); }catch(_){}
  await updateDoc(roomDoc(room), { movieNameRevealed: true, revealedMovieName: currentMovieName, action: "Host revealed the movie name" }); });

buzzerBtn?.addEventListener("click", async ()=>{
  if (buzzerBtn.disabled) return;
  buzzerBtn.disabled = true;
  try {
    const cfNum = Number(frameVal?.textContent) || 1;
    await pressBuzzerOnce(room, cfNum, myUid, name);
    if (buzzerStatus) buzzerStatus.textContent = "You buzzed!";
  } catch(e) {
    if (buzzerStatus) buzzerStatus.textContent = e.message || "Already buzzed.";
  }
});

// -------------------- Auth + main flow --------------------
signInAnonymously(auth).catch(()=>{});

onAuthStateChanged(auth, async (user) => {
  if (!user || !room) return;
  if (listenersInitialized) return;
  listenersInitialized = true;

  myUid = user.uid;

  try {
    if (statusEl) statusEl.textContent = "Joining room…";
    await ensureRoomAndMaybeClaimHost(room, myUid);

    const rs = await getDoc(roomDoc(room));
    const rd = rs.data() || {};
    const noHost = !rd.hostUid;
    iAmHost = (rd.hostUid === myUid) || (noHost && mode === "create");

    // If host and playlist empty, load pack
    if (iAmHost && (!rd.playlist || !rd.playlist.length)) {
      await loadPackToRoom(room, rd.roundIndex ?? 0);
    }

    // Add or merge this player doc
    const myRef = doc(playersCol(room), myUid);
    const playerPayload = { name, joinedAt: serverTimestamp(), host: iAmHost };
    if (qCharacter) playerPayload.character = qCharacter;
    await setDoc(myRef, playerPayload, { merge: true });
    if (statusEl) statusEl.textContent = "Connected.";

    // cleanup on leave
    window.addEventListener("beforeunload", async ()=>{
      try {
        await deleteDoc(myRef);
        const rs2 = await getDoc(roomDoc(room));
        if (rs2.exists() && rs2.data().hostUid === myUid) {
          await updateDoc(roomDoc(room), { hostUid: null }).catch(()=>{});
        }
      } catch(e) { /* best-effort */ }
    });

  } catch(e) {
    if (statusEl) statusEl.textContent = "Join failed: " + (e.code || e.message);
    console.error("join error", e);
    return;
  }

  // live players
  const playersUnsub = onSnapshot(playersCol(room), async (snap) => {
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...(d.data()||{}) }));
    renderPlayers(list);
    try { await assignNewHostIfNeeded(list); } catch(e){ console.warn(e); }
  });

  // room live state
  let lastIndex = null;
  const roomUnsub = onSnapshot(roomDoc(room), (snap) => {
    const d = snap.data() || {};
    const cf = d.currentFrame ?? 1;
    const idx = d.index ?? 0;
    const roundNum = d.round ?? 1;
    const revealed = !!d.frameRevealed;
    const movieNameRevealed = !!d.movieNameRevealed;
    const endOfRound = !!d.endOfRound;

    const noHost = !d.hostUid;
    iAmHost = (d.hostUid === myUid) || (noHost && mode === "create");

    showHostControls(iAmHost && !endOfRound);

    if (roundVal) roundVal.textContent = String(roundNum);
    if (roundNameEl) roundNameEl.textContent = d.roundLabel || (ROUNDS[d.roundIndex||0]?.label || "");
    if (frameVal) frameVal.textContent = String(cf);
    if (frameVal2) frameVal2.textContent = String(cf);

    // playlist item
    const pl = d.playlist || [];
    const item = pl[idx];
    if (item) {
      if (typeof item === "string") {
        movieFrame.src = item;
        currentMovieName = "Unknown";
      } else {
        movieFrame.src = item.url || "movie1.jpg";
        currentMovieName = item.name || ("Frame " + (idx + 1));
      }
    } else {
      movieFrame.src = "movie1.jpg";
      currentMovieName = "Unknown";
    }

    // ensure fallback if image fails
    if (movieFrame) {
      movieFrame.onerror = () => { movieFrame.src = "movie1.jpg"; };
    }

    // Clear buzzer status on new frame
    if (lastIndex === null || lastIndex !== idx) {
      if (buzzerStatus) buzzerStatus.textContent = "";
      lastIndex = idx;
    }

    // NOTE: Dialogue round WILL NOT auto-reveal movie names anymore.
    // The host must click "Show Movie" to reveal the name.
    const isDialogue = d.roundId === "dialogue" || (d.roundLabel && /dialogue/i.test(d.roundLabel));
    if (isDialogue) {
      // DO NOT auto update movieNameRevealed here — user requested manual reveal only.
      // treat the frame like other rounds for reveal behaviour
      if (revealed && !endOfRound) {
        movieBox?.classList.remove("is-blurred");
        if (revealOverlay) revealOverlay.style.display = "none";
        if (buzzerBtn) buzzerBtn.disabled = false;
        showMovieBtn && (showMovieBtn.disabled = false);
      } else {
        movieBox?.classList.add("is-blurred");
        if (revealOverlay) revealOverlay.style.display = "flex";
        if (buzzerBtn) buzzerBtn.disabled = true;
        showMovieBtn && (showMovieBtn.disabled = true);
      }
    } else {
      if (revealed && !endOfRound) {
        movieBox?.classList.remove("is-blurred");
        if (revealOverlay) revealOverlay.style.display = "none";
        if (buzzerBtn) buzzerBtn.disabled = false;
        showMovieBtn && (showMovieBtn.disabled = false);
      } else {
        movieBox?.classList.add("is-blurred");
        if (revealOverlay) revealOverlay.style.display = "flex";
        if (buzzerBtn) buzzerBtn.disabled = true;
        showMovieBtn && (showMovieBtn.disabled = true);
      }
    }

    // Movie name display
    if (movieNameRevealed && d.revealedMovieName) {
      movieNameText.textContent = d.revealedMovieName;
      movieNameCard.style.display = "block";
    } else {
      movieNameCard.style.display = "none";
    }

    // Round banner (show under host controls area) - show briefly
    if (d.roundBanner && d.roundBannerAt) {
      if (roundBanner && roundBannerText) {
        roundBannerText.textContent = d.roundBanner;
        roundBanner.style.display = "flex";
        setTimeout(()=>{ roundBanner.style.display = "none"; }, 3500);
      }
      // clear banner (host does best-effort)
      if (iAmHost) {
        updateDoc(roomDoc(room), { roundBanner: "", roundBannerAt: null }).catch(()=>{});
      }
    }

    // Action toast / corner status (action field is set by host actions)
    if (d.action) {
      // show corner status until action cleared server-side (or until 4s)
      // If the action has been realized (frame changed or movie name revealed), hide.
      if (movieNameRevealed || (lastIndex !== null && lastIndex !== idx)) {
        showCornerStatus("");
      } else {
        showCornerStatus(d.action);
      }
      setTimeout(()=> showCornerStatus(""), 4000);
    }

    // Waiting message for non-hosts while host hasn't revealed yet
    if (waitMsg) waitMsg.style.display = (!iAmHost && !revealed && !endOfRound) ? "block" : "none";

    // End-of-round => compute top players and show winner modal for everyone
    if (endOfRound) {
      (async ()=>{
        try {
          const psnap = await getDocs(playersCol(room));
          const arr = [];
          psnap.forEach(d => arr.push({ id: d.id, ...(d.data()||{}) }));
          arr.sort((a,b)=> (b.score||0)-(a.score||0));
          const top = arr.slice(0,3).map(p => ({ name: p.name || "Player", score: p.score||0, character: p.character||null }));
          if (top.length) showWinnerModal(top);
        } catch(e){
          console.warn("compute winners failed", e);
        }
      })();
    }

    // Attach buzz listener for current frame
    attachBuzzListener(room, cf);

  });

  // nothing to return; listeners will keep running while page open
});