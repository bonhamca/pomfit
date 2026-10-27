import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';

const supabase=createClient(
  'https://wbskfggewwlkeplswpan.supabase.co',
  'sb_publishable_y9L64jb_Xp3aBUuTsMIK4w_0-4b_S-D',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);

const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let busy=false,lastSig='';

function dayIndex(){const d=new Date().getDay();return d===0?0:Math.min(6,d);}
function dateKeyForDay(i){
  const now=new Date(),sun=new Date(now);
  sun.setHours(12,0,0,0);sun.setDate(now.getDate()-now.getDay()+i);
  return [sun.getFullYear(),String(sun.getMonth()+1).padStart(2,'0'),String(sun.getDate()).padStart(2,'0')].join('-');
}
function slotForUser(profile,members,household){
  const sorted=[...(members||[])].sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
  const creator=sorted.find(x=>x.user_id===household?.created_by)||sorted[0];
  const second=sorted.find(x=>x.user_id!==creator?.user_id);
  if(profile?.user_id===second?.user_id)return 'Elizabeth';
  return 'Clark';
}
function plannedMeal(d,slot,person){
  const pm=d?.person_meals?.[person]?.[slot];
  if(pm)return String(pm);
  if(slot==='dinner'){
    const f=d?.flavor_override;
    const base=String(d?.dinner||'');
    if(!f?.name)return base;
    const protein=(base.toLowerCase().match(/salmon|cod|branzino|sea bass|tilapia|trout|sole|catfish|shrimp|chicken|beef|steak|sirloin|flank|tuna/)||[])[0]||'protein';
    const colon=base.indexOf(':'),details=colon>=0?base.slice(colon+1).trim():base;
    return String(f.name).toUpperCase()+' '+protein.toUpperCase()+': '+details;
  }
  if(slot==='lunch')return String(d?.person_lunches?.[person]||d?.lunch||'');
  if(person==='Elizabeth')return slot==='breakfast'?String(d?.elizabeth_breakfast||''):slot==='afternoon'?String(d?.elizabeth_snack||''):'';
  return slot==='breakfast'?String(d?.clark_am||''):slot==='afternoon'?String(d?.clark_afternoon||''):'';
}
function prepInstruction(text,slot,flavor){
  const t=String(text||''),low=t.toLowerCase();
  if(!t)return '';
  if(/\bfast\b/.test(low))return 'No food prep needed; have fasting drinks ready.';
  if(/protein shake|whey|chike|protein drink/.test(low))return 'Pre-portion powder and any add-ins; chill milk/water and pack fruit/nuts separately.';
  if(slot==='lunch'){
    if(/protein shake|tuna pouch|greek yogurt|rotisserie|no cook/.test(low))return 'Pack the ready-to-eat items the night before; no cooking required.';
    return 'Portion the lunch protein and vegetables tonight. Keep dressing/sauce separate until eating.';
  }
  if(slot==='breakfast'||slot==='afternoon')return 'Portion the ingredients tonight so the meal/snack is ready at the planned time.';
  let s='Thaw/portion the protein and wash/chop the listed vegetables tonight. Measure the sauce/seasoning before cooking.';
  if(flavor?.recipe)s+=' Seasoning mix: '+flavor.name+' — '+flavor.recipe+'.';
  return s;
}
function mealRowsForDay(d,person){
  return ['breakfast','lunch','afternoon','dinner'].map(slot=>{
    const text=plannedMeal(d,slot,person);
    if(!text)return '';
    const label=slot==='breakfast'?'Breakfast':slot==='afternoon'?'Afternoon snack':slot[0].toUpperCase()+slot.slice(1);
    const flavor=slot==='dinner'?d?.flavor_override:null;
    return '<div class="prep-meal-row detailed"><div><b>'+esc(label)+'</b></div><div><div class="prep-meal-name">'+esc(text)+'</div><div class="small prep-meal-instruction"><b>Prep tonight:</b> '+esc(prepInstruction(text,slot,flavor))+'</div></div></div>';
  }).join('');
}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function bmr(p,weight){
  const age=num(p.age),h=num(p.height_in),sex=p.calorie_equation_sex;
  if(!weight||!age||!h||!sex)return null;
  const kg=weight*0.45359237,cm=h*2.54,c=sex==='male'?5:sex==='female'?-161:-78;
  return 10*kg+6.25*cm-5*age+c;
}
function energySummary(p,settings,i,d){
  const key=dateKeyForDay(i),log=settings?.energy_log?.[key]||{};
  const weight=num(log.weight_lb)||num(p.weight_lb);
  const base=bmr(p,weight);
  if(!base)return null;
  const factors={sedentary:1.2,light:1.3,moderate:1.4,active:1.5};
  const meals=log.meals&&typeof log.meals==='object'?log.meals:{};
  const supplements=Array.isArray(log.supplements)?log.supplements:[];
  const eaten=Object.values(meals).reduce((a,v)=>a+(Number(v)||0),0)+(Number(log.other_calories)||0)+supplements.reduce((a,x)=>a+(Number(x?.calories)||0),0);
  const pMeals=log.protein_meals&&typeof log.protein_meals==='object'?log.protein_meals:{};
  const protein=Object.values(pMeals).reduce((a,v)=>a+(Number(v)||0),0)+(Number(log.other_protein_g)||0)+supplements.reduce((a,x)=>a+(Number(x?.protein_g)||0),0);
  const burn=Number(log.workout_calories)||0;
  const goal=num(p.goal_weight_lb),rate=Math.max(0,Math.min(1,num(p.goal_rate_lb_week)??.5));
  const adjust=goal&&weight&&Math.abs(goal-weight)>=.5?(goal<weight?-500*rate:500*rate):0;
  const target=Math.max(1200,Math.round(base*(factors[p.baseline_activity]||1.3)+burn+adjust));
  const proteinTarget=num(p.protein_target_g)||Math.max(50,Math.round((goal&&goal<weight?goal:weight)*((p.workout_goals||[]).some(x=>['strength','muscle','cycling','running','ski'].includes(x))?.8:.7)));
  return {target,eaten,remaining:target-eaten,burn,proteinTarget,protein:Math.round(protein),proteinRemaining:Math.max(0,Math.round(proteinTarget-protein))};
}
async function loadData(){
  const {data:{session}}=await supabase.auth.getSession();if(!session)return null;
  const uid=session.user.id;
  const p=await supabase.from('profiles').select('*').eq('user_id',uid).single();if(p.error)return null;
  const profile=p.data;if(!profile?.household_id)return null;
  const [ps,h,state,members]=await Promise.all([
    supabase.from('personal_state').select('settings').eq('user_id',uid).single(),
    supabase.from('households').select('*').eq('id',profile.household_id).single(),
    supabase.from('household_state').select('menu').eq('household_id',profile.household_id).single(),
    supabase.from('profiles').select('user_id,display_name,created_at').eq('household_id',profile.household_id).order('created_at',{ascending:true})
  ]);
  if(ps.error||h.error||state.error||members.error)return null;
  return {profile,settings:ps.data?.settings||{},household:h.data,menu:state.data?.menu,members:members.data||[]};
}
async function patch(){
  if(busy)return;busy=true;
  try{
    const content=document.getElementById('content');if(!content)return;
    const active=document.querySelector('#nav button.active')?.dataset?.tab||'';
    if(!['today','prep'].includes(active))return;
    const data=await loadData();if(!data?.menu?.days)return;
    const person=slotForUser(data.profile,data.members,data.household);

    if(active==='prep'){
      const days=data.menu.days.slice(0,7);
      const sig='prep:'+JSON.stringify(days.map(d=>[d.date,d.dinner,d.flavor_override,d.person_meals,d.person_lunches]));
      if(sig!==lastSig){
        const existing=[...content.querySelectorAll('.prep-live-card')];
        existing.forEach((card,i)=>{
          const target=days[i+1];
          if(!target){
            card.innerHTML='<div class="dayhead"><div><h3>'+esc(days[i]?.date||'Final day')+' night</h3><div class="small">No following-day prep in this 7-day plan.</div></div></div>';
            return;
          }
          const check=card.querySelector('input.check');
          card.innerHTML='<div class="dayhead"><div><h3>'+esc(days[i]?.date||('Day '+(i+1)))+' night → '+esc(target.date)+'</h3><div class="small">Prep tonight for tomorrow’s current planned meals.</div></div></div>'+mealRowsForDay(target,person);
          if(check)card.querySelector('.dayhead')?.appendChild(check);
        });
        const intro=content.querySelector('.card h2');
        if(intro?.textContent==='Meal prep'){
          const p=intro.parentElement.querySelector('p.small');
          if(p)p.innerHTML='Each card is <b>night-before prep</b>: Monday night prepares Tuesday, Tuesday night prepares Wednesday, and so on. It is generated from the following day’s current planned meals.';
        }
        lastSig=sig;
      }
    }

    if(active==='today'){
      const i=dayIndex(),d=data.menu.days[i],p=data.settings?.profile_config||{},e=energySummary(p,data.settings,i,d);
      const jump=content.querySelector('.tracking-jump');
      if(jump&&e&&!jump.querySelector('.today-energy-grid')){
        jump.innerHTML='<div class="dayhead"><div><h3>Calories & protein</h3><div class="small">Today’s estimated needs and logged intake.</div></div><button class="primary" id="openTrackingBtn">Open Tracking</button></div>'+
          '<div class="energy-grid today-energy-grid">'+
          '<div><b>'+e.target+'</b><span>calorie target</span></div>'+
          '<div><b>'+e.eaten+'</b><span>calories logged</span></div>'+
          '<div><b>'+e.remaining+'</b><span>calories remaining</span></div>'+
          '<div><b>'+e.burn+'</b><span>workout burn</span></div>'+
          '<div><b>'+e.proteinTarget+' g</b><span>protein target</span></div>'+
          '<div><b>'+e.protein+' g</b><span>protein logged</span></div>'+
          '<div><b>'+e.proteinRemaining+' g</b><span>protein remaining</span></div>'+
          '</div><div class="small">Estimated needs use your saved profile and today’s logged workout calories. Open Tracking to edit meals or exact values.</div>';
        const btn=document.getElementById('openTrackingBtn');if(btn)btn.onclick=()=>{document.querySelector('#nav button[data-tab="tracking"]')?.click();};
      }
    }
  }finally{busy=false;}
}
const obs=new MutationObserver(()=>setTimeout(patch,0));
obs.observe(document.body,{childList:true,subtree:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')patch();});
setInterval(patch,4000);
setTimeout(patch,500);
