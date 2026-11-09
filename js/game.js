/* 사회문화 연습장 — 학습 게임 "지식의 탑" v2
   문제 풀기·실전 모의고사에서 얻은 학습 성과로 탐구생이 성장하고,
   자동 전투 + 전투 명령 + 스킬 + 유물 수집으로 16층 탑을 오른다. */
(function () {
  'use strict';

  var SAVE_KEY = 'socmul_game_v2';
  var TICK_BASE = 800;
  var CHANCE_EVERY = 5;
  var CHANCE_SEC = 10;

  /* ─── 탑의 층과 보스 ─── */
  var FLOORS = [
    { n: 1, u: 1, name: '가설의 정령', intro: '탐구의 첫 관문. 가설 없이는 한 발짝도 나아갈 수 없다.' },
    { n: 2, u: 1, name: '자료의 수호자', intro: '표와 그래프를 읽지 못하면 지나갈 수 없다.' },
    { n: 3, u: 1, name: '탐구 방법론의 거인', intro: '빈칸 조사와 상관 분석을 구별하라.' },
    { n: 4, u: 2, name: '지위의 기사', intro: '귀속과 성취, 그 경계를 아는가.' },
    { n: 5, u: 2, name: '역할 갈등의 마술사', intro: '기대가 부딪히는 곳에서 갈등이 태어난다.' },
    { n: 6, u: 2, name: '관료제 골렘', intro: '규정에 없는 일은 처리하지 않는다. 역기능 주의.' },
    { n: 7, u: 3, name: '문화 지체의 시계태엽', intro: '물질 문화가 앞서가면 비물질 문화가 뒤처진다.' },
    { n: 8, u: 3, name: '세계화의 드래곤', intro: '동질화와 토착화의 숨결이 교차한다.' },
    { n: 9, u: 3, name: '문화 상대주의 현자', intro: '우리의 옳음이 남의 옳음인가.' },
    { n: 10, u: 4, name: '사다리 없는 계급', intro: '재생산되는 불평등이 탑을 감싼다.' },
    { n: 11, u: 4, name: '빈곤의 늪지대', intro: '절대적 빈곤과 상대적 빈곤, 늪은 깊다.' },
    { n: 12, u: 4, name: '사회 이동의 문지기', intro: '개인적 요인과 구조적 요인을 저울에 올려라.' },
    { n: 13, u: 5, name: '아노미의 그림자', intro: '규범이 흔들리면 일탈이 어둠 속에서 번진다.' },
    { n: 14, u: 5, name: '매스컴의 폭풍', intro: '의제 설정과 총효과 이론, 바람의 방향을 읽어라.' },
    { n: 15, u: 5, name: '미래 사회의 예언자', intro: '탈산업화와 지속 가능한 발전을 말한다.' },
    { n: 16, u: 0, name: '수능의 대군주', intro: '탑의 정점. 5개 단원의 모든 개념이 하나로 군림한다.' },
  ];

  var UNIT_COLORS = { 1: '#2456e6', 2: '#0d8f6e', 3: '#e08a00', 4: '#7a39bb', 5: '#c2456b', 0: '#1f2733' };

  /* ─── 유물 (층별 첫 클리어 보상) ─── */
  var ARTIFACTS = [
    { floor: 1, name: '가설의 파편', desc: '치명타 피해 +15%', mods: { critDmg: 0.15 } },
    { floor: 2, name: '자료의 렌즈', desc: '골드 획득 +10%', mods: { goldPct: 0.10 } },
    { floor: 3, name: '방법론의 노트', desc: '경험치 획득 +10%', mods: { xpPct: 0.10 } },
    { floor: 4, name: '지위의 문장', desc: '공격력 +5%', mods: { atkPct: 0.05 } },
    { floor: 5, name: '역할의 팔찌', desc: '치명타 확률 +3%', mods: { crit: 0.03 } },
    { floor: 6, name: '관료제의 인장', desc: '받는 피해 -5%', mods: { dmgTaken: 0.05 } },
    { floor: 7, name: '시계태엽', desc: '공격력 +5%', mods: { atkPct: 0.05 } },
    { floor: 8, name: '세계화의 동전', desc: '골드 획득 +15%', mods: { goldPct: 0.15 } },
    { floor: 9, name: '현자의 서고', desc: '경험치 획득 +15%', mods: { xpPct: 0.15 } },
    { floor: 10, name: '사다리 조각', desc: '공격력 +8%', mods: { atkPct: 0.08 } },
    { floor: 11, name: '늪의 촛불', desc: '최대 체력 +10%', mods: { hpPct: 0.10 } },
    { floor: 12, name: '문지기의 열쇠', desc: '치명타 확률 +5%', mods: { crit: 0.05 } },
    { floor: 13, name: '질서의 사슬', desc: '받는 피해 -8%', mods: { dmgTaken: 0.08 } },
    { floor: 14, name: '매스컴 안테나', desc: '골드 획득 +20%', mods: { goldPct: 0.20 } },
    { floor: 15, name: '예언서', desc: '공격력 +10%', mods: { atkPct: 0.10 } },
    { floor: 16, name: '수능의 왕관', desc: '공격력·체력 +10%, 치명타 확률 +5%', mods: { atkPct: 0.10, hpPct: 0.10, crit: 0.05 } },
  ];

  /* ─── 스킬 (레벨 달성 시 해금, 전투 중 자동 발동) ─── */
  var SKILLS = [
    { id: 'concept', name: '개념 폭격', lv: 3, desc: '공격 시 18% 확률로 핵심 개념이 관통하여 2.2배 피해' },
    { id: 'review', name: '오답 복습', lv: 5, desc: '공격 시 12% 확률로 실수를 되짚어 체력 6% 회복' },
    { id: 'combo', name: '집중 연계', lv: 8, desc: '4번째 공격마다 추가 타격 (60% 피해)' },
    { id: 'resolve', name: '만점의 각오', lv: 12, desc: '체력 30% 이하일 때 공격력 40% 증가' },
  ];

  /* ─── 상태 ─── */
  var G = null;
  var battle = null;
  var chance = null;
  var viewEl = null;
  var timers = { battle: null, countdown: null };
  var logs = [];

  function defaultState() {
    return {
      lv: 1, xp: 0, gold: 0,
      atkUp: 0, hpUp: 0,
      floor: 1, cleared: 0,
      artifacts: {},
      totalCorrect: 0, totalWrong: 0, bestCombo: 0, combo: 0,
      studyCount: 0, examCount: 0,
      feed: [],
      asked: {},
    };
  }
  function load() {
    G = window.Store ? window.Store.getJSON(SAVE_KEY, null) : null;
    if (!G || typeof G.lv !== 'number') {
      /* v1 저장값 마이그레이션 */
      var old = window.Store ? window.Store.getJSON('socmul_game_v1', null) : null;
      G = defaultState();
      if (old && typeof old.lv === 'number') {
        G.lv = old.lv; G.xp = old.xp || 0; G.gold = old.gold || 0;
        G.atkUp = old.atkUp || 0; G.hpUp = old.hpUp || 0;
        G.floor = old.floor || 1; G.cleared = old.cleared || 0;
        G.totalCorrect = old.totalCorrect || 0; G.totalWrong = old.totalWrong || 0;
        G.bestCombo = old.bestCombo || 0;
      }
    }
    if (!G.artifacts) G.artifacts = {};
    if (!G.feed) G.feed = [];
  }
  function save() { if (window.Store) window.Store.setJSON(SAVE_KEY, G); }

  /* ─── 유물 효과 합산 ─── */
  function mods() {
    var m = { atkPct: 0, hpPct: 0, crit: 0, critDmg: 0, dmgTaken: 0, goldPct: 0, xpPct: 0 };
    ARTIFACTS.forEach(function (a) {
      if (G.artifacts[a.floor]) {
        Object.keys(a.mods).forEach(function (k) { m[k] += a.mods[k]; });
      }
    });
    return m;
  }
  function maxHp() { return Math.round((100 + (G.lv - 1) * 15 + G.hpUp * 30) * (1 + mods().hpPct)); }
  function atk() { return Math.round((10 + (G.lv - 1) * 2 + G.atkUp * 3 + Math.floor(G.totalCorrect * 0.15)) * (1 + mods().atkPct)); }
  function critChance() { return Math.min(0.5, 0.10 + mods().crit); }
  function xpNeed(lv) { return Math.round(40 * Math.pow(lv, 1.5)); }
  function atkCost() { return 40 + G.atkUp * 25; }
  function hpCost() { return 40 + G.hpUp * 25; }
  function bossHp(f) { return Math.round(170 * Math.pow(1.17, f - 1) * (f === 16 ? 1.15 : 1)); }
  function bossAtk(f) { return Math.round(6.5 * Math.pow(1.10, f - 1) * (f === 16 ? 1.15 : 1)); }
  function unitName(u) {
    if (u === 0) return '종합';
    try { var x = UNITS.filter(function (y) { return y.id === u; })[0]; return x ? x.name : ''; } catch (e) { return ''; }
  }
  function hasSkill(id) {
    var s = SKILLS.filter(function (x) { return x.id === id; })[0];
    return s && G.lv >= s.lv;
  }

  /* ─── 문제 풀 (전투 중 퀴즈 찬스용) ─── */
  var POOL = [];
  function buildPool() {
    POOL = [];
    try {
      QUESTIONS.forEach(function (q) {
        POOL.push({ key: 'c' + q.id, u: q.u, q: q.q, c: q.c, a: q.a, e: q.e, src: '개념' });
      });
    } catch (e) {}
    try {
      PREDICT_EXAMS.forEach(function (ex) {
        ex.questions.forEach(function (q, i) {
          POOL.push({ key: 'p' + ex.id + '_' + i, u: q.u, q: q.q, c: q.c, a: q.a, e: q.e, src: '예상' });
        });
      });
    } catch (e) {}
  }
  function pickQuestion() {
    if (!POOL.length) buildPool();
    if (!POOL.length) return null;
    var fresh = POOL.filter(function (q) { return !G.asked[q.key]; });
    var arr = fresh.length ? fresh : POOL;
    if (!fresh.length) G.asked = {};
    var q = arr[Math.floor(Math.random() * arr.length)];
    G.asked[q.key] = 1;
    return q;
  }

  /* ─── 학습 성과 연동 (외부 모드에서 호출) ─── */
  function reportStudy(o) {
    load();
    var m = mods();
    var xpGain, goldGain, msg;
    if (o.correct) {
      G.combo++; G.totalCorrect++;
      if (G.combo > G.bestCombo) G.bestCombo = G.combo;
      xpGain = Math.round((15 + 2 * Math.min(G.combo, 15)) * (1 + m.xpPct));
      goldGain = Math.round((10 + Math.min(G.combo, 10)) * (1 + m.goldPct));
      msg = o.source + ' 정답' + (G.combo > 1 ? ' (연속 x' + G.combo + ')' : '') + ' — 경험치 +' + xpGain + ' · 골드 +' + goldGain;
    } else {
      G.combo = 0; G.totalWrong++;
      xpGain = Math.round(4 * (1 + m.xpPct));
      goldGain = Math.round(2 * (1 + m.goldPct));
      msg = o.source + ' 오답 — 경험치 +' + xpGain + ' · 골드 +' + goldGain;
    }
    G.studyCount++;
    G.xp += xpGain; G.gold += goldGain;
    G.feed.unshift({ msg: msg, at: Date.now() });
    if (G.feed.length > 8) G.feed.length = 8;
    var ups = levelCheck();
    save();
    refreshIfIdle();
    return { xp: xpGain, gold: goldGain, levelUp: ups };
  }
  function reportExam(o) {
    load();
    var m = mods();
    var ratio = o.max ? o.score / o.max : 0;
    var bonus = ratio >= 0.9 ? 100 : ratio >= 0.8 ? 60 : ratio >= 0.7 ? 30 : 0;
    var xpGain = Math.round(o.score * 2 * (1 + m.xpPct));
    var goldGain = Math.round((o.score + bonus) * (1 + m.goldPct));
    G.totalCorrect += o.correct;
    G.examCount++;
    G.xp += xpGain; G.gold += goldGain;
    var msg = o.label + ' ' + o.score + '점 — 경험치 +' + xpGain + ' · 골드 +' + goldGain + (bonus ? ' (고득점 보너스 포함)' : '');
    G.feed.unshift({ msg: msg, at: Date.now() });
    if (G.feed.length > 8) G.feed.length = 8;
    var ups = levelCheck();
    save();
    refreshIfIdle();
    return { xp: xpGain, gold: goldGain, levelUp: ups };
  }
  function levelCheck() {
    var ups = 0;
    while (G.xp >= xpNeed(G.lv)) {
      G.xp -= xpNeed(G.lv);
      G.lv++; ups++;
      addLog('탐구생이 Lv.' + G.lv + '에 도달했습니다! 공격력 +2 · 최대 체력 +15');
    }
    return ups;
  }
  function refreshIfIdle() {
    /* 게임 화면이 열려 있고 전투 중이 아니면 사이드 패널만 갱신 */
    if (viewEl && !battle && !viewEl.hidden) renderSide();
  }

  /* ─── 유틸 ─── */
  function esc(s) {
    return String(s).replace(/&/g, '&' + 'amp;').replace(/</g, '&' + 'lt;').replace(/>/g, '&' + 'gt;').replace(/"/g, '&' + 'quot;');
  }
  /* 받침 여부에 따라 조사 선택 (가설과 / 정령이 / 마술사를) */
  function josa(word, type) {
    var jong = (word.charCodeAt(word.length - 1) - 0xAC00) % 28;
    if (type === 'wa') return jong ? '과' : '와';
    if (type === 'iga') return jong ? '이' : '가';
    return jong ? '을' : '를';
  }

  function stopAll() {
    if (timers.battle) { clearInterval(timers.battle); timers.battle = null; }
    if (timers.countdown) { clearInterval(timers.countdown); timers.countdown = null; }
    battle = null; chance = null;
  }

  /* ─── 메인 렌더 ─── */
  function render(view, keepBattle) {
    if (!keepBattle) stopAll();
    viewEl = view;
    load();
    if (!POOL.length) buildPool();

    var f = FLOORS[G.floor - 1];
    var nextArt = ARTIFACTS[G.floor - 1];

    var html = '<div class="game-head">' +
      '<div class="game-title"><h1>지식의 탑</h1>' +
      '<p>문제 풀기와 실전 모의고사에서 얻은 성과가 그대로 탐구생의 성장이 됩니다. 자동 전투로 16층 탑의 정상에 오르세요.</p></div>' +
      '<div class="game-floor-badge"><b>' + G.floor + '층</b><span>' + esc(f.name) + '</span></div></div>';

    html += '<div class="tower-track">' + FLOORS.map(function (fl) {
      var state = fl.n < G.floor || (G.cleared >= fl.n) ? 'done' : (fl.n === G.floor ? 'cur' : 'lock');
      return '<div class="tt-node ' + state + '" title="' + fl.n + '층 ' + esc(fl.name) + '"><span class="tt-glyph">' + esc(fl.name.charAt(0)) + '</span><span class="tt-n">' + fl.n + '층</span></div>';
    }).join('') + '</div>';

    html += '<div class="game-grid">';
    html += renderStage(f, nextArt);
    html += '<div class="game-side" id="gSide"></div>';
    html += '</div>';

    view.innerHTML = html;
    renderSide();
    bind();
    if (battle) updateBars();
  }

  function renderStage(f, nextArt) {
    var inBattle = !!battle && !battle.wonBanner;
    var bossH = inBattle ? battle.bossHp : bossHp(G.floor);
    var bossMax = bossHp(G.floor);
    var myHp = inBattle ? battle.myHp : maxHp();
    var artHint = nextArt && !G.artifacts[G.floor]
      ? '<p class="stage-art-hint">첫 클리어 보상: <b>' + esc(nextArt.name) + '</b> (' + esc(nextArt.desc) + ')</p>'
      : '';

    var html = '<div class="game-stage' + (inBattle ? ' fighting' : '') + '">' +
      '<div class="stage-head"><span class="stage-tag">' + G.floor + '층 · ' + esc(unitName(f.u)) + '</span>' +
      '<span class="stage-name">' + esc(f.name) + '</span>' +
      (inBattle && battle.enraged ? '<span class="enrage-chip">광폭화</span>' : '') + '</div>' +
      '<p class="stage-intro">' + esc(f.intro) + '</p>' +
      artHint +
      '<div class="stage-arena">' +
      '<div class="fighter me"><div class="f-avatar" id="gMeAv" style="background:#2456e6">탐</div>' +
      '<div class="f-info"><span class="f-name">탐구생 <b>Lv.' + G.lv + '</b></span>' +
      '<div class="hpbar"><div class="hp-fill me-fill" id="gMyHp" style="width:' + (myHp / maxHp() * 100) + '%"></div></div>' +
      '<span class="f-hp" id="gMyHpTxt">' + Math.max(0, Math.round(myHp)) + ' / ' + maxHp() + '</span></div></div>' +
      '<div class="vs">VS</div>' +
      '<div class="fighter boss"><div class="f-avatar' + (inBattle && battle.enraged ? ' enraged' : '') + '" id="gBossAv" style="background:' + UNIT_COLORS[f.u] + '">' + esc(f.name.charAt(0)) + '</div>' +
      '<div class="f-info"><span class="f-name">' + esc(f.name) + ' <b>' + G.floor + '층</b></span>' +
      '<div class="hpbar"><div class="hp-fill boss-fill" id="gBossHp" style="width:' + (bossH / bossMax * 100) + '%"></div></div>' +
      '<span class="f-hp" id="gBossHpTxt">' + Math.max(0, Math.round(bossH)) + ' / ' + bossMax + '</span></div></div>' +
      '</div>';

    /* 전투 명령 */
    if (inBattle) {
      html += '<div class="cmd-row">' +
        '<button class="cmd-btn" data-cmd="focus" type="button"' + (battle.cmd.focus <= 0 ? ' disabled' : '') + '>집중 <small>치명타 3연발</small><span class="cmd-n">x' + battle.cmd.focus + '</span></button>' +
        '<button class="cmd-btn" data-cmd="guard" type="button"' + (battle.cmd.guard <= 0 ? ' disabled' : '') + '>방어 <small>다음 피해 70% 감소</small><span class="cmd-n">x' + battle.cmd.guard + '</span></button>' +
        '<button class="cmd-btn" data-cmd="heal" type="button"' + (battle.cmd.heal <= 0 ? ' disabled' : '') + '>응급 <small>체력 35% 회복</small><span class="cmd-n">x' + battle.cmd.heal + '</span></button>' +
        '</div>';
    }

    html += '<div class="chance-zone" id="gChanceZone"></div>';
    html += '<div class="stage-log" id="gLog">' + (logs.length ? logs.slice(-5).map(function (m) { return '<span class="log-line">' + esc(m) + '</span>'; }).join('') : '<span class="log-dim">아직 전투 기록이 없습니다.</span>') + '</div>';

    /* 승리 배너 */
    if (battle && battle.wonBanner) {
      html += battle.wonBanner;
    }

    html += '<div class="stage-ctrl">' +
      (inBattle
        ? '<button class="btn btn-ghost" data-g-speed type="button">속도 x' + battle.speed + '</button>' +
          '<button class="btn btn-ghost" data-g-flee type="button">후퇴</button>'
        : '<button class="btn btn-primary" data-g-fight type="button">전투 개시</button>') +
      '</div></div>';
    return html;
  }

  function renderSide() {
    var side = viewEl.querySelector('#gSide');
    if (!side) return;
    var m = mods();
    var html = '<div class="panel"><h3>탐구생</h3>' +
      '<div class="stat-row"><span>레벨</span><b>Lv.' + G.lv + '</b></div>' +
      '<div class="stat-row"><span>경험치</span><b>' + Math.floor(G.xp) + ' / ' + xpNeed(G.lv) + '</b></div>' +
      '<div class="xpbar"><div class="xp-fill" style="width:' + Math.min(100, G.xp / xpNeed(G.lv) * 100) + '%"></div></div>' +
      '<div class="stat-row"><span>공격력</span><b>' + atk() + '</b></div>' +
      '<div class="stat-row"><span>최대 체력</span><b>' + maxHp() + '</b></div>' +
      '<div class="stat-row"><span>치명타 확률</span><b>' + Math.round(critChance() * 100) + '%</b></div>' +
      '<div class="stat-row"><span>지식 오라</span><b>+' + Math.floor(G.totalCorrect * 0.15) + '</b><span class="stat-note">누적 정답 ' + G.totalCorrect + '개 반영</span></div>' +
      '<div class="stat-row"><span>골드</span><b>' + G.gold + ' G</b></div>' +
      '</div>';

    /* 성장 */
    html += '<div class="panel"><h3>성장</h3>' +
      '<button class="grow-btn" data-g-up="atk" type="button"><span class="gb-main">무기 연마 <b>공격력 +3</b></span><span class="gb-cost">' + atkCost() + ' G</span></button>' +
      '<button class="grow-btn" data-g-up="hp" type="button"><span class="gb-main">각오 단련 <b>최대 체력 +30</b></span><span class="gb-cost">' + hpCost() + ' G</span></button>' +
      '<p class="panel-note">골드는 학습(문제 풀기·모의고사)과 전투 승리로 얻습니다.</p></div>';

    /* 스킬 */
    html += '<div class="panel"><h3>스킬 <span class="panel-sub">레벨 달성 시 자동 해금</span></h3>' +
      SKILLS.map(function (s) {
        var on = hasSkill(s.id);
        return '<div class="skill-row' + (on ? ' on' : '') + '"><span class="sk-name">' + esc(s.name) + '</span><span class="sk-desc">' + (on ? esc(s.desc) : 'Lv.' + s.lv + ' 해금') + '</span></div>';
      }).join('') + '</div>';

    /* 유물 */
    html += '<div class="panel"><h3>유물 <span class="panel-sub">' + Object.keys(G.artifacts).length + ' / ' + ARTIFACTS.length + '</span></h3>';
    if (!Object.keys(G.artifacts).length) {
      html += '<p class="panel-note">층을 처음 클리어하면 유물을 얻습니다. 유물은 영구 능력치를 올려줍니다.</p>';
    } else {
      html += '<div class="art-list">' + ARTIFACTS.filter(function (a) { return G.artifacts[a.floor]; }).map(function (a) {
        return '<div class="art-chip" title="' + esc(a.desc) + '"><b>' + esc(a.name) + '</b><span>' + esc(a.desc) + '</span></div>';
      }).join('') + '</div>';
    }
    html += '</div>';

    /* 학습 성과 */
    html += '<div class="panel"><h3>학습 성과</h3>' +
      '<div class="stat-row"><span>문제 풀이</span><b>' + G.studyCount + '문항</b></div>' +
      '<div class="stat-row"><span>모의고사 응시</span><b>' + G.examCount + '회</b></div>' +
      '<div class="stat-row"><span>최고 연속 정답</span><b>' + G.bestCombo + '</b></div>' +
      (G.feed.length
        ? '<div class="feed">' + G.feed.slice(0, 5).map(function (x) { return '<div class="feed-line">' + esc(x.msg) + '</div>'; }).join('') + '</div>'
        : '<p class="panel-note">문제 풀기·실전 모의고사 탭에서 공부하면 이곳에 성과가 쌓입니다.</p>') +
      '</div>';

    side.innerHTML = html;
    side.querySelectorAll('[data-g-up]').forEach(function (b) {
      b.addEventListener('click', function () { upgrade(b.dataset.gUp); });
    });
  }

  /* ─── 이벤트 ─── */
  function bind() {
    if (!viewEl) return;
    var q = viewEl;
    q.querySelectorAll('[data-g-up]').forEach(function (b) {
      b.addEventListener('click', function () { upgrade(b.dataset.gUp); });
    });
    var fight = q.querySelector('[data-g-fight]');
    if (fight) fight.addEventListener('click', startBattle);
    var speed = q.querySelector('[data-g-speed]');
    if (speed) speed.addEventListener('click', function () {
      battle.speed = battle.speed === 1 ? 2 : battle.speed === 2 ? 3 : 1;
      restartBattleTimer();
      render(viewEl, true);
    });
    var flee = q.querySelector('[data-g-flee]');
    if (flee) flee.addEventListener('click', function () {
      addLog('탐구생이 후퇴했습니다. 다시 도전할 수 있어요.');
      stopAll(); render(viewEl);
    });
    q.querySelectorAll('[data-cmd]').forEach(function (b) {
      b.addEventListener('click', function () { useCmd(b.dataset.cmd); });
    });
    var nextB = q.querySelector('[data-g-nextfloor]');
    if (nextB) nextB.addEventListener('click', function () { render(viewEl); });
  }

  function upgrade(kind) {
    if (battle) return;
    if (kind === 'atk') {
      if (G.gold < atkCost()) return;
      G.gold -= atkCost(); G.atkUp++;
    } else {
      if (G.gold < hpCost()) return;
      G.gold -= hpCost(); G.hpUp++;
    }
    save(); render(viewEl);
  }

  /* ─── 전투 ─── */
  function startBattle() {
    var f = G.floor;
    battle = {
      floor: f, bossHp: bossHp(f), bossMax: bossHp(f), bossAtk: bossAtk(f),
      myHp: maxHp(), myMax: maxHp(),
      tick: 0, atkCount: 0, speed: 1, over: false,
      charging: false, enraged: false,
      focus: 0, guarded: false,
      cmd: { focus: 2, guard: 2, heal: 1 },
    };
    logs = [];
    addLog(FLOORS[f - 1].name + josa(FLOORS[f - 1].name, 'wa') + ' 전투 시작!');
    render(viewEl, true);
    restartBattleTimer();
  }
  function restartBattleTimer() {
    if (timers.battle) clearInterval(timers.battle);
    timers.battle = setInterval(battleTick, TICK_BASE / battle.speed);
  }

  function useCmd(kind) {
    if (!battle || battle.over || chance) return;
    if (kind === 'focus' && battle.cmd.focus > 0) {
      battle.cmd.focus--; battle.focus = 3;
      addLog('집중! 다음 3회 공격이 치명타로 적중합니다.');
    } else if (kind === 'guard' && battle.cmd.guard > 0) {
      battle.cmd.guard--; battle.guarded = true;
      addLog('방어 태세! 다음 보스 공격 피해가 크게 줄어듭니다.');
    } else if (kind === 'heal' && battle.cmd.heal > 0) {
      battle.cmd.heal--;
      var heal = Math.round(battle.myMax * 0.35);
      battle.myHp = Math.min(battle.myMax, battle.myHp + heal);
      addLog('응급 처치! 체력 +' + heal + ' 회복');
    }
    renderCmdRow();
    updateBars();
  }
  function renderCmdRow() {
    var row = viewEl.querySelector('.cmd-row');
    if (!row) return;
    row.innerHTML =
      '<button class="cmd-btn" data-cmd="focus" type="button"' + (battle.cmd.focus <= 0 ? ' disabled' : '') + '>집중 <small>치명타 3연발</small><span class="cmd-n">x' + battle.cmd.focus + '</span></button>' +
      '<button class="cmd-btn" data-cmd="guard" type="button"' + (battle.cmd.guard <= 0 ? ' disabled' : '') + '>방어 <small>다음 피해 70% 감소</small><span class="cmd-n">x' + battle.cmd.guard + '</span></button>' +
      '<button class="cmd-btn" data-cmd="heal" type="button"' + (battle.cmd.heal <= 0 ? ' disabled' : '') + '>응급 <small>체력 35% 회복</small><span class="cmd-n">x' + battle.cmd.heal + '</span></button>';
    row.querySelectorAll('[data-cmd]').forEach(function (b) {
      b.addEventListener('click', function () { useCmd(b.dataset.cmd); });
    });
  }

  function battleTick() {
    if (!battle || battle.over || chance) return;
    battle.tick++;
    var f = battle.floor;
    var bossName = FLOORS[f - 1].name;

    /* 광폭화 체크 */
    if (!battle.enraged && battle.bossHp / battle.bossMax < 0.3) {
      battle.enraged = true;
      addLog(bossName + josa(bossName, 'iga') + ' 광폭화했습니다! 공격력 상승!');
      var av = viewEl.querySelector('#gBossAv');
      if (av) av.classList.add('enraged');
      var chip = viewEl.querySelector('.stage-head');
      if (chip && !chip.querySelector('.enrage-chip')) {
        var c = document.createElement('span');
        c.className = 'enrage-chip';
        c.textContent = '광폭화';
        chip.appendChild(c);
      }
    }

    /* ── 탐구생 공격 ── */
    battle.atkCount++;
    var dmg = atk() * (0.85 + Math.random() * 0.3);
    if (hasSkill('resolve') && battle.myHp / battle.myMax < 0.3) dmg *= 1.4;
    var crit = battle.focus > 0 || Math.random() < critChance();
    if (battle.focus > 0) battle.focus--;
    if (crit) dmg *= 2 + mods().critDmg;
    var skillTxt = '';
    if (hasSkill('concept') && Math.random() < 0.18) { dmg *= 2.2; skillTxt = ' 개념 폭격!'; }
    battle.bossHp -= dmg;
    floatDmg('boss', Math.round(dmg), crit);
    shake('boss');
    addLog('탐구생의 공격! ' + Math.round(dmg) + ' 데미지' + (crit ? ' (치명타!)' : '') + skillTxt);
    if (hasSkill('review') && Math.random() < 0.12) {
      var heal = Math.round(battle.myMax * 0.06);
      battle.myHp = Math.min(battle.myMax, battle.myHp + heal);
      addLog('오답 복습으로 체력 +' + heal + ' 회복');
    }
    if (hasSkill('combo') && battle.atkCount % 4 === 0) {
      var extra = dmg * 0.6;
      battle.bossHp -= extra;
      floatDmg('boss', Math.round(extra), false);
      addLog('집중 연계! 추가 타격 ' + Math.round(extra) + ' 데미지');
    }
    if (battle.bossHp <= 0) { winBattle(); return; }

    /* ── 보스 행동 ── */
    if (battle.charging) {
      battle.charging = false;
      var bdmg = battle.bossAtk * (battle.enraged ? 1.3 : 1) * 2.5;
      var guarded = battle.guarded;
      if (guarded) { bdmg *= 0.3; battle.guarded = false; }
      battle.myHp -= bdmg;
      floatDmg('me', Math.round(bdmg), false);
      shake('me');
      addLog(bossName + '의 강력한 일격! ' + Math.round(bdmg) + ' 데미지' + (guarded ? ' (방어 성공!)' : ''));
      if (battle.myHp <= 0) { loseBattle(); return; }
    } else if (battle.tick % 7 === 0) {
      battle.charging = true;
      addLog(bossName + josa(bossName, 'iga') + ' 힘을 모읍니다... 방어 준비!');
    } else {
      var nd = battle.bossAtk * (battle.enraged ? 1.3 : 1) * (0.85 + Math.random() * 0.3);
      var g2 = battle.guarded;
      if (g2) { nd *= 0.3; battle.guarded = false; }
      battle.myHp -= nd;
      floatDmg('me', Math.round(nd), false);
      shake('me');
      addLog(bossName + '의 반격! ' + Math.round(nd) + ' 데미지' + (g2 ? ' (방어 성공!)' : ''));
      if (battle.myHp <= 0) { loseBattle(); return; }
    }
    updateBars();
    if (battle.tick % CHANCE_EVERY === 0) startChance();
  }

  function winBattle() {
    battle.over = true;
    stopAll();
    var m = mods();
    var goldGain = Math.round((40 + G.floor * 15) * (1 + m.goldPct));
    var xpGain = Math.round((35 + G.floor * 10) * (1 + m.xpPct));
    G.gold += goldGain; G.xp += xpGain;
    if (G.floor > G.cleared) G.cleared = G.floor;
    var artGain = null;
    var art = ARTIFACTS[G.floor - 1];
    if (art && !G.artifacts[G.floor]) { G.artifacts[G.floor] = 1; artGain = art; }
    addLog(FLOORS[G.floor - 1].name + josa(FLOORS[G.floor - 1].name, 'ul') + ' 물리쳤습니다! 골드 +' + goldGain + ' · 경험치 +' + xpGain);

    var banner = '<div class="victory-banner"><b>승리!</b>' +
      '<span>골드 +' + goldGain + ' · 경험치 +' + xpGain + '</span>' +
      (artGain ? '<span class="vb-art">유물 획득: <b>' + esc(artGain.name) + '</b> — ' + esc(artGain.desc) + '</span>' : '') +
      '</div>';

    if (G.floor >= FLOORS.length) {
      addLog('축하합니다! 지식의 탑 정상 정복! 수능의 대군주를 물리쳤습니다.');
    } else {
      G.floor++;
      addLog(G.floor + '층으로 진입합니다.');
      banner += '<button class="btn btn-primary" data-g-nextfloor type="button">다음 층 도전하기</button>';
    }
    levelCheck();
    battle = { wonBanner: banner, speed: 1, floor: G.floor, bossHp: 0, myHp: maxHp() };
    save();
    render(viewEl, true);
    bind();
  }

  function loseBattle() {
    battle.over = true;
    stopAll();
    addLog('탐구생이 ' + G.floor + '층에서 패배했습니다. 학습으로 힘을 키우고 다시 도전하세요.');
    save();
    render(viewEl);
  }

  function updateBars() {
    if (!battle || !battle.bossMax) return;
    var b = viewEl.querySelector('#gBossHp'), bt = viewEl.querySelector('#gBossHpTxt');
    var mEl = viewEl.querySelector('#gMyHp'), mt = viewEl.querySelector('#gMyHpTxt');
    if (b) b.style.width = Math.max(0, battle.bossHp / battle.bossMax * 100) + '%';
    if (bt) bt.textContent = Math.max(0, Math.round(battle.bossHp)) + ' / ' + battle.bossMax;
    if (mEl) mEl.style.width = Math.max(0, battle.myHp / battle.myMax * 100) + '%';
    if (mt) mt.textContent = Math.max(0, Math.round(battle.myHp)) + ' / ' + battle.myMax;
  }

  function shake(who) {
    var host = viewEl.querySelector(who === 'boss' ? '.fighter.boss' : '.fighter.me');
    if (!host) return;
    host.classList.remove('hitshake');
    void host.offsetWidth;
    host.classList.add('hitshake');
  }
  function floatDmg(who, dmg, crit) {
    var host = viewEl.querySelector(who === 'boss' ? '.fighter.boss' : '.fighter.me');
    if (!host) return;
    var el = document.createElement('span');
    el.className = 'dmg-float' + (crit ? ' crit' : '') + (who === 'me' ? ' taken' : '');
    el.textContent = (crit ? '치명 ' : '') + '-' + dmg;
    host.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
  }

  /* ─── 전투 중 퀴즈 찬스 ── */
  function startChance() {
    var q = pickQuestion();
    if (!q) return;
    chance = { q: q, left: CHANCE_SEC };
    renderChance();
    timers.countdown = setInterval(function () {
      if (!chance) return;
      chance.left--;
      var bar = viewEl.querySelector('#gChanceBar');
      if (bar) bar.style.width = (chance.left / CHANCE_SEC * 100) + '%';
      if (chance.left <= 0) resolveChance(-1);
    }, 1000);
  }
  function renderChance() {
    var zone = viewEl.querySelector('#gChanceZone');
    if (!zone || !chance) return;
    zone.innerHTML = '<div class="chance-card">' +
      '<div class="chance-head"><b>퀴즈 찬스!</b> 정답이면 개념 폭격, 오답이면 보스의 추가 공격' +
      '<span class="chance-timer"><span id="gChanceBar" style="width:100%"></span></span></div>' +
      '<p class="chance-q">' + chance.q.q + '</p>' +
      '<div class="chance-choices">' + chance.q.c.map(function (c, i) {
        return '<button type="button" class="qch" data-g-chance="' + i + '"><span>' + ['①', '②', '③', '④', '⑤'][i] + '</span> ' + c + '</button>';
      }).join('') + '</div></div>';
    zone.querySelectorAll('[data-g-chance]').forEach(function (b) {
      b.addEventListener('click', function () { resolveChance(parseInt(b.dataset.gChance, 10)); });
    });
    zone.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function resolveChance(i) {
    if (!chance || !battle) return;
    if (timers.countdown) { clearInterval(timers.countdown); timers.countdown = null; }
    var correct = i === chance.q.a;
    var zone = viewEl.querySelector('#gChanceZone');
    if (zone) {
      zone.querySelectorAll('[data-g-chance]').forEach(function (b) {
        var idx = parseInt(b.dataset.gChance, 10);
        b.disabled = true;
        if (idx === chance.q.a) b.classList.add('correct');
        else if (idx === i) b.classList.add('wrong');
      });
    }
    if (correct) {
      G.totalCorrect++;
      var dmg = atk() * 3;
      battle.bossHp -= dmg;
      floatDmg('boss', Math.round(dmg), true);
      shake('boss');
      addLog('개념 폭격! ' + Math.round(dmg) + ' 데미지!');
      if (battle.bossHp <= 0) { chance = null; save(); winBattle(); return; }
    } else {
      var bdmg = battle.bossAtk * (battle.enraged ? 1.3 : 1) * 1.5;
      var g = battle.guarded;
      if (g) { bdmg *= 0.3; battle.guarded = false; }
      battle.myHp -= bdmg;
      floatDmg('me', Math.round(bdmg), false);
      shake('me');
      addLog('아쉽습니다. ' + FLOORS[G.floor - 1].name + '의 추가 공격! ' + Math.round(bdmg) + ' 데미지' + (g ? ' (방어 성공!)' : ''));
      if (battle.myHp <= 0) { chance = null; save(); loseBattle(); return; }
    }
    chance = null;
    save();
    updateBars();
    setTimeout(function () { if (viewEl) { var z = viewEl.querySelector('#gChanceZone'); if (z) z.innerHTML = ''; } }, 1200);
  }

  /* ─── 로그 ── */
  function addLog(msg) {
    logs.push(msg);
    if (logs.length > 30) logs.shift();
    var el = viewEl ? viewEl.querySelector('#gLog') : null;
    if (el) {
      el.innerHTML = logs.slice(-5).map(function (m) { return '<span class="log-line">' + esc(m) + '</span>'; }).join('');
    }
  }

  window.GameUI = {
    render: render,
    cleanup: stopAll,
    reportStudy: reportStudy,
    reportExam: reportExam,
  };
})();
