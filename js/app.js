// =====================================================
//  우마시 (우리들의 마음 나누기) — 앱 로직
//  - 소감 1개 = Firestore 문서 1개 (동시 작성해도 서로 덮어쓰지 않음)
//  - 학생·선생님 모두 익명 로그인 / 선생님 모드는 서버가 비밀번호를 확인 (보안 규칙)
//  - 오프라인에서도 작성 → 연결되면 자동 저장
// =====================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, writeBatch, serverTimestamp, arrayUnion, Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig, CLASS_ID, LEGACY_APP_ID } from "./firebase-config.js";

// ---------- 상수 ----------
const EMOJIS = [
  { emoji: '💖', label: '감동이야' }, { emoji: '💡', label: '기발해' },
  { emoji: '👏', label: '멋져최고' }, { emoji: '😄', label: '재밌어' },
  { emoji: '🤝', label: '공감돼' },   { emoji: '🌿', label: '따뜻해' },
  { emoji: '🌈', label: '생생해' },   { emoji: '🌟', label: '반짝여' },
  { emoji: '🥺', label: '뭉클해' },   { emoji: '🎨', label: '표현력 짱' },
  { emoji: '💪', label: '응원해' },   { emoji: '🌻', label: '기분좋아' }
];
const CATEGORIES = [
  { value: '궁금한 점', icon: '🔍' }, { value: '느낀점', icon: '💭' },
  { value: '재미있었던 점', icon: '😆' }, { value: '공감되었던 점', icon: '🤝' },
  { value: '기타', icon: '✨' }
];
const STARTERS = [
  '~한 부분이 인상 깊었어.', '나도 ~한 적이 있어서 공감됐어.',
  '~가 궁금해!', '표현이 생생해서 눈앞에 그려졌어.', '다음 이야기도 기대돼!'
];
// 내 마음 나무: 지금까지(모든 시간) 보낸 소감 수로 자람 — 16단계, 10개마다 한 단계
const STEP = 10;
const STAGES = [
  { min: 0, icon: '🌰', level: 'Lv.1 씨앗', title: '작은 씨앗', desc: '마음을 보내면 씨앗이 깨어나요. 친구에게 첫 마음을 보내 볼까요?' },
  { min: 10, icon: '🌱', level: 'Lv.2 새싹', title: '빼꼼 올라온 새싹', desc: '마음 10개! 땅을 뚫고 작은 새싹이 고개를 내밀었어요.' },
  { min: 20, icon: '☘️', level: 'Lv.3 떡잎', title: '활짝 핀 떡잎', desc: '떡잎이 활짝 펴졌어요. 꾸준함이 멋져요!' },
  { min: 30, icon: '🌿', level: 'Lv.4 어린 줄기', title: '쑥쑥 자라는 줄기', desc: '줄기가 튼튼해지고 있어요.' },
  { min: 40, icon: '🍃', level: 'Lv.5 잎새', title: '초록 잎이 무성한 줄기', desc: '잎이 하나둘 늘어나 초록빛이 가득해요.' },
  { min: 50, icon: '🌷', level: 'Lv.6 꽃봉오리', title: '몽글몽글 꽃봉오리', desc: '곧 꽃이 필 것 같아요! 조금만 더!' },
  { min: 60, icon: '🌸', level: 'Lv.7 첫 꽃', title: '첫 꽃이 피었어요', desc: '마음 60개! 드디어 첫 꽃이 피었어요.' },
  { min: 70, icon: '💐', level: 'Lv.8 꽃다발', title: '향기로운 꽃다발', desc: '꽃이 한가득! 친구들에게 꽃다발 같은 존재예요.' },
  { min: 80, icon: '🪴', level: 'Lv.9 묘목', title: '씩씩한 묘목', desc: '꽃을 지나 나무로 자랄 준비를 하고 있어요.' },
  { min: 90, icon: '🌳', level: 'Lv.10 어린 나무', title: '든든한 어린 나무', desc: '그늘을 만들어 주는 나무가 되었어요.' },
  { min: 100, icon: '🌲', level: 'Lv.11 큰 나무', title: '하늘 높이 큰 나무', desc: '하늘까지 닿을 듯 키가 쑥 컸어요.' },
  { min: 110, icon: '🍎', level: 'Lv.12 열매 나무', title: '열매 맺은 나무', desc: '정성이 달콤한 열매로 주렁주렁 맺혔어요.' },
  { min: 120, icon: '🐦', level: 'Lv.13 새가 사는 나무', title: '새들이 찾아오는 나무', desc: '새들이 둥지를 틀었어요. 모두가 쉬어 가는 나무예요.' },
  { min: 130, icon: '🌲🌳', level: 'Lv.14 사랑의 숲', title: '함께 자라는 사랑의 숲', desc: '혼자가 아닌 숲이 되었어요. 반 전체가 따뜻해져요.' },
  { min: 140, icon: '🌟', level: 'Lv.15 빛나는 숲', title: '반짝반짝 빛나는 숲', desc: '마음 140개! 숲 전체가 반짝반짝 빛나요.' },
  { min: 150, icon: '🌈✨', level: 'Lv.MAX 무지개 숲', title: '찬란한 무지개 숲', desc: '최고의 마음 나눔 천사! 정말 대단해요!' }
].map((st, i, arr) => ({ ...st, max: arr[i + 1] ? arr[i + 1].min : Infinity }));

// 우리 반 마음 숲: 모든 시간의 소감을 합쳐 '친구 한 명당 평균 몇 개'로 자람
// 내 마음 나무와 같은 기준(한 명당 평균 10개마다 한 단계) — 16단계
const FORESTS = [
  { per: 0, icon: '🏜️', title: '아직 빈 들판', desc: '첫 마음을 기다리고 있어요. 우리 반의 숲을 함께 키워 봐요!' },
  { per: 10, icon: '🌱', title: '싹트는 들판', desc: '여기저기 작은 새싹이 돋아나기 시작했어요.' },
  { per: 20, icon: '🌱🌿', title: '새싹 정원', desc: '새싹들이 모여 작은 정원이 되었어요.' },
  { per: 30, icon: '🌿☘️', title: '푸른 풀밭', desc: '초록 풀이 가득한 풀밭이 되었어요.' },
  { per: 40, icon: '🌿🌷', title: '꽃이 피는 정원', desc: '다정한 칭찬 속에서 꽃이 피어나요.' },
  { per: 50, icon: '🌷🌸🌼', title: '알록달록 꽃밭', desc: '서로를 향한 마음이 알록달록 꽃밭이 되었어요.' },
  { per: 60, icon: '🌸🦋🌼', title: '나비가 노는 꽃밭', desc: '꽃밭에 나비들이 날아들었어요.' },
  { per: 70, icon: '🪴🌸🪴', title: '묘목 정원', desc: '작은 나무들이 줄지어 자라기 시작했어요.' },
  { per: 80, icon: '🌳🌸🌳', title: '어린 나무 숲길', desc: '나무가 자라 숲길이 생겼어요.' },
  { per: 90, icon: '🌳🌳🌷🌳', title: '푸른 마을 숲', desc: '우리 반 모두가 쉬어 갈 수 있는 숲이에요.' },
  { per: 100, icon: '🌲🌳🌲🌳', title: '울창한 숲', desc: '나무가 빽빽하게 자란 울창한 숲이에요.' },
  { per: 110, icon: '🌳🍎🌳🍎', title: '열매 맺는 숲', desc: '쌓인 마음들이 열매로 주렁주렁 열렸어요.' },
  { per: 120, icon: '🌲🐦🌳🦋', title: '새들이 노래하는 숲', desc: '새와 나비가 찾아오는 생기 넘치는 숲이에요.' },
  { per: 130, icon: '🏡🌳🌈🌳', title: '무지개 마음 숲', desc: '숲 위에 무지개가 떴어요!' },
  { per: 140, icon: '🌟🌳🌟🌳', title: '별빛 마음 숲', desc: '밤에도 별처럼 반짝이는 숲이에요.' },
  { per: 150, icon: '🏰🌈🌲💖', title: '환상적인 마음 원더랜드', desc: '온 교실이 서로를 응원하는 사랑과 감동으로 빛나요!' }
];
function forestBase() { return Math.max(10, S.students.length); }
function forestIndex(total) { const n = forestBase(); let i = 0; FORESTS.forEach((f, k) => { if (total >= f.per * n) i = k; }); return i; }
const SAMPLE_ROSTER = ['강민준', '김서아', '김하늘', '박서준', '송지우', '이민지', '임도현', '정예은', '최시우', '한소율'];
const NAME_KEY = 'umasi.name';
try { localStorage.removeItem(NAME_KEY); } catch {} // 예전 버전이 기억해 둔 이름 지우기
const MAX_COMMENT = 80;

