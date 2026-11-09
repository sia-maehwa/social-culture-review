/* 공통 스타일러스 엔진: pen 포인터만 필기, 색상·확대·전체화면·제스처 제어 */
(function () {
  'use strict';
  var DEFAULT_COLOR = '#d6336c';
  function bind(options) {
    var root = options.root, canvas = options.canvas;
    if (!root || !canvas || !canvas.getContext) return null;
    if (root._penToolsCleanup) root._penToolsCleanup();
    var mode = options.mode || 'pen', color = options.color || DEFAULT_COLOR;
    var activeStroke = null, activePointerId = null, redoStack = [];
    var toolbar = root, expandTarget = options.expandTarget || canvas.parentElement;
    function getStrokes() { var v = options.getStrokes ? options.getStrokes() : []; return Array.isArray(v) ? v : []; }
    function save() { if (options.save) options.save(getStrokes()); updateHistoryButtons(); }
    function point(event) {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return [0, 0];
      return [Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))];
    }
    function drawStroke(stroke) {
      if (!stroke || !Array.isArray(stroke.p) || !stroke.p.length) return;
      var ctx=canvas.getContext('2d'), erasing=stroke.t==='e';
      ctx.save(); ctx.globalCompositeOperation=erasing?'destination-out':'source-over';
      ctx.strokeStyle=stroke.c||DEFAULT_COLOR; ctx.fillStyle=stroke.c||DEFAULT_COLOR;
      ctx.lineWidth=erasing?Math.max(20,canvas.width/34):Math.max(3,canvas.width/420);
      ctx.lineCap='round'; ctx.lineJoin='round';
      if(stroke.p.length===1){var p=stroke.p[0];ctx.beginPath();ctx.arc(p[0]*canvas.width,p[1]*canvas.height,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}
      else {ctx.beginPath();ctx.moveTo(stroke.p[0][0]*canvas.width,stroke.p[0][1]*canvas.height);for(var i=1;i<stroke.p.length;i++)ctx.lineTo(stroke.p[i][0]*canvas.width,stroke.p[i][1]*canvas.height);ctx.stroke();}
      ctx.restore();
    }
    function redraw(){var c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);getStrokes().forEach(drawStroke);}
    function resize(){var r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;var d=Math.min(2,Math.max(1,window.devicePixelRatio||1));var w=Math.max(600,Math.round(r.width*d)),h=Math.max(280,Math.round(r.height*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;redraw();}}
    function updateHistoryButtons(){var u=toolbar.querySelector('[data-penundo]'),r=toolbar.querySelector('[data-penredo]');if(u)u.disabled=getStrokes().length===0;if(r)r.disabled=redoStack.length===0;}
    function setMode(next){mode=next;canvas.style.touchAction=mode==='off'?'pan-y':'none';canvas.classList.toggle('pen-gesture-locked',mode!=='off');if(options.onModeChange)options.onModeChange(mode);toolbar.querySelectorAll('[data-penmode]').forEach(function(b){var a=b.dataset.penmode===mode;b.classList.toggle('active',a);b.setAttribute('aria-pressed',a?'true':'false');});var h=toolbar.querySelector('.pen-input-hint');if(h)h.textContent=mode==='off'?'필기 꺼짐 · 손가락으로 화면을 스크롤할 수 있습니다.':'펜 입력 중 화면 이동 잠금 · 스크롤하려면 필기를 끄세요.';}
    function setColor(next){if(!/^#[0-9a-f]{6}$/i.test(next||''))return;color=next;if(options.onColorChange)options.onColorChange(color);toolbar.querySelectorAll('[data-pencolor]').forEach(function(b){var a=b.dataset.pencolor.toLowerCase()===color.toLowerCase();b.classList.toggle('active',a);b.setAttribute('aria-pressed',a?'true':'false');});}
    function finish(e){if(!activeStroke||(e&&e.pointerId!==activePointerId))return;var done=activeStroke;activeStroke=null;activePointerId=null;getStrokes().push(done);redoStack=[];save();redraw();}
    function cancel(e){if(!activeStroke||(e&&e.pointerId!==activePointerId))return;activeStroke=null;activePointerId=null;redraw();}
    function down(e){if(mode==='off'||e.pointerType!=='pen'||activeStroke)return;if(e.cancelable)e.preventDefault();activePointerId=e.pointerId;activeStroke={t:mode==='eraser'?'e':'p',c:color,p:[point(e)]};try{canvas.setPointerCapture(e.pointerId);}catch(ignore){}}
    function move(e){if(!activeStroke||e.pointerId!==activePointerId)return;if(e.cancelable)e.preventDefault();var events=typeof e.getCoalescedEvents==='function'?e.getCoalescedEvents():[e];if(!events||!events.length)events=[e];var last=activeStroke.p[activeStroke.p.length-1];events.forEach(function(sample){var n=point(sample);activeStroke.p.push(n);drawStroke({t:activeStroke.t,c:activeStroke.c,p:[last,n]});last=n;});}
    function fullscreenChange(){var b=toolbar.querySelector('[data-penfullscreen]');if(b){var a=document.fullscreenElement===root||root.classList.contains('pen-focus-mode');b.textContent=a?'전체화면 종료':'전체화면';b.setAttribute('aria-pressed',a?'true':'false');}window.requestAnimationFrame(resize);}
    canvas.addEventListener('pointerdown',down,{passive:false});canvas.addEventListener('pointermove',move,{passive:false});canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);
    toolbar.querySelectorAll('[data-penmode]').forEach(function(b){b.addEventListener('click',function(){setMode(b.dataset.penmode);});});
    toolbar.querySelectorAll('[data-pencolor]').forEach(function(b){b.addEventListener('click',function(){setColor(b.dataset.pencolor);});});
    var undo=toolbar.querySelector('[data-penundo]');if(undo)undo.addEventListener('click',function(){var a=getStrokes();if(!a.length)return;redoStack.push(a.pop());save();redraw();});
    var redo=toolbar.querySelector('[data-penredo]');if(redo)redo.addEventListener('click',function(){if(!redoStack.length)return;getStrokes().push(redoStack.pop());save();redraw();});
    var clear=toolbar.querySelector('[data-penclear]');if(clear)clear.addEventListener('click',function(){if(!getStrokes().length)return;if(!window.confirm(options.clearMessage||'이 문항의 필기를 모두 지울까요?'))return;getStrokes().length=0;redoStack=[];save();redraw();});
    var expand=toolbar.querySelector('[data-penexpand]');if(expand&&expandTarget)expand.addEventListener('click',function(){var a=expandTarget.classList.toggle('is-expanded');expand.textContent=a?'공간 줄이기':'공간 확대';window.requestAnimationFrame(resize);});
    var full=toolbar.querySelector('[data-penfullscreen]');if(full)full.addEventListener('click',function(){if(document.fullscreenElement===root){if(document.exitFullscreen)document.exitFullscreen().catch(function(){});return;}if(root.requestFullscreen){root.requestFullscreen({navigationUI:'hide'}).then(function(){root.classList.remove('pen-focus-mode');fullscreenChange();}).catch(function(){root.classList.toggle('pen-focus-mode');fullscreenChange();});}else{root.classList.toggle('pen-focus-mode');fullscreenChange();}});
    window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',fullscreenChange);
    setMode(mode);setColor(color);resize();redraw();
    function destroy(){window.removeEventListener('resize',resize);document.removeEventListener('fullscreenchange',fullscreenChange);if(document.fullscreenElement===root&&document.exitFullscreen)document.exitFullscreen().catch(function(){});root.classList.remove('pen-focus-mode');}
    root._penToolsCleanup=destroy;return {redraw:redraw,resize:resize,setMode:setMode,setColor:setColor,destroy:destroy};
  }
  window.PenTools={bind:bind};
})();
