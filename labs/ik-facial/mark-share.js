/** Local-only visual review. The source model and live pose are never edited. */
export function installMarkShare({capture}) {
  const id = name => document.getElementById(name);
  const dialog = id('markDialog'), canvas = id('markCanvas'), context = canvas.getContext('2d');
  const note = id('markNote'), status = id('markStatus'), stage = id('markStage');
  const openers = ['markFromReview','markFromMotion'].map(id);
  let draft, strokes = [], active = null, pointer = null, returnFocus;
  const maxPoints = 600, maxStrokes = 32;
  const say = message => { status.textContent = message; };
  function redraw() {
    if (!draft) return;
    context.drawImage(draft.image, 0, 0);
    drawInk(context, [...strokes, ...(active ? [active] : [])], canvas.width, canvas.height);
    id('markUndo').disabled = !strokes.length;
  }
  function drawInk(ctx, lines, w, h) {
    const width = Math.max(3, Math.min(w,h)*.009);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const stroke of lines) {
      ctx.beginPath();
      stroke.forEach(([x,y],i) => i ? ctx.lineTo(x*w,y*h) : ctx.moveTo(x*w,y*h));
      if(stroke.length===1) {const [x,y] = stroke[0];ctx.lineTo(x*w+.1,y*h);}
      ctx.lineWidth=width*1.8;ctx.strokeStyle='#132332';ctx.stroke();
      ctx.lineWidth=width;ctx.strokeStyle='#fff06e';ctx.stroke();
    }
  }
  function fit() {
    if (!draft || !dialog.open) return;
    const width = Math.max(1, Math.min(stage.clientWidth, window.innerHeight*.49*canvas.width/canvas.height));
    canvas.style.width = Math.floor(width)+'px';
  }
  const show = e => {
    if (dialog.open) return;
    const opener=e.currentTarget;
    try {
      draft=capture();
      strokes=[];active=null;pointer=null;note.value='';
      canvas.width=draft.image.width;canvas.height=draft.image.height;
      redraw();say('Circle a spot, then add a note. This is a frozen frame; you aren’t painting on the model.');
      returnFocus=opener;dialog.showModal();fit();id('markClose').focus();
    } catch(error) {
      id(opener.id==='markFromReview'?'markReviewHint':'markMotionHint').textContent=error.message;
    }
  };
  openers.forEach(button=>button.addEventListener('click',show));
  const clamp = value => Math.round(Math.max(0,Math.min(1,value))*10000)/10000;
  const point = e => {const r=canvas.getBoundingClientRect();return [clamp((e.clientX-r.left)/r.width),clamp((e.clientY-r.top)/r.height)];};
  canvas.onpointerdown=e=>{
    if(pointer!==null || e.button!==0 || !draft) return;
    if(strokes.length>=maxStrokes){say('Maximum marks reached. Undo a mark to draw another.');return;}
    e.preventDefault(); pointer=e.pointerId;canvas.setPointerCapture(pointer);active=[point(e)];redraw();
  };
  canvas.onpointermove=e=>{
    if(e.pointerId!==pointer||!active||active.length>=maxPoints)return;
    const p=point(e),last=active.at(-1);
    if(Math.hypot((p[0]-last[0])*canvas.width,(p[1]-last[1])*canvas.height)>1) active.push(p);
    redraw();
  };
  canvas.onpointerup=e=>{
    if(e.pointerId!==pointer||!active)return;
    if(active.length<maxPoints)active.push(point(e));
    strokes.push(active);active=null;pointer=null;redraw();
  };
  const cancel=e=>{if(e.pointerId===pointer){active=null;pointer=null;redraw();}};
  canvas.onpointercancel=cancel; canvas.onlostpointercapture=cancel;
  id('markUndo').onclick=()=>{strokes.pop();redraw();say('Last mark removed.');};
  const close = () => {if (strokes.length || note.value.trim()) {
    if (!window.confirm('Close this draft? Download the marked PNG or review file first if you want to keep it.')) return;
  }dialog.close();};
  id('markClose').onclick=close;
  dialog.addEventListener('cancel', e=>{e.preventDefault();close();});
  dialog.addEventListener('close',()=>{
    context.clearRect(0,0,canvas.width,canvas.height);canvas.width=canvas.height=1;
    draft=null;strokes=[];active=null;pointer=null;note.value='';
    returnFocus?.focus();
  });
  window.addEventListener('resize',fit);
  function download(blob,name) {
    const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),15000);
  }
  const base = () => (draft.replay.source.filename.replace(/\.glb$/i,'').replace(/[^a-zA-Z0-9_.-]+/g,'_').slice(0,70)||'CoLab')+'_review';
  id('markPNG').onclick=()=>{
    if(!draft||pointer!==null)return;
    const file=base()+'.png';
    // Copy the visible ink, not the unmarked Three.js drawing buffer.
    canvas.toBlob(blob=>{
      if(!blob){say('Image could not be saved. Try a device screenshot.');return;}
      download(blob,file);say('Marked PNG downloaded. Attach it and the review file in chat.');
    },'image/png');
  };
  id('markJSON').onclick=()=>{
    if(!draft||pointer!==null)return;
    const record={
      schema:'colab-mark-share-v1',capturedAt:draft.capturedAt,
      ...draft.replay,note:note.value.trim(),ink:{coordinates:'normalized-top-left-xy',width:canvas.width,height:canvas.height,strokes},
    };
    download(new Blob([JSON.stringify(record,null,2)+'\n'],{type:'application/json'}),base()+'.json');
    say('Review file downloaded. Attach it and the marked PNG in chat.');
  };
}
