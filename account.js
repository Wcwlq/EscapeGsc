// ============================================================
// account.js —— 账号模块（登录 / 注册 / 提交成绩 / 拉取榜单）
// ============================================================
window.Account = (() => {
  const API_BASE = (() => {
    const h = window.location.hostname;
    const isLocal = h === "localhost" || h === "127.0.0.1" || h === "";
    if (isLocal) return "http://127.0.0.1:9100";
    return window.location.origin + "/api";
  })();

  let token = localStorage.getItem("ss_token") || "";
  let username = localStorage.getItem("ss_username") || "";

  function isLoggedIn() { return !!token; }
  function getUsername() { return username; }

  async function request(path, opts = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(API_BASE + path, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
    return data;
  }

  async function register(u, p) {
    const r = await request("/register", { method: "POST", body: { username: u, password: p } });
    token = r.token; username = r.username;
    localStorage.setItem("ss_token", token);
    localStorage.setItem("ss_username", username);
    return r;
  }

  async function login(u, p) {
    const r = await request("/login", { method: "POST", body: { username: u, password: p } });
    token = r.token; username = r.username;
    localStorage.setItem("ss_token", token);
    localStorage.setItem("ss_username", username);
    return r;
  }

  async function logout() {
    try { await request("/logout", { method: "POST" }); } catch (e) {}
    token = ""; username = "";
    localStorage.removeItem("ss_token");
    localStorage.removeItem("ss_username");
  }

  async function submitScore(mode, seed, day, timeMs) {
    if (!token) throw new Error("未登录");
    return request("/score", {
      method: "POST",
      body: { mode, seed, day, time_ms: Math.floor(timeMs) }
    });
  }

  async function fetchLeaderboard(mode, day) {
    const q = new URLSearchParams({ mode });
    if (day) q.set("day", day);
    return request("/leaderboard?" + q.toString());
  }

  return {
    isLoggedIn, getUsername,
    register, login, logout,
    submitScore, fetchLeaderboard,
    getToken: () => token,
    API_BASE
  };
})();