// ---------- Firebase ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  db = initializeFirestore(app, {});
}
const classRef = doc(db, 'classes', CLASS_ID);
const fbCol = collection(classRef, 'feedbacks');
const secretRef = doc(classRef, 'private', 'teacher');
const sessCol = collection(classRef, 'sessions');
const sessionRef = () => doc(classRef, 'teacherSessions', S.user.uid);

// ---------- 상태 ----------
const S = {
  user: null,
  name: null, // 시작 화면에서는 항상 이름을 새로 고름 (이전에 들어온 학생으로 자동 입장하지 않음)
  students: [],
  allowOwnView: false,
  classLoaded: false,
  feedbacks: [],
  sessions: [],
  session: null,
  fbLoaded: false,
  pending: false,
  error: null,
  teacherView: false,
  filter: 'all',
  query: '',
  compose: null,
  detailTarget: null,
  confirmCb: null,
  unsubs: [],
  teacher: false,
  animate: true
};

// ---------- 유틸 ----------
const $ = (id) => document.getElementById(id);
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
function cleanName(raw) { return String(raw || '').replace(/[\/\\#?%]/g, '').replace(/\s+/g, ' ').trim().slice(0, 10); }
// 한 시간에 한 친구에게는 마음을 한 번만: 시간+보낸 사람+받는 사람으로 문서 이름을 정함 (서버도 같은 규칙으로 확인)
function pairId(sid, from, to) { return `${sid}__${from}__${to}`; }

// ---------- 시간(차시) ----------
const ORD = ['첫', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열', '열한', '열두', '열세', '열네', '열다섯', '열여섯', '열일곱', '열여덟', '열아홉', '스무'];
function sessTitle(n) { return n <= ORD.length ? `${ORD[n - 1]} 번째 시간` : `${n}번째 시간`; }
function sessOf(f) { return f.session || 's1'; } // 시간 기능 전에 쓴 소감은 첫 번째 시간으로
function sessionList() {
  if (S.sessions.length) return S.sessions;
  // 아직 시간을 만들지 않았으면 '첫 번째 시간'이 열려 있는 것으로 봄 (이전 방식과 같게)
  return [{ id: 's1', title: sessTitle(1), order: 1, open: true, ownView: S.allowOwnView, virtual: true }];
}
function visibleSessions() { return S.teacherView ? sessionList() : sessionList().filter((x) => x.open); }
function curSession() {
  const vis = visibleSessions();
  let c = vis.find((x) => x.id === S.session);
  if (!c) { c = vis[vis.length - 1] || null; S.session = c ? c.id : null; }
  return c;
}
function curFbs() { const c = curSession(); return c ? S.feedbacks.filter((f) => sessOf(f) === c.id) : []; }
function ownViewOpen() { const c = curSession(); return !!(c && c.ownView); }
function isTeacher() { return S.teacher; }
function toDate(ts) { return ts && typeof ts.toDate === 'function' ? ts.toDate() : null; }
function timeOf(fb) { const d = toDate(fb.createdAt); return d ? d.getTime() : 0; }
function fmtTime(fb) {
  if (fb.legacyTime) return fb.legacyTime;
  const d = toDate(fb.createdAt);
  if (!d) return '방금';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const t = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  return sameDay ? t : `${d.getMonth() + 1}/${d.getDate()} ${t}`;
}
function isMine(fb) { return !!(S.name && fb.from === S.name && S.user && fb.uid === S.user.uid); }
function stageIndex(n) { let i = 0; STAGES.forEach((s, k) => { if (n >= s.min) i = k; }); return i; }

// 학생에게 보이는지: 반려된 글은 쓴 친구와 선생님에게만
function visible(fb) {
  if (S.teacherView) return true;
  if (fb.status === 'rejected') return fb.from === S.name;
  return true;
}
function receivedBy(name) {
  return curFbs().filter((f) => f.to === name && visible(f)).sort((a, b) => timeOf(a) - timeOf(b));
}
function countable(f) { return f.status !== 'rejected'; }
function mySentCount() { return S.feedbacks.filter((f) => f.from === S.name && countable(f)).length; }
function allNames() {
  const list = [...S.students];
  if (S.teacherView) {
    S.feedbacks.forEach((f) => { if (f.to && !list.includes(f.to)) list.push(f.to); });
  }
  return list;
}

// ---------- 인증 ----------
onAuthStateChanged(auth, (user) => {
  if (!user) {
    S.user = null;
    signInAnonymously(auth).catch(handleAuthError);
    return;
  }
  S.user = user;
  S.error = null;
  startListeners();
  renderAll();
  renderTeacherModal();
});

function handleAuthError(err) {
  console.error(err);
  const code = err?.code || '';
  if (code.includes('operation-not-allowed') || code.includes('admin-restricted')) {
    S.error = 'Firebase에서 "익명 로그인"을 켜야 저장할 수 있어요.';
  } else if (code.includes('network')) {
    S.error = null; // 오프라인 — 연결되면 다시 시도
    setTimeout(() => { if (!auth.currentUser) signInAnonymously(auth).catch(handleAuthError); }, 4000);
  } else {
    S.error = '로그인 중 문제가 생겼어요.';
  }
  renderSync();
  if (S.error) toast(S.error, '⚠️', 5000);
}

function startListeners() {
  S.unsubs.forEach((u) => u());
  S.unsubs = [];

  S.unsubs.push(onSnapshot(classRef, { includeMetadataChanges: true }, (snap) => {
    const d = snap.data() || {};
    S.students = Array.isArray(d.students) ? d.students.filter((x) => typeof x === 'string') : [];
    S.allowOwnView = d.allowOwnView === true;
    S.classLoaded = !snap.metadata.fromCache || S.classLoaded || snap.exists();
    renderAll();
  }, onListenError));

  S.unsubs.push(onSnapshot(fbCol, { includeMetadataChanges: true }, (snap) => {
    S.feedbacks = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    S.pending = snap.metadata.hasPendingWrites;
    S.fbLoaded = S.fbLoaded || !snap.metadata.fromCache;
    renderAll();
  }, onListenError));

  S.unsubs.push(onSnapshot(sessCol, (snap) => {
    S.sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((x) => typeof x.title === 'string')
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    renderAll();
  }, onListenError));

  // 이 기기가 선생님 모드인지 (서버에서 비밀번호가 확인된 기기만 표시가 생김)
  S.unsubs.push(onSnapshot(sessionRef(), (snap) => {
    S.teacher = snap.exists();
    if (!S.teacher && S.teacherView) exitTeacherView();
    renderAll();
  }, () => { S.teacher = false; }));
}

function onListenError(err) {
  console.error(err);
  if (err?.code === 'permission-denied') {
    // 로그인 전환 중 잠깐 생길 수 있음 — 사용자가 있으면 다시 연결
    if (auth.currentUser) setTimeout(startListeners, 800);
    else S.error = '권한이 없어요. 보안 규칙을 확인해 주세요.';
  } else {
    S.error = '서버와 연결이 끊겼어요.';
  }
  renderSync();
}

function writeFailed(err) {
  console.error(err);
  const denied = err?.code === 'permission-denied';
  if (denied && S.teacher) {
    toast('선생님 비밀번호가 바뀌어 선생님 모드가 풀렸어요. 다시 들어와 주세요.', '🔑', 4500);
    deleteDoc(sessionRef()).catch(() => {});
    return;
  }
  toast(denied ? '저장 권한이 없어요. 선생님께 알려주세요.' : '저장하지 못했어요. 잠시 후 다시 해 주세요.', '⚠️', 4000);
}

// ---------- 렌더: 공통 ----------
function renderAll() {
  renderSync();
  renderView();
  renderLogin();
  if (!$('dashView').hidden) renderDash();
  if (!$('detailModal').hidden) renderDetail();
  if (!$('teacherModal').hidden) renderTeacherModal();
}

function renderSync() {
  const pill = $('syncPill');
  const text = pill.querySelector('.sync-text');
  let cls = 'is-ok', label = '실시간 저장됨';
  if (S.error) { cls = 'is-err'; label = '연결 문제'; }
  else if (!navigator.onLine) { cls = 'is-off'; label = '오프라인 · 연결되면 저장'; }
  else if (!S.user || !S.fbLoaded) { cls = 'is-wait'; label = '연결 중'; }
  else if (S.pending) { cls = 'is-wait'; label = '저장 중…'; }
  pill.className = `sync-pill ${cls}`;
  text.textContent = label;
  pill.title = S.error || label;
}

function renderView() {
  const inDash = !!(S.name || S.teacherView);
  $('loginView').hidden = inDash;
  $('dashView').hidden = !inDash;
  $('teacherBanner').hidden = !S.teacherView;
  const chip = $('userChip');
  chip.hidden = !S.name || S.teacherView;
  if (S.name) {
    $('userName').textContent = S.name;
    $('userAvatar').textContent = STAGES[stageIndex(mySentCount())].icon.slice(0, 2);
  }
}

// ---------- 로그인 ----------
function renderLogin() {
  if ($('loginView').hidden) return;
  const sel = $('nameSelect');
  $('rosterCount').textContent = S.students.length;
  const empty = !S.students.length;
  $('rosterEmpty').hidden = !(empty && S.classLoaded);
  $('enterBtn').disabled = empty;
  const key = S.students.join('\n') + '|' + S.classLoaded;
  if (sel.dataset.key === key) return; // 고르는 중인 값은 그대로 둠
  sel.dataset.key = key;
  const keep = sel.value;
  sel.innerHTML = empty
    ? `<option value="">${S.classLoaded ? '명단이 비어 있어요' : '명단을 불러오는 중…'}</option>`
    : '<option value="">내 이름을 찾아 골라요</option>' +
      [...S.students].sort((x, y) => x.localeCompare(y, 'ko')).map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  if (keep && S.students.includes(keep)) sel.value = keep;
}

async function enterAs(rawName) {
  const name = cleanName(rawName);
  if (!name || !S.students.includes(name)) {
    toast('목록에서 내 이름을 골라 주세요!', '🔔');
    $('nameSelect').focus();
    return;
  }
  S.name = name;
  S.animate = true;
  $('nameSelect').value = '';
  renderAll();
  window.scrollTo({ top: 0 });
  toast(`${name} 친구, 환영해요! 친구들의 글에 마음을 전해 보세요.`, '🎉');
}

function logoutStudent() {
  S.name = null;
  safeSet(NAME_KEY, null);
  S.filter = 'all'; S.query = '';
  $('searchInput').value = '';
  closeAllModals();
  renderAll();
  toast('다른 친구로 바꿀 수 있어요.', '👋');
}

// ---------- 대시보드 ----------
function renderDash() {
  const names = allNames();
  const cur = curSession();
  const here = curFbs();
  const thisCount = S.teacherView ? here.length : here.filter(countable).length;
  const mine = mySentCount();

  renderSessionBar();
  setNum('statStudents', S.students.length);
  setNum('statFeedbacks', thisCount);
  setNum('statMine', S.feedbacks.filter(countable).length);
  const lock = $('lockPill');
  const ov = ownViewOpen();
  lock.className = `lock-pill ${ov ? 'is-open' : 'is-locked'}`;
  lock.textContent = ov ? '🔓 내 글 소감: 열람 가능' : '🔒 내 글 소감: 활동 중';
  $('teacherBanner').querySelector('.tag').textContent = cur ? `선생님 모드 · ${cur.title}` : '선생님 모드';

  if (!cur) {
    $('dashToolbar').hidden = true;
    $('cardsGrid').innerHTML = '';
    $('cardsEmpty').hidden = false;
    $('cardsEmpty').innerHTML = '<span class="big">🗓️</span>아직 열린 시간이 없어요.<br>선생님이 시간을 열면 여기에 나타나요.';
    renderTree(mine, new Set());
    renderForest();
    return;
  }
  $('dashToolbar').hidden = false;

  // 정렬: 나 → 나머지 명단 순서
  let list = names.slice();
  if (!S.teacherView && S.name) {
    list = list.filter((n) => n !== S.name);
    if (S.students.includes(S.name)) list.unshift(S.name);
  }
  const sentTo = new Set(here.filter((f) => f.from === S.name).map((f) => f.to));
  const q = S.query.trim();
  list = list.filter((n) => {
    if (q && !n.includes(q)) return false;
    if (S.teacherView || S.filter === 'all') return true;
    if (n === S.name) return false;
    return S.filter === 'done' ? sentTo.has(n) : !sentTo.has(n);
  });

  const grid = $('cardsGrid');
  const empty = $('cardsEmpty');
  grid.classList.toggle('enter', S.animate);
  S.animate = false;
  grid.innerHTML = list.map((n, i) => cardHtml(n, sentTo.has(n), i)).join('');
  empty.hidden = list.length > 0;
  if (!list.length) {
    let msg = '<span class="big">🔍</span>찾는 친구가 없어요.';
    if (!names.length) msg = '<span class="big">👥</span>아직 명단이 없어요. 선생님이 명단을 등록하면 친구 카드가 나타나요.';
    else if (!q && S.filter === 'todo') msg = '<span class="big">🎉</span>모든 친구에게 마음을 보냈어요! 정말 멋져요.';
    else if (!q && S.filter === 'done') msg = '<span class="big">💌</span>아직 마음을 보낸 친구가 없어요. 첫 마음을 보내 볼까요?';
    empty.innerHTML = msg;
  }

  document.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.filter === S.filter));
  $('cardsGrid').closest('.dash-main').querySelector('.seg').hidden = S.teacherView;

  renderTree(mine, sentTo);
  renderForest();
}

function cardHtml(name, sent, i) {
  const tv = S.teacherView;
  const isSelf = !tv && name === S.name;
  const list = receivedBy(name);
  const counted = tv ? list : list.filter(countable);
  const lockedSelf = isSelf && !ownViewOpen();
  const rejected = tv ? list.filter((f) => f.status === 'rejected' || f.status === 'revised').length : 0;

  const kicker = tv ? '🧑‍🏫 지도 대상' : isSelf ? '✨ 나의 글' : '📄 친구의 글';
  const icon = tv ? '🔍' : lockedSelf ? '🔒' : counted.length ? '📬' : '📭';
  const emojis = counted.slice(-6).map((f) => esc(f.emoji)).join('');
  const box = lockedSelf
    ? '<span class="fcard-note">🎁 선생님이 열어주면 볼 수 있어요</span>'
    : emojis ? `<span class="fcard-emojis">${emojis}</span>` : '<span class="fcard-note">아직 도착한 마음이 없어요</span>';

  let foot = '';
  if (tv) {
    foot = `${rejected ? `<span class="fcard-flag">반려·재작성 ${rejected}</span>` : '<span></span>'}<span class="tiny muted">관리하기 →</span>`;
  } else if (isSelf) {
    foot = `<span class="tiny muted">${ownViewOpen() ? '친구들이 남긴 마음을 열어 봐요' : '활동이 끝나면 열려요'}</span><span class="tiny accent">보기 →</span>`;
  } else {
    foot = `<span class="tiny muted">${sent ? '마음을 보냈어요 💛' : '글을 읽었나요?'}</span>
      ${sent
        ? `<button class="btn btn-sm btn-soft" data-action="open-detail" data-name="${esc(name)}">보낸 마음 보기</button>`
        : `<button class="btn btn-sm btn-primary" data-action="compose" data-name="${esc(name)}">마음 보내기 ✏️</button>`}`;
  }

  const cls = ['fcard', isSelf && 'is-self', !tv && sent && !isSelf && 'is-sent', tv && 'is-teacher'].filter(Boolean).join(' ');
  return `<article class="${cls}" style="animation-delay:${Math.min(i, 12) * 25}ms" data-action="open-detail" data-name="${esc(name)}" tabindex="0" role="button" aria-label="${esc(name)}의 글 보기">
    <div class="fcard-top">
      <div style="min-width:0"><div class="fcard-kicker">${kicker}</div><h3 class="fcard-name">${esc(name)}</h3></div>
      <span class="fcard-mail" aria-hidden="true">${icon}</span>
    </div>
    <div class="fcard-box">${box}<span class="fcard-count">${counted.length}개</span></div>
    <div class="fcard-foot">${foot}</div>
  </article>`;
}

function renderTree(mine, sentTo) {
  const idx = stageIndex(mine);
  const st = STAGES[idx];
  const icon = $('myTreeIcon');
  if (icon.textContent !== st.icon) {
    icon.textContent = st.icon;
    icon.classList.remove('pop'); void icon.offsetWidth; icon.classList.add('pop');
  }
  $('myLevel').textContent = st.level;
  $('myTreeTitle').textContent = st.title;
  $('myTreeDesc').textContent = st.desc;
  setNum('myCount', `${mine}개`);
  if (st.max === Infinity) {
    $('myBar').style.width = '100%';
    $('myNext').textContent = '🎉 모든 성장 단계를 달성했어요!';
  } else {
    $('myBar').style.width = `${Math.round(((mine - st.min) / (st.max - st.min)) * 100)}%`;
    $('myNext').textContent = `다음 단계까지 ${st.max - mine}개 남았어요!`;
  }
  const friends = S.students.filter((n) => n !== S.name);
  const done = friends.filter((n) => sentTo.has(n)).length;
  setNum('sentFriends', `${done} / ${friends.length}명`);
  $('myTreeIcon').closest('.tree-card').hidden = S.teacherView;
}

function renderForest() {
  // 모든 시간에 쌓인 마음을 합쳐서 자람 (친구 한 명당 평균 소감 수 기준)
  const total = S.feedbacks.filter(countable).length;
  const n = forestBase();
  const idx = forestIndex(total);
  const f = FORESTS[idx];
  const next = FORESTS[idx + 1];
  const lo = f.per * n;
  const hi = next ? next.per * n : lo;
  const pct = next ? Math.round(((total - lo) / (hi - lo)) * 100) : 100;
  $('forestPct').textContent = `Lv.${idx + 1}${next ? '' : ' MAX'} · 쌓인 마음 ${total}개`;
  $('forestBar').style.width = `${Math.max(0, Math.min(100, pct))}%`;
  const icon = $('forestIcon');
  if (icon.textContent !== f.icon) {
    if (icon.textContent) { icon.classList.remove('pop'); void icon.offsetWidth; icon.classList.add('pop'); }
    icon.textContent = f.icon;
  }
  $('forestTitle').textContent = f.title;
  $('forestDesc').textContent = next ? `${f.desc} (다음 단계까지 ${hi - total}개)` : f.desc;
  renderStageList();
}

function renderStageList() {
  const tree = $('treeStageList');
  if (tree && !tree.dataset.done) {
    tree.dataset.done = '1';
    tree.innerHTML = `<p class="stage-head">🌱 내 마음 나무 <span>내가 보낸 소감</span></p>
    <ul>${STAGES.map((st) => `<li><b>${Array.from(st.icon)[0]}</b> ${esc(st.level.replace(/^Lv\.\S+ /, ''))}<span>${st.min}개~</span></li>`).join('')}</ul>`;
  }
  const box = $('stageList');
  if (!box || box.dataset.n === String(forestBase())) return;
  box.dataset.n = String(forestBase());
  const n = forestBase();
  box.innerHTML = `<p class="stage-head">🌳 우리 반 마음 숲 <span>반 전체 소감</span></p>
    <ul>${FORESTS.map((f) => `<li><b>${Array.from(f.icon)[0]}</b> ${esc(f.title)}<span>${f.per * n}개~</span></li>`).join('')}</ul>`;
}

// ---------- 마음 쓰기 / 고치기 ----------
function openCompose(target, fb = null) {
  if (!fb) {
    if (!S.name) { toast('먼저 이름을 고르고 들어와 주세요!', '⚠️'); return; }
    if (target === S.name) { toast('내 글에는 소감을 남길 수 없어요.', '🙂'); return; }
    if (!curSession()) { toast('지금은 열린 시간이 없어요.', '🗓️'); return; }
    const already = curFbs().find((f) => f.to === target && f.from === S.name);
    if (already) {
      if (isMine(already)) {
        toast('한 시간에 한 친구에게는 한 번만 보낼 수 있어요. 보낸 마음을 고쳐 볼까요?', '💌', 3200);
        fb = already;
      } else {
        toast(`이번 시간에 ${target} 친구에게는 이미 마음을 보냈어요.`, '💌', 3200);
        return;
      }
    }
  }
  const byTeacher = !!fb && S.teacherView;
  S.compose = {
    mode: fb ? 'edit' : 'new', target, id: fb?.id || null, byTeacher,
    prevStatus: fb?.status || 'normal',
    emoji: fb?.emoji || EMOJIS[0].emoji, label: fb?.label || EMOJIS[0].label
  };
  $('composeKicker').textContent = byTeacher ? '선생님 수정' : fb ? '소감 고치기' : '마음 전달하기';
  $('composeTarget').textContent = target;
  $('composeHint').textContent = fb ? '내용을 고친 뒤 저장해요.' : '글을 읽고 느낀 감정과 힘이 되는 한 줄을 선물해요.';
  $('composeFrom').textContent = fb ? fb.from : S.name;
  $('composeRejectNote').hidden = !(fb && fb.status === 'rejected' && !byTeacher);
  $('composeSubmit').textContent = fb ? '고친 내용 저장 ✨' : '마음 남기기 💕';

  renderEmojiGrid();
  const cats = fb?.categories?.length ? fb.categories : ['느낀점'];
  $('catGrid').innerHTML = CATEGORIES.map((c) => `
    <label class="chip"><input type="checkbox" value="${esc(c.value)}" ${cats.includes(c.value) ? 'checked' : ''}><span>${c.icon} ${esc(c.value)}</span></label>`).join('');
  $('starterRow').innerHTML = fb ? '' : STARTERS.map((s) => `<button type="button" class="starter" data-action="starter" data-text="${esc(s)}">${esc(s)}</button>`).join('');
  $('commentInput').value = fb?.comment || '';
  updateCharCount();
  openModal('composeModal');
  setTimeout(() => $('commentInput').focus({ preventScroll: true }), 120);
}

function renderEmojiGrid() {
  $('emojiGrid').innerHTML = EMOJIS.map((e) => `
    <button type="button" class="emoji-btn ${e.emoji === S.compose.emoji ? 'is-on' : ''}" data-action="pick-emoji" data-emoji="${e.emoji}" data-label="${esc(e.label)}" aria-pressed="${e.emoji === S.compose.emoji}">
      <span class="e">${e.emoji}</span><span class="l">${esc(e.label)}</span>
    </button>`).join('');
}

function updateCharCount() {
  $('charCount').textContent = `${$('commentInput').value.length} / ${MAX_COMMENT}자`;
}

function submitCompose() {
  const c = S.compose;
  if (!c) return;
  const categories = [...$('catGrid').querySelectorAll('input:checked')].map((i) => i.value);
  const comment = $('commentInput').value.replace(/\s+$/g, '').replace(/^\s+/g, '').slice(0, MAX_COMMENT);
  if (!categories.length) { toast('전하고 싶은 이야기를 하나 이상 골라 주세요!', '☑️'); return; }
  if (!comment) { toast('친구에게 전할 느낀점을 적어 주세요!', '✏️'); $('commentInput').focus(); return; }
  if (!S.user) { toast('아직 연결 중이에요. 잠시 후 다시 눌러 주세요.', '⏳'); return; }

  if (c.mode === 'new') {
    const before = stageIndex(mySentCount());
    const forestBefore = forestIndex(S.feedbacks.filter(countable).length);
    const sid = curSession()?.id;
    if (!sid) { toast('지금은 열린 시간이 없어요.', '🗓️'); return; }
    setDoc(doc(fbCol, pairId(sid, S.name, c.target)), {
      session: sid, to: c.target, from: S.name, uid: S.user.uid,
      emoji: c.emoji, label: c.label, categories, comment,
      status: 'normal', editedBy: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }).catch(writeFailed);
    closeModal('composeModal');
    toast(`${c.target} 친구에게 마음이 전달되었어요!`, '💖');
    burst([c.emoji, '💛', '✨']);
    setTimeout(() => {
      const fAfter = forestIndex(S.feedbacks.filter(countable).length);
      if (fAfter > forestBefore) {
        toast(`우리 반 마음 숲이 [${FORESTS[fAfter].title}]으로 자랐어요! ${FORESTS[fAfter].icon}`, '🌳', 3500);
        burst(['🌳', '🌸', '🦋', '💚']);
        return;
      }
      const after = stageIndex(mySentCount());
      if (after > before) {
        const st = STAGES[after];
        toast(`와! 내 마음 나무가 [${st.title}] 단계로 자랐어요! ${st.icon}`, '🌟', 3500);
        burst(['🌱', '🌸', '🌈', '⭐']);
      }
    }, 1300);
  } else {
    const status = !c.byTeacher && c.prevStatus === 'rejected' ? 'revised' : c.prevStatus;
    updateDoc(doc(fbCol, c.id), {
      emoji: c.emoji, label: c.label, categories, comment, status,
      editedBy: c.byTeacher ? 'teacher' : 'student', updatedAt: serverTimestamp()
    }).catch(writeFailed);
    closeModal('composeModal');
    toast(status === 'revised' ? '다시 쓴 글을 선생님께 보냈어요!' : '소감을 고쳤어요!', '✅');
  }
  S.compose = null;
}

// ---------- 상세 보기 ----------
function openDetail(name) {
  S.detailTarget = name;
  $('detailList').classList.add('enter');
  renderDetail();
  setTimeout(() => $('detailList').classList.remove('enter'), 400);
  openModal('detailModal');
}

function renderDetail() {
  const name = S.detailTarget;
  if (!name) return;
  const tv = S.teacherView;
  const isSelf = !tv && name === S.name;
  const list = receivedBy(name);
  const counted = tv ? list : list.filter(countable);
  const canView = tv || !isSelf || ownViewOpen();

  $('detailTitle').textContent = `📜 ${name}의 글 · ${curSession()?.title || ''}`;
  $('detailWriteBtn').hidden = tv || isSelf || !S.name || !curSession() || curFbs().some((f) => f.to === name && f.from === S.name);

  const summary = $('detailSummary');
  const box = $('detailList');

  if (!canView) {
    summary.innerHTML = '<span>🔒 선생님이 열람을 허용하면 볼 수 있어요.</span>';
    box.innerHTML = `<div class="locked-box">
      <span class="big">🎁</span>
      <h4 class="title-sm">두근두근! 친구들의 마음이 모이고 있어요</h4>
      <p class="muted small">활동이 끝난 뒤 선생님이 열어 주시면<br>친구들이 남긴 이모티콘과 소감을 모두 볼 수 있어요 😊</p>
      <span class="count">지금까지 도착한 마음 ${counted.length}개</span>
    </div>`;
    return;
  }

  if (!counted.length && !list.length) {
    summary.innerHTML = '<span class="muted">아직 도착한 마음이 없어요.</span>';
    box.innerHTML = `<div class="empty"><span class="big">💌</span>
      <b>아직 친구들이 남긴 소감이 없어요</b>
      <p class="small muted">${isSelf ? '친구들이 곧 마음을 보내 줄 거예요!' : '인쇄된 글을 읽고 제일 먼저 응원을 남겨 보세요!'}</p></div>`;
    return;
  }

  const counts = {};
  counted.forEach((f) => { counts[f.emoji] = (counts[f.emoji] || 0) + 1; });
  summary.innerHTML = `<b>모인 감정</b>
    ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([e, n]) => `<span class="emo-count">${esc(e)} <b>${n}</b></span>`).join('')}
    <span class="total">총 ${counted.length}개의 응원</span>`;

  box.innerHTML = list.slice().reverse().map(fbHtml).join('');
}

function fbHtml(fb) {
  const tv = S.teacherView;
  const mine = isMine(fb);
  const st = fb.status || 'normal';
  const cls = ['fb', mine && 'is-mine', st === 'rejected' && 'is-rejected', st === 'revised' && tv && 'is-revised'].filter(Boolean).join(' ');
  const cats = (fb.categories?.length ? fb.categories : ['느낀점']).map((c) => `<span class="mini mini-sky">#${esc(c)}</span>`).join('');
  const badges = [
    mine ? '<span class="mini mini-me">내가 쓴 글</span>' : '',
    st === 'rejected' ? '<span class="mini mini-rose">선생님 반려</span>' : '',
    st === 'revised' && (tv || mine) ? '<span class="mini mini-blue">다시 씀</span>' : '',
    fb.editedBy === 'teacher' && tv ? '<span class="mini mini-amber">선생님 수정</span>' : ''
  ].join('');

  let tools = '';
  const id = esc(fb.id);
  if (tv) {
    if (st === 'revised') tools += `<button class="tool-btn ok" data-action="set-status" data-id="${id}" data-status="normal">✓ 확인</button>`;
    tools += st === 'rejected'
      ? `<button class="tool-btn ok" data-action="set-status" data-id="${id}" data-status="normal">반려 취소</button>`
      : `<button class="tool-btn warn" data-action="set-status" data-id="${id}" data-status="rejected">반려</button>`;
  }
  if (tv || mine) {
    tools += `<button class="tool-btn" data-action="edit-fb" data-id="${id}" title="고치기">✏️</button>
      <button class="tool-btn del" data-action="delete-fb" data-id="${id}" title="지우기">🗑️</button>`;
  }

  let note = '';
  if (st === 'rejected') {
    note = tv
      ? '<div class="note note-rose">반려된 글이에요. 쓴 친구에게만 보이고, 받는 친구에게는 숨겨져요.</div>'
      : '<div class="note note-rose"><b>선생님 안내:</b> 친구가 기분 좋게 읽을 수 있도록 ✏️를 눌러 다정하게 다시 써 볼까요?</div>';
  } else if (st === 'revised' && tv) {
    note = '<div class="note note-amber">반려 후 학생이 다시 쓴 글이에요. 확인해 주세요.</div>';
  }

  return `<div class="${cls}">
    <div class="fb-top">
      <div class="fb-who">
        <span class="fb-emoji">${esc(fb.emoji)}</span>
        <div style="min-width:0">
          <div class="fb-name">${esc(fb.from)} 친구 ${badges}</div>
          <div class="fb-badges"><span class="mini mini-amber">${esc(fb.label)}</span>${cats}</div>
        </div>
      </div>
      <div class="fb-tools"><span class="fb-time">${esc(fmtTime(fb))}</span>${tools}</div>
    </div>
    ${note}
    <div class="fb-text">${esc(fb.comment)}</div>
  </div>`;
}

// 숫자가 바뀌면 통통 튀는 효과
function setNum(id, v) {
  const el = $(id);
  const t = String(v);
  if (el.textContent === t) return;
  const first = el.dataset.ready !== '1';
  el.textContent = t;
  el.dataset.ready = '1';
  if (first) return;
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

function findFb(id) { return S.feedbacks.find((f) => f.id === id); }

function deleteFb(id) {
  const fb = findFb(id);
  if (!fb) return;
  showConfirm({ icon: '🗑️', title: '이 소감을 지울까요?', text: `${fb.from} 친구가 ${fb.to} 친구에게 쓴 소감이 사라져요.`, yes: '지우기' }, () => {
    deleteDoc(doc(fbCol, id)).catch(writeFailed);
    toast(S.teacherView ? '선생님 권한으로 소감을 지웠어요.' : '소감을 지웠어요.', '🗑️');
  });
}

function setStatus(id, status) {
  const fb = findFb(id);
  if (!fb || !isTeacher()) return;
  updateDoc(doc(fbCol, id), { status, updatedAt: serverTimestamp() }).catch(writeFailed);
  toast(status === 'rejected' ? `${fb.from} 학생의 소감을 반려했어요.` : `${fb.from} 학생의 소감을 정상으로 돌렸어요.`, status === 'rejected' ? '⚠️' : '✅');
}

// ---------- 선생님 ----------
function renderTeacherModal() {
  const t = isTeacher();
  $('teacherSignedOut').hidden = t;
  $('teacherSignedIn').hidden = !t;
  $('teacherWho').textContent = t ? '이 기기는 선생님 모드예요.' : '비밀번호를 입력해 주세요.';
  if (!t) return;

  renderSessionAdmin();
  const cur = sessionList().find((x) => x.id === S.session) || sessionList()[sessionList().length - 1];
  const here = S.feedbacks.filter((f) => sessOf(f) === cur.id);
  $('tCurTitle').textContent = `📊 ${cur.title} 현황`;
  const names = S.students;
  const live = here.filter(countable);
  const noRecv = names.filter((n) => !live.some((f) => f.to === n));
  const noSend = names.filter((n) => !here.some((f) => f.from === n));
  const flagged = here.filter((f) => f.status === 'rejected' || f.status === 'revised');
  $('tStatFb').textContent = here.length;
  $('tStatNoRecv').textContent = noRecv.length;
  $('tStatNoSend').textContent = noSend.length;
  $('tStatRej').textContent = flagged.length;

  const short = (arr) => arr.slice(0, 15).map(esc).join(', ') + (arr.length > 15 ? ` 외 ${arr.length - 15}명` : '');
  const lines = [];
  if (noRecv.length && here.length) lines.push(`<div class="line"><b>📭 아직 못 받은</b>${short(noRecv)}</div>`);
  if (noSend.length && here.length) lines.push(`<div class="line"><b>✏️ 아직 안 쓴</b>${short(noSend)}</div>`);
  const revised = here.filter((f) => f.status === 'revised').length;
  if (revised) lines.push(`<div class="line"><b>🔁 다시 쓴 글</b>${revised}개가 확인을 기다려요.</div>`);
  $('tAttention').innerHTML = lines.join('');

  const ri = $('rosterInput');
  if (document.activeElement !== ri && !ri.dataset.dirty) ri.value = S.students.join(', ');
}

function withTimeout(p, ms = 10000) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({ code: 'timeout' }), ms))]);
}

