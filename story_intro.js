// ============================================================
// story_intro.js —— 英雄出场式完整故事线
// v2：无句读版 · 与 lore.js 标点风格统一
// 7 幕过场动画，逐行揭示，背景色调随剧情流转
// ============================================================
window.HeroIntro = (() => {
  // ============ 剧本 ============
  const CHAPTERS = [
    // ── 序幕 ──
    {
      id: "prologue",
      duration: 3200,
      title: "",
      lines: ["很久以前、有一对兄妹"],
      subtitle: "",
      bgTint: "dark"
    },
    // ── 壹 · 院子 ──
    {
      id: "chapter1",
      duration: 9000,
      title: "—— 壹 · 院子",
      lines: [
        "夏天的时候",
        "院子最深处有一棵槐树",
        "叶子能把大半个院子遮起来",
        "小洛在树下睡午觉",
        "头发上落满了花"
      ],
      bgTint: "warm"
    },
    // ── 贰 · 火 ──
    {
      id: "chapter2",
      duration: 10000,
      title: "—— 贰 · 火",
      lines: [
        "那天下午很热",
        "小洛缠着我要吃冰棍",
        "我说等会儿",
        "——那是我最后一次",
        "听她说话"
      ],
      bgTint: "fire"
    },
    // ── 叁 · 之后 ──
    {
      id: "chapter3",
      duration: 9000,
      title: "—— 叁 · 之后",
      lines: [
        "那天之后",
        "小锦变成了两个人",
        "一个还在哭",
        "一个已经哭不出来了",
        "他们共用一具身体",
        "从来没说过一句话"
      ],
      bgTint: "cold"
    },
    // ── 肆 · 十年 ──
    {
      id: "chapter4",
      duration: 9000,
      title: "—— 肆 · 十年",
      lines: [
        "十年过去了",
        "小锦每天回到那个院子",
        "站在铁笼前面",
        "不进",
        "也不走",
        "他想关上门",
        "可那扇门是他自己打开的"
      ],
      bgTint: "dark"
    },
    // ── 伍 · 今晚 ──
    {
      id: "chapter5",
      duration: 8500,
      title: "—— 伍 · 今晚",
      lines: [
        "今晚、他又醒了",
        "他在后面",
        "他一直都在后面",
        "跑吧",
        "别停下",
        "只要跑到天亮"
      ],
      bgTint: "night"
    },
    // ── 终 · 标题 ──
    {
      id: "finale",
      duration: 6000,
      title: "",
      lines: ["恐怖少帅"],
      subtitle: "——“哥、水开了”",
      bgTint: "black",
      isFinale: true
    }
  ];

  // ============ 状态 ============
  let overlay = null;
  let currentIndex = 0;
  let timers = [];
  let running = false;
  let endCallback = null;

  // ============ 构建 DOM ============
  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.id = "hero-intro";
    overlay.className = "hero-intro";
    overlay.innerHTML = `
      <div class="hero-intro-bg" aria-hidden="true"></div>
      <div class="hero-intro-vignette" aria-hidden="true"></div>
      <div class="hero-intro-grain" aria-hidden="true"></div>
      <div class="hero-intro-content">
        <p class="hero-intro-title"></p>
        <div class="hero-intro-lines"></div>
        <p class="hero-intro-subtitle"></p>
      </div>
      <button class="hero-intro-skip" type="button">
        <span>跳过</span>
        <span class="skip-arrow">▸</span>
      </button>
      <div class="hero-intro-progress">
        <span class="progress-dot"></span>
        <span class="progress-dot"></span>
        <span class="progress-dot"></span>
        <span class="progress-dot"></span>
        <span class="progress-dot"></span>
        <span class="progress-dot"></span>
        <span class="progress-dot"></span>
      </div>
    `;
    document.getElementById("game-shell").appendChild(overlay);

    const skipBtn = overlay.querySelector(".hero-intro-skip");
    skipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      end();
    });
    window.addEventListener("keydown", (e) => {
      if (!running) return;
      if (e.code === "Escape" || e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        end();
      }
    });
  }

  function clearTimers() {
    for (const t of timers) clearTimeout(t);
    timers = [];
  }

  function setProgressDot(idx) {
    const dots = overlay.querySelectorAll(".progress-dot");
    dots.forEach((d, i) => {
      d.classList.toggle("active", i === idx);
      d.classList.toggle("done", i < idx);
    });
  }

  // ============ 播放一幕 ============
  function playChapter(chapter, chapterIdx, onDone) {
    const bg = overlay.querySelector(".hero-intro-bg");
    const titleEl = overlay.querySelector(".hero-intro-title");
    const linesEl = overlay.querySelector(".hero-intro-lines");
    const subEl = overlay.querySelector(".hero-intro-subtitle");
    const contentEl = overlay.querySelector(".hero-intro-content");

    bg.className = "hero-intro-bg tint-" + (chapter.bgTint || "dark");

    contentEl.classList.toggle("is-finale", !!chapter.isFinale);
    titleEl.textContent = chapter.title || "";
    titleEl.style.opacity = "0";
    linesEl.innerHTML = "";
    subEl.textContent = "";
    subEl.style.opacity = "0";

    setProgressDot(chapterIdx);

    requestAnimationFrame(() => {
      titleEl.style.opacity = chapter.title ? "1" : "0";
    });

    const lineCount = Math.max(1, chapter.lines.length);
    const startDelay = chapter.title ? 800 : 400;
    const lineDelay = Math.min(1100, (chapter.duration - startDelay - 1400) / lineCount);

    chapter.lines.forEach((line, i) => {
      const t = setTimeout(() => {
        const p = document.createElement("p");
        p.className = "hero-intro-line";
        p.textContent = line || "\u00A0";
        if (chapter.isFinale) p.classList.add("is-finale-line");
        linesEl.appendChild(p);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => p.classList.add("is-visible"));
        });
      }, startDelay + i * lineDelay);
      timers.push(t);
    });

    if (chapter.subtitle) {
      const t = setTimeout(() => {
        subEl.textContent = chapter.subtitle;
        subEl.style.opacity = "1";
      }, startDelay + lineCount * lineDelay + 500);
      timers.push(t);
    }

    const endT = setTimeout(onDone, chapter.duration);
    timers.push(endT);
  }

  // ============ 播放下一幕 ============
  function playNext() {
    if (!running) return;
    if (currentIndex >= CHAPTERS.length) {
      end();
      return;
    }
    const chapter = CHAPTERS[currentIndex];
    const idx = currentIndex;
    playChapter(chapter, idx, () => {
      const contentEl = overlay.querySelector(".hero-intro-content");
      contentEl.classList.add("is-transitioning");
      const t = setTimeout(() => {
        contentEl.classList.remove("is-transitioning");
        currentIndex++;
        playNext();
      }, 350);
      timers.push(t);
    });
  }

  // ============ 生命周期 ============
  function start() {
    if (running) return;
    ensureOverlay();
    running = true;
    currentIndex = 0;
    clearTimers();
    overlay.classList.add("is-visible");
    document.body.classList.add("is-intro-running");
    requestAnimationFrame(() => {
      playNext();
    });
  }

  function end() {
    if (!running) return;
    running = false;
    clearTimers();
    if (overlay) {
      overlay.classList.add("is-fading");
      setTimeout(() => {
        overlay.classList.remove("is-visible");
        overlay.classList.remove("is-fading");
      }, 500);
    }
    document.body.classList.remove("is-intro-running");
    const cb = endCallback;
    endCallback = null;
    if (typeof cb === "function") {
      setTimeout(cb, 550);
    }
  }

  function play(cb) {
    endCallback = cb || null;
    start();
  }

  return {
    play,
    end,
    isRunning: () => running
  };
})();