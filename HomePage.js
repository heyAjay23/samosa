// HomePage.js
// Firebase + character picker + Create/Join flows + loading UI + Why modal text update
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// --- Firebase config ---
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

// DOM refs
const qs = s=>document.querySelector(s);
const createSection = qs('#createSection');
const joinSection   = qs('#joinSection');
const toggleHint    = qs('#toggleHint');
const nameCreateInp = qs('#nameCreate');
const nameJoinInp   = qs('#nameJoin');
const roomCodeInp   = qs('#roomCode');
const createBtn     = qs('#createBtn');
const joinBtn       = qs('#joinBtn');

const pickCharCreate = qs('#pickCharCreate');
const pickCharJoin   = qs('#pickCharJoin');
const charPicker     = qs('#charPicker');
const charBackdrop   = qs('#charBackdrop');
const charListEl     = qs('#charList');
const charConfirmBtn = qs('#charConfirm');
const charCancelBtn  = qs('#charCancel');
const charCloseBtn   = qs('#charClose');

const charCardCreate = qs('#charCardCreate');
const charCircleCreate = qs('#charCircleCreate');
const charLabelCreate = qs('#charLabelCreate');

const charCardJoin = qs('#charCardJoin');
const charCircleJoin = qs('#charCircleJoin');
const charLabelJoin = qs('#charLabelJoin');

const whyBadge = qs('#whyBadge');
const whyModal = qs('#whyModal');
const whyClose = qs('#whyClose');
const whyBackdrop = qs('#whyBackdrop');

const loadingToast = qs('#loadingToast');
const loadingText = qs('#loadingText');

// Prefill name if saved
const savedName = localStorage.getItem('playerName') || '';
if (nameCreateInp) nameCreateInp.value = savedName;
if (nameJoinInp)   nameJoinInp.value   = savedName;

// Toggle helpers
function showJoin(){
  createSection.classList.add('hidden'); createSection.classList.remove('shown');
  joinSection.classList.add('shown');    joinSection.classList.remove('hidden');
  joinSection.setAttribute('aria-hidden','false'); createSection.setAttribute('aria-hidden','true');
toggleHint.innerHTML = 'Going to create instead? <button type="button" id="openCreate">Create a room</button>';
  document.getElementById('openCreate').addEventListener('click', showCreate, {once:true});
  nameJoinInp?.focus();
}
function showCreate(){
  joinSection.classList.add('hidden'); joinSection.classList.remove('shown');
  createSection.classList.add('shown'); createSection.classList.remove('hidden');
  createSection.setAttribute('aria-hidden','false'); joinSection.setAttribute('aria-hidden','true');
  toggleHint.innerHTML = 'Have a room code? <button type="button" id="openJoin">Join one</button>';
  document.getElementById('openJoin').addEventListener('click', showJoin, {once:true});
  nameCreateInp?.focus();
}
document.getElementById('openJoin').addEventListener('click', showJoin, {once:true});

// Helpers
const trim = s=> (s||'').trim();
const makeCode = () => Math.random().toString(36).slice(2,7).toUpperCase();
function goToGame(params) {
  location.href = `Game.html?${new URLSearchParams(params)}`;
}
  
// Always create a brand-new room (no reuse)
async function createFreshRoom(name, uid, maxAttempts=6){
  for (let i=0;i<maxAttempts;i++){
    const code = makeCode();
    const ref  = doc(db, "rooms", code);
    const snap = await getDoc(ref);
    if (!snap.exists()){
      await setDoc(ref, {
        createdAt: serverTimestamp(),
        status: "lobby",
        // host at CREATE time (prevents 403 later)
        hostUid: uid,
        hostName: name,
        // defaults so Game page is ready
        currentFrame: 1,
        round: 1,
        framesPerRound: 10,
        frameRevealed: false,
        endOfRound: false
      });
      return code;
    }
  }
  throw new Error("Could not allocate a room. Try again.");
}

async function verifyRoom(code){
  const snap = await getDoc(doc(db,"rooms",code));
  if(!snap.exists()) throw new Error("Room not found");
  return true;
}

