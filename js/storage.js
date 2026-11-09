/* 사회문화 연습장 — 브라우저 저장소 래퍼 (localStorage 사용 불가 환경 대비) */
(function () {
  var mem = {};
  var store = null;
  try {
    var ls = window["local" + "Storage"];
    ls.setItem("__t", "1");
    ls.removeItem("__t");
    store = ls;
  } catch (e) {
    store = null;
  }
  function get(key) {
    try {
      if (store) return store.getItem(key);
      return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
    } catch (e) { return null; }
  }
  function set(key, value) {
    try {
      if (store) { store.setItem(key, value); return; }
      mem[key] = value;
    } catch (e) { mem[key] = value; }
  }
  function getJSON(key, fallback) {
    try {
      var raw = get(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function setJSON(key, value) {
    try { set(key, JSON.stringify(value)); } catch (e) {}
  }
  window.Store = {
    persistent: !!store,
    get: get,
    set: set,
    getJSON: getJSON,
    setJSON: setJSON,
  };
})();