async function teacherLogin() {
  const input = $('teacherPw');
  const pw = input.value.trim();
  const note = $('teacherDenied');
  if (!pw) { input.focus(); return; }
  if (!S.user) { toast('아직 연결 중이에요. 잠시 후 다시 해 주세요.', '⏳'); return; }
  const btn = $('teacherLoginBtn');
  btn.disabled = true; btn.textContent = '확인 중…';
  try {
    // 서버 보안 규칙이 비밀번호를 확인해 줌 (비밀번호는 페이지 소스에 없음)
    await withTimeout(setDoc(sessionRef(), { pw, at: serverTimestamp() }));
    input.value = '';
    note.hidden = true;
    toast('선생님, 반가워요!', '🧑‍🏫');
  } catch (err) {
    console.error(err);
    note.hidden = false;
    note.textContent = err?.code === 'permission-denied' ? '비밀번호가 맞지 않아요.'
      : err?.code === 'timeout' ? '인터넷 연결을 확인해 주세요.' : '확인하지 못했어요. 다시 해 주세요.';
    input.select();
    const form = $('teacherSignedOut');
    form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
  } finally {
    btn.disabled = false; btn.textContent = '들어가기';
  }
}

async function teacherLogout() {
  exitTeacherView();
  closeAllModals();
  try { await deleteDoc(sessionRef()); } catch (err) { console.error(err); }
  S.teacher = false;
  renderAll();
  toast('선생님 모드를 끝냈어요.', '👋');
}

