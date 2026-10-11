import { flower, flowerCluster, isPointing } from './engine.mjs';
const $ = id => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d'), video = $('video'), stage = $('stage');
const colors = [['Lilac','#9672d4'],['Rose','#ef729e'],['Red','#e95264'],['Orange','#ed9350'],['Yellow','#edbd45'],['Green','#77ad82'],['Blue','#6c9ed8'],['White','#ffffff']];
let color = colors[0][1], size = 20, strokes = [], current = null, last = null, smoothed = null;
let stream = null, landmarker = null, modelPromise = null, frame = 0, lastVideoTime = -1, lastInference = 0;
let starting = false, paused = false, pointerId = null;
const setStatus = (text, live = false) => { if ($('status').textContent !== text) $('status').textContent = text; $('status-dot').classList.toggle('live', live); };
function updateActions() { for (const id of ['undo','clear','save']) $(id).disabled = strokes.length === 0; }
function showError(message) { $('error').textContent = message; $('error').hidden = !message; }
function dismissWelcome() { $('welcome').hidden = true; $('stage-note').textContent = stream ? 'Point only your index finger. Keep your middle, ring, and little fingers curled.' : 'Drag your mouse or finger to draw flowers.'; }
function endStroke() { current = null; last = null; smoothed = null; }
function stamp(x, y) {
  for (const bloom of flowerCluster(size, color, colors.map(([,hex])=>hex))) {
    const px = x + bloom.x * 1.6, py = y + bloom.y * 1.6;
    const dot = { ...bloom, x: px / canvas.width, y: py / canvas.height };
    // Store each bloom so undo and redraw preserve the exact colors and sizes.
    current.push(dot); flower(ctx, px, py, bloom.size * 1.6, bloom.color, bloom.rotation);
  }
}
function drawAt(x, y) {
  dismissWelcome();
  if (!current) { current = []; strokes.push(current); stamp(x,y); last = {x,y}; updateActions(); return; }
  const distance = Math.hypot(x-last.x, y-last.y), spacing = size * 1.7;
  // Stamp by distance, never by time: a held finger doesn't pile up flowers.
  if (distance > canvas.width * .2) { endStroke(); drawAt(x,y); return; }
  const steps = Math.floor(distance / spacing), start = last;
  for (let i = 1; i <= steps; i++) {
    const ratio = i * spacing / distance;
    stamp(start.x + (x-start.x)*ratio, start.y + (y-start.y)*ratio);
  }
  if (steps) last = {x:start.x + (x-start.x)*steps*spacing/distance, y:start.y + (y-start.y)*steps*spacing/distance};
}
function redraw() { ctx.clearRect(0,0,canvas.width,canvas.height); for (const stroke of strokes) for (const d of stroke) flower(ctx,d.x*canvas.width,d.y*canvas.height,d.size*1.6,d.color,d.rotation); updateActions(); }
for (const [name, hex] of colors) {
  const b = document.createElement('button'); b.className = 'swatch'; b.style.setProperty('--color',hex);
  b.setAttribute('aria-label',name); b.title = name; b.setAttribute('aria-pressed',String(hex === color));
  b.addEventListener('click',()=>{ endStroke(); color=hex; for (const item of $('palette').children) item.setAttribute('aria-pressed', String(item === b)); }); $('palette').append(b);
}
$('size').addEventListener('input', e=>{ endStroke(); size=Number(e.target.value); $('size-value').value=size; });
$('clear').addEventListener('click',()=>{ endStroke(); strokes=[]; redraw(); });
$('undo').addEventListener('click',()=>{ endStroke(); strokes.pop(); redraw(); });
$('try').addEventListener('click',()=>{ dismissWelcome(); setStatus('Mouse / touch mode'); });
function pointerPosition(e) { const r = canvas.getBoundingClientRect(); return {x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height}; }
canvas.addEventListener('pointerdown',e=>{ if (stream || (e.pointerType === 'mouse' && e.button !== 0)) return; pointerId=e.pointerId; canvas.setPointerCapture(e.pointerId); endStroke(); const p=pointerPosition(e); drawAt(p.x,p.y); setStatus('Drawing flowers',true); });
canvas.addEventListener('pointermove',e=>{ if (e.pointerId !== pointerId) return; const p=pointerPosition(e); drawAt(p.x,p.y); });
for (const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,()=>{ pointerId=null; endStroke(); if(!stream) setStatus('Mouse / touch mode'); });
async function loadModel() {
  if (landmarker) return landmarker;
  if (!modelPromise) modelPromise = (async()=>{
    const {HandLandmarker,FilesetResolver} = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
    const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
    const options = {baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'}, runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.6,minTrackingConfidence:.6};
    try { return await HandLandmarker.createFromOptions(files,{...options,baseOptions:{...options.baseOptions,delegate:'GPU'}}); }
    catch { return await HandLandmarker.createFromOptions(files,options); }
  })().catch(error=>{ modelPromise=null; throw error; });
  landmarker = await modelPromise; return landmarker;
}
async function startCamera() {
  if (starting || stream) return;
  starting=true; $('start').disabled=true; $('camera-toggle').disabled=true; showError(''); endStroke(); pointerId=null;
  let pendingStream;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera needs HTTPS or localhost. You can still try mouse / touch drawing.');
    setStatus('Waiting for camera permission');
    pendingStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:960}},audio:false});
    setStatus('Loading hand tracking…'); await loadModel();
    video.srcObject=pendingStream; await video.play(); stream=pendingStream;
    canvas.height=Math.round(canvas.width*video.videoHeight/video.videoWidth); stage.style.aspectRatio=`${video.videoWidth} / ${video.videoHeight}`; redraw();
    video.style.display='block'; stage.classList.add('camera-on'); paused=false; lastVideoTime=-1;
    dismissWelcome(); $('camera-toggle').hidden=false; $('camera-toggle').textContent='Stop camera'; $('pause').hidden=false; $('pause').textContent='Pause drawing';
    setStatus('Show your hand',true); frame=requestAnimationFrame(track);
  } catch (error) {
    pendingStream?.getTracks().forEach(t=>t.stop()); stream=null; video.srcObject=null;
    const messages = {NotAllowedError:'Camera permission was denied. Allow camera access in your browser, then try again.',NotFoundError:'No camera found. Connect a webcam, or try mouse / touch drawing.',NotReadableError:'Camera is busy. Close other apps using it, then try again.'};
    showError(messages[error.name] || `${error.message || 'Hand tracking could not load.'} Check your internet connection and try again.`); setStatus('Camera unavailable');
  } finally { starting=false; $('start').disabled=false; $('camera-toggle').disabled=false; }
}
function stopCamera() {
  cancelAnimationFrame(frame); stream?.getTracks().forEach(t=>t.stop()); stream=null; video.srcObject=null; video.style.display='none'; stage.classList.remove('camera-on');
  $('cursor').style.display='none'; endStroke(); $('camera-toggle').textContent='Turn on camera'; $('pause').hidden=true; dismissWelcome(); setStatus('Mouse / touch mode');
}
function track(now) {
  if (!stream) return;
  try {
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now-lastInference >= 40) {
      lastInference=now; lastVideoTime=video.currentTime;
      const hand=landmarker.detectForVideo(video,now).landmarks[0];
      if (hand) {
        const p={x:(1-hand[8].x)*canvas.width,y:hand[8].y*canvas.height};
        smoothed=smoothed ? {x:smoothed.x*.35+p.x*.65,y:smoothed.y*.35+p.y*.65} : p;
        $('cursor').style.display='block'; $('cursor').style.left=`${smoothed.x/canvas.width*100}%`; $('cursor').style.top=`${smoothed.y/canvas.height*100}%`;
        if (!paused && isPointing(hand)) { drawAt(smoothed.x,smoothed.y); setStatus('Drawing flowers',true); }
        else { endStroke(); setStatus(paused ? 'Drawing paused' : 'Point only your index finger',true); }
      } else { endStroke(); $('cursor').style.display='none'; setStatus(paused ? 'Drawing paused' : 'Show your hand',true); }
    }
    frame=requestAnimationFrame(track);
  } catch { stopCamera(); showError('Hand tracking stopped. Turn on the camera to retry, or continue with mouse / touch.'); }
}
$('start').addEventListener('click',startCamera);
$('camera-toggle').addEventListener('click',()=>stream ? stopCamera() : startCamera());
$('pause').addEventListener('click',()=>{ paused=!paused; endStroke(); $('pause').textContent=paused ? 'Resume drawing' : 'Pause drawing'; });
$('save').addEventListener('click',()=>{
  const output=document.createElement('canvas'); output.width=canvas.width; output.height=canvas.height; const c=output.getContext('2d');
  if (stream && video.readyState>=2) { c.save(); c.translate(output.width,0); c.scale(-1,1); c.drawImage(video,0,0,output.width,output.height); c.restore(); }
  else { c.fillStyle='#eae5f6'; c.fillRect(0,0,output.width,output.height); }
  c.drawImage(canvas,0,0); const a=document.createElement('a'); a.download='my-flower-drawing.png'; a.href=output.toDataURL('image/png'); a.click();
});
window.addEventListener('pagehide',()=>{ cancelAnimationFrame(frame); stream?.getTracks().forEach(t=>t.stop()); landmarker?.close(); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden && stream) stopCamera(); });
