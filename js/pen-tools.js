/* 사회문화 연습장 — 공통 스타일러스 필기 엔진
   펜 입력만 필기로 처리하며 손가락 입력은 필기에서 제외합니다. */
(function () {
  'use strict';

  function bind(options) {
    var root = options.root;
    var canvas = options.canvas;
    if (!root || !canvas || !canvas.getContext) return null;

    var mode = options.mode || 'pen';
    var activeStroke = null;
    var activePointerId = null;
    var redoStack = [];
    var toolbar = root;

    function getStrokes() {
      var result = options.getStrokes ? options.getStrokes() : [];
      return Array.isArray(result) ? result : [];
    }

    function save() {
      if (options.save) options.save(getStrokes());
      updateHistoryButtons();
    }

    function pointFromEvent(event) {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return [0, 0];
      return [
        Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
      ];
    }

    function drawStroke(stroke) {
      if (!stroke || !Array.isArray(stroke.p) || !stroke.p.length) return;
      var ctx = canvas.getContext('2d');
      var erasing = stroke.t === 'e';
      ctx.save();
      ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
      ctx.strokeStyle = '#d6336c';
      ctx.fillStyle = '#d6336c';
      ctx.lineWidth = erasing ? Math.max(18, canvas.width / 22) : Math.max(2.5, canvas.width / 420);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.p.length === 1) {
        var only = stroke.p[0];
        ctx.beginPath();
        ctx.arc(only[0] * canvas.width, only[1] * canvas.height, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(stroke.p[0][0] * canvas.width, stroke.p[0][1] * canvas.height);
        for (var i = 1; i < stroke.p.length; i++) {
          ctx.lineTo(stroke.p[i][0] * canvas.width, stroke.p[i][1] * canvas.height);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    function redraw() {
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      getStrokes().forEach(drawStroke);
    }

    function setMode(nextMode) {
      mode = nextMode;
      if (options.onModeChange) options.onModeChange(mode);
      toolbar.querySelectorAll('[data-penmode]').forEach(function (button) {
        var active = button.dataset.penmode === mode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function updateHistoryButtons() {
      var undo = toolbar.querySelector('[data-penundo]');
      var redo = toolbar.querySelector('[data-penredo]');
      if (undo) undo.disabled = getStrokes().length === 0;
      if (redo) redo.disabled = redoStack.length === 0;
    }

    canvas.addEventListener('pointerdown', function (event) {
      /* mouse와 손가락은 그리지 않습니다. 브라우저가 스타일러스를 pen으로 보고해야 합니다. */
      if (mode === 'off' || event.pointerType !== 'pen' || activeStroke) return;
      event.preventDefault();
      activePointerId = event.pointerId;
      activeStroke = {
        t: mode === 'eraser' ? 'e' : 'p',
        p: [pointFromEvent(event)]
      };
      try { canvas.setPointerCapture(event.pointerId); } catch (ignore) {}
    });

    canvas.addEventListener('pointermove', function (event) {
      if (!activeStroke || event.pointerId !== activePointerId) return;
      event.preventDefault();
      var events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
      if (!events.length) events = [event];
      var last = activeStroke.p[activeStroke.p.length - 1];
      events.forEach(function (sample) {
        var next = pointFromEvent(sample);
        activeStroke.p.push(next);
        drawStroke({ t: activeStroke.t, p: [last, next] });
        last = next;
      });
    });

    function finish(event) {
      if (!activeStroke || (event && event.pointerId !== activePointerId)) return;
      var completed = activeStroke;
      activeStroke = null;
      activePointerId = null;
      var strokes = getStrokes();
      strokes.push(completed);
      redoStack = [];
      save();
      if (completed.p.length === 1) redraw();
    }

    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('lostpointercapture', finish);

    toolbar.querySelectorAll('[data-penmode]').forEach(function (button) {
      button.addEventListener('click', function () { setMode(button.dataset.penmode); });
    });

    var undoButton = toolbar.querySelector('[data-penundo]');
    if (undoButton) undoButton.addEventListener('click', function () {
      var strokes = getStrokes();
      if (!strokes.length) return;
      redoStack.push(strokes.pop());
      save();
      redraw();
    });

    var redoButton = toolbar.querySelector('[data-penredo]');
    if (redoButton) redoButton.addEventListener('click', function () {
      if (!redoStack.length) return;
      getStrokes().push(redoStack.pop());
      save();
      redraw();
    });

    var clearButton = toolbar.querySelector('[data-penclear]');
    if (clearButton) clearButton.addEventListener('click', function () {
      if (!getStrokes().length) return;
      if (!window.confirm(options.clearMessage || '이 문항의 필기를 모두 지울까요?')) return;
      getStrokes().length = 0;
      redoStack = [];
      save();
      redraw();
    });

    setMode(mode);
    redraw();
    return { redraw: redraw, setMode: setMode };
  }

  window.PenTools = { bind: bind };
})();
