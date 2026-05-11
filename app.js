'use strict';

const API_KEY = '0a8e5af76b6ec57d96fe693e76ea90a4';
const LIBRARY_API = 'https://api.calil.jp/library';
const CHECK_API   = 'https://api.calil.jp/check';

const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
  '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
  '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
  '熊本県','大分県','宮崎県','鹿児島県','沖縄県',
];

let libraries = [];
let userLat = null;
let userLon = null;
let checkPollTimer = null;

const geoBtn       = document.getElementById('geo-btn');
const prefSelect   = document.getElementById('pref-select');
const cityInput    = document.getElementById('city-input');
const searchBtn    = document.getElementById('search-btn');
const statusMsg    = document.getElementById('status-msg');
const libResults   = document.getElementById('library-results');
const libList      = document.getElementById('libraries-list');
const resultCount  = document.getElementById('results-count');
const bookSection  = document.getElementById('book-section');
const isbnInput    = document.getElementById('isbn-input');
const bookSearchBtn= document.getElementById('book-search-btn');
const bookStatus   = document.getElementById('book-status');
const bookResults  = document.getElementById('book-results');

PREFECTURES.forEach(pref => {
  const opt = document.createElement('option');
  opt.value = pref;
  opt.textContent = pref;
  prefSelect.appendChild(opt);
});

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const id = '_calil_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = () => { settled = true; delete window[id]; script.remove(); };
    window[id] = (data) => { if (settled) return; cleanup(); resolve(data); };
    script.onerror = () => { if (settled) return; cleanup(); reject(new Error('ネットワークエラーが発生しました')); };
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + id;
    document.head.appendChild(script);
  });
}

function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatDistance(km) {
  return km < 1 ? Math.round(km*1000)+'m' : km.toFixed(1)+'km';
}

function showStatus(type, text) {
  statusMsg.className = 'status-msg ' + type;
  statusMsg.innerHTML = type === 'loading' ? `<span class="spinner"></span>${esc(text)}` : esc(text);
  statusMsg.classList.remove('hidden');
}
function hideStatus() { statusMsg.classList.add('hidden'); }

function showBookStatus(type, text) {
  bookStatus.className = 'status-msg ' + type;
  bookStatus.innerHTML = type === 'loading' ? `<span class="spinner"></span>${esc(text)}` : esc(text);
  bookStatus.classList.remove('hidden');
}
function hideBookStatus() { bookStatus.classList.add('hidden'); }

geoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) { showStatus('error', '⚠️ このブラウザは位置情報に対応していません'); return; }
  geoBtn.disabled = true;
  showStatus('loading', '現在地を取得中...');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      userLat = pos.coords.latitude;
      userLon = pos.coords.longitude;
      geoBtn.disabled = false;
      showStatus('loading', '図書館を検索中...');
      try {
        const data = await jsonp(`${LIBRARY_API}?appkey=${API_KEY}&geocode=${userLon},${userLat}&limit=30`);
        handleLibResults(data);
      } catch(e) { showStatus('error', '⚠️ 検索に失敗しました: ' + e.message); }
    },
    (err) => {
      geoBtn.disabled = false;
      const msgs = {1:'位置情報の使用が拒否されました。',2:'位置情報を取得できませんでした。',3:'タイムアウトしました。'};
      showStatus('error', '⚠️ ' + (msgs[err.code] || err.message));
    },
    { timeout: 10000 }
  );
});

searchBtn.addEventListener('click', doManualSearch);
cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') doManualSearch(); });

async function doManualSearch() {
  const pref = prefSelect.value;
  const city = cityInput.value.trim();
  if (!pref) { prefSelect.focus(); showStatus('error', '⚠️ 都道府県を選択してください'); return; }
  userLat = null; userLon = null;
  searchBtn.disabled = true;
  showStatus('loading', '図書館を検索中...');
  try {
    let url = `${LIBRARY_API}?appkey=${API_KEY}&pref=${encodeURIComponent(pref)}&limit=30`;
    if (city) url += `&city=${encodeURIComponent(city)}`;
    const data = await jsonp(url);
    handleLibResults(data);
  } catch(e) {
    showStatus('error', '⚠️ 検索に失敗しました: ' + e.message);
  } finally {
    searchBtn.disabled = false;
  }
}

function handleLibResults(data) {
  if (!Array.isArray(data) || data.length === 0) {
    showStatus('error', '⚠️ 図書館が見つかりませんでした。検索条件を変えてお試しください。');
    return;
  }
  if (userLat !== null) {
    data.forEach(lib => {
      if (lib.geocode) {
        const [lon, lat] = lib.geocode.split(',').map(Number);
        lib._dist = isNaN(lat) ? Infinity : calcDistance(userLat, userLon, lat, lon);
      } else { lib._dist = Infinity; }
    });
    data.sort((a,b) => a._dist - b._dist);
  }
  libraries = data;
  hideStatus();
  renderLibraries();
}

