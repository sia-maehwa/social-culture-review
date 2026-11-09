/* 사회문화 연습장 — 퀴즈 앱 로직 */
(function () {
  'use strict';

  var WRONG_KEY = 'socmul_wrong_v1';
  var STATS_KEY = 'socmul_stats_v1';
  var QUIZ_PEN_KEY = 'socmul_quiz_pen_v1';
  var PEN_COLOR_KEY = 'socmul_pen_color_v1';
  var DEFAULT_PEN_COLOR = '#d6336c';
  var SELECTED_SUBJECT_KEY = 'study_selected_subject_v1';
  var LEGACY_SUBJECT_KEY = 'study_active_subject_v1';
  /* 현재 실제 문제 데이터가 준비된 과목만 선택지로 표시합니다. */
  var SUBJECTS = [{
    id: 'social-culture',
    title: '사회·문화',
    curriculum: '2015 개정 교육과정',
    description: '사회·문화 핵심 개념과 평가원 기출을 학습합니다.',
    detail: '5개 단원 · 개념 문제 62문항 · 기출 15회분'
  }];

  var UNIT_COLORS = {
    1: '#2456e6',
    2: '#0d8f6e',
    3: '#e08a00',
    4: '#7a39bb',
    5: '#c2456b',
  };

  /* 저장소: js/storage.js 의 지속 저장소(브라우저에 기록 남음) 사용, 없으면 메모리 폴백 */
  var storage = (function () {
    var S = window.Store;
    if (S) {
      return {
        getItem: function (k) { return S.get(k); },
        setItem: function (k, v) { S.set(k, String(v)); },
        removeItem: function (k) { S.set(k, ''); },
      };
    }
    var mem = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
    };
  })();

  function readJSON(key, fallback) {
    try { return JSON.parse(storage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { storage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function getWrong() { return readJSON(WRONG_KEY, {}); }
  function setWrong(w) { writeJSON(WRONG_KEY, w); }
  function getStats() { return readJSON(STATS_KEY, { byUnit: {}, total: 0, correct: 0 }); }
  function setStats(s) { writeJSON(STATS_KEY, s); }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&' + 'amp;')
      .replace(/</g, '&' + 'lt;')
      .replace(/>/g, '&' + 'gt;')
      .replace(/"/g, '&' + 'quot;');
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function unitName(id) {
    var u = UNITS.filter(function (u) { return u.id === id; })[0];
    return u ? u.name : '';
  }
  function unitById(id) { return UNITS.filter(function (u) { return u.id === id; })[0]; }
  function unitQuestions(u) { return QUESTIONS.filter(function (q) { return q.u === u; }); }
  function questionById(id) { return QUESTIONS.filter(function (q) { return q.id === id; })[0]; }

  var CHOICE_LABELS = ['①', '②', '③', '④', '⑤'];

  /* 스타일러스 hover와 펜 입력 시 브라우저 패닝 억제를 함께 처리합니다. */
  (function bindStylusHover() {
    var activeTarget = null;
    var lockedRoot = null;
    var selector = 'button:not(:disabled), a[href], [role="button"], .unit-card, .exam-card, .choice, .pq-choice, .omr-cell, .ctab, .cmd-btn, .grow-btn';

    function clearHover() {
      if (activeTarget) activeTarget.classList.remove('pen-hover');
      activeTarget = null;
    }
    function lockPenRoot(target) {
      var nextRoot = target && target.closest ? target.closest('.pen-surface-root') : null;
      if (nextRoot === lockedRoot) return;
      if (lockedRoot) lockedRoot.classList.remove('pen-hover-input');
      lockedRoot = nextRoot;
      if (lockedRoot) lockedRoot.classList.add('pen-hover-input');
    }
    function updateHover(target, pointerType) {
      var next = target && target.closest ? target.closest(selector) : null;
      if (next !== activeTarget) {
        clearHover();
        activeTarget = next;
        if (activeTarget) activeTarget.classList.add('pen-hover-target', 'pen-hover');
      }
      /* 일부 Android 펜 드라이버는 hover를 mouse 계열로 보고합니다.
         실제 touch에서 생성된 mouse 이벤트는 위에서 제외했으므로 이 경로도 펜 입력 면을 잠급니다. */
      if (pointerType === 'pen' || pointerType === 'mouse') lockPenRoot(target);
    }
    function hitTest(event) {
      if (typeof document.elementFromPoint === 'function') {
        return document.elementFromPoint(event.clientX, event.clientY) || event.target;
      }
      return event.target;
    }
    function handleMove(event, pointerType) {
      if (event.sourceCapabilities && event.sourceCapabilities.firesTouchEvents) return;
      var type = pointerType || event.pointerType;
      if (type === 'pen' && event.buttons === 0) {
        updateHover(hitTest(event), 'pen');
      } else if (type === 'mouse' && event.buttons === 0) {
        updateHover(hitTest(event), 'mouse');
      } else if (type === 'pen') {
        clearHover();
        lockPenRoot(hitTest(event));
      } else {
        clearHover();
      }
    }

    document.addEventListener('pointerover', function (event) {
      /* 버튼을 누르기 전 대상에 진입하는 순간부터 pen/mouse hover를 적용합니다. */
      if ((event.pointerType === 'pen' || event.pointerType === 'mouse') && event.buttons === 0) {
        updateHover(hitTest(event), event.pointerType);
      }
    }, true);
    document.addEventListener('pointermove', function (event) { handleMove(event); }, true);

    /* 구형/제조사 Android 입력 스택에서 hover를 mousemove로만 노출하는 경우의 보조 경로 */
    document.addEventListener('mousemove', function (event) {
      if (event.sourceCapabilities && event.sourceCapabilities.firesTouchEvents) return;
      handleMove(event, 'mouse');
    }, true);

    document.addEventListener('pointerdown', function (event) {
      clearHover();
      if (event.pointerType === 'pen') lockPenRoot(event.target);
    }, true);
    document.addEventListener('pointerup', function (event) {
      if (event.pointerType === 'pen') {
        var current = hitTest(event);
        if (current && current.closest && current.closest('.pen-surface-root')) lockPenRoot(current);
      }
    }, true);
    document.addEventListener('pointercancel', function (event) {
      if (event.pointerType === 'pen') {
        var current = hitTest(event);
        if (current && current.closest && current.closest('.pen-surface-root')) lockPenRoot(current);
      }
    }, true);
    document.addEventListener('pointerout', function (event) {
      if (event.pointerType === 'pen' && !event.relatedTarget) {
        clearHover();
        lockPenRoot(null);
      }
    }, true);
    window.addEventListener('blur', function () {
      clearHover();
      lockPenRoot(null);
    });
  })();

  function getSelectedSubject() {
    var saved = storage.getItem(SELECTED_SUBJECT_KEY) || storage.getItem(LEGACY_SUBJECT_KEY);
    if (!SUBJECTS.some(function (subject) { return subject.id === saved; })) return null;
    if (storage.getItem(SELECTED_SUBJECT_KEY) !== saved) storage.setItem(SELECTED_SUBJECT_KEY, saved);
    return saved;
  }

  /* ─── 앱 상태 ─── */
  var initialView = getSelectedSubject() ? 'home' : 'subject-select';
  var state = { view: initialView, unit: 0, ids: [], idx: 0, answered: {}, results: [], mode: 'unit', penMode: 'pen', penColor: storage.getItem(PEN_COLOR_KEY) || DEFAULT_PEN_COLOR };

  var el = {
    views: {
      subjectSelect: document.getElementById('view-subject-select'),
      home: document.getElementById('view-home'),
      quiz: document.getElementById('view-quiz'),
      result: document.getElementById('view-result'),
      concepts: document.getElementById('view-concepts'),
      wrong: document.getElementById('view-wrong'),
      exam: document.getElementById('view-exam'),
      examrun: document.getElementById('view-examrun'),
      examresult: document.getElementById('view-examresult'),
      game: document.getElementById('view-game'),
    },
    wrongBadge: document.getElementById('wrongCountBadge'),
  };

  function show(view) {
    if (view !== 'subject-select' && !getSelectedSubject()) view = 'subject-select';
    if (view !== 'quiz' && el.views.quiz && el.views.quiz._penToolsCleanup) el.views.quiz._penToolsCleanup();
    if (window.ExamUI) window.ExamUI.cleanup();
    if (window.GameUI) window.GameUI.cleanup();
    state.view = view;
    Object.keys(el.views).forEach(function (k) {
      el.views[k].hidden = (k !== view && k !== 'subjectSelect');
    });
    if (el.views.subjectSelect) el.views.subjectSelect.hidden = (view !== 'subject-select');
    var navigation = document.querySelector('.gnb');
    if (navigation) navigation.hidden = (view === 'subject-select');
    document.querySelectorAll('.gnb-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.nav === view);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    render();
  }

  /* ─── 첫 진입 과목 선택 ─── */
  function renderSubjectSelect() {
    var selected = getSelectedSubject();
    var html = '<div class="subject-pick-page">' +
      '<span class="hero-kicker">STUDY SUBJECT</span>' +
      '<h1>어떤 과목을 공부할까요?</h1>' +
      '<p class="subject-pick-description">공부할 과목을 선택해 주세요. 선택한 과목은 다음 실행에도 기억합니다.</p>' +
      '<div class="section-head"><h2>과목 선택</h2><span>현재 등록된 과목 ' + SUBJECTS.length + '개</span></div>' +
      '<div class="subject-pick-grid">';

    SUBJECTS.forEach(function (subject) {
      html += '<button type="button" class="subject-pick-button" data-select-subject="' + esc(subject.id) + '">' +
        '<span class="subject-pick-mark" aria-hidden="true">社</span>' +
        '<span class="subject-pick-copy"><strong>' + esc(subject.title) + '</strong>' +
        '<small>' + esc(subject.curriculum) + '</small><span>' + esc(subject.detail) + '</span></span>' +
        '<span class="subject-pick-action">' + (selected === subject.id ? '선택됨' : '선택하기') + ' <span aria-hidden="true">→</span></span>' +
        '</button>';
    });

    html += '</div><p class="subject-pick-footnote">현재 실제 학습 데이터가 준비된 과목만 표시합니다. 다른 과목은 문제와 해설 데이터가 준비되면 이 목록에 추가됩니다.</p></div>';
    el.views.subjectSelect.innerHTML = html;
  }

  function chooseSubject(id) {
    var subject = SUBJECTS.filter(function (item) { return item.id === id; })[0];
    if (!subject) return;
    storage.setItem(SELECTED_SUBJECT_KEY, subject.id);
    show('home');
  }

  /* ─── 홈 ─── */
  function renderHome() {
    var stats = getStats();
    var wrong = getWrong();
    var wrongCount = Object.keys(wrong).length;

    var html = '<div class="hero">' +
      '<span class="hero-kicker">2015 개정 교육과정 · 사회·문화</span>' +
      '<h1>단원을 골라 개념 문제로<br>수능 감각을 연습하세요</h1>' +
      '<p>수능·평가원 기출 출제 경향을 반영해 제작한 개념 문제 ' + QUESTIONS.length + '문항. 틀린 문제는 자동으로 오답 노트에 쌓이고, 단원별 정답률로 취약 단원을 확인할 수 있습니다.</p>' +
      '</div>';

    html += '<a class="exam-banner" href="#" data-nav-exam>' +
      '<span class="eb-badge">실전 모의고사</span>' +
      '<span class="eb-title">평가원 기출 5개년 · 15회분 (수능·6월·9월)</span>' +
      '<span class="eb-cta">응시하기 →</span></a>';

    html += '<div class="stat-strip">' +
      statCard('누적 학습', stats.total + '<small style="font-size:.55em">문항</small>') +
      statCard('전체 정답률', stats.total ? Math.round((stats.correct / stats.total) * 100) + '<small style="font-size:.55em">%</small>' : '—') +
      statCard('오답 노트', wrongCount + '<small style="font-size:.55em">문항</small>', true) +
      '</div>';

    html += '<div class="section-head"><h2>단원 선택</h2><span>2015 개정 교육과정 사회·문화</span></div>';
    html += '<div class="unit-grid">';

    UNITS.forEach(function (u) {
      var qs = unitQuestions(u.id);
      var st = stats.byUnit[u.id] || { total: 0, correct: 0 };
      var acc = st.total ? Math.round((st.correct / st.total) * 100) : null;
      html += '<div class="unit-card" style="--unit-accent:' + UNIT_COLORS[u.id] + '">' +
        '<div class="unit-top"><span class="unit-num">UNIT ' + u.id + '</span>' +
        '<span class="unit-qcount">' + qs.length + '문항</span></div>' +
        '<h3 class="unit-name">' + u.name + '</h3>' +
        '<p class="unit-desc">' + u.desc + '</p>' +
        '<div class="unit-meta">' +
        (acc !== null
          ? '<span class="unit-accuracy">정답률 ' + acc + '%<span class="bar"><i style="width:' + acc + '%"></i></span></span>'
          : '<span class="unit-accuracy">아직 기록 없음</span>') +
        '<div class="unit-actions">' +
        '<button class="btn btn-primary" data-start-unit="' + u.id + '" type="button">단원 학습</button>' +
        '<button class="btn btn-ghost" data-view-concepts="' + u.id + '" type="button">개념 보기</button>' +
        '</div></div></div>';
    });

    html += '</div>';

    el.views.home.innerHTML = html;
    bindHomeEvents();
  }

  function statCard(label, value, danger) {
    return '<div class="stat-card"><span class="stat-label">' + label + '</span>' +
      '<div class="stat-value' + (danger ? ' accent' : '') + '">' + value + '</div></div>';
  }

  function bindHomeEvents() {
    document.querySelectorAll('[data-start-unit]').forEach(function (b) {
      b.addEventListener('click', function () { startQuiz(parseInt(b.dataset.startUnit, 10)); });
    });
    var banner = document.querySelector('[data-nav-exam]');
    if (banner) banner.addEventListener('click', function (e) { e.preventDefault(); show('exam'); });
    document.querySelectorAll('[data-view-concepts]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.conceptUnit = parseInt(b.dataset.viewConcepts, 10);
        show('concepts');
      });
    });
  }

  /* ─── 퀴즈 ─── */
  function startQuiz(unitId, ids) {
    state.mode = 'unit';
    state.unit = unitId;
    if (ids) {
      state.ids = ids.slice();
      state.mode = 'wrong';
    } else {
      state.ids = shuffle(unitQuestions(unitId).map(function (q) { return q.id; }));
    }
    state.idx = 0;
    state.results = [];
    state.answered = {};
    show('quiz');
  }

  function quizPenBarHtml() {
    var colors = [['#d6336c', '빨강'], ['#2563eb', '파랑'], ['#20252b', '검정'], ['#16a34a', '초록'], ['#9333ea', '보라'], ['#ea580c', '주황']];
    return '<div class="pen-bar quiz-pen-bar" aria-label="문제 풀이 필기 도구">' +
      '<span class="pen-bar-label">풀이 필기</span>' +
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

  function bindQuizPen(view, question) {
    if (!window.PenTools) return;
    var all = readJSON(QUIZ_PEN_KEY, {});
    var questionKey = String(question.id);
    var strokes = Array.isArray(all[questionKey]) ? all[questionKey] : [];
    var tools = window.PenTools.bind({
      root: view,
      mode: state.penMode,
      color: state.penColor,
      getStrokes: function () { return strokes; },
      save: function () {
        var latest = readJSON(QUIZ_PEN_KEY, {});
        latest[questionKey] = strokes;
        writeJSON(QUIZ_PEN_KEY, latest);
      },
      onModeChange: function (mode) { state.penMode = mode; },
      onColorChange: function (color) { state.penColor = color; storage.setItem(PEN_COLOR_KEY, color); },
      clearMessage: '이 문제의 필기를 모두 지울까요?'
    });
    if (tools) view._penToolsCleanup = tools.destroy;
  }

  function renderQuiz() {
    if (state.idx >= state.ids.length) { renderResult(); return; }
    var q = questionById(state.ids[state.idx]);
    var stats = getStats();
    var answered = state.answered[q.id] !== undefined;

    var html = '<div class="quiz-topbar"><div class="quiz-info">' +
      '<span class="quiz-tag' + (state.mode === 'wrong' ? ' error-mode' : '') + '">' +
      (state.mode === 'wrong' ? '오답 재도전' : esc(unitName(q.u))) + '</span>' +
      '<span class="quiz-topic">' + esc(q.t) + '</span></div>' +
      '<button class="quiz-exit" data-exit-quiz type="button">✕ 나가기</button></div>';

    html += '<div class="progress-row"><div class="progress-track" role="progressbar" aria-valuenow="' + (state.idx) + '" aria-valuemax="' + state.ids.length + '"><div class="progress-fill" style="width:' + ((state.idx / state.ids.length) * 100) + '%"></div></div>' +
      '<span class="progress-count">' + (state.idx + 1) + ' / ' + state.ids.length + '</span></div>';

    html += quizPenBarHtml();

    html += '<div class="q-card"><div class="q-head">' +
      '<span class="q-num">' + (state.mode === 'wrong' ? '재도전 ' : '') + 'Q' + q.id + '</span>' +
      '<span class="q-diff" title="난이도">' + diffDots(q.d) + '<span class="q-diff-label">' + diffLabel(q.d) + '</span></span></div>';

    html += '<div class="q-text quiz-question-prompt">' + q.q + '</div>';

    html += '<div class="choices" role="group" aria-label="선택지">';
    q.c.forEach(function (c, i) {
      var cls = 'choice';
      if (answered) {
        if (i === q.a) cls += ' correct';
        else if (i === state.answered[q.id]) cls += ' wrong';
        else cls += ' dimmed';
      }
      html += '<button type="button" class="' + cls + '" data-choice="' + i + '"' + (answered ? ' disabled' : '') + '>' +
        '<span class="choice-num">' + CHOICE_LABELS[i] + '</span><span>' + c + '</span></button>';
    });
    html += '</div>';

    if (answered) {
      var correct = state.answered[q.id] === q.a;
      html += '<div class="expl ' + (correct ? 'correct-expl' : 'wrong-expl') + '">' +
        '<div class="expl-head">' + (correct ? '정답 — ' + CHOICE_LABELS[q.a] : '오답 — 정답은 ' + CHOICE_LABELS[q.a]) + '</div>' +
        '<div class="expl-body">' + q.e + '</div></div>';
      html += '<div class="quiz-nav"><button class="btn btn-primary" data-next-q type="button">' +
        (state.idx + 1 === state.ids.length ? '결과 보기' : '다음 문제 →') + '</button></div>';
    }

    html += '</div>';
    el.views.quiz.innerHTML = html;

    el.views.quiz.querySelectorAll('[data-choice]').forEach(function (b) {
      b.addEventListener('click', function () { answer(q.id, parseInt(b.dataset.choice, 10)); });
    });
    var next = el.views.quiz.querySelector('[data-next-q]');
    if (next) next.addEventListener('click', function () { state.idx++; renderQuiz(); });
    var exit = el.views.quiz.querySelector('[data-exit-quiz]');
    if (exit) exit.addEventListener('click', function () { show('home'); });

    bindQuizPen(el.views.quiz, q);
  }

  function diffDots(d) {
    var out = '';
    for (var i = 1; i <= 3; i++) out += '<i class="' + (i <= d ? 'on' : '') + '"></i>';
    return out;
  }
  function diffLabel(d) {
    return d === 1 ? '하' : d === 2 ? '중' : '상';
  }

  function answer(qid, choice) {
    if (state.answered[qid] !== undefined) return;
    var q = questionById(qid);
    state.answered[qid] = choice;
    var correct = choice === q.a;

    var results = state.results;
    results.push({ id: qid, choice: choice, correct: correct });

    var wrong = getWrong();
    if (correct) {
      delete wrong[qid];
    } else {
      wrong[qid] = (wrong[qid] || 0) + 1;
    }
    setWrong(wrong);

    var stats = getStats();
    stats.total += 1;
    if (correct) stats.correct += 1;
    var bu = stats.byUnit[q.u] || { total: 0, correct: 0 };
    bu.total += 1;
    if (correct) bu.correct += 1;
    stats.byUnit[q.u] = bu;
    setStats(stats);

    /* 학습 게임(지식의 탑) 성장 연동 */
    if (window.GameUI) window.GameUI.reportStudy({ correct: correct, unit: q.u, source: '개념 문제' });

    updateWrongBadge();
    renderQuiz();
  }

  /* ─── 결과 ─── */
  function renderResult() {
    el.views.quiz.hidden = true;
    var total = state.results.length;
    var correctCount = state.results.filter(function (r) { return r.correct; }).length;
    var pct = total ? Math.round((correctCount / total) * 100) : 0;

    var html = '<div class="result-hero"><div class="result-score">' + pct + '<small>%</small></div>' +
      '<div class="result-msg">' + resultMsg(pct) + '</div>' +
      '<div class="result-sub">' + correctCount + ' / ' + total + ' 정답 · ' +
      (state.mode === 'wrong' ? '오답 재도전' : unitName(state.unit)) + '</div>' +
      '<div class="result-actions">' +
      (state.mode === 'wrong'
        ? '<button class="btn btn-primary" data-again-wrong type="button">오답 다시 풀기</button>'
        : '<button class="btn btn-primary" data-again type="button">같은 단원 다시 풀기</button>') +
      '<button class="btn btn-ghost" data-gohome type="button">다른 단원 선택</button>' +
      '</div></div>';

    if (state.mode !== 'wrong' && state.results.length) {
      html += '<div class="q-card"><h3 style="font-size:var(--text-lg);font-weight:800;margin-bottom:var(--space-4)">문항별 결과</h3><table class="result-table"><thead><tr><th>번호</th><th>소주제</th><th>내 선택</th><th>정답</th><th>결과</th></tr></thead><tbody>';
      state.results.forEach(function (r) {
        var q = questionById(r.id);
        html += '<tr><td>Q' + r.id + '</td><td>' + esc(q.t) + '</td>' +
          '<td>' + CHOICE_LABELS[r.choice] + '</td><td>' + CHOICE_LABELS[q.a] + '</td>' +
          '<td class="' + (r.correct ? 'ok' : 'no') + '">' + (r.correct ? '정답' : '오답') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    var wrong = getWrong();
    var wrongCount = Object.keys(wrong).length;
    if (wrongCount) {
      html += '<div class="result-actions" style="margin-top:var(--space-6)">' +
        '<button class="btn btn-ghost" data-retry-wrong type="button">오답 노트 다시 풀기 (' + wrongCount + '문항)</button></div>';
    }

    el.views.result.innerHTML = html;
    el.views.result.hidden = false;
    state.view = 'result';

    var againWrong = el.views.result.querySelector('[data-again-wrong]');
    if (againWrong) againWrong.addEventListener('click', function () { startRetryWrong(); });
    var again = el.views.result.querySelector('[data-again]');
    if (again) again.addEventListener('click', function () {
      startQuiz(state.unit);
    });
    el.views.result.querySelector('[data-gohome]').addEventListener('click', function () { show('home'); });
    var retry = el.views.result.querySelector('[data-retry-wrong]');
    if (retry) retry.addEventListener('click', function () { startRetryWrong(); });
  }

  function resultMsg(pct) {
    if (pct === 100) return '완벽합니다. 이 단원은 안심해도 좋아요.';
    if (pct >= 80) return '훌륭해요. 조금만 더 다듬으면 됩니다.';
    if (pct >= 60) return '좋은 시작이에요. 틀린 문제의 해설을 꼼꼼히 확인하세요.';
    return '개념 정리부터 차근차근 다시 살펴보세요.';
  }

  /* ─── 개념 정리 ─── */
  function renderConcepts() {
    var unitId = state.conceptUnit || 1;
    var html = '<div class="section-head"><h2>개념 정리</h2><span>단원별 핵심 개념 한눈에</span></div>';
    html += '<div class="concept-tabs">';
    UNITS.forEach(function (u) {
      html += '<button type="button" class="ctab' + (u.id === unitId ? ' active' : '') + '" data-ctab="' + u.id + '">' + u.id + '. ' + u.name + '</button>';
    });
    html += '</div>';

    html += '<dl class="term-grid">';
    (CONCEPTS[unitId] || []).forEach(function (term) {
      html += '<div class="term-card"><dt>' + term.t + '</dt><dd>' + term.d + '</dd></div>';
    });
    html += '</dl>';

    el.views.concepts.innerHTML = html;
    el.views.concepts.querySelectorAll('[data-ctab]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.conceptUnit = parseInt(b.dataset.ctab, 10);
        renderConcepts();
      });
    });
  }

  /* ─── 오답 노트 ─── */
  function renderWrong() {
    var wrong = getWrong();
    var ids = Object.keys(wrong).map(Number).sort(function (a, b) { return a - b; });

    var html = '<div class="section-head"><h2>오답 노트</h2><span>틀렸거나 자주 틀린 문제가 여기에 쌓입니다</span></div>';

    if (!ids.length) {
      html += '<div class="empty-state"><strong>아직 오답이 없습니다</strong>문제를 풀고 틀리면 이곳에 자동으로 기록됩니다.</div>';
      el.views.wrong.innerHTML = html;
      return;
    }

    html += '<div class="quiz-nav" style="margin:0 0 var(--space-6);justify-content:flex-start">' +
      '<button class="btn btn-primary" data-retry-all type="button">오답 전부 다시 풀기 (' + ids.length + '문항)</button>' +
      '<button class="btn btn-ghost" data-clear-wrong type="button">전체 비우기</button></div>';

    html += '<div class="wrong-list">';
    ids.forEach(function (qid) {
      var q = questionById(qid);
      var tries = wrong[qid];
      html += '<div class="wrong-item"><div class="wrong-item-head">' +
        '<span class="quiz-tag error-mode">' + esc(unitName(q.u)) + '</span>' +
        '<span class="wrong-tries">누적 ' + tries + '회 오답</span></div>' +
        '<div class="wrong-q">' + q.q + '</div>' +
        '<div class="wrong-actions">' +
        '<button class="btn btn-ghost" data-review="' + qid + '" type="button">이 문제만 다시 풀기</button>' +
        '<button class="btn btn-ghost" data-remove="' + qid + '" type="button">목록에서 지우기</button>' +
        '</div></div>';
    });
    html += '</div>';

    el.views.wrong.innerHTML = html;

    el.views.wrong.querySelector('[data-retry-all]').addEventListener('click', function () { startRetryWrong(); });
    el.views.wrong.querySelector('[data-clear-wrong]').addEventListener('click', function () {
      if (window.confirm('오답 노트를 전부 비울까요? 기록은 되돌릴 수 없습니다.')) {
        setWrong({}); updateWrongBadge(); renderWrong();
      }
    });
    el.views.wrong.querySelectorAll('[data-review]').forEach(function (b) {
      b.addEventListener('click', function () { startQuiz(questionById(parseInt(b.dataset.review, 10)).u, [parseInt(b.dataset.review, 10)]); });
    });
    el.views.wrong.querySelectorAll('[data-remove]').forEach(function (b) {
      b.addEventListener('click', function () {
        var w = getWrong();
        delete w[parseInt(b.dataset.remove, 10)];
        setWrong(w); updateWrongBadge(); renderWrong();
      });
    });
  }

  function startRetryWrong() {
    var wrong = getWrong();
    var ids = shuffle(Object.keys(wrong).map(Number));
    if (!ids.length) { show('wrong'); return; }
    startQuiz(questionById(ids[0]).u, ids);
  }

  /* ─── 공통 ─── */
  function updateWrongBadge() {
    var count = Object.keys(getWrong()).length;
    el.wrongBadge.hidden = count === 0;
    el.wrongBadge.textContent = count > 99 ? '99+' : String(count);
  }

  function render() {
    switch (state.view) {
      case 'subject-select': renderSubjectSelect(); break;
      case 'home': renderHome(); break;
      case 'quiz': renderQuiz(); break;
      case 'concepts': renderConcepts(); break;
      case 'wrong': renderWrong(); break;
      case 'exam': if (window.ExamUI) window.ExamUI.renderPicker(el.views.exam); break;
      case 'examrun': if (window.ExamUI) window.ExamUI.renderRun(el.views.examrun); break;
      case 'examresult': if (window.ExamUI) window.ExamUI.renderResult(el.views.examresult); break;
      case 'game': if (window.GameUI) window.GameUI.render(el.views.game); break;
      case 'result': /* renderResult가 이미 렌더링됨 */ break;
    }
    updateWrongBadge();
  }

  /* ─── 이벤트 바인딩 ─── */
  document.querySelectorAll('[data-nav]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      show(b.dataset.nav);
    });
  });

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-select-subject]') : null;
    if (button) chooseSubject(button.dataset.selectSubject);
  });

  /* ─── 모의고사 모듈에 뷰 전달 ─── */
  window.AppUI = { show: show };

  /* ─── 시작 ─── */
  show('home');
})();
