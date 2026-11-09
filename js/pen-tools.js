/* 사회문화 연습장 — 화면 전체 스타일러스 필기 엔진
   스타일러스는 필기하고, 손가락은 브라우저의 기본 화면 이동(스크롤)을 사용합니다. */
(function () {
  'use strict';
  var DEFAULT_COLOR = '#d6336c';
  function bind(options) {
    var root = options.root;
    if (!root || !root.addEventListener || !root.appendChild) return null;
    if (root._penToolsCleanup) root._penToolsCleanup();
    var mode = options.mode || 'pen';
    var color = /^#[0-9a-f]{6}$/i.test(options.color || '') ? options.color : DEFAULT_COLOR;
    var activeStroke = null, activePointerId = null, redoStack = [];
    var toolbar = root, ratio = 1, logicalWidth = 0, resizeObserver = null;
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
      var ctx = canvas.getContext('2d'), erasing = stroke.t === 'e';
      var strokeColor = stroke.c || DEFAULT_COLOR;
      ctx.save();
      ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = strokeColor;
      ctx.lineWidth = erasing ? Math.max(26 * ratio, canvas.width / 38) : Math.max(2.8 * ratio, canvas.width / 480);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      var first = strokePoint(stroke, stroke.p[0]);
      if (stroke.p.length === 1) {
        ctx.beginPath(); ctx.arc(first[0], first[1], ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(first[0], first[1]);
        for (var i = 1; i < stroke.p.length; i++) {
          var next = strokePoint(stroke, stroke.p[i]); ctx.lineTo(next[0], next[1]);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
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
        canvas.width = width; canvas.height = height; redraw();
      }
    }
    function updateHistoryButtons() {
      var undo = toolbar.querySelector('[data-penundo]');
      var redo = toolbar.querySelector('[data-penredo]');
      if (undo) undo.disabled = getStrokes().length === 0;
      if (redo) redo.disabled = redoStack.length === 0;
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
    function setColor(nextColor) {
      if (!/^#[0-9a-f]{6}$/i.test(nextColor || '')) return;
      color = nextColor;
      if (options.onColorChange) options.onColorChange(color);
      toolbar.querySelectorAll('[data-pencolor]').forEach(function (button) {
        var active = button.dataset.pencolor.toLowerCase() === color.toLowerCase();
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
    function isControlTarget(target) {
      if (!target || !target.closest) return false;
      return !!target.closest('button, a, input, textarea, select, summary, [role="button"], .pen-bar, [data-no-pen]');
    }
    function onPointerDown(event) {
      if (event.pointerType !== 'pen' || mode === 'off' || activeStroke || isControlTarget(event.target)) return;
      if (event.cancelable) event.preventDefault();
      activePointerId = event.pointerId;
      activeStroke = { t: mode === 'eraser' ? 'e' : 'p', c: color, u: 1, w: logicalWidth, p: [pointFromEvent(event)] };
      try { root.setPointerCapture(event.pointerId); } catch (ignore) {}
      redraw();
    }
    function onPointerMove(event) {
      if (!activeStroke || event.pointerId !== activePointerId) return;
      if (event.cancelable) event.preventDefault();
      var events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
      if (!events || !events.length) events = [event];
      events.forEach(function (sample) { activeStroke.p.push(pointFromEvent(sample)); });
      redraw();
    }
    function finish(event) {
      if (!activeStroke || (event && event.pointerId !== activePointerId)) return;
      var completed = activeStroke; activeStroke = null; activePointerId = null;
      getStrokes().push(completed); redoStack = []; save(); redraw();
    }
    function cancel(event) {
      if (!activeStroke || (event && event.pointerId !== activePointerId)) return;
      activeStroke = null; activePointerId = null; redraw();
    }

    root.addEventListener('pointerdown', onPointerDown, true);
    root.addEventListener('pointermove', onPointerMove, true);
    root.addEventListener('pointerup', finish, true);
    root.addEventListener('pointercancel', cancel, true);
    root.addEventListener('lostpointercapture', cancel, true);
    toolbar.querySelectorAll('[data-penmode]').forEach(function (button) {
      button.addEventListener('click', function () { setMode(button.dataset.penmode); });
    });
    toolbar.querySelectorAll('[data-pencolor]').forEach(function (button) {
      button.addEventListener('click', function () { setColor(button.dataset.pencolor); });
    });
    var undoButton = toolbar.querySelector('[data-penundo]');
    if (undoButton) undoButton.addEventListener('click', function () {
      var strokes = getStrokes(); if (!strokes.length) return;
      redoStack.push(strokes.pop()); save(); redraw();
    });
    var redoButton = toolbar.querySelector('[data-penredo]');
    if (redoButton) redoButton.addEventListener('click', function () {
      if (!redoStack.length) return;
      getStrokes().push(redoStack.pop()); save(); redraw();
    });
    var clearButton = toolbar.querySelector('[data-penclear]');
    if (clearButton) clearButton.addEventListener('click', function () {
      if (!getStrokes().length) return;
      if (!window.confirm(options.clearMessage || '이 문항의 필기를 모두 지울까요?')) return;
      getStrokes().length = 0; redoStack = []; save(); redraw();
    });
    window.addEventListener('resize', resize);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize); resizeObserver.observe(root);
    }
    resize(); setMode(mode); setColor(color); redraw();

    function destroy() {
      window.removeEventListener('resize', resize);
      if (resizeObserver) resizeObserver.disconnect();
      root.removeEventListener('pointerdown', onPointerDown, true);
      root.removeEventListener('pointermove', onPointerMove, true);
      root.removeEventListener('pointerup', finish, true);
      root.removeEventListener('pointercancel', cancel, true);
      root.removeEventListener('lostpointercapture', cancel, true);
      try { if (activePointerId !== null) root.releasePointerCapture(activePointerId); } catch (ignore) {}
      if (canvas.parentNode === root) root.removeChild(canvas);
      root.classList.remove('pen-surface-root'); root._penToolsCleanup = null;
    }
    root._penToolsCleanup = destroy;
    return { redraw: redraw, resize: resize, setMode: setMode, setColor: setColor, destroy: destroy };
  }
  window.PenTools = { bind: bind };
})();
