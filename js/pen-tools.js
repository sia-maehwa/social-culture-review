/* 사회문화 연습장 — 스타일러스 입력 엔진 */
(function () {
  'use strict';
  var DEFAULT_COLOR = '#d6336c';

  function bind(options) {
    var root = options.root;
    if (!root || !root.addEventListener || !root.appendChild) return null;
    if (root._penToolsCleanup) root._penToolsCleanup();

    var mode = options.mode || 'pen';
    var color = /^#[0-9a-f]{6}$/i.test(options.color || '') ? options.color : DEFAULT_COLOR;
    var activeStroke = null;
    var activePointerId = null;
    var redoStack = [];
    var ratio = 1;
    var logicalWidth = 0;
    var resizeObserver = null;
    var canvas = document.createElement('canvas');
    canvas.className = 'pen-surface-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    root.classList.add('pen-surface-root');
    root.appendChild(canvas);

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
      return [event.clientX - rect.left, event.clientY - rect.top];
    }
    function strokePoint(stroke, point) {
      if (stroke.u === 1) {
        var savedWidth = Number(stroke.w) || logicalWidth || 1;
        return [point[0] * logicalWidth / savedWidth * ratio, point[1] * ratio];
      }
      return [point[0] * canvas.width, point[1] * canvas.height];
    }
    function drawStroke(stroke) {
      if (!stroke || !Array.isArray(stroke.p) || !stroke.p.length) return;
      var ctx = canvas.getContext('2d');
      var erasing = stroke.t === 'e';
      var strokeColor = stroke.c || DEFAULT_COLOR;
      ctx.save();
      ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = strokeColor;
      ctx.lineWidth = erasing ? Math.max(26 * ratio, canvas.width / 38) : Math.max(2.8 * ratio, canvas.width / 480);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      var first = strokePoint(stroke, stroke.p[0]);
      if (stroke.p.length === 1) {
        ctx.beginPath();
        ctx.arc(first[0], first[1], ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(first[0], first[1]);
        for (var i = 1; i < stroke.p.length; i++) {
          var nextPoint = strokePoint(stroke, stroke.p[i]);
          ctx.lineTo(nextPoint[0], nextPoint[1]);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    function drawDot(stroke, point) {
      var ctx = canvas.getContext('2d');
      var erasing = stroke.t === 'e';
      ctx.save();
      ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
      ctx.fillStyle = stroke.c || DEFAULT_COLOR;
      ctx.beginPath();
      var p = strokePoint(stroke, point);
      var width = erasing ? Math.max(26 * ratio, canvas.width / 38) : Math.max(2.8 * ratio, canvas.width / 480);
      ctx.arc(p[0], p[1], width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    function drawSegments(stroke, fromPoint, points) {
      if (!points || !points.length) return;
      var ctx = canvas.getContext('2d');
      var erasing = stroke.t === 'e';
      ctx.save();
      ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
      ctx.strokeStyle = stroke.c || DEFAULT_COLOR;
      ctx.lineWidth = erasing ? Math.max(26 * ratio, canvas.width / 38) : Math.max(2.8 * ratio, canvas.width / 480);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      var start = strokePoint(stroke, fromPoint);
      ctx.beginPath();
      ctx.moveTo(start[0], start[1]);
      for (var i = 0; i < points.length; i++) {
        var point = strokePoint(stroke, points[i]);
        ctx.lineTo(point[0], point[1]);
      }
      ctx.stroke();
      ctx.restore();
    }
    /* 전체 재생은 초기 표시, 크기 변경, 실행 취소/다시 실행/전체 지우기 때만 사용합니다.
       펜 이동 중에는 이 함수를 호출하지 않습니다. */
    function redraw() {
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      getStrokes().forEach(drawStroke);
      if (activeStroke) drawStroke(activeStroke);
    }
    function resize() {
      var rect = root.getBoundingClientRect();
      logicalWidth = Math.max(1, root.clientWidth || rect.width);
      var logicalHeight = Math.max(1, root.scrollHeight || rect.height);
      ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      var width = Math.max(1, Math.round(logicalWidth * ratio));
      var height = Math.max(1, Math.round(logicalHeight * ratio));
      canvas.style.width = logicalWidth + 'px';
      canvas.style.height = logicalHeight + 'px';
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        redraw();
      }
    }
    function updateHistoryButtons() {
      var undo = root.querySelector('[data-penundo]');
      var redo = root.querySelector('[data-penredo]');
      if (undo) undo.disabled = getStrokes().length === 0;
      if (redo) redo.disabled = redoStack.length === 0;
    }
    function setMode(nextMode) {
      mode = nextMode;
      if (options.onModeChange) options.onModeChange(mode);
      root.querySelectorAll('[data-penmode]').forEach(function (button) {
        var active = button.dataset.penmode === mode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
    function setColor(nextColor) {
      if (!/^#[0-9a-f]{6}$/i.test(nextColor || '')) return;
      color = nextColor;
      if (options.onColorChange) options.onColorChange(color);
      root.querySelectorAll('[data-pencolor]').forEach(function (button) {
        var active = button.dataset.pencolor.toLowerCase() === color.toLowerCase();
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
    function isControlTarget(target) {
      if (!target || !target.closest) return false;
      return !!target.closest('button, a, input, textarea, select, summary, [role="button"], .pen-bar, [data-no-pen]');
    }
    function lastPoint() {
      if (!activeStroke || !activeStroke.p.length) return null;
      return activeStroke.p[activeStroke.p.length - 1];
    }
    function appendPoint(sample) {
      if (!activeStroke || !Number.isFinite(sample.clientX) || !Number.isFinite(sample.clientY)) return false;
      var point = pointFromEvent(sample);
      var previous = lastPoint();
      /* Android 일부 펌웨어는 event.timeStamp 정밀도가 낮거나 샘플 간 시간이 겹칩니다.
         시간값으로 획을 버리지 않고 실제 좌표 중복만 제거합니다. */
      if (previous && Math.abs(previous[0] - point[0]) < 0.25 && Math.abs(previous[1] - point[1]) < 0.25) return false;
      activeStroke.p.push(point);
      return true;
    }
    function appendSamples(event) {
      if (!activeStroke) return;
      var samples = [];
      if (typeof event.getCoalescedEvents === 'function') {
        try { samples = event.getCoalescedEvents() || []; } catch (ignore) { samples = []; }
      }
      /* coalesced 샘플과 현재 좌표 중 새로 추가된 점만 모읍니다. */
      var previous = lastPoint();
      var added = [];
      for (var i = 0; i < samples.length; i++) {
        if (appendPoint(samples[i])) added.push(lastPoint());
      }
      /* 마지막 좌표도 포함합니다. */
      if (appendPoint(event)) added.push(lastPoint());
      if (!added.length) return;
      if (previous) drawSegments(activeStroke, previous, added);
      else drawDot(activeStroke, added[0]);
    }
    function isInsideRoot(target) {
      return !!(target && (target === root || (root.contains && root.contains(target))));
    }

    function onPointerDown(event) {
      if (event.pointerType !== 'pen' || mode === 'off' || activeStroke) return;
      if (!isInsideRoot(event.target) || isControlTarget(event.target)) return;

      activePointerId = event.pointerId;
      activeStroke = {
        t: mode === 'eraser' ? 'e' : 'p',
        c: color,
        u: 1,
        w: logicalWidth,
        p: [pointFromEvent(event)]
      };
      root.classList.add('pen-input-active');
      try { root.setPointerCapture(event.pointerId); } catch (ignore) {}
      drawDot(activeStroke, activeStroke.p[0]);
      /* pointerdown은 취소하지 않습니다. 일부 Android Chrome이 생성하는 보조 mousemove
         이벤트도 아래 fallback 입력 경로에서 사용할 수 있게 둡니다. */
    }
    function onPointerMove(event) {
      if (!activeStroke || event.pointerId !== activePointerId) return;
      /* 한 가지 표준 스트림만 사용합니다. getCoalescedEvents()가 프레임 사이의
         실제 펜 좌표를 묶어서 제공하므로 별도 이동 이벤트와 섞지 않습니다. */
      appendSamples(event);
    }
    function finish(event) {
      if (!activeStroke || (event && event.pointerId !== activePointerId)) return;
      if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) appendSamples(event);
      var completed = activeStroke;
      activeStroke = null;
      activePointerId = null;

      root.classList.remove('pen-input-active');
      getStrokes().push(completed);
      redoStack = [];
      /* 캔버스에는 획이 이미 증분 렌더링되어 있으므로 전체 redraw 없이 저장만 합니다. */
      save();
    }
    function cancel(event) {
      if (!activeStroke || (event && event.pointerId !== activePointerId)) return;
      /* 브라우저의 pointercancel/pointer capture 해제도 마지막으로 수신한 부분 획은 저장합니다. */
      var interrupted = activeStroke;
      activeStroke = null;
      activePointerId = null;

      root.classList.remove('pen-input-active');
      if (interrupted.p.length) {
        getStrokes().push(interrupted);
        redoStack = [];
        save();
      }
      /* 부분 획도 입력 중 캔버스에 이미 그려졌으므로 전체 재생은 필요하지 않습니다. */
    }

    var capture = { capture: true, passive: false };
    document.addEventListener('pointerdown', onPointerDown, capture);
    document.addEventListener('pointermove', onPointerMove, capture);
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', cancel, true);
    /* lostpointercapture만으로 획을 끝내지 않습니다. 실제 pointerup 또는 pointercancel에서만 끝냅니다. */

    root.querySelectorAll('[data-penmode]').forEach(function (button) {
      button.addEventListener('click', function () { setMode(button.dataset.penmode); });
    });
    root.querySelectorAll('[data-pencolor]').forEach(function (button) {
      button.addEventListener('click', function () { setColor(button.dataset.pencolor); });
    });
    var undoButton = root.querySelector('[data-penundo]');
    if (undoButton) undoButton.addEventListener('click', function () {
      var strokes = getStrokes();
      if (!strokes.length) return;
      redoStack.push(strokes.pop());
      save();
      redraw();
    });
    var redoButton = root.querySelector('[data-penredo]');
    if (redoButton) redoButton.addEventListener('click', function () {
      if (!redoStack.length) return;
      getStrokes().push(redoStack.pop());
      save();
      redraw();
    });
    var clearButton = root.querySelector('[data-penclear]');
    if (clearButton) clearButton.addEventListener('click', function () {
      if (!getStrokes().length) return;
      if (!window.confirm(options.clearMessage || '이 문항의 필기를 모두 지울까요?')) return;
      getStrokes().length = 0;
      redoStack = [];
      save();
      redraw();
    });

    window.addEventListener('resize', resize);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(root);
    }
    resize();
    setMode(mode);
    setColor(color);
    redraw();

    function destroy() {
      window.removeEventListener('resize', resize);
      if (resizeObserver) resizeObserver.disconnect();
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', finish, true);
      document.removeEventListener('pointercancel', cancel, true);
      try { if (activePointerId !== null) root.releasePointerCapture(activePointerId); } catch (ignore) {}
      if (canvas.parentNode === root) root.removeChild(canvas);
      root.classList.remove('pen-surface-root', 'pen-input-active');
      root._penToolsCleanup = null;
    }
    root._penToolsCleanup = destroy;
    return { redraw: redraw, resize: resize, setMode: setMode, setColor: setColor, destroy: destroy };
  }

  window.PenTools = { bind: bind };
})();
