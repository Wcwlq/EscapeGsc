// ============================================================
// net.js —— 联机模块（基于 PeerJS / WebRTC 的 P2P 直连）
// 特性：自动识别自建信令服务器 / 官方测试服务器
// ============================================================
window.Net = (() => {
  function getPeerConfig() {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "";

    if (isLocal) {
      return { debug: 1 };
    }

    return {
      host: host,
      port: protocol === "https:" ? 443 : 80,
      path: "/peerjs",
      secure: protocol === "https:",
      debug: 1,
    };
  }

  let peer = null;
  let conn = null;
  let isHostFlag = false;
  let roomCodeValue = null;
  let connectedFlag = false;
  const handlers = Object.create(null);

  function on(type, fn) {
    if (!handlers[type]) handlers[type] = [];
    handlers[type].push(fn);
  }
  function emit(type, data) {
    const list = handlers[type];
    if (!list) return;
    for (const fn of list) {
      try { fn(data); } catch (e) { console.error("[Net handler]", e); }
    }
  }

  function generateCode() {
    let s = "";
    for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10);
    return s;
  }
  function peerIdFor(code) { return "shaoshuai-x-" + code; }

  function setupConn(c) {
    conn = c;
    // 如果连接已 open（如 joiner 在 c.on("open") 后才调 setupConn），直接标记
    if (c.open) {
      connectedFlag = true;
      emit("open");
    }
    conn.on("open", () => { connectedFlag = true; emit("open"); });
    conn.on("data", (data) => {
      if (data && typeof data === "object" && typeof data.t === "string") {
        emit(data.t, data.d);
      }
    });
    conn.on("close", () => { connectedFlag = false; emit("close"); });
    conn.on("error", (err) => emit("error", err));
  }

  function createRoom(cb) {
    if (typeof Peer === "undefined") {
      cb("PeerJS 未加载（检查网络）", null);
      return;
    }
    let attempts = 0;
    const tryCreate = () => {
      attempts++;
      if (attempts > 5) {
        cb("无法创建房间，请稍后重试", null);
        return;
      }
      const code = generateCode();
      isHostFlag = true;
      roomCodeValue = code;
      peer = new Peer(peerIdFor(code), getPeerConfig());
      peer.on("open", () => {
        emit("host-ready", code);
        cb(null, code);
      });
      peer.on("connection", (c) => {
        if (conn && connectedFlag) {
          try { c.close(); } catch (e) {}
          return;
        }
        setupConn(c);
      });
      peer.on("error", (err) => {
        if (err && err.type === "unavailable-id") {
          try { peer.destroy(); } catch (e) {}
          peer = null;
          setTimeout(tryCreate, 200);
          return;
        }
        cb((err && err.message) || "创建失败", null);
      });
    };
    tryCreate();
  }

  function joinRoom(code, cb) {
    if (typeof Peer === "undefined") {
      cb("PeerJS 未加载（检查网络）");
      return;
    }
    isHostFlag = false;
    roomCodeValue = code;
    peer = new Peer(getPeerConfig());
    let done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      cb(err || null);
    };
    peer.on("open", () => {
      const c = peer.connect(peerIdFor(code), { reliable: true });
      c.on("open", () => { setupConn(c); finish(null); });
      c.on("error", () => finish("无法连接到房间"));
    });
    peer.on("error", (err) => finish((err && err.message) || "加入失败"));
    setTimeout(() => finish("连接超时，请检查房间号"), 12000);
  }

  function send(type, data) {
    if (conn && connectedFlag) {
      try { conn.send({ t: type, d: data }); } catch (e) {}
    }
  }

  function close() {
    if (conn) { try { conn.close(); } catch (e) {} conn = null; }
    if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
    connectedFlag = false;
    isHostFlag = false;
    roomCodeValue = null;
  }

  return {
    on, emit, createRoom, joinRoom, send, close,
    get isHost() { return isHostFlag; },
    get roomCode() { return roomCodeValue; },
    get connected() { return connectedFlag; }
  };
})();