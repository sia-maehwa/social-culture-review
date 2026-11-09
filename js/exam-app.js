/* 사회문화 연습장 — 실전 모의고사 모드
   기출 15회분 + 수능 예상 모의고사 3회분(자체 제작)
   점수 채점(배점 합산) · 등급컷 · 도표 문항 제외 · 펜 필기 지원 */
(function () {
  'use strict';

  var EXAM_TIME = 30 * 60; /* 수능 사회탐구 30분 */
  var CHOICE_LABELS = ['①', '②', '③', '④', '⑤'];
  var HIST_KEY = 'socmul_exam_hist_v1';
  var NODOYO_KEY = 'socmul_nodopyo_v1';
  var PEN_KEY = 'socmul_pen_v1';
  var PEN_COLOR_KEY = 'socmul_pen_color_v1';
  var DEFAULT_PEN_COLOR = '#d6336c';

  var state = {
    examId: null,
    answers: [],      /* 문항별 선택 (0~4, null=미응답) */
    idx: 0,
    deadline: 0,
    timerId: null,
    submitted: false,
    history: [],      /* { id, score, max, correct, total, at } */
    penMode: 'pen',   /* pen | eraser | off */
    penColor: (window.Store && window.Store.get(PEN_COLOR_KEY)) || DEFAULT_PEN_COLOR,
    strokes: {},      /* { 문항인덱스: [stroke, ...] } */
  };

  /* ─── 데이터 접근 ─── */
  function allExams() {
    var list = (typeof EXAMS !== 'undefined' ? EXAMS : []).slice();
    if (typeof PREDICT_EXAMS !== 'undefined') {
      /* 예상 모의고사 문항의 정답 필드(a)를 기출 형식(ans)으로 맞춤 */
      PREDICT_EXAMS.forEach(function (p) {
        list.push({
          id: p.id, year: p.year, kind: p.kind, label: p.label, sub: p.sub,
          questions: p.questions.map(function (q) {
            return { n: q.n, ans: q.a, pts: q.pts, d: q.d, u: q.u, q: q.q, c: q.c, e: q.e };
          }),
        });
      });
    }
    return list;
  }
  function examById(id) {
    return allExams().filter(function (e) { return e.id === id; })[0] || null;
  }
  function isPredict(e) { return e && e.id.indexOf('predict_') === 0; }
  function imgSrc(examId, n) {
    return 'assets/exams/' + examId + '/q' + (n < 10 ? '0' + n : n) + '.jpg';
  }
  function unitName(u) {
    try {
      var un = UNITS.filter(function (x) { return x.id === u; })[0];
      return un ? un.name : '';
    } catch (err) { return ''; }
  }

  /* ─── 설정/기록 저장 ─── */
  function excludeDopyo() {
    return window.Store ? window.Store.get(NODOYO_KEY) === '1' : false;
  }
  function setExcludeDopyo(v) {
    if (window.Store) window.Store.set(NODOYO_KEY, v ? '1' : '');
  }
  function loadHistory() {
    state.history = window.Store ? window.Store.getJSON(HIST_KEY, []) : [];
    if (!Array.isArray(state.history)) state.history = [];
  }
  function saveHistory() {
    if (window.Store) window.Store.setJSON(HIST_KEY, state.history);
  }
  function bestRecord(id) {
    var best = null;
    state.history.forEach(function (h) {
      if (h.id === id && (best === null || h.score > best.score)) best = h;
    });
    return best;
  }
  function loadPen(examId) {
    var all = window.Store ? window.Store.getJSON(PEN_KEY, {}) : {};
    state.strokes = (all && all[examId]) ? all[examId] : {};
  }
  function savePen() {
    if (!window.Store || !state.examId) return;
    var all = window.Store.getJSON(PEN_KEY, {});
    all[state.examId] = state.strokes;
    window.Store.setJSON(PEN_KEY, all);
  }

  /* ─── 도표 제외 로직 ─── */
  function includedIdx(e) {
    var r = [];
    if (!excludeDopyo()) {
      e.questions.forEach(function (_, i) { r.push(i); });
    } else {
      e.questions.forEach(function (q, i) { if (!q.d) r.push(i); });
    }
    return r;
  }
  function maxScore(e) {
    return includedIdx(e).reduce(function (s, i) { return s + (e.questions[i].pts || 2); }, 0);
  }

  /* ─── 채점 ─── */
  function scoreExam(e) {
    var inc = includedIdx(e);
    var score = 0, correct = 0, blank = 0;
    inc.forEach(function (i) {
      var q = e.questions[i];
      var mine = state.answers[i];
      if (mine === null || mine === undefined) { blank++; return; }
      if (mine === q.ans) { score += (q.pts || 2); correct++; }
    });
    return { score: score, max: maxScore(e), correct: correct, total: inc.length, blank: blank };
  }

  /* ─── 등급컷 ─── */
  function cutsFor(e) {
    if (isPredict(e)) return { cuts: AVG_CUTS, note: '최근 5개년(2022~2026) 15회 평균 등급컷 · 참고용' };
    /* 수능·모의평가 모두 원점수 등급컷은 주요 입시기관 추정치 종합(kicegg 제공). 평가원 공식 발표는 표준점수 기준임 */
    return { cuts: e.cuts, note: '주요 입시기관 원점수 추정 종합(kicegg 제공) · 참고용' };
  }
  function gradeOf(score, cuts) {
    for (var g = 1; g <= 8; g++) {
      if (score >= cuts[String(g)]) return g;
    }
    return 9;
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }
  function stopTimer() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  }

  /* ─── 시험 목록 ─── */
  function renderPicker(view) {
    stopTimer();
    loadHistory();
    var nodopyo = excludeDopyo();

    var html = '<div class="hero exam-hero">' +
      '<span class="hero-kicker">기출 15회분 + 자체 제작 예상 모의고사 3회분</span>' +
      '<h1>실전 모의고사로<br>실제 시험 감각을 익히세요</h1>' +
      '<p>2022~2026학년도 수능·6월·9월 평가원 기출 15회분과, 기출 300문항 분석을 바탕으로 제작한 예상 모의고사 3회분. 제한 시간 30분, 점수 채점(배점 2·3점 합산) 후 예상 등급까지 확인합니다.</p>' +
      '</div>';

    /* 도표 제외 설정 */
    html += '<div class="dopyo-toggle' + (nodopyo ? ' on' : '') + '">' +
      '<div class="dt-text"><b>도표(표·그래프) 문항 제외</b>' +
      '<span>표나 그래프 자료가 포함된 문항을 빼고 응시합니다. 채점 만점은 제외 문항 배점을 뺀 점수가 되고, 등급 추정은 참고용으로 제공됩니다.</span></div>' +
      '<button type="button" class="dt-switch" data-dopyo-toggle role="switch" aria-checked="' + nodopyo + '" aria-label="도표 문항 제외"><span class="dt-knob"></span></button></div>';

    /* 예상 모의고사 */
    if (typeof PREDICT_EXAMS !== 'undefined') {
      html += '<div class="section-head predict-head"><h2>수능 예상 모의고사</h2><span>기출 5개년 분석 기반 자체 제작 · 3회분</span></div>';
      html += '<div class="exam-year-row"><div class="exam-cards predict-cards">';
      PREDICT_EXAMS.forEach(function (e) {
        var best = bestRecord(e.id);
        html += '<button type="button" class="exam-card predict-card" data-start-exam="' + e.id + '">' +
          '<span class="exam-card-kind">자체 제작</span>' +
          '<span class="exam-card-title">' + esc2(e.label.replace('수능 예상 ', '')) + '</span>' +
          '<span class="exam-card-meta">20문항 · 50점 · 30분' +
          (best ? ' · 최고 <b>' + best.score + '점</b>' : '') + '</span>' +
          '<span class="predict-sub">' + esc2(e.sub) + '</span></button>';
      });
      html += '</div></div>';

      /* 분석 노트 */
      html += '<details class="predict-note"><summary>이 예상 문제지는 어떻게 만들었나요? (기출 분석 노트)</summary><div class="pn-body">' +
        '<p>최근 5개년(2022~2026) 평가원 기출 15회, 300문항의 <b>단원별 출제 비중</b>을 분석해 그 분포를 따랐고, 최근 수능에서 반복되는 유형(빈출 개념 조합, 3점 변별력 문항 형식)을 참고해 자체 제작했습니다. 실제 출제 문항과 무관하며 학습용 예상 문제입니다.</p>' +
        '<div class="unit-freq">';
      var freqTotal = 0;
      [1, 2, 3, 4, 5].forEach(function (u) { freqTotal += UNIT_FREQ[u] || 0; });
      [1, 2, 3, 4, 5].forEach(function (u) {
        var n = UNIT_FREQ[u] || 0;
        html += '<div class="uf-row"><span class="uf-name">' + esc2(unitName(u)) + '</span>' +
          '<span class="uf-bar"><span class="uf-fill" style="width:' + Math.round(n / 83 * 100) + '%"></span></span>' +
          '<span class="uf-val">' + n + '문항</span></div>';
      });
      html += '</div></div></details>';
    }

    /* 기출 목록 */
    html += '<div class="section-head" style="margin-top:var(--space-8)"><h2>평가원 기출 5개년</h2><span>총 15회 · 300문항</span></div>';

    var years = [];
    allExams().forEach(function (e) { if (e.year && years.indexOf(e.year) === -1) years.push(e.year); });
    years.sort(function (a, b) { return b - a; });

    years.forEach(function (y) {
      html += '<div class="exam-year-row"><h3 class="exam-year">' + y + '학년도</h3><div class="exam-cards">';
      ['suneung', 'june', 'sept'].forEach(function (kind) {
        var e = EXAMS.filter(function (x) { return x.year === y && x.kind === kind; })[0];
        if (!e) return;
        var best = bestRecord(e.id);
        html += '<button type="button" class="exam-card" data-start-exam="' + e.id + '">' +
          '<span class="exam-card-kind">' + (kind === 'suneung' ? '수능' : kind === 'june' ? '6월 모의평가' : '9월 모의평가') + '</span>' +
          '<span class="exam-card-title">' + esc2(e.label.split('학년도 ')[1] || e.label) + '</span>' +
          '<span class="exam-card-meta">20문항 · 50점' +
          (best !== null ? ' · 최고 <b>' + best.score + '점</b>' : '') + '</span></button>';
      });
      html += '</div></div>';
    });

    html += '<p class="exam-src-note">출제: 한국교육과정평가원 (공공저작물 제56조에 따라 출처를 표시하고 제공합니다)</p>';
    if (window.Store && !window.Store.persistent) {
      html += '<p class="exam-src-note">이 브라우저에서는 기록 저장이 제한되어 페이지를 닫으면 응시 기록이 사라질 수 있습니다.</p>';
    }

    view.innerHTML = html;
    view.querySelectorAll('[data-start-exam]').forEach(function (b) {
      b.addEventListener('click', function () { startExam(b.dataset.startExam); });
    });
    var dt = view.querySelector('[data-dopyo-toggle]');
    if (dt) dt.addEventListener('click', function () {
      setExcludeDopyo(!excludeDopyo());
      renderPicker(view);
    });
  }

  /* ─── 응시 ─── */
  function startExam(examId) {
    var app = window.AppUI;
    state.examId = examId;
    state.answers = new Array(20).fill(null);
    state.idx = 0;
    state.submitted = false;
    state.penMode = 'pen';
    loadPen(examId);
    /* 첫 (포함된) 문항으로 이동 */
    var e = examById(examId);
    var inc = includedIdx(e);
    if (inc.length && inc.indexOf(0) === -1) state.idx = inc[0];
    state.deadline = Date.now() + EXAM_TIME * 1000;
    if (app) app.show('examrun');
    startTimer();
  }

  function startTimer() {
    stopTimer();
    state.timerId = setInterval(tickTimer, 500);
    tickTimer();
  }

  function tickTimer() {
    var el = document.getElementById('examTimer');
    if (!el) return;
    var left = (state.deadline - Date.now()) / 1000;
    if (left <= 0 && !state.submitted) {
      stopTimer();
      el.textContent = '00:00';
      el.classList.add('danger');
      submitExam(true);
      return;
    }
    el.textContent = fmtTime(left);
    el.classList.toggle('warn', left < 300);
  }

  /* ─── 펜 필기 ─── */
  function penBarHtml() {
    var colors = [['#d6336c', '빨강'], ['#2563eb', '파랑'], ['#20252b', '검정'], ['#16a34a', '초록'], ['#9333ea', '보라'], ['#ea580c', '주황']];
    return '<div class="pen-bar" aria-label="필기 도구">' +
      '<span class="pen-bar-label">필기 도구</span>' +
      '<button type="button" class="pen-tool' + (state.penMode === 'pen' ? ' active' : '') + '" data-penmode="pen" aria-pressed="' + (state.penMode === 'pen') + '">펜</button>' +
      '<button type="button" class="pen-tool' + (state.penMode === 'eraser' ? ' active' : '') + '" data-penmode="eraser" aria-pressed="' + (state.penMode === 'eraser') + '">지우개</button>' +
      '<button type="button" class="pen-tool' + (state.penMode === 'off' ? ' active' : '') + '" data-penmode="off" aria-pressed="' + (state.penMode === 'off') + '">필기 끄기</button>' +
      '<span class="pen-palette" role="group" aria-label="펜 색상">' + colors.map(function (item) {
        return '<button type="button" class="pen-color' + (state.penColor === item[0] ? ' active' : '') + '" data-pencolor="' + item[0] + '" aria-label="' + item[1] + '" title="' + item[1] + '" aria-pressed="' + (state.penColor === item[0]) + '"><i style="background:' + item[0] + '"></i></button>';
      }).join('') + '</span>' +
      '<button type="button" class="pen-tool" data-penundo disabled>실행 취소</button>' +
      '<button type="button" class="pen-tool" data-penredo disabled>다시 실행</button>' +
      '<button type="button" class="pen-tool" data-penclear>전체 지우기</button>' +
      '<span class="pen-input-hint">펜: 필기 · 손가락: 화면 드래그</span>' +
      '</div>';
  }

  function bindPen(view, qIdx) {
    if (!window.PenTools) return null;
    var tools = window.PenTools.bind({
      root: view,
      mode: state.penMode,
      color: state.penColor,
      getStrokes: function () { return state.strokes[qIdx] || (state.strokes[qIdx] = []); },
      save: savePen,
      onModeChange: function (mode) { state.penMode = mode; },
      onColorChange: function (color) { state.penColor = color; if (window.Store) window.Store.set(PEN_COLOR_KEY, color); },
      clearMessage: '이 문항의 필기를 모두 지울까요?'
    });
    if (tools) view._penToolsCleanup = tools.destroy;
    return tools;
  }

  function renderRun(view) {
    var e = examById(state.examId);
    if (!e) { if (window.AppUI) window.AppUI.show('exam'); return; }
    var inc = includedIdx(e);
    var pos = inc.indexOf(state.idx);
    if (pos === -1) pos = 0;
    var n = state.idx + 1;
    var predict = isPredict(e);
    var q = e.questions[state.idx];

    var html = '<div class="exam-run-top">' +
      '<div class="exam-run-info"><span class="quiz-tag exam-tag">' + esc2(e.label) + '</span>' +
      '<span class="exam-run-q">' + (pos + 1) + ' / ' + inc.length + '</span></div>' +
      '<div class="exam-run-right"><span class="exam-timer" id="examTimer">30:00</span>' +
      '<button class="quiz-exit" data-exit-exam type="button">✕ 나가기</button></div></div>';

    html += '<div class="exam-progress"><div class="progress-track"><div class="progress-fill" style="width:' + ((pos + 1) / inc.length * 100) + '%"></div></div></div>';

    html += penBarHtml();

    if (predict) {
      /* 텍스트 문항 (예상 모의고사) */
      html += '<div class="exam-qcard predict-card2">' +
        '<div class="pq-head"><span class="pq-num">' + q.n + '번</span>' +
        '<span class="pq-badje">' + (q.pts || 2) + '점</span>' +
        (q.d ? '<span class="pq-badje dopyo">도표</span>' : '') + '</div>' +
        '<div class="pq-q">' + q.q + '</div>' +
        '<div class="pq-choices" role="group" aria-label="답안 선택">' +
        q.c.map(function (c, i) {
          var marked = state.answers[state.idx] === i;
          return '<button type="button" class="pq-choice' + (marked ? ' marked' : '') + '" data-omr="' + i + '" aria-pressed="' + marked + '">' +
            '<span class="pq-clab">' + CHOICE_LABELS[i] + '</span><span class="pq-ctext">' + c + '</span></button>';
        }).join('') + '</div>' +
        '</div>';
    } else {
      /* 이미지 문항 (기출) */
      html += '<div class="exam-qcard">' +
        '<div class="exam-qwrap">' +
        '<img class="exam-qimg" id="examQImg" src="' + imgSrc(e.id, n) + '" alt="' + esc2(e.label) + ' ' + n + '번 문항" loading="eager" />' +
        '</div>' +
        '<div class="omr" role="group" aria-label="답안 선택">' +
        CHOICE_LABELS.map(function (c, i) {
          var marked = state.answers[state.idx] === i;
          return '<button type="button" class="omr-btn' + (marked ? ' marked' : '') + '" data-omr="' + i + '" aria-pressed="' + marked + '">' +
            '<span class="omr-num">' + c + '</span><span class="omr-state">' + (marked ? '선택됨' : '') + '</span></button>';
        }).join('') + '</div></div>';
    }

    var lastQ = inc[inc.length - 1] === state.idx;
    html += '<div class="exam-run-nav">' +
      '<button class="btn btn-ghost" data-exam-prev type="button"' + (pos === 0 ? ' disabled' : '') + '>← 이전</button>' +
      '<div class="omr-grid" aria-label="문항 이동">' +
      e.questions.map(function (qq, i) {
        var excluded = inc.indexOf(i) === -1;
        var cur = i === state.idx;
        var done = !excluded && state.answers[i] !== null && state.answers[i] !== undefined;
        return '<button type="button" class="omr-cell' + (cur ? ' cur' : '') + (done ? ' done' : '') + (excluded ? ' excl' : '') + '"' +
          (excluded ? ' disabled title="도표 문항 제외됨"' : ' data-goto="' + i + '"') + '>' + (i + 1) + '</button>';
      }).join('') + '</div>' +
      (lastQ
        ? '<button class="btn btn-primary" data-exam-submit type="button">시험 종료</button>'
        : '<button class="btn btn-primary" data-exam-next type="button">다음 →</button>') +
      '</div>';

    if (lastQ) {
      var unanswered = inc.filter(function (i) { return state.answers[i] === null || state.answers[i] === undefined; }).length;
      if (unanswered === 0) {
        html += '<p class="exam-submit-hint">모든 문항에 답안을 표기했습니다. 준비되면 시험을 종료하세요.</p>';
      } else {
        html += '<p class="exam-submit-hint warn2">미표기 문항이 ' + unanswered + '개 있습니다. 시험을 종료하면 그대로 채점됩니다.</p>';
      }
    }

    view.innerHTML = html;
    tickTimer();

    /* 답안 선택 */
    view.querySelectorAll('[data-omr]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.answers[state.idx] = parseInt(b.dataset.omr, 10);
        renderRun(view);
      });
    });
    /* 문항 이동 (도표 제외 문항은 건너뜀) */
    var prev = view.querySelector('[data-exam-prev]');
    if (prev && !prev.disabled) prev.addEventListener('click', function () {
      var p = inc.indexOf(state.idx); if (p > 0) { state.idx = inc[p - 1]; renderRun(view); }
    });
    var next = view.querySelector('[data-exam-next]');
    if (next) next.addEventListener('click', function () {
      var p = inc.indexOf(state.idx); if (p < inc.length - 1) { state.idx = inc[p + 1]; renderRun(view); }
    });
    view.querySelectorAll('[data-goto]').forEach(function (b) {
      b.addEventListener('click', function () { state.idx = parseInt(b.dataset.goto, 10); renderRun(view); });
    });
    var submit = view.querySelector('[data-exam-submit]');
    if (submit) submit.addEventListener('click', function () { submitExam(false); });
    var exit = view.querySelector('[data-exit-exam]');
    if (exit) exit.addEventListener('click', function () {
      stopTimer();
      if (window.AppUI) window.AppUI.show('exam');
    });

    /* 현재 문항 화면 전체를 필기 면으로 사용합니다. */
    bindPen(view, state.idx);
  }

  function submitExam(auto) {
    if (state.submitted) return;
    var e = examById(state.examId);
    var inc = includedIdx(e);
    var unanswered = inc.filter(function (i) { return state.answers[i] === null || state.answers[i] === undefined; }).length;
    if (!auto && unanswered > 0) {
      if (!window.confirm(unanswered + '문항이 미표기 상태입니다. 그대로 제출할까요?')) return;
    }
    if (auto) window.alert('제한 시간이 종료되어 자동 제출되었습니다.');
    state.submitted = true;
    stopTimer();
    var r = scoreExam(e);
    /* 학습 게임(지식의 탑) 성장 연동 */
    if (window.GameUI) window.GameUI.reportExam({ score: r.score, max: r.max, correct: r.correct, label: e.label });
    loadHistory();
    state.history.push({ id: state.examId, score: r.score, max: r.max, correct: r.correct, total: r.total, at: Date.now() });
    saveHistory();
    if (window.AppUI) window.AppUI.show('examresult');
  }

  /* ─── 결과 ─── */
  function renderResult(view) {
    var e = examById(state.examId);
    if (!e) { if (window.AppUI) window.AppUI.show('exam'); return; }
    var r = scoreExam(e);
    var pct = r.max > 0 ? Math.round(r.score / r.max * 100) : 0;
    var inc = includedIdx(e);
    var nodopyo = excludeDopyo() && e.questions.some(function (q) { return q.d; });
    var cf = cutsFor(e);

    /* 등급 산출 */
    var gradeScore = r.score;
    var scaledNote = '';
    if (nodopyo && r.max > 0 && r.max !== 50) {
      gradeScore = Math.round(r.score * 50 / r.max * 10) / 10;
      scaledNote = '도표 문항 제외로 환산 점수(' + gradeScore + '점/50점) 기준 추정이므로 참고용입니다.';
    }
    var myGrade = gradeOf(gradeScore, cf.cuts);

    var html = '<div class="result-hero exam-result-hero">' +
      '<div class="result-score">' + r.score + '<small>/' + r.max + '점</small></div>' +
      '<div class="result-msg">' + examResultMsg(pct) + '</div>' +
      '<div class="result-sub">' + esc2(e.label) + ' · 정답 ' + r.correct + '문항 / ' + r.total + '문항' + (r.blank ? ' · 미응답 ' + r.blank + '문항' : '') + '</div>' +
      '<div class="grade-badge">예상 등급 <b>' + myGrade + '등급</b>' + (nodopyo ? ' <span class="grade-note">(참고)</span>' : '') + '</div>' +
      '<div class="result-actions">' +
      '<button class="btn btn-primary" data-exam-again type="button">같은 시험 다시 풀기</button>' +
      '<button class="btn btn-ghost" data-exam-list type="button">시험지 목록으로</button>' +
      '</div></div>';

    /* 등급컷 표 */
    html += '<div class="q-card cut-card"><h3 class="cut-title">원점수 등급컷</h3>' +
      (scaledNote ? '<p class="cut-warn">' + scaledNote + '</p>' : '') +
      '<table class="cut-table"><thead><tr><th>등급</th>';
    for (var g = 1; g <= 8; g++) html += '<th>' + g + '</th>';
    html += '<th>9등급</th></tr></thead><tbody><tr><th>원점수</th>';
    for (g = 1; g <= 8; g++) {
      html += '<td class="' + (myGrade === g ? 'mine' : '') + '">' + cf.cuts[String(g)] + '점 이상</td>';
    }
    html += '<td class="' + (myGrade === 9 ? 'mine' : '') + '">—</td></tr></tbody></table>' +
      '<p class="cut-src">' + cf.note + ' · 내 점수: ' + gradeScore + '점 → <b>' + myGrade + '등급</b></p>' +
      '<p class="cut-src dim">등급컷은 시험마다 난이도에 따라 달라지며, 위 수치는 해당 회차 실제(또는 추정) 값입니다.</p></div>';

    /* 문항별 결과 */
    html += '<div class="q-card"><h3 style="font-size:var(--text-lg);font-weight:800;margin-bottom:var(--space-4)">문항별 결과</h3>' +
      '<table class="result-table"><thead><tr><th>번호</th><th>배점</th><th>내 답안</th><th>정답</th><th>결과</th></tr></thead><tbody>';
    e.questions.forEach(function (q, i) {
      var excluded = inc.indexOf(i) === -1;
      var mine = state.answers[i];
      var ok = !excluded && mine === q.ans;
      if (excluded) {
        html += '<tr class="excl-row"><td>' + (i + 1) + '번</td><td>' + (q.pts || 2) + '점</td>' +
          '<td colspan="2">도표 문항 제외</td><td class="dim2">—</td></tr>';
      } else {
        html += '<tr><td>' + (i + 1) + '번</td><td>' + (q.pts || 2) + '점</td>' +
          '<td>' + (mine === null || mine === undefined ? '<span class="no">미응답</span>' : CHOICE_LABELS[mine]) + '</td>' +
          '<td>' + CHOICE_LABELS[q.ans] + '</td>' +
          '<td class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '정답' : '오답') + '</td></tr>';
      }
    });
    html += '</tbody></table></div>';

    /* 문항별 검토 */
    html += '<div class="section-head" style="margin-top:var(--space-8)"><h2>문항별 검토</h2><span>문항을 눌러 문제와 내 답안을 확인하세요</span></div>';
    html += '<div class="exam-review-list">';
    e.questions.forEach(function (q, i) {
      var excluded = inc.indexOf(i) === -1;
      var mine = state.answers[i];
      var ok = !excluded && mine === q.ans;
      var verdict = excluded ? '제외' : (ok ? '정답' : (mine === null || mine === undefined ? '미응답' : '오답'));
      html += '<details class="exam-review' + (!ok && !excluded ? ' wrong-q' : '') + (excluded ? ' excl-q' : '') + '">' +
        '<summary><span class="er-num">' + (i + 1) + '번</span>' +
        '<span class="er-verdict ' + (ok ? 'ok' : 'no') + (excluded ? ' dim2' : '') + '">' + verdict + '</span>' +
        '<span class="er-ans">' + (excluded ? '도표 문항 제외' : '내 답 ' + (mine === null || mine === undefined ? '—' : CHOICE_LABELS[mine]) + ' · 정답 ' + CHOICE_LABELS[q.ans] + ' · ' + (q.pts || 2) + '점') + '</span></summary>';
      if (isPredict(e)) {
        html += '<div class="er-body">' +
          '<div class="pq-head"><span class="pq-num">' + q.n + '번</span><span class="pq-badje">' + (q.pts || 2) + '점</span>' +
          '<span class="pq-badje unit">' + esc2(unitName(q.u)) + '</span></div>' +
          '<div class="pq-q">' + q.q + '</div>' +
          '<div class="pq-choices review">' + q.c.map(function (c, ci) {
            var cls = ci === q.ans ? 'pq-choice correct' : (ci === mine ? 'pq-choice wrong' : 'pq-choice');
            return '<div class="' + cls + '"><span class="pq-clab">' + CHOICE_LABELS[ci] + '</span><span class="pq-ctext">' + c + '</span></div>';
          }).join('') + '</div>' +
          (q.e ? '<div class="pq-expl"><b>해설</b> ' + q.e + '</div>' : '') +
          '</div>';
      } else {
        html += '<div class="er-body"><img class="exam-qimg" src="' + imgSrc(e.id, q.n) + '" alt="' + (i + 1) + '번 문항" loading="lazy" />' +
          '<p class="er-note">정답: <b>' + CHOICE_LABELS[q.ans] + '</b> (' + (q.pts || 2) + '점)' + (excluded ? ' · 이 회차에서 제외된 문항입니다' : (ok ? '' : ' · 내 답안: ' + (mine === null || mine === undefined ? '미응답' : CHOICE_LABELS[mine]))) + '</p></div>';
      }
      html += '</details>';
    });
    html += '</div>';

    html += '<p class="exam-src-note" style="margin-top:var(--space-6)">' +
      (isPredict(e) ? '예상 모의고사는 기출 분석 기반 자체 제작 문항입니다.' : '출제: 한국교육과정평가원 · ') +
      '복습은 단원별 개념 정리와 오답 노트를 활용해 보세요.</p>';

    view.innerHTML = html;

    view.querySelector('[data-exam-again]').addEventListener('click', function () { startExam(state.examId); });
    view.querySelector('[data-exam-list]').addEventListener('click', function () {
      if (window.AppUI) window.AppUI.show('exam');
    });
  }

  function examResultMsg(pct) {
    if (pct === 100) return '만점입니다. 실전 감각이 완벽해요.';
    if (pct >= 90) return '훌륭합니다. 놓친 배점만 골라 복습해요.';
    if (pct >= 75) return '좋은 성적이에요. 오답 문항의 개념을 짚어보세요.';
    if (pct >= 55) return '무난한 성적이에요. 3점 문항 위주로 다시 풀어보세요.';
    return '기초 개념부터 다잡고 다시 도전해 보세요.';
  }

  function esc2(s) {
    return String(s).replace(/&/g, '&' + 'amp;').replace(/</g, '&' + 'lt;').replace(/>/g, '&' + 'gt;').replace(/"/g, '&' + 'quot;');
  }

  window.ExamUI = {
    renderPicker: renderPicker,
    renderRun: renderRun,
    renderResult: renderResult,
    cleanup: function () {
      stopTimer();
      var runView = document.getElementById('view-examrun');
      if (runView && runView._penToolsCleanup) runView._penToolsCleanup();
    },
  };
})();
