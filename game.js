(() => {
  "use strict";

  // ============================ DOM ============================
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const menu = document.getElementById("menu");
  const result = document.getElementById("result");
  const restartButton = document.getElementById("restart-button");
  const hud = document.getElementById("hud");
  const crosshair = document.getElementById("crosshair");
  const objectiveText = document.getElementById("objective-text");
  const statusBadge = document.getElementById("status-badge");
  const statusText = document.getElementById("status-text");
  const message = document.getElementById("message");
  const mobileControls = document.getElementById("mobile-controls");
  const resultKicker = document.getElementById("result-kicker");
  const resultTitle = document.getElementById("result-title");
  const resultCopy = document.getElementById("result-copy");
  const resultImage = document.getElementById("result-image");
  const loadingError = document.getElementById("loading-error");
  const sensSlider = document.getElementById("sens-slider");
  const sensValue = document.getElementById("sens-value");

  crosshair.style.display = "none";

  const ammoBadge = document.createElement("div");
  ammoBadge.id = "ammo-badge";
  ammoBadge.textContent = "🔫 ∞";
  document.getElementById("game-shell").appendChild(ammoBadge);

  // ============================ 常量 ============================
  const MAP_W = 21;
  const MAP_H = 21;
  const BASE_FOV = Math.PI / 2.2;

  const MOVE_SPEED = 1.75;
  const RUN_SPEED = 2.85;
  const ROTATE_SPEED = 1.75;
  const BASE_MOUSE_SENS = 0.0011;
  const PITCH_SENSITIVITY = 0.0010;
  const PITCH_LIMIT = 0.55;
  const LOCK_DURATION = 30;
  const VIEW_RADIUS = 7;
  const MAX_ENEMY_SPEED = 4.0;

  const AUTO_FIRE_DELAY = 0.5;
  const AUTO_FIRE_INTERVAL = 0.12;
  const SINGLE_FIRE_COOLDOWN = 0.38;
  const RECOIL_BASE = 1.4;
  const RECOIL_AUTO = 1.4 * 0.7;
  const RECOIL_DECAY = 5.6;
  const VIEW_KICK_DECAY = 6.3;

  const PITCH_RECENTER_DELAY = 0.5;
  const PITCH_RECENTER_SPEED = 0.6;
  const CASING_LIFE = 4.5;

  const START_GRACE_DURATION = 5;

  const SOUND_RANGE = 8;
  const HIT_VOICE_BOOST_DECAY = 2.5;

  const WALL_TEX_SIZE = 512;

  // 墙面惊吓
  const WALL_SCARE_MIN_INTERVAL = 1;
  const WALL_SCARE_MAX_INTERVAL = 4;

  // ============================ 难度 ============================
  const DIFFICULTIES = {
    peace:     { label: "和平模式", enemySpeedMult: 0.75, detectRange: 10, enemyCount: 1 },
    easy:      { label: "简单模式", enemySpeedMult: 1.0,  detectRange: 6,  enemyCount: 1 },
    hard:      { label: "困难模式", enemySpeedMult: 1.0,  detectRange: 4,  enemyCount: 1 },
    nightmare: { label: "噩梦模式", enemySpeedMult: 1.0,  detectRange: 0,  enemyCount: 1 },
    hell:      { label: "地狱模式", enemySpeedMult: 1.0,  detectRange: 5,  enemyCount: 2 }
  };
  let currentDifficulty = "easy";

  // ============================ 状态 ============================
  const player = { x: 1.5, y: 1.5, angle: 0, pitch: 0, walkPhase: 0 };
  const input = Object.create(null);
  const zBuffer = [];
  const bloodParticles = [];

  let enemies = [];

  const bats = [];
  const skulls = [];
  let batSpawnTimer = 5 + Math.random() * 4;
  let skullSpawnTimer = 7 + Math.random() * 6;

  // 【新增】墙面惊吓
  const wallScares = new Map();  // key: "gx,gy" -> { life, maxLife, phase }
  let wallScareTimer = WALL_SCARE_MIN_INTERVAL + Math.random() * 6;

  let flickerTimer = 8 + Math.random() * 8;
  let flickerActive = 0;
  let flickerDark = 0;
  let ghostTimer = 14 + Math.random() * 10;
  let ghostActive = 0;
  let ghostX = 0, ghostY = 0, ghostAlpha = 0;
  let ambientNodes = null;
  let ambientCreakTimer = 5 + Math.random() * 8;
  let ambientWhisperTimer = 12 + Math.random() * 15;

  let lastMouseMoveTime = 0;
  let hitConfirmTimer = 0;
  let whiteFlash = 0;
  let mapExpanded = false;

  let hitVoiceBoost = 0;

  const casings = [];

  let map = [];
  let explored = [];
  let exitCell = { x: 19, y: 19 };
  let gunPosition = { x: 5.5, y: 5.5 };
  let keyPosition = { x: 15.5, y: 15.5 };
  let gunCellRef = null;
  let keyCellRef = null;

  let hasKey = false;
  let hasGun = false;
  let gunPicked = false;

  let gunCooldown = 0;
  let muzzleFlash = 0;
  let rageFlash = 0;
  let gunKick = 0;
  let viewKick = 0;

  let triggerHeld = false;
  let triggerHeldSince = 0;
  let autoFiring = false;
  let autoFireTimer = 0;

  let lockState = "idle";
  let lockTimer = 0;
  let doorOpened = false;

  let graceTimer = 0;

  let sensitivityMult = 1.0;

  let state = "menu";
  let lastTime = performance.now();
  let messageTimer = 0;
  let audio = null;
  let heartbeatTimer = 0;
  let shake = 0;
  let voicesPrimed = false;
  let nearbyPlayPending = false;
  let exploreAccum = 0;

  // 墙面照片纹理（只在惊吓时用）
  let wallTexture = null;

  const doubaoImage = new Image();
  doubaoImage.src = "assets/doubao.jpg";
  doubaoImage.addEventListener("error", () => { loadingError.hidden = false; });

  const doubaoNormalImage = new Image();
  doubaoNormalImage.src = "assets/doubao-normal.png";
  doubaoNormalImage.addEventListener("error", () => {});
  doubaoNormalImage.addEventListener("load", () => {
    buildWallTexture();
  });

  const voices = {
    victory: new Audio("assets/audio/victory.mp3"),
    caught: new Audio("assets/audio/caught.mp3"),
    nearby: new Audio("assets/audio/nearby.mp3")
  };
  for (const clip of Object.values(voices)) clip.preload = "auto";
  voices.nearby.loop = true;
  voices.victory.loop = true;
  voices.caught.loop = true;

  // ============================ 墙面照片纹理 ============================
  function buildWallTexture() {
    const size = WALL_TEX_SIZE;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const cx = c.getContext("2d");

    cx.fillStyle = "#1c1008";
    cx.fillRect(0, 0, size, size);

    if (!doubaoNormalImage.complete || !doubaoNormalImage.naturalWidth) {
      wallTexture = c;
      return;
    }

    const img = doubaoNormalImage;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const scale = Math.max(size / imgW, size / imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;

    cx.drawImage(img, dx, dy, dw, dh);

    // 叠一层暗红，让它更恐怖
    cx.fillStyle = "rgba(30, 6, 4, 0.35)";
    cx.fillRect(0, 0, size, size);

    // 噪点
    for (let i = 0; i < 3200; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const a = Math.random() * 0.08;
      cx.fillStyle = `rgba(0, 0, 0, ${a})`;
      cx.fillRect(x, y, 1, 1);
    }

    wallTexture = c;
  }

  // ============================ 工具 ============================
  function resizeCanvas() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.35);
    canvas.width = Math.min(1100, Math.max(480, Math.round(window.innerWidth * pixelRatio)));
    canvas.height = Math.min(1000, Math.max(320, Math.round(window.innerHeight * pixelRatio)));
  }

  function normalizeAngle(a) {
    while (a < -Math.PI) a += Math.PI * 2;
    while (a > Math.PI) a -= Math.PI * 2;
    return a;
  }

  function isWall(x, y) {
    const gx = Math.floor(x);
    const gy = Math.floor(y);
    if (gy < 0 || gy >= MAP_H || gx < 0 || gx >= MAP_W) return true;
    return map[gy][gx] !== 0;
  }

  function canMoveTo(x, y, radius = 0.18) {
    return !isWall(x - radius, y - radius) &&
           !isWall(x + radius, y - radius) &&
           !isWall(x - radius, y + radius) &&
           !isWall(x + radius, y + radius);
  }

  function movePlayer(dx, dy) {
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (canMoveTo(nx, player.y)) player.x = nx;
    if (canMoveTo(player.x, ny)) player.y = ny;
  }

  function updateAmmoBadge() {
    ammoBadge.textContent = "🔫 ∞";
    ammoBadge.style.opacity = hasGun ? "1" : "0";
  }

  function getFov() { return BASE_FOV; }
  function currentPreset() { return DIFFICULTIES[currentDifficulty]; }

  // ============================ 地图生成 ============================
  function bfsDistances(grid, sx, sy) {
    const dist = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(-1));
    if (grid[sy] === undefined || grid[sy][sx] !== 0) return dist;
    const q = [[sx, sy]];
    dist[sy][sx] = 0;
    let head = 0;
    while (head < q.length) {
      const [x, y] = q[head++];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
        if (grid[ny][nx] !== 0) continue;
        if (dist[ny][nx] !== -1) continue;
        dist[ny][nx] = dist[y][x] + 1;
        q.push([nx, ny]);
      }
    }
    return dist;
  }

  function generateLevel() {
    const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(1));

    const visited = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(false));
    const sx = 1, sy = 1;
    grid[sy][sx] = 0;
    visited[sy][sx] = true;
    const stack = [[sx, sy]];
    const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const opts = [];
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx > 0 && nx < MAP_W - 1 && ny > 0 && ny < MAP_H - 1 && !visited[ny][nx]) {
          opts.push([nx, ny, dx, dy]);
        }
      }
      if (!opts.length) { stack.pop(); continue; }
      const [nx, ny, dx, dy] = opts[Math.floor(Math.random() * opts.length)];
      grid[y + dy / 2][x + dx / 2] = 0;
      grid[ny][nx] = 0;
      visited[ny][nx] = true;
      stack.push([nx, ny]);
    }

    const extra = Math.floor(MAP_W * MAP_H * 0.055);
    for (let i = 0; i < extra; i++) {
      const x = 1 + Math.floor(Math.random() * (MAP_W - 2));
      const y = 1 + Math.floor(Math.random() * (MAP_H - 2));
      if (grid[y][x] !== 1) continue;
      const h = grid[y][x - 1] === 0 && grid[y][x + 1] === 0;
      const v = grid[y - 1][x] === 0 && grid[y + 1][x] === 0;
      if (h || v) grid[y][x] = 0;
    }

    const roomCount = 5;
    for (let r = 0; r < roomCount; r++) {
      const rw = 2 + Math.floor(Math.random() * 3);
      const rh = 2 + Math.floor(Math.random() * 3);
      const rx = 1 + Math.floor(Math.random() * (MAP_W - 2 - rw));
      const ry = 1 + Math.floor(Math.random() * (MAP_H - 2 - rh));
      for (let y = ry; y < ry + rh; y++) {
        for (let x = rx; x < rx + rw; x++) {
          if (x > 0 && x < MAP_W - 1 && y > 0 && y < MAP_H - 1) grid[y][x] = 0;
        }
      }
    }

    grid[1][2] = 0;
    grid[2][1] = 0;
    grid[sy][sx] = 0;
    const dist = bfsDistances(grid, sx, sy);

    const cells = [];
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (grid[y][x] !== 0) continue;
        if (x === sx && y === sy) continue;
        if (dist[y][x] < 0) continue;
        cells.push({ x, y, dist: dist[y][x] });
      }
    }

    let exitC = cells[0];
    for (const c of cells) if (c.dist > exitC.dist) exitC = c;

    cells.sort((a, b) => a.dist - b.dist);
    const others = cells.filter(c => !(c.x === exitC.x && c.y === exitC.y));
    const n = others.length;

    const pick = (lo, hi) => {
      const a = Math.floor(n * lo);
      const b = Math.max(a + 1, Math.floor(n * hi));
      return others[a + Math.floor(Math.random() * (b - a))];
    };

    const gunC     = pick(0.08, 0.28);
    const keyC     = pick(0.45, 0.72);
    const enemyC   = pick(0.55, 0.85);
    const enemyC2  = pick(0.25, 0.55);

    grid[exitC.y][exitC.x] = 2;

    return {
      map: grid, exitCell: exitC, gunCell: gunC, keyCell: keyC,
      enemyCell: enemyC, enemyCell2: enemyC2,
      start: { x: sx + 0.5, y: sy + 0.5 }
    };
  }

  // ============================ 音频 ============================
  function initAudio() {
    if (!audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = new AC();
    }
    if (audio.state === "suspended") audio.resume();

    if (window.location.protocol === "file:") {
      for (const clip of Object.values(voices)) {
        clip.volume = 1.0;
      }
      return;
    }

    for (const clip of Object.values(voices)) {
      if (!clip._boosted) {
        try {
          const src = audio.createMediaElementSource(clip);
          const gain = audio.createGain();
          gain.gain.value = 2.4;
          src.connect(gain).connect(audio.destination);
          clip._boosted = true;
        } catch (e) {}
      }
    }
  }

  function primeVoiceAudio() {
    if (voicesPrimed) return;
    voicesPrimed = true;
    for (const clip of Object.values(voices)) {
      const vol = clip.volume;
      clip.volume = 0;
      const p = clip.play();
      if (p) p.then(() => { clip.pause(); clip.currentTime = 0; clip.volume = vol; })
               .catch(() => { clip.volume = vol; });
    }
  }

  function stopAllVoices() {
    for (const clip of Object.values(voices)) { clip.pause(); clip.currentTime = 0; }
    nearbyPlayPending = false;
  }

  function stopNearbyVoice() {
    voices.nearby.pause();
    voices.nearby.currentTime = 0;
    nearbyPlayPending = false;
  }

  function playVoice(clip) {
    try {
      clip.pause();
      clip.currentTime = 0;
      clip.volume = 1.0;
      const p = clip.play();
      if (p && p.catch) p.catch(() => {
        playTone(82, 0.45, "sawtooth", 0.04);
      });
    } catch (e) {}
  }

  function updateNearbyVoice(distance) {
    const audible = SOUND_RANGE;
    if (state !== "playing" || distance >= audible) {
      if (hitVoiceBoost <= 0.01) {
        stopNearbyVoice();
        return;
      }
    }
    const proximity = Math.max(0, Math.min(1, (audible - distance) / Math.max(0.45, audible - 0.45)));
    let vol = 0.10 + Math.pow(proximity, 1.55) * 0.90;
    vol = Math.min(1.0, vol + hitVoiceBoost);
    voices.nearby.volume = vol;

    if (voices.nearby.paused && !nearbyPlayPending) {
      nearbyPlayPending = true;
      voices.nearby.currentTime = 0;
      voices.nearby.play().catch(() => {}).finally(() => { nearbyPlayPending = false; });
    }
  }

  function playTone(freq, dur, type = "sine", volume = 0.04) {
    if (!audio) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audio.currentTime);
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + dur + 0.03);
  }

  function makeNoiseBuffer(duration, envFn) {
    const len = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const p = i / len;
      d[i] = (Math.random() * 2 - 1) * (envFn ? envFn(p) : 1);
    }
    return buf;
  }

  function makeStereoPanner() {
    if (audio.createStereoPanner) return audio.createStereoPanner();
    return null;
  }

  function playGunshot(isAuto = false) {
    if (!audio) return;
    const t = audio.currentTime;
    const volScale = isAuto ? 0.78 : 1.0;
    const tailScale = isAuto ? 0.55 : 1.0;

    {
      const src = audio.createBufferSource();
      src.buffer = makeNoiseBuffer(0.008, p => Math.pow(1 - p, 6));
      const hp = audio.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 3200;
      const g = audio.createGain();
      g.gain.setValueAtTime(0.30 * volScale, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
      src.connect(hp).connect(g).connect(audio.destination);
      src.start(t); src.stop(t + 0.02);
    }
    {
      const src = audio.createBufferSource();
      src.buffer = makeNoiseBuffer(0.14, p => Math.exp(-p * 7) * (1 - Math.exp(-p * 200)));
      const bp = audio.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 3200; bp.Q.value = 0.85;
      const g = audio.createGain();
      g.gain.setValueAtTime(0.65 * volScale, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      src.connect(bp).connect(g).connect(audio.destination);
      src.start(t); src.stop(t + 0.16);
    }
    {
      const src = audio.createBufferSource();
      src.buffer = makeNoiseBuffer(0.26, p => Math.exp(-p * 6.5));
      const hp = audio.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 450;
      const lp = audio.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 5200;
      const g = audio.createGain();
      g.gain.setValueAtTime(0.78 * volScale, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      src.connect(hp).connect(lp).connect(g).connect(audio.destination);
      src.start(t); src.stop(t + 0.28);
    }
    {
      const osc = audio.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(185, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + 0.30);
      const g = audio.createGain();
      g.gain.setValueAtTime(0.44 * volScale, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      osc.connect(g).connect(audio.destination);
      osc.start(t); osc.stop(t + 0.40);
    }
    {
      const osc = audio.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(65, t + 0.10);
      const g = audio.createGain();
      g.gain.setValueAtTime(0.10 * volScale, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(g).connect(audio.destination);
      osc.start(t); osc.stop(t + 0.14);
    }
    {
      const src = audio.createBufferSource();
      src.buffer = makeNoiseBuffer(0.70, p => Math.exp(-p * 3.6));
      const lp = audio.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(2200, t);
      lp.frequency.exponentialRampToValueAtTime(600, t + 0.70);
      const g = audio.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.20 * tailScale, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
      const pan = makeStereoPanner();
      if (pan) {
        pan.pan.setValueAtTime(-0.25, t);
        pan.pan.linearRampToValueAtTime(0.2, t + 0.5);
        src.connect(lp).connect(g).connect(pan).connect(audio.destination);
      } else {
        src.connect(lp).connect(g).connect(audio.destination);
      }
      src.start(t + 0.01); src.stop(t + 0.74);
    }
  }

  function playBulletWhoosh(panAmount = 0) {
    if (!audio) return;
    const t = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = makeNoiseBuffer(0.16, p => Math.sin(Math.PI * p) * (1 - p * 0.45));
    const bp = audio.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 9;
    bp.frequency.setValueAtTime(5800, t);
    bp.frequency.exponentialRampToValueAtTime(680, t + 0.14);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    const pan = makeStereoPanner();
    if (pan) {
      const p0 = Math.max(-1, Math.min(1, panAmount - 0.25));
      const p1 = Math.max(-1, Math.min(1, panAmount + 0.35));
      pan.pan.setValueAtTime(p0, t);
      pan.pan.linearRampToValueAtTime(p1, t + 0.14);
      src.connect(bp).connect(g).connect(pan).connect(audio.destination);
    } else {
      src.connect(bp).connect(g).connect(audio.destination);
    }
    src.start(t); src.stop(t + 0.18);
  }

  function playFleshHit() {
    if (!audio) return;
    const t = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = makeNoiseBuffer(0.14, p => Math.exp(-p * 8) + Math.exp(-p * 1.8) * 0.4);
    const lp = audio.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1200;
    const g = audio.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(lp).connect(g).connect(audio.destination);
    src.start(t); src.stop(t + 0.18);

    const osc = audio.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.10);
    const g2 = audio.createGain();
    g2.gain.setValueAtTime(0.22, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g2).connect(audio.destination);
    osc.start(t); osc.stop(t + 0.16);
  }

  function startAmbientAudio() {
    if (!audio || ambientNodes) return;
    const windLen = Math.floor(audio.sampleRate * 4);
    const windBuf = audio.createBuffer(1, windLen, audio.sampleRate);
    const wd = windBuf.getChannelData(0);
    for (let i = 0; i < windLen; i++) {
      const p = i / windLen;
      wd[i] = (Math.random() * 2 - 1) * (0.45 + 0.55 * Math.sin(p * Math.PI * 6));
    }
    const windSrc = audio.createBufferSource();
    windSrc.buffer = windBuf;
    windSrc.loop = true;
    const windLp = audio.createBiquadFilter();
    windLp.type = "lowpass"; windLp.frequency.value = 240;
    const windGain = audio.createGain();
    windGain.gain.value = 0.045;
    windSrc.connect(windLp).connect(windGain).connect(audio.destination);
    windSrc.start();
    ambientNodes = { windSrc, windGain };
  }

  function stopAmbientAudio() {
    if (!ambientNodes) return;
    try { ambientNodes.windSrc.stop(); } catch (e) {}
    ambientNodes = null;
  }

  function playCreak() {
    if (!audio) return;
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(90 + Math.random() * 40, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.6);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(g).connect(audio.destination);
    osc.start(t); osc.stop(t + 0.72);
  }

  function playWhisper() {
    if (!audio) return;
    const t = audio.currentTime;
    const len = 0.9 + Math.random() * 0.6;
    const src = audio.createBufferSource();
    src.buffer = makeNoiseBuffer(len, p => {
      const env = Math.sin(Math.PI * p);
      const mod = 0.6 + 0.4 * Math.sin(p * Math.PI * 14);
      return env * mod;
    });
    const bp = audio.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 5;
    bp.frequency.setValueAtTime(800, t);
    bp.frequency.linearRampToValueAtTime(1400, t + len * 0.5);
    bp.frequency.linearRampToValueAtTime(600, t + len);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.15);
    g.gain.linearRampToValueAtTime(0.02, t + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp).connect(g).connect(audio.destination);
    src.start(t); src.stop(t + len + 0.05);
  }

  // 墙面惊吓播放的刺耳尖啸
  function playWallScream() {
    if (!audio) return;
    const t = audio.currentTime;

    // 低频下坠
    const osc = audio.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.7);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    osc.connect(g).connect(audio.destination);
    osc.start(t); osc.stop(t + 0.78);

    // 高频尖啸
    const osc2 = audio.createOscillator();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(2200, t);
    osc2.frequency.exponentialRampToValueAtTime(900, t + 0.5);
    const g2 = audio.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.linearRampToValueAtTime(0.05, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc2.connect(g2).connect(audio.destination);
    osc2.start(t); osc2.stop(t + 0.58);

    // 噪声
    const src = audio.createBufferSource();
    src.buffer = makeNoiseBuffer(0.7, p => Math.exp(-p * 4));
    const hp = audio.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 800;
    const g3 = audio.createGain();
    g3.gain.setValueAtTime(0.12, t);
    g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(hp).connect(g3).connect(audio.destination);
    src.start(t); src.stop(t + 0.72);
  }

  // ============================ 敌人对象 ============================
  function createEnemy(x, y, extraDelay = 0) {
    return {
      x, y,
      path: [], repathTimer: 0,
      activeTimer: 1.3 + extraDelay,
      stunTimer: 0,
      rageLevel: 0,
      wanderTarget: null
    };
  }

  // ============================ 恐怖装饰 ============================
  function spawnBat() {
    const cands = [];
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (map[y][x] !== 0) continue;
        const d = Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y);
        if (d >= 3.5 && d <= 9) cands.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
    if (!cands.length) return;
    const c = cands[Math.floor(Math.random() * cands.length)];
    bats.push({
      x: c.x, y: c.y,
      z: 0.12 + Math.random() * 0.08,
      vx: 0, vy: 0, vz: 0,
      state: "idle", life: 0,
      phase: Math.random() * Math.PI * 2,
      flyTime: 0
    });
  }

  function spawnSkull() {
    const fov = getFov();
    const ang = player.angle + (Math.random() - 0.5) * fov * 1.4;
    const dist = 2.8 + Math.random() * 3.7;
    const tx = player.x + Math.cos(ang) * dist;
    const ty = player.y + Math.sin(ang) * dist;
    const gx = Math.floor(tx), gy = Math.floor(ty);
    if (gx < 0 || gx >= MAP_W || gy < 0 || gy >= MAP_H) return;

    const life = 0.42 + Math.random() * 0.4;
    skulls.push({
      x: tx, y: ty,
      z: 0.30 + Math.random() * 0.40,
      life: 0, maxLife: life,
      size: 0.34 + Math.random() * 0.30,
      spin: Math.random() < 0.5 ? -1 : 1
    });
    playTone(58, 0.4, "sawtooth", 0.032);
    playTone(180, 0.14, "square", 0.02);
  }

  function spawnGhost() {
    const fov = getFov();
    const ang = player.angle + (Math.random() - 0.5) * fov * 0.55;
    for (let d = 15; d >= 9; d -= 1) {
      const tx = player.x + Math.cos(ang) * d;
      const ty = player.y + Math.sin(ang) * d;
      const gx = Math.floor(tx), gy = Math.floor(ty);
      if (gx < 0 || gx >= MAP_W || gy < 0 || gy >= MAP_H) continue;
      if (map[gy][gx] !== 0) continue;
      if (!hasLineOfSight(player.x, player.y, tx, ty)) continue;
      ghostX = tx;
      ghostY = ty;
      ghostActive = 0.32;
      ghostAlpha = 0.85;
      if (Math.random() < 0.6) playWhisper();
      playTone(2400, 0.08, "sine", 0.012);
      return;
    }
  }

    // 【改动】触发一次墙面惊吓
  function spawnWallScare() {
    const cands = [];
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    // 搜索范围放大到 16 格
    const R = 16;
    const fov = getFov();
    for (let y = py - R; y <= py + R; y++) {
      for (let x = px - R; x <= px + R; x++) {
        if (y < 0 || y >= MAP_H || x < 0 || x >= MAP_W) continue;
        if (map[y][x] !== 1) continue;

        // 至少一面朝向可通行区域
        const adjacent = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          return nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H && map[ny][nx] === 0;
        });
        if (!adjacent) continue;

        const wx = x + 0.5, wy = y + 0.5;
        const d = Math.hypot(wx - player.x, wy - player.y);
        // 放宽距离：0.8 ~ 16
        if (d < 0.8 || d > R) continue;

        // 放宽角度：视野 ±FOV*1.4（允许在视野边缘外一点）
        const rel = Math.abs(normalizeAngle(Math.atan2(wy - player.y, wx - player.x) - player.angle));
        if (rel > fov * 1.4) continue;

        // 视线遮挡不作硬性要求，被挡住的也可以当作“隐约闪烁”
        cands.push({ x, y, dist: d });
      }
    }
    if (!cands.length) return;

    // 【改动】面数从 2~4 提到 6~12
    const count = 6 + Math.floor(Math.random() * 7);
    // 【改动】持续时长 1.2~2.2 秒
    const life = 1.2 + Math.random() * 1.0;

    // 优先选近处的墙，让玩家更容易看到
    cands.sort((a, b) => a.dist - b.dist);
    // 从最近的一半里随机抽取
    const poolSize = Math.max(count, Math.floor(cands.length * 0.6));
    const pool = cands.slice(0, poolSize);

    for (let i = 0; i < count && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const c = pool.splice(idx, 1)[0];
      wallScares.set(`${c.x},${c.y}`, {
        life,
        maxLife: life,
        phase: Math.random() * Math.PI * 2
      });
    }

    // 音效：尖啸 + 低语
    playWallScream();
    if (Math.random() < 0.7) playWhisper();
    shake = Math.max(shake, 1.1);
  }

  function updateScares(dt) {
    batSpawnTimer -= dt;
    if (batSpawnTimer <= 0) {
      if (bats.length < 4) spawnBat();
      batSpawnTimer = 4 + Math.random() * 6;
    }
    skullSpawnTimer -= dt;
    if (skullSpawnTimer <= 0) {
      if (skulls.length < 2) spawnSkull();
      skullSpawnTimer = 9 + Math.random() * 8;
    }

    for (let i = bats.length - 1; i >= 0; i--) {
      const b = bats[i];
      b.life += dt;
      if (b.state === "idle") {
        b.phase += dt * 3;
        b.z = 0.12 + Math.sin(b.phase * 0.5) * 0.03;
        const d = Math.hypot(player.x - b.x, player.y - b.y);
        if (d < 4.5) {
          b.state = "flying";
          b.flyTime = 0;
          const ang = Math.atan2(player.y - b.y, player.x - b.x) + (Math.random() - 0.5) * 0.7;
          const spd = 2.6 + Math.random() * 1.3;
          b.vx = Math.cos(ang) * spd;
          b.vy = Math.sin(ang) * spd;
          b.vz = 1.7 + Math.random() * 0.9;
          playTone(2300 + Math.random() * 500, 0.05, "square", 0.038);
          window.setTimeout(() => playTone(2700, 0.04, "square", 0.03), 55);
          window.setTimeout(() => playTone(2100, 0.05, "square", 0.032), 120);
        }
      } else if (b.state === "flying") {
        b.phase += dt * 26;
        b.flyTime += dt;
        const nx = b.x + b.vx * dt;
        const ny = b.y + b.vy * dt;
        if (!isWall(nx, b.y)) b.x = nx; else b.vx = -b.vx;
        if (!isWall(b.x, ny)) b.y = ny; else b.vy = -b.vy;
        b.z += b.vz * dt;
        if (b.flyTime > 1.5 || b.z > 3.2) b.state = "escaping";
      } else {
        b.phase += dt * 22;
        b.z += dt * 3.6;
        b.x += b.vx * dt * 0.5;
        b.y += b.vy * dt * 0.5;
        if (b.z > 4.2) bats.splice(i, 1);
      }
    }

    for (let i = skulls.length - 1; i >= 0; i--) {
      const s = skulls[i];
      s.life += dt;
      if (s.life >= s.maxLife) skulls.splice(i, 1);
    }

    if (flickerActive > 0) {
      flickerActive -= dt;
      flickerDark = Math.max(0, Math.min(1, Math.abs(Math.sin(performance.now() / 40)) * 0.85 + 0.15));
      if (flickerActive <= 0) {
        flickerDark = 0;
        flickerTimer = 9 + Math.random() * 10;
      }
    } else {
      flickerTimer -= dt;
      if (flickerTimer <= 0) {
        flickerActive = 0.35 + Math.random() * 0.45;
        flickerDark = 0.9;
        playTone(80 + Math.random() * 40, 0.05, "square", 0.06);
        window.setTimeout(() => playTone(120, 0.03, "square", 0.04), 60);
        flickerTimer = 9999;
      }
    }

    if (ghostActive > 0) {
      ghostActive -= dt;
      ghostAlpha = Math.max(0, ghostActive / 0.32) * 0.85;
      if (ghostActive <= 0) ghostTimer = 14 + Math.random() * 12;
    } else {
      ghostTimer -= dt;
      if (ghostTimer <= 0) {
        spawnGhost();
        ghostTimer = 9999;
      }
    }

    updateWallScares(dt);

    if (state === "playing" && audio) {
      ambientCreakTimer -= dt;
      if (ambientCreakTimer <= 0) {
        playCreak();
        ambientCreakTimer = 6 + Math.random() * 10;
      }
      ambientWhisperTimer -= dt;
      if (ambientWhisperTimer <= 0) {
        if (Math.random() < 0.7) playWhisper();
        ambientWhisperTimer = 14 + Math.random() * 18;
      }
    }
  }

  // ============================ 流程 ============================
  function resetGame() {
    stopAllVoices();
    stopAmbientAudio();
    const level = generateLevel();
    map = level.map;
    exitCell = level.exitCell;
    gunCellRef = level.gunCell;
    keyCellRef = level.keyCell;

    gunPosition = { x: level.gunCell.x + 0.5, y: level.gunCell.y + 0.5 };
    keyPosition = { x: level.keyCell.x + 0.5, y: level.keyCell.y + 0.5 };

    player.x = level.start.x;
    player.y = level.start.y;
    player.angle = 0;
    player.pitch = 0;
    player.walkPhase = 0;

    const preset = currentPreset();
    enemies = [];

    if (currentDifficulty === "hell") {
      enemies.push(createEnemy(level.enemyCell.x + 0.5, level.enemyCell.y + 0.5, 0));
      enemies.push(createEnemy(level.enemyCell2.x + 0.5, level.enemyCell2.y + 0.5, 0));
      graceTimer = 0;
    } else if (currentDifficulty === "nightmare") {
      enemies.push(createEnemy(player.x + 0.08, player.y + 0.08, 0));
      graceTimer = START_GRACE_DURATION;
    } else {
      enemies.push(createEnemy(player.x + 0.08, player.y + 0.08, 0));
      if (preset.enemyCount >= 2) {
        enemies.push(createEnemy(player.x - 0.08, player.y - 0.08, 0));
      }
      graceTimer = START_GRACE_DURATION;
    }

    explored = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(false));

    hasKey = false;
    hasGun = false;
    gunPicked = false;
    gunCooldown = 0;
    muzzleFlash = 0;
    rageFlash = 0;
    gunKick = 0;
    viewKick = 0;
    triggerHeld = false;
    autoFiring = false;
    autoFireTimer = 0;
    bloodParticles.length = 0;
    hitVoiceBoost = 0;

    bats.length = 0;
    skulls.length = 0;
    batSpawnTimer = 5 + Math.random() * 4;
    skullSpawnTimer = 7 + Math.random() * 6;

    // 【新增】重置墙面惊吓
    wallScares.clear();
    wallScareTimer = WALL_SCARE_MIN_INTERVAL + Math.random() * 6;

    flickerTimer = 8 + Math.random() * 8;
    flickerActive = 0;
    flickerDark = 0;
    ghostTimer = 14 + Math.random() * 10;
    ghostActive = 0;
    ghostAlpha = 0;
    ambientCreakTimer = 5 + Math.random() * 8;
    ambientWhisperTimer = 12 + Math.random() * 15;

    lastMouseMoveTime = performance.now();
    hitConfirmTimer = 0;
    whiteFlash = 0;
    mapExpanded = false;

    casings.length = 0;

    lockState = "idle";
    lockTimer = 0;
    doorOpened = false;
    shake = 0;

    objectiveText.textContent = "先找到那把枪";
    statusText.textContent = "少帅正在寻找你";
    statusBadge.classList.remove("danger");
    statusBadge.classList.remove("rage");
    updateAmmoBadge();
    hideMessage();
    markExploredAroundPlayer();
  }

  function startGame() {
    resetGame();
    state = "playing";
    menu.classList.remove("is-visible");
    result.classList.remove("is-visible");
    hud.classList.add("is-visible");
    crosshair.classList.add("is-visible");
    mobileControls.classList.add("is-visible");
    initAudio();
    primeVoiceAudio();
    startAmbientAudio();
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      canvas.requestPointerLock?.();
    }
    if (currentDifficulty === "hell") {
      showMessage(`地狱模式 · 两个少帅正在远处逼近`, 3400);
    } else if (currentDifficulty === "nightmare") {
      showMessage(`噩梦模式 · 先找枪，再找刀`, 2800);
    } else {
      showMessage(`少帅就在你身后！5 秒内快跑！`, 4500);
    }
  }

  function endGame(won) {
    state = won ? "won" : "lost";
    hud.classList.remove("is-visible");
    crosshair.classList.remove("is-visible");
    mobileControls.classList.remove("is-visible");
    ammoBadge.style.opacity = "0";
    triggerHeld = false;
    autoFiring = false;
    document.exitPointerLock?.();
    resultKicker.textContent = won ? "你赢了" : "游戏结束";
    resultTitle.textContent = won ? "天亮之前" : "他抓到你了";
    resultCopy.textContent = won
      ? "你钻进铁笼，反手锁上。少帅在栏杆外站了一整夜。"
      : "黑暗里传来熟悉的笑声。下一次，别让他靠得太近。";
    resultImage.src = won ? "assets/doubao-normal.png" : "assets/doubao.jpg";
    resultImage.alt = won ? "正常的少帅" : "恐怖的少帅";
    result.classList.toggle("is-win", won);
    result.classList.toggle("is-loss", !won);
    result.classList.add("is-visible");
    stopNearbyVoice();
    playVoice(won ? voices.victory : voices.caught);
  }

  function showMessage(text, duration = 1800) {
    message.textContent = text;
    message.classList.add("is-visible");
    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(hideMessage, duration);
  }
  function hideMessage() { message.classList.remove("is-visible"); }

  // ============================ 寻路 ============================
  function findPath(sx, sy, ex, ey) {
    const start = { x: Math.floor(sx), y: Math.floor(sy) };
    const end = { x: Math.floor(ex), y: Math.floor(ey) };
    if (map[end.y]?.[end.x] !== 0) return [];
    const queue = [start];
    const visited = new Map([[`${start.x},${start.y}`, null]]);
    let cur = 0;
    while (cur < queue.length) {
      const c = queue[cur++];
      if (c.x === end.x && c.y === end.y) break;
      for (const n of [{ x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 1 }]) {
        const id = `${n.x},${n.y}`;
        if (!visited.has(id) && map[n.y]?.[n.x] === 0) { visited.set(id, c); queue.push(n); }
      }
    }
    const endId = `${end.x},${end.y}`;
    if (!visited.has(endId)) return [];
    const path = [];
    let step = end;
    while (step && !(step.x === start.x && step.y === start.y)) {
      path.unshift({ x: step.x + 0.5, y: step.y + 0.5 });
      step = visited.get(`${step.x},${step.y}`);
    }
    return path;
  }

  function hasLineOfSight(fx, fy, tx, ty) {
    const dx = tx - fx, dy = ty - fy;
    const d = Math.hypot(dx, dy);
    if (d < 0.02) return true;
    const steps = Math.max(2, Math.ceil(d * 14));
    for (let i = 1; i < steps - 1; i++) {
      const t = i / steps;
      if (isWall(fx + dx * t, fy + dy * t)) return false;
    }
    return true;
  }

  function canSeeForMap(fx, fy, tx, ty) {
    const dx = tx - fx, dy = ty - fy;
    const d = Math.hypot(dx, dy);
    if (d < 0.02) return true;
    const maxT = Math.max(0.1, (d - 0.32) / d);
    const steps = Math.max(2, Math.ceil(d * 11));
    for (let i = 1; i < steps; i++) {
      const t = (i / steps) * maxT;
      if (isWall(fx + dx * t, fy + dy * t)) return false;
    }
    return true;
  }

  function randomWalkableCell() {
    for (let i = 0; i < 40; i++) {
      const x = 1 + Math.floor(Math.random() * (MAP_W - 2));
      const y = 1 + Math.floor(Math.random() * (MAP_H - 2));
      if (map[y][x] === 0) return { x: x + 0.5, y: y + 0.5 };
    }
    return null;
  }

  // ============================ 探索 ============================
  function markExploredAroundPlayer() {
    const px = player.x, py = player.y;
    const R = VIEW_RADIUS;
    const minX = Math.max(0, Math.floor(px - R));
    const maxX = Math.min(MAP_W - 1, Math.floor(px + R));
    const minY = Math.max(0, Math.floor(py - R));
    const maxY = Math.min(MAP_H - 1, Math.floor(py + R));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (explored[y][x]) continue;
        const cx = x + 0.5, cy = y + 0.5;
        if (Math.hypot(cx - px, cy - py) > R) continue;
        if (canSeeForMap(px, py, cx, cy)) explored[y][x] = true;
      }
    }
  }

  function updateExploration(dt) {
    exploreAccum += dt;
    if (exploreAccum < 0.09) return;
    exploreAccum = 0;
    markExploredAroundPlayer();
  }

  // ============================ 扳机 & 开火 ============================
  function pressTrigger() {
    triggerHeld = true;
    triggerHeldSince = performance.now();
    autoFiring = false;
    autoFireTimer = 0;
  }

  function releaseTrigger() {
    if (!triggerHeld) return;
    const held = (performance.now() - triggerHeldSince) / 1000;
    if (held < AUTO_FIRE_DELAY && !autoFiring && state === "playing" && hasGun) {
      fireGun(false);
    }
    triggerHeld = false;
    autoFiring = false;
  }

  function fireGun(isAuto = false) {
    if (state !== "playing" || !hasGun) return false;
    if (gunCooldown > 0) return false;

    gunCooldown = isAuto ? (AUTO_FIRE_INTERVAL * 0.9) : SINGLE_FIRE_COOLDOWN;

    const recoil = isAuto ? RECOIL_AUTO : RECOIL_BASE;
    muzzleFlash = 1;
    gunKick = recoil;
    viewKick = recoil;
    shake = Math.max(shake, 2.6 * recoil);
    player.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, player.pitch - 0.022 * recoil));

    playGunshot(isAuto);
    playBulletWhoosh(isAuto ? 0.25 : 0.15);

    const cx = player.x + Math.cos(player.angle) * 0.25 + Math.cos(player.angle + Math.PI / 2) * 0.15;
    const cy = player.y + Math.sin(player.angle) * 0.25 + Math.sin(player.angle + Math.PI / 2) * 0.15;
    const sideAng = player.angle + Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    casings.push({
      x: cx, y: cy, z: 0.55,
      vx: Math.cos(sideAng) * (1.4 + Math.random() * 0.8),
      vy: Math.sin(sideAng) * (1.4 + Math.random() * 0.8),
      vz: 1.8 + Math.random() * 0.6,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 14,
      life: CASING_LIFE,
      grounded: false
    });

    let best = null, bestDist = Infinity;
    for (const e of enemies) {
      const dx = e.x - player.x, dy = e.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.001 || d > 16) continue;
      const rel = Math.abs(normalizeAngle(Math.atan2(dy, dx) - player.angle));
      const tol = Math.atan2(0.60, Math.max(d, 0.5));
      if (rel < tol && hasLineOfSight(player.x, player.y, e.x, e.y)) {
        if (d < bestDist) { bestDist = d; best = e; }
      }
    }
    if (best) {
      const dx = best.x - player.x, dy = best.y - player.y;
      const d = Math.hypot(dx, dy);
      hitEnemy(best, dx / d, dy / d, isAuto);
    }
    return true;
  }

  function hitEnemy(e, ux, uy, isAuto) {
    const recoil = isAuto ? RECOIL_AUTO : RECOIL_BASE;
    const knockback = 4.2 * recoil;
    const steps = Math.max(20, Math.floor(24 * recoil));
    for (let i = 0; i < steps; i++) {
      const sx = (ux * knockback) / steps;
      const sy = (uy * knockback) / steps;
      if (canMoveTo(e.x + sx, e.y, 0.24)) e.x += sx;
      if (canMoveTo(e.x, e.y + sy, 0.24)) e.y += sy;
    }
    e.path = []; e.repathTimer = 0.5;
    e.stunTimer = 1.0;
    e.rageLevel += 1;

    spawnBlood(e.x, e.y, ux, uy);

    shake = Math.max(shake, 3.4 * recoil);
    rageFlash = Math.max(rageFlash, 0.9);
    playTone(62, 0.24, "sawtooth", 0.08);
    playTone(180, 0.10, "square", 0.04);

    hitConfirmTimer = 0.28;
    whiteFlash = Math.max(whiteFlash, 0.75);
    playFleshHit();

    hitVoiceBoost = 1.0;
    try {
      if (voices.nearby.paused) {
        nearbyPlayPending = true;
        voices.nearby.currentTime = 0;
        voices.nearby.volume = 1.0;
        voices.nearby.play().catch(() => {}).finally(() => { nearbyPlayPending = false; });
      } else {
        voices.nearby.volume = 1.0;
      }
    } catch (err) {}

    if (e.rageLevel >= 8) {
      showMessage(`少帅已经疯了！狂暴 Lv.${e.rageLevel}`, 1300);
    } else {
      showMessage(`击中了！少帅狂暴 Lv.${e.rageLevel}`, 1300);
    }
  }

  function spawnBlood(x, y, ux, uy) {
    const sx = -uy, sy = ux;
    for (let i = 0; i < 48; i++) {
      const spread = (Math.random() - 0.5) * 2.2;
      const fwd = 0.7 + Math.random() * 3.0;
      const life = 1.4 + Math.random() * 1.8;
      bloodParticles.push({
        x, y,
        z: 0.32 + Math.random() * 0.7,
        vx: ux * fwd + sx * spread,
        vy: uy * fwd + sy * spread,
        vz: 1.1 + Math.random() * 3.8,
        life, maxLife: life,
        size: 0.026 + Math.random() * 0.06
      });
    }
  }

  function updateBlood(dt) {
    for (let i = bloodParticles.length - 1; i >= 0; i--) {
      const p = bloodParticles[i];
      p.life -= dt;
      if (p.life <= 0) { bloodParticles.splice(i, 1); continue; }
      p.vz -= 5.4 * dt;
      const px = p.x, py = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (isWall(p.x, p.y)) { p.x = px; p.y = py; p.vx = 0; p.vy = 0; }
      if (p.z <= 0.02) { p.z = 0.02; p.vz = 0; p.vx *= 0.42; p.vy *= 0.42; }
    }
  }

  function updateCasings(dt) {
    for (let i = casings.length - 1; i >= 0; i--) {
      const c = casings[i];
      c.life -= dt;
      if (c.life <= 0) { casings.splice(i, 1); continue; }
      if (!c.grounded) {
        c.vz -= 9.8 * dt;
        const nx = c.x + c.vx * dt;
        const ny = c.y + c.vy * dt;
        if (!isWall(nx, c.y)) c.x = nx; else { c.vx = 0; }
        if (!isWall(c.x, ny)) c.y = ny; else { c.vy = 0; }
        c.z += c.vz * dt;
        c.rot += c.vrot * dt;
        if (c.z <= 0.02) {
          c.z = 0.02;
          c.grounded = true;
          if (audio) {
            const t = audio.currentTime;
            const osc = audio.createOscillator();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(1800 + Math.random() * 500, t);
            osc.frequency.exponentialRampToValueAtTime(900, t + 0.06);
            const g = audio.createGain();
            g.gain.setValueAtTime(0.04, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
            osc.connect(g).connect(audio.destination);
            osc.start(t); osc.stop(t + 0.1);
          }
        }
      }
    }
  }

  // ============================ 插刀 ============================
  function tryInsertKnife() {
    if (state !== "playing") return;
    if (lockState !== "idle") return;
    if (!hasKey) { showMessage("你需要先找到那把刀", 1400); return; }
    const d = Math.hypot(player.x - (exitCell.x + 0.5), player.y - (exitCell.y + 0.5));
    if (d > 1.7) { showMessage("得靠近铁笼才能把刀插进锁里", 1500); return; }

    lockState = "inserted";
    lockTimer = LOCK_DURATION;
    hasKey = false;
    for (const e of enemies) {
      e.rageLevel += 2;
      e.repathTimer = 0;
    }

    objectiveText.textContent = `撑过 ${LOCK_DURATION} 秒——少帅彻底疯了`;
    showMessage("刀插进锁孔，铁笼开始绞动……撑住 30 秒！", 3200);
    playTone(220, 0.6, "sawtooth", 0.06);
    window.setTimeout(() => playTone(160, 0.9, "square", 0.045), 200);
    rageFlash = 1.2;
    shake = Math.max(shake, 1.6);
  }

  // ============================ 敌人更新 ============================
  function updateSingleEnemy(e, dt, preset) {
    e.stunTimer = Math.max(0, e.stunTimer - dt);
    e.activeTimer -= dt;
    if (e.activeTimer > 0) return;

    e.repathTimer -= dt;
    if (e.repathTimer <= 0) {
      e.path = findPath(e.x, e.y, player.x, player.y);
      e.repathTimer = 0.32;
      if (!e.path.length) {
        if (!e.wanderTarget || Math.hypot(e.wanderTarget.x - e.x, e.wanderTarget.y - e.y) < 0.6) {
          e.wanderTarget = randomWalkableCell();
        }
        if (e.wanderTarget) {
          e.path = findPath(e.x, e.y, e.wanderTarget.x, e.wanderTarget.y);
        }
      }
    }

    if (e.stunTimer <= 0) {
      const t = e.path[0];
      if (t) {
        const dx = t.x - e.x, dy = t.y - e.y;
        const d = Math.hypot(dx, dy);
        const baseSpeed = hasKey ? 0.90 : 0.72;
        const rageMult = 1 + e.rageLevel * 0.20;
        const lockBoost = lockState === "inserted" ? 1.15 : 1;
        const speed = Math.min(
          MAX_ENEMY_SPEED,
          baseSpeed * rageMult * lockBoost * preset.enemySpeedMult
        );
        if (d < 0.08) e.path.shift();
        else { e.x += (dx / d) * speed * dt; e.y += (dy / d) * speed * dt; }
      }
    }
  }

  function updateEnemies(dt) {
    const preset = currentPreset();

    const frozen = graceTimer > 0;
    if (frozen) graceTimer = Math.max(0, graceTimer - dt);

    if (frozen) {
      for (const e of enemies) {
        e.stunTimer = Math.max(e.stunTimer, 0.2);
      }
    } else {
      for (const e of enemies) {
        updateSingleEnemy(e, dt, preset);
      }
    }

    if (!enemies.length) return;

    let nearest = enemies[0];
    let nearestDist = Math.hypot(player.x - nearest.x, player.y - nearest.y);
    for (const e of enemies) {
      const d = Math.hypot(player.x - e.x, player.y - e.y);
      if (d < nearestDist) { nearest = e; nearestDist = d; }
    }

    hitVoiceBoost = Math.max(0, hitVoiceBoost - dt * HIT_VOICE_BOOST_DECAY);
    updateNearbyVoice(nearestDist);

    const detectRange = preset.detectRange;
    const danger = detectRange > 0 && nearestDist < detectRange;
    const totalRage = enemies.reduce((m, e) => Math.max(m, e.rageLevel), 0);

    statusBadge.classList.toggle("danger", danger);
    statusBadge.classList.toggle("rage", totalRage > 0);
    const rageTxt = totalRage > 0 ? ` · 狂暴 Lv.${totalRage}` : "";
    const countTxt = enemies.length > 1 ? ` ×${enemies.length}` : "";
    if (frozen) {
      statusText.textContent = `无敌 ${graceTimer.toFixed(1)}s · 快跑！`;
    } else {
      statusText.textContent = danger
        ? `他就在附近${rageTxt}${countTxt}`
        : (lockState === "inserted"
            ? `锁在绞动…${rageTxt}${countTxt}`
            : `少帅正在寻找你${rageTxt}${countTxt}`);
    }

    shake = Math.max(0, (2.45 - nearestDist) * 1.35);

    heartbeatTimer -= dt;
    if (danger && !frozen && detectRange > 0 && heartbeatTimer <= 0) {
      const fast = 1 / (1 + totalRage * 0.14);
      playTone(66, 0.13, "sine", 0.065);
      window.setTimeout(() => playTone(54, 0.1, "sine", 0.04), 150 * fast);
      heartbeatTimer = Math.max(0.34, nearestDist * 0.2) * fast;
    }

    if (!frozen) {
      for (const e of enemies) {
        const d = Math.hypot(player.x - e.x, player.y - e.y);
        if (d < 0.48) { endGame(false); return; }
      }
    }
  }

  // ============================ 玩家 ============================
  function updatePlayer(dt) {
    gunCooldown = Math.max(0, gunCooldown - dt);
    muzzleFlash = Math.max(0, muzzleFlash - dt * 6);
    rageFlash = Math.max(0, rageFlash - dt * 1.5);
    gunKick = Math.max(0, gunKick - dt * RECOIL_DECAY);
    viewKick = Math.max(0, viewKick - dt * VIEW_KICK_DECAY);

    if (hitConfirmTimer > 0) hitConfirmTimer = Math.max(0, hitConfirmTimer - dt);
    if (whiteFlash > 0) whiteFlash = Math.max(0, whiteFlash - dt * 8);

    const now = performance.now();
    if ((now - lastMouseMoveTime) / 1000 > PITCH_RECENTER_DELAY) {
      if (Math.abs(player.pitch) > 0.005) {
        const dir = player.pitch > 0 ? -1 : 1;
        player.pitch += dir * PITCH_RECENTER_SPEED * dt;
        if (Math.sign(player.pitch) !== Math.sign(dir * -1)) player.pitch = 0;
      }
    }

    if (triggerHeld && hasGun && state === "playing") {
      if (!autoFiring) {
        const held = (performance.now() - triggerHeldSince) / 1000;
        if (held >= AUTO_FIRE_DELAY) {
          autoFiring = true;
          autoFireTimer = 0;
        }
      }
      if (autoFiring) {
        autoFireTimer -= dt;
        if (autoFireTimer <= 0) {
          if (fireGun(true)) autoFireTimer = AUTO_FIRE_INTERVAL;
          else autoFireTimer = 0.04;
        }
      }
    }

    const running = input.ShiftLeft || input.ShiftRight || input.run;
    const speed = (running ? RUN_SPEED : MOVE_SPEED) * dt;
    let fwd = 0, str = 0;
    if (input.KeyW || input.ArrowUp || input.forward) fwd += 1;
    if (input.KeyS || input.ArrowDown || input.backward) fwd -= 1;
    if (input.KeyA || input.left) str -= 1;
    if (input.KeyD || input.right) str += 1;
    if (input.ArrowLeft || input.turnLeft) player.angle -= ROTATE_SPEED * dt;
    if (input.ArrowRight || input.turnRight) player.angle += ROTATE_SPEED * dt;
    player.angle = normalizeAngle(player.angle);

    const moving = fwd !== 0 || str !== 0;
    if (moving) player.walkPhase += dt * (running ? 11 : 7.5);

    const len = Math.hypot(fwd, str) || 1;
    fwd /= len; str /= len;
    const dx = (Math.cos(player.angle) * fwd + Math.cos(player.angle + Math.PI / 2) * str) * speed;
    const dy = (Math.sin(player.angle) * fwd + Math.sin(player.angle + Math.PI / 2) * str) * speed;
    movePlayer(dx, dy);

    if (!hasGun && !gunPicked &&
        Math.hypot(player.x - gunPosition.x, player.y - gunPosition.y) < 0.55) {
      hasGun = true;
      gunPicked = true;
      updateAmmoBadge();
      objectiveText.textContent = "再找到那把刀";
      showMessage("捡到手枪，子弹无限。左键 = 单发，按住 0.5 秒进入连发", 3200);
      playTone(520, 0.1, "square", 0.06);
      window.setTimeout(() => playTone(700, 0.12, "square", 0.05), 90);
    }

    if (!hasKey && lockState === "idle" && Math.hypot(player.x - keyPosition.x, player.y - keyPosition.y) < 0.55) {
      if (!hasGun) {
        showMessage("先找到那把枪，再来拿刀", 1500);
      } else {
        hasKey = true;
        objectiveText.textContent = "找到铁笼，按 Q 把刀插进锁里";
        showMessage("你拿到了刀……他也听见了。狂暴开始。", 2800);
        playTone(860, 0.14, "triangle", 0.08);
        window.setTimeout(() => playTone(440, 0.34, "triangle", 0.06), 120);
        for (const e of enemies) {
          e.repathTimer = 0;
          if (e.rageLevel < 3) e.rageLevel = 3;
        }
        rageFlash = Math.max(rageFlash, 0.7);
      }
    }

    if (lockState === "inserted") {
      lockTimer -= dt;
      if (lockTimer <= 0) {
        lockTimer = 0;
        lockState = "open";
        map[exitCell.y][exitCell.x] = 0;
        doorOpened = true;
        objectiveText.textContent = "铁笼开了——快钻进去！";
        showMessage("锁开了！", 1600);
        playTone(118, 0.65, "sawtooth", 0.05);
        playTone(280, 0.4, "triangle", 0.05);
      }
    }

    if (doorOpened) {
      const dExit = Math.hypot(player.x - (exitCell.x + 0.5), player.y - (exitCell.y + 0.5));
      if (dExit < 0.6) endGame(true);
    }
  }

  // ============================ 渲染 ============================
  // castRay 现在返回命中的格子坐标 mx / my，用于查询墙面惊吓
  function castRay(angle) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let mx = Math.floor(player.x), my = Math.floor(player.y);
    const ddx = Math.abs(1 / (dx || 0.000001));
    const ddy = Math.abs(1 / (dy || 0.000001));
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    let sdx = dx < 0 ? (player.x - mx) * ddx : (mx + 1 - player.x) * ddx;
    let sdy = dy < 0 ? (player.y - my) * ddy : (my + 1 - player.y) * ddy;
    let side = 0, tile = 1;
    for (let i = 0; i < 64; i++) {
      if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; }
      else { sdy += ddy; my += sy; side = 1; }
      if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) { tile = 1; break; }
      tile = map[my][mx];
      if (tile !== 0) break;
    }
    const dist = side === 0
      ? (mx - player.x + (1 - sx) / 2) / (dx || 0.000001)
      : (my - player.y + (1 - sy) / 2) / (dy || 0.000001);
    const hit = side === 0 ? player.y + dist * dy : player.x + dist * dx;
    return {
      distance: Math.max(dist, 0.001),
      side, tile,
      texture: hit - Math.floor(hit),
      mx, my
    };
  }

  function drawBackground(W, H, horizonY) {
    ctx.fillStyle = "#050403";
    ctx.fillRect(0, 0, W, H);

    const ceilBot = Math.max(0, Math.min(H, horizonY));
    if (ceilBot > 0) {
      const g = ctx.createLinearGradient(0, horizonY - H * 0.9, 0, horizonY);
      g.addColorStop(0, "#030303");
      g.addColorStop(1, "#191612");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, ceilBot);
    }
    const floorTop = Math.max(0, Math.min(H, horizonY));
    if (floorTop < H) {
      const g = ctx.createLinearGradient(0, horizonY, 0, horizonY + H * 0.9);
      g.addColorStop(0, "#1a1714");
      g.addColorStop(1, "#050403");
      ctx.fillStyle = g;
      ctx.fillRect(0, floorTop, W, H - floorTop);
    }

    ctx.strokeStyle = "rgba(109, 92, 69, 0.07)";
    ctx.lineWidth = 1;
    for (let y = horizonY + 8; y < H; y += Math.max(8, (y - horizonY) * 0.16)) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function renderCageStrip(x, top, sw, wallHeight, hit, distanceShade, sideShade) {
    const unlocked = hit.tile === 3;
    const closed = hit.tile === 2;
    const texture = hit.texture;
    const shade = Math.max(0.16, distanceShade * sideShade);
    const dk = Math.floor(9 * shade);
    ctx.fillStyle = `rgb(${dk},${dk},${dk})`;
    ctx.fillRect(x, top, sw + 1, wallHeight);

    const bars = 7;
    const local = texture * bars;
    const frac = local - Math.floor(local);
    if (frac < 0.36) {
      const lit = frac < 0.17;
      const base = (unlocked ? 156 : 112) * shade * (lit ? 1.3 : 0.68);
      ctx.fillStyle = `rgb(${Math.min(255, Math.floor(base))},${Math.min(255, Math.floor(base * 0.9))},${Math.min(255, Math.floor(base * 0.7))})`;
      ctx.fillRect(x, top, sw + 1, wallHeight);
    }

    const railT = Math.max(2, wallHeight * 0.045);
    for (const rail of [0.06, 0.5, 0.94]) {
      const ry = top + wallHeight * rail - railT / 2;
      const base = (unlocked ? 142 : 108) * shade;
      ctx.fillStyle = `rgb(${Math.min(255, Math.floor(base))},${Math.min(255, Math.floor(base * 0.88))},${Math.min(255, Math.floor(base * 0.66))})`;
      ctx.fillRect(x, ry, sw + 1, railT);
    }

    if (Math.abs(texture - 0.5) < 0.075) {
      ctx.fillStyle = closed
        ? `rgba(231,55,37,${Math.max(0.5, shade)})`
        : `rgba(112,235,168,${Math.max(0.5, shade)})`;
      ctx.fillRect(x, top + wallHeight * 0.4, sw + 1, Math.max(4, wallHeight * 0.16));
    }
  }

  // 【新增】把某一列墙画成少帅照片（带闪烁）
  function renderWallScareStrip(x, top, sw, wallHeight, hit, corrected, focal, distShade, sideShade, flickerMult, scare) {
    // 先画默认木色底
    const light = Math.floor(105 * distShade * sideShade * flickerMult);
    ctx.fillStyle = `rgb(${light},${Math.floor(light * 0.89)},${Math.floor(light * 0.72)})`;
    ctx.fillRect(x, top, sw + 1, wallHeight);

    if (!wallTexture) return;

    // 生命进度
    const t = scare.life / scare.maxLife;      // 1 -> 0
    // 淡入 0.15，淡出 0.25
    let alpha;
    if (t > 0.85) alpha = (1 - t) / 0.15;
    else if (t < 0.3) alpha = t / 0.3;
    else alpha = 1;

    // 闪烁：每个墙有自己的相位
    const flickerVal = 0.5 + 0.5 * Math.sin(scare.life * 38 + scare.phase);
    alpha *= 0.55 + 0.55 * flickerVal;

    alpha = Math.max(0, Math.min(1, alpha));
    if (alpha <= 0.01) return;

    // 采样 UV
    const worldColWidth = Math.max(0.0005, corrected / focal);
    const srcW = Math.max(1, WALL_TEX_SIZE * worldColWidth);
    let srcX = hit.texture * WALL_TEX_SIZE - srcW * 0.5;
    if (srcX < 0) srcX += WALL_TEX_SIZE;
    if (srcX > WALL_TEX_SIZE) srcX -= WALL_TEX_SIZE;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (srcX + srcW <= WALL_TEX_SIZE) {
      ctx.drawImage(wallTexture, srcX, 0, srcW, WALL_TEX_SIZE, x, top, sw + 1, wallHeight);
    } else {
      const part1 = WALL_TEX_SIZE - srcX;
      const part2 = srcW - part1;
      const xPart1 = (sw + 1) * (part1 / srcW);
      ctx.drawImage(wallTexture, srcX, 0, part1, WALL_TEX_SIZE, x, top, xPart1, wallHeight);
      ctx.drawImage(wallTexture, 0, 0, part2, WALL_TEX_SIZE, x + xPart1, top, (sw + 1) - xPart1, wallHeight);
    }
    ctx.restore();

    // 距离衰减
    const dark = 1 - Math.max(0.05, distShade * sideShade * flickerMult);
    if (dark > 0.01) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.85, dark)})`;
      ctx.fillRect(x, top, sw + 1, wallHeight);
    }
  }

  function drawBatSprite(cx, cy, S, flapPhase, alpha) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(cx, cy);
    const wing = Math.sin(flapPhase);
    const tipY = -S * 0.06 - wing * S * 0.28;
    ctx.fillStyle = "#160c10";
    ctx.beginPath();
    ctx.moveTo(-S * 0.05, -S * 0.02);
    ctx.quadraticCurveTo(-S * 0.42, tipY - S * 0.10, -S * 0.62, tipY);
    ctx.quadraticCurveTo(-S * 0.40, tipY + S * 0.18, -S * 0.14, S * 0.10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(S * 0.05, -S * 0.02);
    ctx.quadraticCurveTo(S * 0.42, tipY - S * 0.10, S * 0.62, tipY);
    ctx.quadraticCurveTo(S * 0.40, tipY + S * 0.18, S * 0.14, S * 0.10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0d070a";
    ctx.beginPath();
    ctx.ellipse(0, 0, S * 0.12, S * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -S * 0.19, S * 0.10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-S * 0.06, -S * 0.25);
    ctx.lineTo(-S * 0.13, -S * 0.40);
    ctx.lineTo(-S * 0.02, -S * 0.30);
    ctx.closePath();
    ctx.moveTo(S * 0.06, -S * 0.25);
    ctx.lineTo(S * 0.13, -S * 0.40);
    ctx.lineTo(S * 0.02, -S * 0.30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff3a26";
    ctx.shadowColor = "#ff2a10";
    ctx.shadowBlur = S * 0.15;
    ctx.beginPath();
    ctx.arc(-S * 0.04, -S * 0.20, S * 0.022, 0, Math.PI * 2);
    ctx.arc(S * 0.04, -S * 0.20, S * 0.022, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawSkullSprite(cx, cy, S, alpha, spin) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(performance.now() / 90) * 0.05 * spin);
    ctx.fillStyle = "#e8e0d0";
    ctx.shadowColor = "rgba(255, 60, 30, 0.55)";
    ctx.shadowBlur = S * 0.35;
    ctx.beginPath();
    ctx.arc(0, 0, S * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#d8d0c0";
    ctx.beginPath();
    ctx.moveTo(-S * 0.28, S * 0.28);
    ctx.lineTo(S * 0.28, S * 0.28);
    ctx.lineTo(S * 0.22, S * 0.55);
    ctx.lineTo(-S * 0.22, S * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0a0605";
    ctx.beginPath();
    ctx.arc(-S * 0.16, -S * 0.02, S * 0.14, 0, Math.PI * 2);
    ctx.arc(S * 0.16, -S * 0.02, S * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, S * 0.10);
    ctx.lineTo(-S * 0.08, S * 0.28);
    ctx.lineTo(S * 0.08, S * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#3a2a20";
    ctx.lineWidth = Math.max(1, S * 0.02);
    for (let i = -3; i <= 3; i++) {
      const x = i * S * 0.06;
      ctx.beginPath();
      ctx.moveTo(x, S * 0.30);
      ctx.lineTo(x, S * 0.52);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 40, 20, 0.9)";
    ctx.shadowColor = "#ff2a10";
    ctx.shadowBlur = S * 0.22;
    ctx.beginPath();
    ctx.arc(-S * 0.16, -S * 0.02, S * 0.045, 0, Math.PI * 2);
    ctx.arc(S * 0.16, -S * 0.02, S * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function renderGhost(horizonY) {
    if (ghostActive <= 0 || ghostAlpha <= 0) return;
    if (!doubaoImage.complete || !doubaoImage.naturalWidth) return;

    const W = canvas.width, H = canvas.height;
    const dx = ghostX - player.x, dy = ghostY - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const rel = normalizeAngle(Math.atan2(dy, dx) - player.angle);
    const fov = getFov();
    if (Math.abs(rel) > fov * 0.9) return;
    const corr = dist * Math.cos(rel);
    if (corr <= 0.06) return;
    const focal = W / (2 * Math.tan(fov / 2));
    const sx = W / 2 + Math.tan(rel) * focal;
    const col = Math.max(0, Math.min(W - 1, Math.round(sx)));
    if ((zBuffer[col] ?? Infinity) < corr - 0.2) return;

    const scale = H / corr;
    const spriteH = Math.min(H * 2.2, scale * 0.95);
    const spriteW = spriteH * (9 / 16);
    const top = horizonY - scale * 0.47;
    const left = sx - spriteW / 2;

    ctx.save();
    ctx.globalAlpha = ghostAlpha * 0.55;
    ctx.shadowColor = "rgba(60, 5, 5, 0.85)";
    ctx.shadowBlur = 28;
    ctx.drawImage(doubaoImage, left, top, spriteW, spriteH);
    ctx.restore();
  }

  function renderScares(horizonY) {
    const W = canvas.width, H = canvas.height;
    const fov = getFov();
    const focal = W / (2 * Math.tan(fov / 2));

    for (const b of bats) {
      const dx = b.x - player.x, dy = b.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.15 || dist > 15) continue;
      const rel = normalizeAngle(Math.atan2(dy, dx) - player.angle);
      if (Math.abs(rel) > fov * 0.85) continue;
      const corr = dist * Math.cos(rel);
      if (corr <= 0.05) continue;
      const sx = W / 2 + Math.tan(rel) * focal;
      const sy = horizonY + (0.5 - b.z) * (H / corr);
      const col = Math.max(0, Math.min(W - 1, Math.round(sx)));
      if ((zBuffer[col] ?? Infinity) < corr - 0.15) continue;
      const size = Math.min(H * 1.1, (H / corr) * 0.55);
      const alpha = b.state === "idle" ? 0.55 : Math.max(0.35, 1 - dist / 15);
      drawBatSprite(sx, sy, size, b.phase, alpha);
    }

    for (const s of skulls) {
      const dx = s.x - player.x, dy = s.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.1 || dist > 12) continue;
      const rel = normalizeAngle(Math.atan2(dy, dx) - player.angle);
      if (Math.abs(rel) > fov * 0.9) continue;
      const corr = dist * Math.cos(rel);
      if (corr <= 0.05) continue;
      const sx = W / 2 + Math.tan(rel) * focal;
      const col = Math.max(0, Math.min(W - 1, Math.round(sx)));
      if ((zBuffer[col] ?? Infinity) < corr - 0.15) continue;
      const t = s.life / s.maxLife;
      let alpha;
      if (t < 0.15) alpha = t / 0.15;
      else if (t > 0.7) alpha = (1 - t) / 0.3;
      else alpha = 1;
      alpha = Math.max(0, Math.min(1, alpha)) * 0.95;
      const sy = horizonY + (0.5 - s.z) * (H / corr);
      const size = Math.min(H * 0.9, (H / corr) * s.size);
      drawSkullSprite(sx, sy, size, alpha, s.spin);
    }
  }

  function renderCrosshair() {
    if (state !== "playing") return;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;

    const now = performance.now();
    const breath = 1 + Math.sin(now / 520) * 0.07;

    const fire = Math.min(1.5, gunKick);
    const hitK = hitConfirmTimer > 0 ? Math.min(1, hitConfirmTimer / 0.28) : 0;

    const scaleBase = Math.max(0.85, Math.min(1.6, H / 720));

    const inner = (9 + hitK * 3 + fire * 6) * scaleBase * breath;
    const armLen = (13 + hitK * 5) * scaleBase * (1 + fire * 0.3);
    const outer = inner + armLen;

    const lw = Math.max(2, H * 0.004) * (1 + hitK * 0.65 + fire * 0.4);

    let color, glowColor;
    if (hitK > 0) {
      color = `rgba(255, 55, 40, ${0.9 + hitK * 0.1})`;
      glowColor = `rgba(255, 40, 20, ${0.5 + hitK * 0.5})`;
    } else {
      color = "rgba(248, 232, 200, 0.9)";
      glowColor = "rgba(255, 210, 150, 0.5)";
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = Math.max(5, H * 0.010) * (1 + hitK * 1.4 + fire * 0.4);

    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(outer, inner);
      ctx.lineTo(inner, inner);
      ctx.lineTo(inner, outer);
      ctx.stroke();
      ctx.restore();
    }

    if (hitK > 0.1) {
      ctx.fillStyle = `rgba(255, 70, 45, ${hitK})`;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1.8, 3.5 * scaleBase * (1 + hitK * 0.8)), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function renderWorld() {
    const W = canvas.width, H = canvas.height;
    const shakeX = shake ? (Math.random() - 0.5) * shake * 3.0 : 0;
    const shakeY = shake ? (Math.random() - 0.5) * shake * 2.1 : 0;
    const pitchShift = (player.pitch - viewKick * 0.16) * H * 0.78;
    const horizonY = H / 2 - pitchShift + shakeY;
    const fov = getFov();
    const focal = W / (2 * Math.tan(fov / 2));

    ctx.save();
    ctx.translate(shakeX, 0);

    drawBackground(W, H, horizonY);
    zBuffer.length = W;

    const flickerMult = 1 - flickerDark * 0.88;

    const sw = 2;
    for (let x = 0; x < W; x += sw) {
      const camX = (x / W) * 2 - 1;
      const ra = player.angle + Math.atan(camX * Math.tan(fov / 2));
      const hit = castRay(ra);
      const corr = hit.distance * Math.cos(ra - player.angle);
      const wallH = Math.min(H * 3, H / corr);
      const top = horizonY - wallH / 2;
      const distShade = Math.max(0.13, 1 - corr / 11.5);
      const seam = Math.min(hit.texture, 1 - hit.texture);
      const plank = seam < 0.035 ? 0.62 : 1;
      const sideShade = hit.side ? 0.72 : 1;
      const flicker = 0.92 + Math.random() * 0.08;

      if (hit.tile !== 2 && hit.tile !== 3) {
        // 【核心】检查这面墙是否被“惊吓”了
        const key = hit.mx + "," + hit.my;
        const scare = wallScares.get(key);
        if (scare) {
          renderWallScareStrip(x, top, sw, wallH, hit, corr, focal, distShade, sideShade, flicker * flickerMult, scare);
        } else {
          // 默认木色
          const light = Math.floor(105 * distShade * sideShade * plank * flicker * flickerMult);
          ctx.fillStyle = `rgb(${light},${Math.floor(light * 0.89)},${Math.floor(light * 0.72)})`;
          ctx.fillRect(x, top, sw + 1, wallH);
        }
      } else {
        renderCageStrip(x, top, sw, wallH, hit, distShade, sideShade);
      }
      for (let i = 0; i < sw; i++) zBuffer[x + i] = corr;
    }

    renderSprite(keyPosition.x, keyPosition.y, "key", horizonY);
    renderSprite(gunPosition.x, gunPosition.y, "gun", horizonY);

    renderCasings(horizonY);
    renderScares(horizonY);
    renderGhost(horizonY);

    for (const e of enemies) renderEnemySprite(e, horizonY);

    renderBlood(horizonY);

    if (muzzleFlash > 0.01) {
      const g = ctx.createRadialGradient(W / 2, horizonY + H * 0.16, 4, W / 2, horizonY + H * 0.16, W * 0.46);
      g.addColorStop(0, `rgba(255,232,170,${0.62 * muzzleFlash})`);
      g.addColorStop(0.45, `rgba(255,170,60,${0.24 * muzzleFlash})`);
      g.addColorStop(1, "rgba(255,140,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();

    {
      const cx = W / 2, cy = horizonY;
      const g = ctx.createRadialGradient(cx, cy, W * 0.08, cx, cy, W * 0.82);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.35, "rgba(0,0,0,0.12)");
      g.addColorStop(0.7, "rgba(0,0,0,0.42)");
      g.addColorStop(1, "rgba(0,0,0,0.82)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    const maxRage = enemies.reduce((m, e) => Math.max(m, e.rageLevel), 0);
    const ragePulse = maxRage > 0
      ? 0.04 + Math.sin(performance.now() / 340) * 0.025 * Math.min(1, maxRage / 8)
      : 0;
    const rageAmt = Math.min(0.5, rageFlash * 0.42 + ragePulse);
    if (rageAmt > 0.005) {
      const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.18, W / 2, H / 2, W * 0.78);
      g.addColorStop(0, "rgba(180,0,0,0)");
      g.addColorStop(1, `rgba(180,0,0,${rageAmt})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    if (graceTimer > 0) {
      const k = Math.min(1, graceTimer / START_GRACE_DURATION);
      const pulse = 0.35 + Math.sin(performance.now() / 140) * 0.25;
      const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.30, W / 2, H / 2, W * 0.78);
      g.addColorStop(0, "rgba(255, 210, 120, 0)");
      g.addColorStop(1, `rgba(255, 200, 100, ${(0.35 + pulse * 0.25) * k})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    if (whiteFlash > 0.01) {
      ctx.fillStyle = `rgba(255, 235, 210, ${Math.min(0.35, whiteFlash * 0.35)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (hasGun && state === "playing") renderViewModel(horizonY);

    renderCrosshair();

    if (lockState === "inserted" && state === "playing") {
      const t = Math.ceil(lockTimer);
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = `bold ${Math.round(H * 0.13)}px system-ui`;
      ctx.fillStyle = `rgba(255, 80, 40, ${0.72 + Math.sin(performance.now() / 140) * 0.22})`;
      ctx.shadowColor = "rgba(255, 40, 20, 0.9)";
      ctx.shadowBlur = 30;
      ctx.fillText(String(t), W / 2, H * 0.26);
      ctx.shadowBlur = 0;
      ctx.font = `500 ${Math.round(H * 0.03)}px system-ui`;
      ctx.fillStyle = "rgba(255, 190, 150, 0.95)";
      ctx.fillText("撑住！铁笼正在绞动", W / 2, H * 0.26 + H * 0.045);
      ctx.restore();
    }

    if (mapExpanded) renderMinimapFullscreen();
    else renderMinimap();
  }

  function renderCasings(horizonY) {
    if (!casings.length) return;
    const W = canvas.width, H = canvas.height;
    const fov = getFov();
    const focal = W / (2 * Math.tan(fov / 2));

    ctx.save();
    for (const c of casings) {
      const dx = c.x - player.x, dy = c.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.15 || dist > 12) continue;
      const rel = normalizeAngle(Math.atan2(dy, dx) - player.angle);
      if (Math.abs(rel) > fov * 0.85) continue;
      const corr = dist * Math.cos(rel);
      if (corr <= 0.06) continue;
      const sx = W / 2 + Math.tan(rel) * focal;
      const sy = horizonY + (0.5 - c.z) * (H / corr);
      const col = Math.max(0, Math.min(W - 1, Math.round(sx)));
      if ((zBuffer[col] ?? Infinity) < corr - 0.15) continue;

      const size = Math.max(1.2, (H / corr) * 0.035);
      const fade = Math.min(1, c.life / 0.8);

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(sx, sy);
      ctx.rotate(c.rot);
      ctx.fillStyle = "#d4a748";
      ctx.fillRect(-size * 0.5, -size * 0.3, size, size * 0.6);
      ctx.fillStyle = "#8a6a26";
      ctx.fillRect(-size * 0.5, -size * 0.3, size * 0.2, size * 0.6);
      ctx.restore();
    }
    ctx.restore();
  }

  function renderSprite(wx, wy, kind, horizonY) {
    if (kind === "key" && (hasKey || lockState !== "idle")) return;
    if (kind === "gun" && (hasGun || gunPicked)) return;

    const W = canvas.width, H = canvas.height;
    const dx = wx - player.x, dy = wy - player.y;
    const dist = Math.hypot(dx, dy);
    const rel = normalizeAngle(Math.atan2(dy, dx) - player.angle);
    const fov = getFov();
    if (Math.abs(rel) > fov * 0.74 || dist < 0.08) return;

    const focal = W / (2 * Math.tan(fov / 2));
    const sx = W / 2 + Math.tan(rel) * focal;
    const scale = H / (dist * Math.cos(rel));
    const col = Math.max(0, Math.min(W - 1, Math.round(sx)));
    if ((zBuffer[col] ?? Infinity) < dist - 0.2) return;

    ctx.save();
    if (kind === "key") {
      const bob = Math.sin(performance.now() / 230) * 0.045;
      const h = 0.38 + bob;
      const sy = horizonY + (0.5 - h) * scale;
      const size = Math.max(20, Math.min(H * 1.5, scale * 0.42));
      ctx.shadowColor = "#f6c74f";
      ctx.shadowBlur = 20;
      ctx.font = `${size}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🔪", sx, sy);
    } else if (kind === "gun") {
      const bob = Math.sin(performance.now() / 250) * 0.04;
      const h = 0.36 + bob;
      const sy = horizonY + (0.5 - h) * scale;
      const size = Math.max(22, Math.min(H * 1.5, scale * 0.40));
      drawGunSprite(sx, sy, size * 0.95);
    }
    ctx.restore();
  }

  function renderEnemySprite(e, horizonY) {
    const W = canvas.width, H = canvas.height;
    const dx = e.x - player.x, dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    const rel = normalizeAngle(Math.atan2(dy, dx) - player.angle);
    const fov = getFov();
    if (Math.abs(rel) > fov * 0.74 || dist < 0.08) return;

    const focal = W / (2 * Math.tan(fov / 2));
    const sx = W / 2 + Math.tan(rel) * focal;
    const scale = H / (dist * Math.cos(rel));
    const col = Math.max(0, Math.min(W - 1, Math.round(sx)));
    if ((zBuffer[col] ?? Infinity) < dist - 0.2) return;

    if (!doubaoImage.complete || !doubaoImage.naturalWidth) return;

    ctx.save();
    const spriteH = Math.min(H * 2.2, scale * 0.95);
    const spriteW = spriteH * (9 / 16);
    const top = horizonY - scale * 0.47;
    const left = sx - spriteW / 2;
    ctx.shadowColor = "rgba(150, 15, 9, 0.75)";
    ctx.shadowBlur = dist < 2.5 ? 34 : 14;
    ctx.globalAlpha = Math.max(0.5, 1 - dist / 20);
    ctx.drawImage(doubaoImage, left, top, spriteW, spriteH);
    ctx.globalCompositeOperation = "multiply";
    const rageTint = Math.min(0.65, e.rageLevel * 0.075);
    ctx.fillStyle = `rgba(80,0,0,${Math.min(0.8, 0.05 + dist * 0.014 + rageTint)})`;
    ctx.fillRect(left, top, spriteW, spriteH);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  function drawGunSprite(cx, cy, S) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = "#7fb8ff";
    ctx.shadowBlur = S * 0.30;
    ctx.fillStyle = "#dbe4ee";
    ctx.beginPath();
    ctx.moveTo(-S * 0.55, -S * 0.22);
    ctx.lineTo(S * 0.40, -S * 0.22);
    ctx.lineTo(S * 0.46, -S * 0.16);
    ctx.lineTo(S * 0.46, -S * 0.04);
    ctx.lineTo(-S * 0.55, -S * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#a6b3c0";
    ctx.beginPath();
    ctx.moveTo(-S * 0.55, -S * 0.04);
    ctx.lineTo(S * 0.20, -S * 0.04);
    ctx.lineTo(S * 0.20, S * 0.06);
    ctx.lineTo(-S * 0.55, S * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1d2227";
    ctx.fillRect(S * 0.42, -S * 0.19, S * 0.08, S * 0.13);
    ctx.fillStyle = "#373d44";
    ctx.beginPath();
    ctx.moveTo(-S * 0.55, S * 0.06);
    ctx.lineTo(-S * 0.22, S * 0.06);
    ctx.lineTo(-S * 0.13, S * 0.48);
    ctx.lineTo(-S * 0.5, S * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#1f242a";
    ctx.lineWidth = Math.max(1, S * 0.025);
    for (let i = 0; i < 4; i++) {
      const t = (i + 1) / 5;
      ctx.beginPath();
      ctx.moveTo(-S * 0.5 + t * S * 0.28, S * 0.1 + t * S * 0.38);
      ctx.lineTo(-S * 0.55 + t * S * 0.28, S * 0.14 + t * S * 0.38);
      ctx.stroke();
    }
    ctx.strokeStyle = "#8a949e";
    ctx.lineWidth = Math.max(2, S * 0.045);
    ctx.beginPath();
    ctx.arc(-S * 0.24, S * 0.18, S * 0.16, -Math.PI * 0.15, Math.PI * 1.05);
    ctx.stroke();
    ctx.fillStyle = "#eef4fa";
    ctx.fillRect(S * 0.33, -S * 0.26, S * 0.04, S * 0.05);
    ctx.fillRect(-S * 0.5, -S * 0.26, S * 0.04, S * 0.05);
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.fillRect(-S * 0.5, -S * 0.19, S * 0.86, S * 0.02);
    ctx.restore();
  }

  function renderViewModel(horizonY) {
    const W = canvas.width, H = canvas.height;
    const moving = input.KeyW || input.KeyS || input.KeyA || input.KeyD ||
                   input.ArrowUp || input.ArrowDown || input.ArrowLeft || input.ArrowRight ||
                   input.forward || input.backward || input.left || input.right ||
                   input.turnLeft || input.turnRight;
    const bobX = moving ? Math.sin(player.walkPhase) * W * 0.012 : 0;
    const bobY = moving ? Math.abs(Math.cos(player.walkPhase)) * H * 0.014 : 0;
    const kickEase = gunKick;
    const S = H * 0.60;
    const gunCX = W * 0.64 + bobX + kickEase * W * 0.026;
    const gunCY = H * 1.00 + bobY + kickEase * H * 0.22;
    const rot = -0.16 + kickEase * 0.42;

    ctx.save();
    ctx.translate(gunCX, gunCY);
    ctx.rotate(rot);
    const body = "#dfe7f0";
    const mid = "#98a4b1";
    const dark = "#3a4148";

    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-S * 0.10, 0);
    ctx.lineTo(S * 0.10, 0);
    ctx.lineTo(S * 0.13, -S * 0.30);
    ctx.lineTo(-S * 0.13, -S * 0.30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#22272d";
    ctx.lineWidth = Math.max(1, S * 0.012);
    for (let i = 0; i < 5; i++) {
      const t = (i + 1) / 6;
      const y = -S * 0.05 - t * S * 0.22;
      ctx.beginPath();
      ctx.moveTo(-S * 0.115, y);
      ctx.lineTo(S * 0.115, y);
      ctx.stroke();
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-S * 0.13, -S * 0.30);
    ctx.lineTo(S * 0.13, -S * 0.30);
    ctx.lineTo(S * 0.13, -S * 0.88);
    ctx.lineTo(-S * 0.13, -S * 0.88);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mid;
    ctx.fillRect(-S * 0.13, -S * 0.34, S * 0.26, S * 0.05);
    ctx.fillStyle = "rgba(255,255,255,0.36)";
    ctx.fillRect(-S * 0.105, -S * 0.855, S * 0.05, S * 0.53);
    ctx.fillStyle = "#14181c";
    ctx.beginPath();
    ctx.ellipse(0, -S * 0.88, S * 0.07, S * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2f7fc";
    ctx.fillRect(-S * 0.025, -S * 0.925, S * 0.05, S * 0.045);
    ctx.strokeStyle = mid;
    ctx.lineWidth = Math.max(2, S * 0.022);
    ctx.beginPath();
    ctx.arc(S * 0.10, -S * 0.24, S * 0.06, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();

    if (muzzleFlash > 0.02) {
      const g = ctx.createRadialGradient(0, -S * 0.90, 0, 0, -S * 0.90, S * 0.50);
      g.addColorStop(0, `rgba(255, 245, 190, ${muzzleFlash})`);
      g.addColorStop(0.35, `rgba(255, 170, 50, ${muzzleFlash * 0.8})`);
      g.addColorStop(1, "rgba(255, 100, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -S * 0.90, S * 0.50, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ============ 小地图 ============
  function renderMinimap() {
    const W = canvas.width;
    const cell = Math.max(4, Math.min(7, W / 150));
    const mw = MAP_W * cell;
    const mh = MAP_H * cell;
    const x0 = W - mw - 16;
    const y0 = 74;
    const preset = currentPreset();

    ctx.save();
    ctx.fillStyle = "rgba(10, 7, 5, 0.92)";
    ctx.fillRect(x0 - 6, y0 - 6, mw + 12, mh + 12);
    ctx.shadowColor = "rgba(240, 200, 130, 0.55)";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "rgba(226, 182, 110, 0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 - 6.5, y0 - 6.5, mw + 13, mh + 13);
    ctx.shadowBlur = 0;

    drawMinimapCells(x0, y0, cell);

    if (!hasGun && !gunPicked && gunCellRef && explored[gunCellRef.y] && explored[gunCellRef.y][gunCellRef.x]) {
      ctx.shadowColor = "#7fb8ff"; ctx.shadowBlur = 10;
      ctx.fillStyle = "#9fd0ff";
      ctx.beginPath();
      ctx.arc(x0 + (gunCellRef.x + 0.5) * cell, y0 + (gunCellRef.y + 0.5) * cell, cell * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!hasKey && lockState === "idle" && keyCellRef && explored[keyCellRef.y] && explored[keyCellRef.y][keyCellRef.x]) {
      ctx.shadowColor = "#f6c74f"; ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffd769";
      ctx.beginPath();
      ctx.arc(x0 + (keyCellRef.x + 0.5) * cell, y0 + (keyCellRef.y + 0.5) * cell, cell * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    drawCageMarker(x0, y0, cell);

    const detectRange = preset.detectRange;
    if (detectRange > 0) {
      for (const e of enemies) {
        const dToPlayer = Math.hypot(player.x - e.x, player.y - e.y);
        if (dToPlayer >= detectRange) continue;
        drawEnemyAvatarOnMap(x0, y0, cell, e);
      }
    }

    drawPlayerMarker(x0, y0, cell);
    ctx.restore();
  }

  function renderMinimapFullscreen() {
    const W = canvas.width, H = canvas.height;
    ctx.save();
    ctx.fillStyle = "rgba(4, 2, 1, 0.88)";
    ctx.fillRect(0, 0, W, H);

    const maxW = W * 0.75;
    const maxH = H * 0.75;
    const cell = Math.max(6, Math.min(maxW / MAP_W, maxH / MAP_H));
    const mw = MAP_W * cell;
    const mh = MAP_H * cell;
    const x0 = (W - mw) / 2;
    const y0 = (H - mh) / 2 + 12;

    ctx.fillStyle = "rgba(10, 7, 5, 0.98)";
    ctx.fillRect(x0 - 10, y0 - 10, mw + 20, mh + 20);
    ctx.shadowColor = "rgba(240, 200, 130, 0.75)";
    ctx.shadowBlur = 24;
    ctx.strokeStyle = "rgba(226, 182, 110, 0.95)";
    ctx.lineWidth = 3;
    ctx.strokeRect(x0 - 10.5, y0 - 10.5, mw + 21, mh + 21);
    ctx.shadowBlur = 0;

    drawMinimapCells(x0, y0, cell);

    if (!hasGun && !gunPicked && gunCellRef && explored[gunCellRef.y] && explored[gunCellRef.y][gunCellRef.x]) {
      ctx.shadowColor = "#7fb8ff"; ctx.shadowBlur = 14;
      ctx.fillStyle = "#b8dcff";
      ctx.beginPath();
      ctx.arc(x0 + (gunCellRef.x + 0.5) * cell, y0 + (gunCellRef.y + 0.5) * cell, cell * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#001a2e";
      ctx.font = `bold ${Math.max(11, cell * 0.6)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("枪", x0 + (gunCellRef.x + 0.5) * cell, y0 + (gunCellRef.y + 0.5) * cell);
    }
    if (!hasKey && lockState === "idle" && keyCellRef && explored[keyCellRef.y] && explored[keyCellRef.y][keyCellRef.x]) {
      ctx.shadowColor = "#f6c74f"; ctx.shadowBlur = 14;
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath();
      ctx.arc(x0 + (keyCellRef.x + 0.5) * cell, y0 + (keyCellRef.y + 0.5) * cell, cell * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#3a2500";
      ctx.font = `bold ${Math.max(11, cell * 0.6)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("刀", x0 + (keyCellRef.x + 0.5) * cell, y0 + (keyCellRef.y + 0.5) * cell);
    }

    drawCageMarker(x0, y0, cell);

    const preset = currentPreset();
    const detectRange = preset.detectRange;
    if (detectRange > 0) {
      for (const e of enemies) {
        const dToPlayer = Math.hypot(player.x - e.x, player.y - e.y);
        if (dToPlayer >= detectRange) continue;
        drawEnemyAvatarOnMap(x0, y0, cell, e);
      }
    }

    drawPlayerMarker(x0, y0, cell);

    ctx.shadowBlur = 0;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 220, 180, 0.9)";
    ctx.font = `500 ${Math.round(H * 0.028)}px system-ui`;
    ctx.fillText("按 Tab 关闭地图", W / 2, y0 - 30);

    ctx.restore();
  }

  function drawMinimapCells(x0, y0, cell) {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!explored[y][x]) continue;
        const v = map[y][x];
        let col;
        if (v === 0) col = "#8a785a";
        else if (v === 2) col = "#ffcb66";
        else if (v === 3) col = "#7ee2a8";
        else col = "#2a231b";
        ctx.fillStyle = col;
        ctx.fillRect(x0 + x * cell, y0 + y * cell, cell - 0.6, cell - 0.6);
      }
    }
  }

  function drawCageMarker(x0, y0, cell) {
    const ex = x0 + (exitCell.x + 0.5) * cell;
    const ey = y0 + (exitCell.y + 0.5) * cell;
    const opened = (lockState === "open");
    const pulse = 0.55 + Math.sin(performance.now() / 320) * 0.35;
    ctx.shadowColor = opened ? "#7ee2a8" : "#ff3a1e";
    ctx.shadowBlur = 16;
    ctx.strokeStyle = opened ? `rgba(126, 226, 168, ${pulse})` : `rgba(255, 70, 40, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, ey, cell * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 12;
    ctx.fillStyle = opened ? "#7ee2a8" : "#ff4a2c";
    const hs = cell * 0.5;
    ctx.fillRect(ex - hs, ey - hs, hs * 2, hs * 2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#1a0a06";
    ctx.lineWidth = Math.max(1.2, cell * 0.16);
    ctx.beginPath();
    ctx.moveTo(ex - hs * 0.55, ey);
    ctx.lineTo(ex + hs * 0.55, ey);
    ctx.moveTo(ex, ey - hs * 0.55);
    ctx.lineTo(ex, ey + hs * 0.55);
    ctx.stroke();
  }

  function drawEnemyAvatarOnMap(x0, y0, cell, e) {
    const ex = x0 + e.x * cell;
    const ey = y0 + e.y * cell;
    const avatarR = Math.max(9, cell * 1.35);
    const size = avatarR * 2;

    const pulse = 0.55 + Math.sin(performance.now() / 180) * 0.4;
    ctx.save();
    ctx.shadowColor = "rgba(255, 40, 20, 0.95)";
    ctx.shadowBlur = 16;
    ctx.strokeStyle = `rgba(255, 60, 40, ${Math.max(0.45, pulse)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, ey, avatarR + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(ex, ey, avatarR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (doubaoNormalImage.complete && doubaoNormalImage.naturalWidth) {
      ctx.fillStyle = "#000";
      ctx.fillRect(ex - avatarR, ey - avatarR, size, size);
      ctx.drawImage(doubaoNormalImage, ex - avatarR, ey - avatarR, size, size);
    } else {
      ctx.fillStyle = "#3a0a08";
      ctx.fillRect(ex - avatarR, ey - avatarR, size, size);
      ctx.strokeStyle = "#ff6b45";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ex - avatarR * 0.5, ey - avatarR * 0.5);
      ctx.lineTo(ex + avatarR * 0.5, ey + avatarR * 0.5);
      ctx.moveTo(ex + avatarR * 0.5, ey - avatarR * 0.5);
      ctx.lineTo(ex - avatarR * 0.5, ey + avatarR * 0.5);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "multiply";
    const tint = Math.min(0.6, 0.18 + e.rageLevel * 0.06);
    ctx.fillStyle = `rgba(140, 10, 5, ${tint})`;
    ctx.fillRect(ex - avatarR, ey - avatarR, size, size);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "#ffb28a";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255, 80, 40, 0.85)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(ex, ey, avatarR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayerMarker(x0, y0, cell) {
    const px = x0 + player.x * cell;
    const py = y0 + player.y * cell;
    ctx.shadowColor = "#ff5a3c";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ff6b45";
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2.4, cell * 0.56), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff0c8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(player.angle) * cell * 1.9, py + Math.sin(player.angle) * cell * 1.9);
    ctx.stroke();
  }

  function renderBlood(horizonY) {
    if (!bloodParticles.length) return;
    const W = canvas.width, H = canvas.height;
    const fov = getFov();
    const focal = W / (2 * Math.tan(fov / 2));
    ctx.save();
    for (const p of bloodParticles) {
      const dx = p.x - player.x, dy = p.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.06 || dist > 24) continue;
      const rel = normalizeAngle(Math.atan2(dy, dx) - player.angle);
      if (Math.abs(rel) > fov * 0.84) continue;
      const corr = dist * Math.cos(rel);
      if (corr <= 0.06) continue;
      const sx = W / 2 + Math.tan(rel) * focal;
      const sy = horizonY + (0.5 - p.z) * (H / corr);
      const col = Math.max(0, Math.min(W - 1, Math.round(sx)));
      if ((zBuffer[col] ?? Infinity) < corr - 0.18) continue;
      const r = Math.max(0.8, (H / corr) * p.size);
      const fade = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = 0.25 + fade * 0.7;
      ctx.fillStyle = "#b7111b";
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      if (r > 3) {
        ctx.globalAlpha = (0.25 + fade * 0.7) * 0.5;
        ctx.fillStyle = "#7d070f";
        ctx.beginPath(); ctx.arc(sx - r * 0.25, sy + r * 0.2, r * 0.55, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function renderIdle() {
    const W = canvas.width, H = canvas.height;
    const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.5, W * 0.75);
    g.addColorStop(0, "#241411"); g.addColorStop(0.42, "#0e0b09"); g.addColorStop(1, "#020202");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(185,145,99,0.05)";
    for (let x = 0; x < W; x += 46) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - W * 0.18, H); ctx.stroke();
    }
  }

  // ============================ 主循环 ============================
  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (state === "playing") {
      updatePlayer(dt);
      if (state === "playing") updateEnemies(dt);
      updateScares(dt);
      updateBlood(dt);
      updateCasings(dt);
      updateExploration(dt);
      renderWorld();
    } else {
      renderIdle();
    }
    requestAnimationFrame(frame);
  }

  // ============================ 输入 ============================
  window.addEventListener("resize", resizeCanvas);

  function updateSensitivityDisplay() {
    if (sensValue) sensValue.textContent = sensitivityMult.toFixed(2) + "x";
  }
  if (sensSlider) {
    sensitivityMult = parseFloat(sensSlider.value) || 1.0;
    updateSensitivityDisplay();
    sensSlider.addEventListener("input", () => {
      sensitivityMult = parseFloat(sensSlider.value) || 1.0;
      updateSensitivityDisplay();
    });
  }

  window.addEventListener("keydown", (e) => {
    input[e.code] = true;
    if (e.code === "KeyQ" && !e.repeat) tryInsertKnife();
    if (e.code === "Tab") {
      e.preventDefault();
      if (state === "playing") mapExpanded = !mapExpanded;
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => { input[e.code] = false; });
  window.addEventListener("blur", () => {
    for (const k of Object.keys(input)) input[k] = false;
    triggerHeld = false;
    autoFiring = false;
  });

  document.addEventListener("mousemove", (e) => {
    if (state === "playing" && document.pointerLockElement === canvas) {
      if (Math.abs(e.movementY) > 0.5) lastMouseMoveTime = performance.now();
      player.angle = normalizeAngle(player.angle + e.movementX * BASE_MOUSE_SENS * sensitivityMult);
      player.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT,
        player.pitch + e.movementY * PITCH_SENSITIVITY * sensitivityMult));
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    if (state !== "playing") return;
    if (e.button === 0) {
      e.preventDefault();
      if (document.pointerLockElement === canvas) {
        pressTrigger();
      } else if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        canvas.requestPointerLock?.();
      }
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      if (state === "playing") releaseTrigger();
    }
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  for (const btn of document.querySelectorAll("[data-control]")) {
    const control = btn.dataset.control;
    const on = (e) => {
      e.preventDefault();
      if (control === "fire") { pressTrigger(); btn.classList.add("is-held"); return; }
      if (control === "knife") { tryInsertKnife(); return; }
      input[control] = true;
      btn.classList.add("is-held");
      btn.setPointerCapture?.(e.pointerId);
    };
    const off = (e) => {
      e.preventDefault();
      if (control === "fire") { releaseTrigger(); btn.classList.remove("is-held"); return; }
      if (control === "knife") { btn.classList.remove("is-held"); return; }
      input[control] = false;
      btn.classList.remove("is-held");
    };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointercancel", off);
    btn.addEventListener("pointerleave", (e) => {
      if (!btn.hasPointerCapture?.(e.pointerId)) off(e);
    });
  }

  for (const btn of document.querySelectorAll("[data-difficulty]")) {
    btn.addEventListener("click", () => {
      const key = btn.dataset.difficulty;
      if (!DIFFICULTIES[key]) return;
      currentDifficulty = key;
      for (const b of document.querySelectorAll("[data-difficulty]")) {
        b.setAttribute("aria-checked", b === btn ? "true" : "false");
      }
      startGame();
    });
  }

  restartButton.addEventListener("click", startGame);

  resizeCanvas();
  renderIdle();
  buildWallTexture();
  requestAnimationFrame(frame);
})();