function renderLibraries() {
  resultCount.textContent = libraries.length + '件';
  libResults.classList.remove('hidden');
  libList.innerHTML = '';
  libraries.forEach(lib => {
    const name    = lib.formal || lib.name || lib.libkey || '不明';
    const address = lib.address || '';
    const tel     = lib.tel || '';
    const url     = lib.url || '';
    const sysId   = lib.systemid || '';
    const distHtml = (lib._dist !== undefined && lib._dist !== Infinity)
      ? `<span class="lib-distance">${formatDistance(lib._dist)}</span>` : '';
    const telHtml  = tel ? `<div class="lib-tel">📞 ${esc(tel)}</div>` : '';
    const urlHtml  = url ? `<a class="lib-url" href="${esc(url)}" target="_blank" rel="noopener">ウェブサイト →</a>` : '<span></span>';
    const li = document.createElement('li');
    li.className = 'library-card';
    li.innerHTML = `
      <div class="lib-header">
        <h3 class="lib-name">${esc(name)}</h3>
        ${distHtml}
      </div>
      ${address ? `<div class="lib-address">📍 ${esc(address)}</div>` : ''}
      ${telHtml}
      <div class="lib-footer">${urlHtml}<span class="lib-system">${esc(sysId)}</span></div>
    `;
    libList.appendChild(li);
  });
  bookSection.classList.remove('hidden');
  bookSection.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

bookSearchBtn.addEventListener('click', startBookSearch);
isbnInput.addEventListener('keydown', e => { if (e.key === 'Enter') startBookSearch(); });

function startBookSearch() {
  const raw = isbnInput.value.trim().replace(/-/g, '');
  if (!raw) { isbnInput.focus(); return; }
  if (!/^\d{10}(\d{3})?$/.test(raw)) {
    showBookStatus('error', '⚠️ ISBNは10桁または13桁の数字で入力してください（ハイフン不要）');
    return;
  }
  if (libraries.length === 0) { showBookStatus('error', '⚠️ まず図書館を検索してください'); return; }
  if (checkPollTimer !== null) { clearTimeout(checkPollTimer); checkPollTimer = null; }
  const systemIds = [...new Set(libraries.map(l => l.systemid).filter(Boolean))].slice(0, 100);
  bookResults.innerHTML = '';
  bookResults.classList.add('hidden');
  bookSearchBtn.disabled = true;
  showBookStatus('loading', `ISBN ${raw} を検索中...`);
  pollCheck(raw, systemIds, null);
}

async function pollCheck(isbn, systemIds, session) {
  let url = `${CHECK_API}?appkey=${API_KEY}&isbn=${isbn}&systemid=${systemIds.join(',')}&format=json`;
  if (session) url += `&session=${encodeURIComponent(session)}`;
  try {
    const data = await jsonp(url);
    renderBookResults(isbn, data.books || {});
    if (data.continue === 1) {
      showBookStatus('loading', '図書館の在庫を確認中...');
      checkPollTimer = setTimeout(() => pollCheck(isbn, systemIds, data.session), 2000);
    } else {
      hideBookStatus();
      bookSearchBtn.disabled = false;
    }
  } catch(e) {
    showBookStatus('error', '⚠️ 蔵書検索に失敗しました: ' + e.message);
    bookSearchBtn.disabled = false;
  }
}

const STATUS_META = {
  '貸出可':  { cls: 'available',   label: '貸出可' },
  '館内のみ':{ cls: 'inhouse',     label: '館内のみ' },
  '貸出中':  { cls: 'checked-out', label: '貸出中' },
  '在庫なし':{ cls: 'none',        label: '在庫なし' },
  '予約中':  { cls: 'reserved',    label: '予約中' },
  '準備中':  { cls: 'reserved',    label: '準備中' },
};

function renderBookResults(isbn, books) {
  const isbnData = books[isbn] || {};
  bookResults.innerHTML = '';
  const items = [];
  Object.entries(isbnData).forEach(([sysId, info]) => {
    if (!info || info.status === 'Error') return;
    Object.entries(info.libkey || {}).forEach(([libName, statusStr]) => {
      items.push({ sysId, libName, statusStr, reserveurl: info.reserveurl || '' });
    });
  });
  const order = ['貸出可','館内のみ','準備中','予約中','貸出中','在庫なし'];
  items.sort((a,b) => {
    const ia = order.indexOf(a.statusStr), ib = order.indexOf(b.statusStr);
    return (ia===-1?99:ia)-(ib===-1?99:ib);
  });
  if (items.length === 0) {
    bookResults.innerHTML = '<p class="no-results">検索した図書館には蔵書情報がありませんでした</p>';
    bookResults.classList.remove('hidden');
    return;
  }
  items.forEach(({ libName, statusStr, reserveurl }) => {
    const meta = STATUS_META[statusStr] || { cls: 'unknown', label: statusStr || '不明' };
    const reserveHtml = reserveurl
      ? `<a class="reserve-link" href="${esc(reserveurl)}" target="_blank" rel="noopener">予約する</a>` : '';
    const div = document.createElement('div');
    div.className = 'book-result-item';
    div.innerHTML = `
      <span class="book-lib-name">${esc(libName)}</span>
      <span class="book-status ${meta.cls}">${esc(meta.label)}</span>
      ${reserveHtml}
    `;
    bookResults.appendChild(div);
  });
  bookResults.classList.remove('hidden');
}

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