async function changePassword() {
  const input = $('newPw');
  const pw = input.value.trim();
  if (pw.length < 4) { toast('비밀번호는 4자 이상으로 정해 주세요.', '🔑'); input.focus(); return; }
  try {
    await withTimeout(updateDoc(secretRef, { pw }));
    await withTimeout(setDoc(sessionRef(), { pw, at: serverTimestamp() }));
    input.value = '';
    toast('비밀번호를 바꿨어요. 새 비밀번호를 꼭 기억해 두세요!', '🔑', 4000);
  } catch (err) {
    console.error(err);
    toast(err?.code === 'permission-denied' ? '선생님 모드가 풀렸어요. 다시 들어와 주세요.' : '바꾸지 못했어요.', '⚠️', 4000);
  }
}

function enterTeacherView(sid) {
  if (!isTeacher()) return;
  S.teacherView = true;
  if (sid) S.session = sid;
  S.animate = true;
  closeAllModals();
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function exitTeacherView() {
  S.teacherView = false;
  S.animate = true;
  renderAll();
}

// ---------- 시간 메뉴 / 관리 ----------
function renderSessionBar() {
  const bar = $('sessionBar');
  const vis = visibleSessions();
  const cur = curSession();
  if (!vis.length) { bar.innerHTML = ''; return; }
  bar.innerHTML = vis.map((x) => {
    const n = S.feedbacks.filter((f) => sessOf(f) === x.id && (S.teacherView || countable(f))).length;
    const cls = ['sess-pill', cur && x.id === cur.id && 'is-active', !x.open && 'is-closed'].filter(Boolean).join(' ');
    return `<button class="${cls}" role="tab" aria-selected="${cur && x.id === cur.id}" data-action="pick-session" data-id="${esc(x.id)}">${!x.open ? '🔒 ' : '📖 '}${esc(x.title)}<span class="cnt">${n}</span></button>`;
  }).join('');
}

function renderSessionAdmin() {
  const box = $('sessionAdmin');
  if (box.contains(document.activeElement) && document.activeElement.dataset.rename) return; // 이름 고치는 중엔 그대로
  const curId = (sessionList().find((x) => x.id === S.session) || sessionList()[sessionList().length - 1]).id;
  box.innerHTML = sessionList().map((x) => {
    const n = S.feedbacks.filter((f) => sessOf(f) === x.id).length;
    const id = esc(x.id);
    return `<div class="sess-row ${x.id === curId ? 'is-cur' : ''}">
      <div class="sess-top">
        <div class="sess-title-wrap"><label class="sess-name-label"><input class="sess-name-input" data-rename="${id}" value="${esc(x.title)}" maxlength="30" aria-label="시간 이름 (눌러서 고치기)"><span class="sess-edit" aria-hidden="true">✏️</span></label><div class="sess-meta">소감 ${n}개 · ${x.open ? '학생에게 보임' : '학생에게 숨김'}</div></div>
        <div class="sess-btns">
          <button class="btn btn-indigo btn-sm" data-action="view-session" data-id="${id}">조회</button>
          ${sessionList().length > 1 ? `<button class="tool-btn del" data-action="delete-session" data-id="${id}" title="이 시간 지우기">🗑️</button>` : ''}
        </div>
      </div>
      <div class="sess-ctrls">
        <label><span class="switch sm"><input type="checkbox" data-sess="${id}" data-field="open" ${x.open ? 'checked' : ''}><span class="slider"></span></span>학생에게 열기(열람 허용)</label>
        <label><span class="switch sm"><input type="checkbox" data-sess="${id}" data-field="ownView" ${x.ownView ? 'checked' : ''}><span class="slider"></span></span>자기 글에 받은 소감 공개</label>
      </div>
    </div>`;
  }).join('');
}

function sessData(x) {
  return { title: x.title, order: x.order, open: !!x.open, ownView: !!x.ownView, createdAt: serverTimestamp() };
}

async function setSessionField(id, field, value) {
  const x = sessionList().find((y) => y.id === id);
  if (!x) return;
  try {
    if (x.virtual) await setDoc(doc(sessCol, id), sessData({ ...x, [field]: value }));
    else await updateDoc(doc(sessCol, id), { [field]: value });
    const msg = field === 'open'
      ? (value ? `${x.title}을(를) 학생들에게 열었어요.` : `${x.title}을(를) 학생 화면에서 숨겼어요.`)
      : (value ? `${x.title}: 자기 글에 받은 소감을 볼 수 있어요.` : `${x.title}: 받은 소감을 다시 잠갔어요.`);
    toast(msg, value ? '🔓' : '🔒');
  } catch (err) { writeFailed(err); renderSessionAdmin(); }
}

async function renameSession(id, raw) {
  const x = sessionList().find((y) => y.id === id);
  if (!x) return;
  const title = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  if (!title) { toast('시간 이름을 적어 주세요.', '✏️'); renderSessionAdmin(); return; }
  if (title === x.title) return;
  try {
    if (x.virtual) await setDoc(doc(sessCol, id), sessData({ ...x, title }));
    else await updateDoc(doc(sessCol, id), { title });
    toast(`시간 이름을 '${title}'(으)로 바꿨어요.`, '✏️');
  } catch (err) { writeFailed(err); renderSessionAdmin(); }
}

async function addSession() {
  const list = sessionList();
  const next = list.reduce((m, x) => Math.max(m, x.order || 0), 0) + 1;
  try {
    const b = writeBatch(db);
    list.filter((x) => x.virtual).forEach((x) => b.set(doc(sessCol, x.id), sessData(x)));
    b.set(doc(sessCol, `s${next}`), sessData({ title: sessTitle(next), order: next, open: true, ownView: false }));
    await b.commit();
    S.session = `s${next}`;
    toast(`${sessTitle(next)}을(를) 만들고 학생들에게 열었어요.`, '🗓️');
  } catch (err) { writeFailed(err); }
}

function deleteSession(id) {
  const x = sessionList().find((y) => y.id === id);
  if (!x || sessionList().length <= 1) { toast('시간은 하나 이상 있어야 해요.', '🗓️'); return; }
  const n = S.feedbacks.filter((f) => sessOf(f) === id).length;
  showConfirm({ icon: '🗓️', title: `${x.title}을(를) 지울까요?`, text: `이 시간에 쌓인 소감 ${n}개도 함께 지워지고 되돌릴 수 없어요. 먼저 결과를 내려받아 두세요.`, yes: '지우기' }, async () => {
    try {
      const ids = S.feedbacks.filter((f) => sessOf(f) === id).map((f) => f.id);
      for (let i = 0; i < ids.length; i += 400) {
        const b = writeBatch(db);
        ids.slice(i, i + 400).forEach((fid) => b.delete(doc(fbCol, fid)));
        await b.commit();
      }
      if (!x.virtual) await deleteDoc(doc(sessCol, id));
      if (S.session === id) S.session = null;
      toast(`${x.title}을(를) 지웠어요.`, '🗑️');
    } catch (err) { writeFailed(err); }
  });
}

function parseRoster(raw) {
  const seen = new Set();
  return String(raw).split(/[,\s]+/).map(cleanName).filter((n) => n && !seen.has(n) && seen.add(n));
}

function saveRoster() {
  const list = parseRoster($('rosterInput').value);
  if (!list.length) { toast('이름을 한 명 이상 적어 주세요.', '👥'); return; }
  delete $('rosterInput').dataset.dirty;
  setDoc(classRef, { students: list }, { merge: true }).catch(writeFailed);
  toast(`명단 ${list.length}명을 저장했어요.`, '👥');
}

function exportRows() {
  const order = allNamesForExport();
  const rows = [];
  sessionList().forEach((se) => {
    order.forEach((to) => {
      S.feedbacks.filter((f) => sessOf(f) === se.id && f.to === to).sort((a, b) => timeOf(a) - timeOf(b)).forEach((f) => rows.push(f));
    });
  });
  return { order, rows };
}
function sessName(id) { return (sessionList().find((x) => x.id === id) || {}).title || id; }
function allNamesForExport() {
  const list = [...S.students];
  S.feedbacks.forEach((f) => { if (!list.includes(f.to)) list.push(f.to); });
  return list;
}
const STATUS_KO = { normal: '정상', rejected: '반려', revised: '다시 씀' };
function fullTime(f) {
  if (f.legacyTime) return f.legacyTime;
  const d = toDate(f.createdAt);
  return d ? d.toLocaleString('ko-KR') : '';
}

function exportCsv() {
  const { rows } = exportRows();
  if (!rows.length) { toast('아직 모인 소감이 없어요.', 'ℹ️'); return; }
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  let csv = '﻿시간,글 쓴 친구,보낸 친구,이모티콘,느낌,항목,소감,상태,작성 시간\n';
  rows.forEach((f) => {
    csv += [sessName(sessOf(f)), f.to, f.from, f.emoji, f.label, (f.categories || []).join(', '), f.comment, STATUS_KO[f.status] || '정상', fullTime(f)].map(q).join(',') + '\n';
  });
  download(csv, `우마시_마음나누기_${today()}.csv`, 'text/csv;charset=utf-8');
  toast('엑셀(CSV) 파일을 내려받았어요!', '📥');
}

function exportTxt() {
  const { order } = exportRows();
  if (!S.feedbacks.length) { toast('아직 모인 소감이 없어요.', 'ℹ️'); return; }
  const line = '='.repeat(46);
  let t = `${line}\n [우마시] 우리들의 마음 나누기 - 활동 결과 보고서\n 날짜: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}\n 학생 수: ${S.students.length}명 · 모인 마음: ${S.feedbacks.length}개\n${line}\n\n`;
  sessionList().forEach((se) => {
    const inSess = S.feedbacks.filter((f) => sessOf(f) === se.id);
    t += `\n####  ${se.title} (${inSess.length}개)  ####\n\n`;
    order.forEach((to, i) => {
      const list = inSess.filter((f) => f.to === to).sort((a, b) => timeOf(a) - timeOf(b));
      if (!list.length) return;
      t += `${'-'.repeat(46)}\n▶ ${to}의 글에 모인 마음 (${list.length}개)\n${'-'.repeat(46)}\n`;
      list.forEach((f, k) => {
        const flag = f.status && f.status !== 'normal' ? ` <${STATUS_KO[f.status]}>` : '';
        t += `  ${k + 1}. [${f.from}] ${f.emoji} (${f.label}) ${(f.categories || []).map((c) => `[${c}]`).join(' ')}${flag}\n     "${f.comment}" (${fullTime(f)})\n`;
      });
      t += '\n';
    });
  });
  download(t, `우마시_학급소감모음_${today()}.txt`, 'text/plain;charset=utf-8');
  toast('보고서 파일을 내려받았어요!', '📥');
}

function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importLegacy() {
  const btn = $('importBtn');
  btn.disabled = true; btn.textContent = '가져오는 중…';
  try {
    const base = ['artifacts', LEGACY_APP_ID, 'public', 'data'];
    const [setSnap, fbSnap] = await Promise.all([
      getDoc(doc(db, ...base, 'settings', 'config')),
      getDoc(doc(db, ...base, 'feedbacks', 'all'))
    ]);
    const setData = setSnap.data() || {};
    const fbData = fbSnap.data() || {};
    let map = {};
    if (typeof fbData.payload === 'string') { try { map = JSON.parse(fbData.payload); } catch {} }
    else if (fbData.feedbacks) map = fbData.feedbacks;

    const roster = Array.isArray(setData.students) ? setData.students.map(cleanName).filter(Boolean) : [];
    const items = [];
    Object.entries(map).forEach(([to, list]) => (Array.isArray(list) ? list : []).forEach((f) => items.push({ to, f })));

    if (!roster.length && !items.length) { toast('가져올 이전 데이터가 없어요.', 'ℹ️'); return; }

    const ops = [];
    if (roster.length) ops.push((b) => b.set(classRef, { students: arrayUnion(...roster) }, { merge: true }));
    const start = Date.now() - items.length * 1000;
    items.forEach(({ to, f }, i) => {
      const id = 'legacy-' + String(f.id || i).replace(/[^\w-]/g, '').slice(0, 60);
      const cats = Array.isArray(f.categories) && f.categories.length ? f.categories.slice(0, 5).map(String) : ['느낀점'];
      ops.push((b) => b.set(doc(fbCol, id), {
        to: cleanName(to), from: cleanName(f.from) || '알 수 없음', uid: 'legacy',
        emoji: String(f.emoji || '💖').slice(0, 8), label: String(f.label || '').slice(0, 20),
        categories: cats, comment: String(f.comment || '').slice(0, MAX_COMMENT) || '(내용 없음)',
        status: f.status === 'rejected' ? 'rejected' : 'normal', editedBy: null,
        legacyTime: String(f.timestamp || '').slice(0, 40),
        createdAt: Timestamp.fromMillis(start + i * 1000), updatedAt: serverTimestamp()
      }));
    });
    for (let i = 0; i < ops.length; i += 400) {
      const b = writeBatch(db);
      ops.slice(i, i + 400).forEach((op) => op(b));
      await b.commit();
    }
    toast(`명단 ${roster.length}명, 소감 ${items.length}개를 가져왔어요!`, '🗂️', 3500);
  } catch (err) {
    console.error(err);
    toast(err?.code === 'permission-denied' ? '이전 데이터를 읽을 권한이 없어요. 보안 규칙을 확인해 주세요.' : '가져오지 못했어요.', '⚠️', 4000);
  } finally {
    btn.disabled = false; btn.textContent = '가져오기';
  }
}

function resetFeedbacks() {
  showConfirm({ icon: '🧹', title: '소감을 모두 비울까요?', text: `모인 소감 ${S.feedbacks.length}개가 모두 지워지고 되돌릴 수 없어요. 먼저 결과를 내려받아 두세요.`, yes: '모두 비우기' }, async () => {
    try {
      const snap = await getDocs(fbCol);
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
        await b.commit();
      }
      toast('소감을 모두 비웠어요.', '🧹');
    } catch (err) { writeFailed(err); }
  });
}

