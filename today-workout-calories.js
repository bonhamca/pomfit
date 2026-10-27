(()=>{
  let busy=false;
  function todayIndex(){const d=new Date().getDay();return d===0?0:Math.min(6,d);}
  function isToday(){return document.querySelector('#nav button.active')?.dataset?.tab==='today';}
  function ownWorkoutBlock(){
    if(!isToday())return null;
    const root=document.getElementById('content');if(!root)return null;
    const box=root.querySelector('.work input[data-workout-check]');
    return box?.closest('.work')||null;
  }
  function showStatus(msg,bad=false){
    const el=document.querySelector('[data-today-workout-cal-status]');
    if(el){el.textContent=msg||'';el.className='small'+(bad?' save-warn':'');}
  }
  function inject(){
    const block=ownWorkoutBlock();if(!block||block.querySelector('.today-workout-calories'))return;
    const i=todayIndex();
    const wrap=document.createElement('div');
    wrap.className='calorie-log today-workout-calories';
    wrap.innerHTML='<label class="small">Peloton calories burned <input class="search" type="number" min="0" step="1" inputmode="numeric" data-today-workout-calories placeholder="Enter Peloton estimate"></label><button class="secondary" type="button" data-save-today-workout-calories>Save calories</button><div class="small" data-today-workout-cal-status></div>';
    block.appendChild(wrap);
    const input=wrap.querySelector('[data-today-workout-calories]');
    const save=wrap.querySelector('[data-save-today-workout-calories]');
    save.onclick=async()=>{
      if(busy)return;
      const val=String(input.value||'').trim();
      if(val===''||!Number.isFinite(Number(val))||Number(val)<0){showStatus('Enter Peloton’s calories burned.',true);return;}
      busy=true;showStatus('Saving…');
      try{
        const todayBtn=document.querySelector('#nav button[data-tab="today"]');
        const workoutBtn=document.querySelector('#nav button[data-tab="workout"]');
        if(!workoutBtn)throw new Error('Workout page is unavailable.');
        workoutBtn.click();
        await new Promise(r=>setTimeout(r,80));
        const real=document.querySelector('[data-workout-calories="'+i+'"]');
        if(!real)throw new Error('Could not find today’s workout calorie field.');
        real.value=String(Math.round(Number(val)));
        real.dispatchEvent(new Event('change',{bubbles:true}));
        await new Promise(r=>setTimeout(r,180));
        todayBtn?.click();
        await new Promise(r=>setTimeout(r,80));
        inject();
        const restored=document.querySelector('[data-today-workout-calories]');
        if(restored)restored.value=String(Math.round(Number(val)));
        showStatus('Saved. PomFit will use this instead of its workout estimate.');
      }catch(e){
        showStatus('Could not save: '+(e?.message||'Unknown error'),true);
      }finally{busy=false;}
    };
  }
  new MutationObserver(()=>setTimeout(inject,0)).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')inject();});
  setTimeout(inject,300);
})();