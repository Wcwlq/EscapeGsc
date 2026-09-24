// ============================================================
// leaderboard.js —— 排行榜渲染
// ============================================================
window.Leaderboard = (() => {
  function formatTime(ms) {
    if (ms == null) return "—";
    const s = ms / 1000;
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    if (m > 0) return `${m}:${sec.toFixed(2).padStart(5, "0")}`;
    return `${sec.toFixed(2)}s`;
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  async function render(container, mode, day) {
    container.innerHTML = '<p class="lb-empty">加载中…</p>';
    try {
      const data = await Account.fetchLeaderboard(mode, day || todayStr());
      const entries = data.entries || [];
      if (!entries.length) {
        container.innerHTML = '<p class="lb-empty">今日暂无记录，来做第一个吧</p>';
        return;
      }
      let html = '<ol class="lb-list">';
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const cls = i === 0 ? "lb-top1" : (i < 3 ? "lb-top3" : "");
        html += `<li class="${cls}">
          <span class="lb-rank">${i + 1}</span>
          <span class="lb-name">${escapeHTML(e.username)}</span>
          <span class="lb-time">${formatTime(e.best_time)}</span>
        </li>`;
      }
      html += "</ol>";
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<p class="lb-empty">加载失败：${escapeHTML(err.message)}</p>`;
    }
  }

  return { render, formatTime, todayStr };
})();