// -------------------- Characters --------------------
// Raw GitHub base (your repo). If not present, image may 404 and we'll show emoji fallback.
const RAW_BASE = "https://raw.githubusercontent.com/heyAjay23/logos/main/";
const CHARACTERS = [
  { id:'supersuper', name:'SuperSuper', file:'SuperSuper.jpg', emoji:'🥇' },
  { id:'wvish',      name:'Wvish',      file:'Wvish.jpg', emoji:'✨' },
  { id:'moviestalk', name:'Moviestalk', file:'Moviestalk.jpg', emoji:'🎬' },
  { id:'desinerd',   name:'DesiNerd',   file:'Desi ners.jpg', emoji:'🧠' },
  { id:'bnftb',      name:'Bnftb',      file:'bnftv.jpeg', emoji:'🎧' },
  { id:'thepj',      name:'ThePJ',      file:'pj.jpg', emoji:'🎭' },
  { id:'comicverse', name:'Comicverse', file:'comicverse.jpeg', emoji:'🖼' },
  { id:'abhireview', name:'Abhi Review',file:'abhi review.jpeg', emoji:'📝' },
  { id:'surajkumar', name:'Suraj Kumar',file:'images.jpeg', emoji:'🎤' },
  { id:'yogi',       name:'Yogi Bolta Hai', file:'yogi.jpg', emoji:'🗣' }
].map(c => ({ ...c, url: RAW_BASE + encodeURIComponent(c.file) }));

let selectedChar = null;
let pickerTarget = 'create'; // 'create' or 'join'

// Render character list into modal using DOM APIs (more robust than innerHTML with inline onerror)
function renderCharList(){
  charListEl.innerHTML = '';
  CHARACTERS.forEach(c=>{
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.className = 'char-item';

    const thumb = document.createElement('div');
    thumb.className = 'char-thumb-large';
    thumb.dataset.id = c.id;

    const img = document.createElement('img');
    img.src = c.url;
    img.alt = c.name;
    // if image fails, fallback to emoji inside thumb
    img.onerror = () => {
      img.style.display = 'none';
      thumb.textContent = c.emoji;
      thumb.style.fontSize = '48px';
      thumb.style.display = 'flex';
      thumb.style.alignItems = 'center';
      thumb.style.justifyContent = 'center';
    };
    thumb.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'char-meta';
    const n = document.createElement('div');
    n.className = 'char-name';
    n.textContent = c.name;
    const s = document.createElement('div');
    s.className = 'char-sub';
    s.textContent = 'Tap to select';
    meta.appendChild(n);
    meta.appendChild(s);

    li.appendChild(thumb);
    li.appendChild(meta);

    li.addEventListener('click', ()=>{
      // visual selection
      document.querySelectorAll('.char-item').forEach(x=>x.classList.remove('selected'));
      li.classList.add('selected');
      selectedChar = c;
    });

    charListEl.appendChild(li);
  });
}

// Show preview in the create/join card and disable the input (per request)
function showCharPreviewFor(target){
  const card = (target === 'create') ? {wrap: charCardCreate, circle: charCircleCreate, label: charLabelCreate, input: nameCreateInp} : {wrap: charCardJoin, circle: charCircleJoin, label: charLabelJoin, input: nameJoinInp};
  if (!selectedChar){
    // hide preview and ensure input is enabled if there was no saved char
    card.wrap.style.display = 'none';
    if (card.input) card.input.disabled = false;
    return;
  }

  // set image or emoji inside char circle
  card.circle.innerHTML = '';
  const img = document.createElement('img');
  img.src = selectedChar.url;
  img.alt = selectedChar.name;
  img.onload = ()=> { card.circle.appendChild(img); };
  img.onerror = ()=> {
    card.circle.textContent = selectedChar.emoji;
    card.circle.style.fontSize = '48px';
  };

  card.label.textContent = selectedChar.name;
  card.wrap.style.display = 'flex';

  // populate input and disable it so user can't change name (per your last instruction)
  if (card.input){
    card.input.value = selectedChar.name;
    card.input.disabled = true;
  }

  // persist selection
  localStorage.setItem('selectedCharacter', selectedChar.id);
}