// ---------- 모달 / 토스트 ----------
function openModal(id) {
  $(id).hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  $(id).hidden = true;
  if (id === 'detailModal') S.detailTarget = null;
  if (id === 'composeModal') S.compose = null;
  if (!document.querySelector('.modal:not([hidden])')) document.body.style.overflow = '';
}
function closeAllModals() { document.querySelectorAll('.modal:not([hidden])').forEach((m) => closeModal(m.id)); }
function topModal() { const open = [...document.querySelectorAll('.modal:not([hidden])')]; return open[open.length - 1]; }

function showConfirm({ icon, title, text, yes }, cb) {
  $('confirmIcon').textContent = icon;
  $('confirmTitle').textContent = title;
  $('confirmText').textContent = text;
  $('confirmYes').textContent = yes;
  S.confirmCb = cb;
  openModal('confirmModal');
}

let toastTimer;
function toast(msg, icon = '✨', ms = 2600) {
  $('toastMsg').textContent = msg;
  $('toastIcon').textContent = icon;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), ms);
}

function burst(items) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = $('burst');
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('span');
    s.textContent = items[i % items.length];
    s.style.left = `${45 + Math.random() * 10}%`;
    s.style.top = `${55 + Math.random() * 10}%`;
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 520}px`);
    s.style.setProperty('--dy', `${-120 - Math.random() * 360}px`);
    s.style.setProperty('--rot', `${(Math.random() - 0.5) * 120}deg`);
    s.style.animationDelay = `${Math.random() * 150}ms`;
    layer.appendChild(s);
    setTimeout(() => s.remove(), 1700);
  }
}

// ---------- 이벤트 ----------
document.addEventListener('click', (e) => {
  const modal = e.target.classList?.contains('modal') ? e.target : null;
  if (modal) { closeModal(modal.id); return; } // 바깥 클릭

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  const name = el.dataset.name;
  const id = el.dataset.id;

  switch (a) {
    case 'home': closeAllModals(); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'logout': logoutStudent(); break;
    case 'filter': S.filter = el.dataset.filter; S.animate = true; renderDash(); break;
    case 'open-detail': openDetail(name); break;
    case 'compose': openCompose(name); break;
    case 'write-from-detail': { const t = S.detailTarget; closeModal('detailModal'); openCompose(t); break; }
    case 'pick-emoji':
      S.compose.emoji = el.dataset.emoji; S.compose.label = el.dataset.label; renderEmojiGrid(); break;
    case 'starter': {
      const ta = $('commentInput');
      const add = el.dataset.text;
      ta.value = (ta.value ? ta.value.replace(/\s*$/, ' ') : '') + add;
      ta.value = ta.value.slice(0, MAX_COMMENT);
      updateCharCount(); ta.focus();
      const tilde = ta.value.lastIndexOf('~');
      if (tilde >= 0) ta.setSelectionRange(tilde, tilde + 1);
      break;
    }
    case 'submit-compose': submitCompose(); break;
    case 'close-modal': closeModal(el.closest('.modal').id); break;
    case 'edit-fb': { const fb = findFb(id); if (fb) openCompose(fb.to, fb); break; }
    case 'delete-fb': deleteFb(id); break;
    case 'set-status': setStatus(id, el.dataset.status); break;
    case 'open-teacher': $('teacherDenied').hidden = true; renderTeacherModal(); openModal('teacherModal'); if (!S.teacher) setTimeout(() => $('teacherPw').focus(), 120); break;
    case 'teacher-logout': teacherLogout(); break;
    case 'enter-teacher-view': enterTeacherView(S.session); break;
    case 'view-session': enterTeacherView(el.dataset.id); break;
    case 'pick-session': S.session = el.dataset.id; S.animate = true; renderAll(); break;
    case 'add-session': addSession(); break;
    case 'delete-session': deleteSession(el.dataset.id); break;
    case 'exit-teacher-view': exitTeacherView(); break;
    case 'sample-roster': $('rosterInput').value = SAMPLE_ROSTER.join(', '); $('rosterInput').dataset.dirty = '1'; break;
    case 'save-roster': saveRoster(); break;
    case 'export-csv': exportCsv(); break;
    case 'export-txt': exportTxt(); break;
    case 'import-legacy': importLegacy(); break;
    case 'reset-feedbacks': resetFeedbacks(); break;
    case 'confirm-yes': { const cb = S.confirmCb; S.confirmCb = null; closeModal('confirmModal'); cb && cb(); break; }
    case 'confirm-no': S.confirmCb = null; closeModal('confirmModal'); break;
  }
});

// 버튼을 누르면 물결이 퍼지는 효과
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.btn, .roster-chip, .emoji-btn, .seg-btn, .chip span, .starter');
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 1.6;
  const dot = document.createElement('span');
  dot.className = 'ripple';
  dot.style.width = dot.style.height = `${size}px`;
  dot.style.left = `${e.clientX - r.left - size / 2}px`;
  dot.style.top = `${e.clientY - r.top - size / 2}px`;
  el.appendChild(dot);
  setTimeout(() => dot.remove(), 650);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.rename) { e.preventDefault(); e.target.blur(); return; }
  if (e.key === 'Escape' && e.target.dataset && e.target.dataset.rename) {
    const x = sessionList().find((y) => y.id === e.target.dataset.rename);
    if (x) e.target.value = x.title;
    e.target.blur(); e.stopPropagation(); return;
  }
  if (e.key === 'Escape') { const m = topModal(); if (m) closeModal(m.id); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.fcard')) { e.preventDefault(); openDetail(e.target.dataset.name); }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'commentInput') submitCompose();
});

$('loginForm').addEventListener('submit', (e) => { e.preventDefault(); enterAs($('nameSelect').value); });
$('teacherSignedOut').addEventListener('submit', (e) => { e.preventDefault(); teacherLogin(); });
$('pwChangeForm').addEventListener('submit', (e) => { e.preventDefault(); changePassword(); });
$('searchInput').addEventListener('input', (e) => { S.query = e.target.value; renderDash(); });
$('commentInput').addEventListener('input', updateCharCount);
$('rosterInput').addEventListener('input', (e) => { e.target.dataset.dirty = '1'; });
$('sessionAdmin').addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.rename) { renameSession(t.dataset.rename, t.value); return; }
  if (t.dataset.sess) setSessionField(t.dataset.sess, t.dataset.field, t.checked);
});
window.addEventListener('online', renderSync);
window.addEventListener('offline', renderSync);

renderAll();
