(() => {
  const STORAGE_KEY = 'alarms_v1';

  // --- State ---
  let alarms = load();
  let audioCtx = null;
  let firingId = null;

  // --- DOM refs ---
  const timeInput    = document.getElementById('alarm-time');
  const labelInput   = document.getElementById('alarm-label');
  const addBtn       = document.getElementById('add-btn');
  const alarmsList   = document.getElementById('alarms');
  const emptyMsg     = document.getElementById('empty-msg');
  const modal        = document.getElementById('modal');
  const modalLabel   = document.getElementById('modal-label');
  const modalTime    = document.getElementById('modal-time');
  const dismissBtn   = document.getElementById('dismiss-btn');
  const currentTime  = document.getElementById('current-time');

  // --- Clock ---
  function updateClock() {
    const now = new Date();
    currentTime.textContent = now.toLocaleTimeString('ja-JP', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    checkAlarms(now);
  }

  setInterval(updateClock, 500);
  updateClock();

  // --- Alarm check ---
  function checkAlarms(now) {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentHHMM = `${hh}:${mm}`;

    if (now.getSeconds() !== 0) return;

    alarms.forEach(alarm => {
      if (alarm.enabled && alarm.time === currentHHMM && firingId !== alarm.id) {
        triggerAlarm(alarm);
      }
    });
  }

  // --- Trigger ---
  function triggerAlarm(alarm) {
    firingId = alarm.id;
    modalLabel.textContent = alarm.label || 'アラーム';
    modalTime.textContent  = alarm.time;
    modal.classList.remove('hidden');
    playBeep();
    document.querySelector(`[data-id="${alarm.id}"]`)?.classList.add('firing');
  }

  // --- Dismiss ---
  dismissBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    stopBeep();
    if (firingId !== null) {
      document.querySelector(`[data-id="${firingId}"]`)?.classList.remove('firing');
    }
    firingId = null;
  });

  // --- Add alarm ---
  addBtn.addEventListener('click', addAlarm);
  labelInput.addEventListener('keydown', e => { if (e.key === 'Enter') addAlarm(); });

  function addAlarm() {
    const time = timeInput.value;
    if (!time) { timeInput.focus(); return; }

    const alarm = {
      id: Date.now(),
      time,
      label: labelInput.value.trim(),
      enabled: true,
    };

    alarms.push(alarm);
    alarms.sort((a, b) => a.time.localeCompare(b.time));
    save();
    render();

    labelInput.value = '';
    timeInput.value  = '';
    timeInput.focus();
  }

  // --- Render ---
  function render() {
    alarmsList.innerHTML = '';
    emptyMsg.style.display = alarms.length ? 'none' : '';

    alarms.forEach(alarm => {
      const li = document.createElement('li');
      li.className = 'alarm-item' + (alarm.enabled ? ' active' : '');
      li.dataset.id = alarm.id;

      li.innerHTML = `
        <div class="alarm-time">${alarm.time}</div>
        <div class="alarm-info">
          <div class="alarm-label">${escHtml(alarm.label)}</div>
        </div>
        <div class="alarm-controls">
          <label class="toggle" title="${alarm.enabled ? 'オフにする' : 'オンにする'}">
            <input type="checkbox" ${alarm.enabled ? 'checked' : ''} data-id="${alarm.id}" />
            <span class="toggle-slider"></span>
          </label>
          <button class="delete-btn" data-id="${alarm.id}" title="削除">✕</button>
        </div>
      `;

      li.querySelector('input[type="checkbox"]').addEventListener('change', e => {
        const id = Number(e.target.dataset.id);
        const a  = alarms.find(x => x.id === id);
        if (a) { a.enabled = e.target.checked; save(); render(); }
      });

      li.querySelector('.delete-btn').addEventListener('click', e => {
        const id = Number(e.currentTarget.dataset.id);
        alarms = alarms.filter(x => x.id !== id);
        save();
        render();
      });

      alarmsList.appendChild(li);
    });
  }

  // --- Persistence ---
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms)); } catch {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  // --- Audio ---
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  let beepInterval = null;

  function playBeep() {
    const beep = () => {
      const ctx  = getAudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    };
    beep();
    beepInterval = setInterval(beep, 700);
  }

  function stopBeep() {
    clearInterval(beepInterval);
    beepInterval = null;
  }

  // --- Util ---
  function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- Init ---
  render();
})();