// Open/close picker
function openPicker(forTarget='create'){ pickerTarget = forTarget; renderCharList(); charPicker.classList.remove('hidden'); charPicker.setAttribute('aria-hidden','false'); }
function closePicker(){ charPicker.classList.add('hidden'); charPicker.setAttribute('aria-hidden','true'); }

// Hook pick buttons
pickCharCreate?.addEventListener('click', ()=> openPicker('create'));
pickCharJoin?.addEventListener('click', ()=> openPicker('join'));
charBackdrop?.addEventListener('click', closePicker);
charCloseBtn?.addEventListener('click', closePicker);
charCancelBtn?.addEventListener('click', closePicker);

// Confirm selection — show preview for the target and disable editing
charConfirmBtn?.addEventListener('click', ()=>{
  if (!selectedChar) {
    alert('Please select a character first.');
    return;
  }
  showCharPreviewFor(pickerTarget);
  // also update the other side (so user sees same preview if switching sections)
  // (we intentionally disable editing so both inputs reflect the character)
  if (pickerTarget === 'create') showCharPreviewFor('join');
  else showCharPreviewFor('create');

  closePicker();
});

// Restore selection from localStorage on load (if present)
const savedCharId = localStorage.getItem('selectedCharacter');
if (savedCharId){
  const found = CHARACTERS.find(c => c.id === savedCharId);
  if (found){
    selectedChar = found;
    // populate both previews & disable inputs
    showCharPreviewFor('create');
    showCharPreviewFor('join');
  }
}

// Why modal open/close (if present in DOM)
if (whyBadge && whyModal && whyClose && whyBackdrop){
  whyBadge?.addEventListener('click', ()=> { whyModal.classList.remove('hidden'); whyModal.setAttribute('aria-hidden','false'); });
  whyBackdrop?.addEventListener('click', ()=> { whyModal.classList.add('hidden'); whyModal.setAttribute('aria-hidden','true'); });
  whyClose?.addEventListener('click', ()=> { whyModal.classList.add('hidden'); whyModal.setAttribute('aria-hidden','true'); });
}

// Loading toast helpers
function showLoading(message){
  if (!loadingToast) return;
  loadingText.textContent = message || "Loading…";
  loadingToast.classList.remove('hidden');
}
function hideLoading(){
  if (!loadingToast) return;
  loadingToast.classList.add('hidden');
}

// --- Auth + button handlers ---
// sign in anonymously so createFreshRoom can set hostUid
signInAnonymously(auth).catch(console.error);

// Attach click handlers after auth is ready
onAuthStateChanged(auth, (user)=>{
  // Create
  createBtn?.addEventListener('click', async ()=>{
    const raw = trim(nameCreateInp.value);
    if(!raw) return alert("Please enter your name or choose a character.");
    // Use selectedChar name if a character is selected (we already set input but ensure)
    const actualName = selectedChar ? selectedChar.name : raw;
    localStorage.setItem('playerName', actualName);
    try{
      showLoading('Creating room…');
      const uid  = user?.uid;
      if(!uid){ hideLoading(); alert("Auth not ready. Try again."); return; }
      const room = await createFreshRoom(actualName, uid);
      const params = { mode:'create', name: actualName, room };
      if (selectedChar) params.character = selectedChar.id;
      hideLoading();
      goToGame(params);
    }catch(err){
      hideLoading();
      alert(err.message||'Create failed');
    }
  });

  // Join
  joinBtn?.addEventListener('click', async ()=>{
    const name = trim(nameJoinInp.value);
    const room = trim(roomCodeInp.value).toUpperCase();
    if(!name) return alert("Please enter your name.");
    if(!room) return alert("Please enter a room code.");
    localStorage.setItem('playerName', name);
    try{
      showLoading('Joining room…');
      await verifyRoom(room);
      const params = { mode:'join', name, room };
      if (selectedChar) params.character = selectedChar.id;
      hideLoading();
      goToGame(params);
    }catch(err){
      hideLoading();
      alert(err.message||'Join failed');
    }
  });
});

// Enter key quick submit
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    const joining = getComputedStyle(joinSection).gridTemplateRows !== '0fr';
    (joining ? joinBtn : createBtn).click();
  }
});