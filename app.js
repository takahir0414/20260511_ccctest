(() => {
  let startTime = 0;
  let elapsed = 0;
  let running = false;
  let rafId = null;
  let laps = [];
  let lastLapElapsed = 0;

  const minutesEl      = document.getElementById('minutes');
  const secondsEl      = document.getElementById('seconds');
  const centisEl       = document.getElementById('centiseconds');
  const startStopBtn   = document.getElementById('start-stop');
  const lapBtn         = document.getElementById('lap');
  const resetBtn       = document.getElementById('reset');
  const lapList        = document.getElementById('lap-list');

  function format(ms) {
    const totalCs = Math.floor(ms / 10);
    const cs  = totalCs % 100;
    const s   = Math.floor(totalCs / 100) % 60;
    const m   = Math.floor(totalCs / 6000);
    return {
      m:  String(m).padStart(2, '0'),
      s:  String(s).padStart(2, '0'),
      cs: String(cs).padStart(2, '0'),
    };
  }

  function render(ms) {
    const { m, s, cs } = format(ms);
    minutesEl.textContent = m;
    secondsEl.textContent = s;
    centisEl.textContent  = cs;
  }

  function tick() {
    elapsed = Date.now() - startTime;
    render(elapsed);
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    startTime = Date.now() - elapsed;
    running = true;
    startStopBtn.textContent = 'ストップ';
    startStopBtn.classList.add('running');
    lapBtn.disabled = false;
    resetBtn.disabled = true;
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(rafId);
    running = false;
    startStopBtn.textContent = 'スタート';
    startStopBtn.classList.remove('running');
    lapBtn.disabled = true;
    resetBtn.disabled = false;
  }

  function reset() {
    elapsed = 0;
    lastLapElapsed = 0;
    laps = [];
    render(0);
    lapList.innerHTML = '';
    resetBtn.disabled = true;
    lapBtn.disabled = true;
    updateLapHighlights();
  }

  function addLap() {
    const lapTime = elapsed - lastLapElapsed;
    lastLapElapsed = elapsed;
    laps.push({ lapTime, total: elapsed });
    renderLaps();
  }

  function renderLaps() {
    updateLapHighlights();
    lapList.innerHTML = '';

    const times = laps.map(l => l.lapTime);
    const min = Math.min(...times);
    const max = Math.max(...times);

    [...laps].reverse().forEach((lap, i) => {
      const num = laps.length - i;
      const li  = document.createElement('li');

      if (laps.length > 1) {
        if (lap.lapTime === min) li.classList.add('fastest');
        else if (lap.lapTime === max) li.classList.add('slowest');
      }

      const lapFmt   = format(lap.lapTime);
      const totalFmt = format(lap.total);

      li.innerHTML = `
        <span class="lap-num">${num}</span>
        <span class="lap-time">${lapFmt.m}:${lapFmt.s}.${lapFmt.cs}</span>
        <span class="lap-total">${totalFmt.m}:${totalFmt.s}.${totalFmt.cs}</span>
      `;
      lapList.appendChild(li);
    });
  }

  function updateLapHighlights() {}

  startStopBtn.addEventListener('click', () => {
    if (running) stop(); else start();
  });

  lapBtn.addEventListener('click', () => {
    if (running) addLap();
  });

  resetBtn.addEventListener('click', () => {
    if (!running) reset();
  });

  render(0);
})();
