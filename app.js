import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
import { DEFAULT_DATA } from './data.js?v=16';

const supabase=createClient(
  'https://wbskfggewwlkeplswpan.supabase.co',
  'sb_publishable_y9L64jb_Xp3aBUuTsMIK4w_0-4b_S-D',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let session,profile,household,shared,personal,channels=[];
let ui={view:'Clark',tab:'today'};

function show(id){['authShell','setupShell','appShell'].forEach(x=>$('#'+x).classList.toggle('hidden',x!==id));}
function notice(id,msg,bad=false){const e=$(id);if(!msg){e.classList.add('hidden');return;}e.textContent=msg;e.className='notice'+(bad?' error':'');}
function myName(){return profile?.display_name||session?.user?.user_metadata?.display_name||session?.user?.email?.split('@')[0]||'Me';}
function myView(){return myName().toLowerCase().includes('elizabeth')?'Elizabeth':'Clark';}
function pomName(){return String(personal?.settings?.pom_name||'Gizmo').trim()||'Gizmo';}
function syncMsg(t){if($('#syncStatus'))$('#syncStatus').textContent=t;}
function todayIndex(){const d=new Date().getDay();return d===0?0:Math.min(6,d);}
function personalProfile(){return personal?.settings?.profile_config||{};}
function profileReady(){return personalProfile().onboarding_complete===true;}
function dietStyle(){return personalProfile().diet_style||'balanced';}
function foodList(key){return String(personalProfile()[key]||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);}
function mealSchedule(){return personalProfile().meals||{
  breakfast:{enabled:true,time:'08:00',location:'Home'},
  lunch:{enabled:true,time:'12:30',location:'Work'},
  afternoon:{enabled:true,time:'16:00',location:'Work'},
  dinner:{enabled:true,time:'19:00',location:'Home'}
};}
function workoutGoals(){const g=personalProfile().workout_goals;return Array.isArray(g)?g:[];}
function workoutChecks(){return personal?.settings?.workout_checks||{};}
function barkEnabled(){return personal?.settings?.bark_reminder_enabled===true;}
function barkTime(){return personal?.settings?.bark_reminder_time||'20:00';}
function localDateKey(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function playBark(){
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return false;
  const ctx=new AC();
  const bark=(delay,freq)=>{
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type='sawtooth';
    o.frequency.setValueAtTime(freq,ctx.currentTime+delay);
    o.frequency.exponentialRampToValueAtTime(70,ctx.currentTime+delay+.18);
    g.gain.setValueAtTime(.0001,ctx.currentTime+delay);
    g.gain.exponentialRampToValueAtTime(.22,ctx.currentTime+delay+.015);
    g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+delay+.22);
    o.connect(g);g.connect(ctx.destination);o.start(ctx.currentTime+delay);o.stop(ctx.currentTime+delay+.24);
  };
  bark(0,175);bark(.27,145);
  setTimeout(()=>ctx.close().catch(()=>{}),700);
  return true;
}
const MEAL_CATALOG={
  balanced:{
    breakfast:[
      ['Protein shake with milk and berries',['protein','whey','milk','berries']],
      ['Eggs, whole-grain toast and fresh fruit',['eggs','bread','fruit']],
      ['Greek yogurt, berries and nuts',['yogurt','berries','nuts']]
    ],
    lunch:[
      ['Grilled chicken, vegetables and a whole-grain side',['chicken','vegetables','whole grain']],
      ['Salmon salad with olive oil and fruit',['salmon','salad','olive oil','fruit']],
      ['Lean beef bowl with vegetables and beans',['beef','vegetables','beans']]
    ],
    afternoon:[
      ['Protein shake plus fruit',['protein','whey','fruit']],
      ['Swiss cheese, fruit and pistachios',['swiss','fruit','pistachios']],
      ['Nuts or pepitas with a protein drink',['nuts','pepitas','protein']]
    ],
    dinner:[
      ['Lean protein, two vegetables and a measured whole-food carbohydrate',['protein','vegetables','whole grain']],
      ['Fish, vegetables and olive oil',['fish','vegetables','olive oil']]
    ]
  },
  mediterranean:{
    breakfast:[
      ['Greek yogurt, berries, walnuts and cinnamon',['yogurt','berries','walnuts']],
      ['Eggs with tomato, spinach and whole-grain toast',['eggs','tomato','spinach','bread']],
      ['Protein coffee plus fruit and pistachios',['protein','coffee','fruit','pistachios']]
    ],
    lunch:[
      ['Salmon and white-bean salad with olive oil and lemon',['salmon','beans','salad','olive oil']],
      ['Chicken, hummus, vegetables and whole grain',['chicken','hummus','vegetables','whole grain']],
      ['Tuna, tomato, cucumber, olives and greens',['tuna','tomato','cucumber','olives']]
    ],
    afternoon:[
      ['Fruit with nuts',['fruit','nuts']],
      ['Swiss cheese with tomato and cucumber',['swiss','tomato','cucumber']],
      ['Protein shake with berries',['protein','berries']]
    ],
    dinner:[
      ['Fish, vegetables, olive oil and legumes or whole grain',['fish','vegetables','olive oil','beans']],
      ['Chicken with roasted vegetables and olive oil',['chicken','vegetables','olive oil']]
    ]
  },
  lowcarb:{
    breakfast:[
      ['Protein shake with milk or unsweetened milk and berries',['protein','whey','milk','berries']],
      ['Eggs with greens and cheese',['eggs','greens','cheese']],
      ['Smoked salmon, cucumber and cheese',['salmon','cucumber','cheese']]
    ],
    lunch:[
      ['Chicken salad with olive oil and non-starchy vegetables',['chicken','salad','olive oil','vegetables']],
      ['Salmon with asparagus and greens',['salmon','asparagus','greens']],
      ['Lean beef with mushrooms and green beans',['beef','mushrooms','green beans']]
    ],
    afternoon:[
      ['Protein shake and pistachios',['protein','pistachios']],
      ['Swiss cheese and cucumber',['swiss','cucumber']],
      ['Pepitas and a protein drink',['pepitas','protein']]
    ],
    dinner:[
      ['Fish or lean meat with two non-starchy vegetables',['fish','meat','vegetables']],
      ['Chicken with asparagus, zucchini or green beans',['chicken','asparagus','zucchini','green beans']]
    ]
  },
  keto:{
    breakfast:[
      ['Eggs with cheese and avocado',['eggs','cheese','avocado']],
      ['Low-carb protein shake with unsweetened milk',['protein','whey','milk']],
      ['Smoked salmon with cucumber and olive oil',['salmon','cucumber','olive oil']]
    ],
    lunch:[
      ['Salmon salad with olive oil and low-carb vegetables',['salmon','salad','olive oil','vegetables']],
      ['Chicken with avocado and greens',['chicken','avocado','greens']],
      ['Lean beef with mushrooms and asparagus',['beef','mushrooms','asparagus']]
    ],
    afternoon:[
      ['Swiss cheese and pistachios',['swiss','pistachios']],
      ['Protein shake with unsweetened milk',['protein','whey','milk']],
      ['Pepitas and cheese',['pepitas','cheese']]
    ],
    dinner:[
      ['Fish or meat with non-starchy vegetables and olive oil',['fish','meat','vegetables','olive oil']],
      ['Chicken with asparagus or zucchini and olive oil',['chicken','asparagus','zucchini','olive oil']]
    ]
  },
  pescatarian:{
    breakfast:[
      ['Eggs with vegetables and fruit',['eggs','vegetables','fruit']],
      ['Greek yogurt, berries and nuts',['yogurt','berries','nuts']],
      ['Protein shake with berries',['protein','berries']]
    ],
    lunch:[
      ['Salmon salad with olive oil and beans',['salmon','salad','olive oil','beans']],
      ['Tuna and white-bean bowl with vegetables',['tuna','beans','vegetables']],
      ['Shrimp bowl with vegetables and whole grain',['shrimp','vegetables','whole grain']]
    ],
    afternoon:[
      ['Swiss cheese and fruit',['swiss','fruit']],
      ['Protein shake and pistachios',['protein','pistachios']],
      ['Pepitas and berries',['pepitas','berries']]
    ],
    dinner:[
      ['Fish or shellfish with vegetables',['fish','shrimp','vegetables']],
      ['Salmon, vegetables and a whole-food carbohydrate',['salmon','vegetables','whole grain']]
    ]
  },
  vegetarian:{
    breakfast:[
      ['Eggs with vegetables and whole-grain toast',['eggs','vegetables','bread']],
      ['Greek yogurt, berries and nuts',['yogurt','berries','nuts']],
      ['Protein shake with fruit',['protein','fruit']]
    ],
    lunch:[
      ['Lentil and vegetable bowl with olive oil',['lentils','vegetables','olive oil']],
      ['Bean salad with Swiss cheese and vegetables',['beans','swiss','vegetables']],
      ['Tofu or tempeh vegetable bowl',['tofu','tempeh','vegetables']]
    ],
    afternoon:[
      ['Swiss cheese and fruit',['swiss','fruit']],
      ['Protein shake and nuts',['protein','nuts']],
      ['Pepitas and berries',['pepitas','berries']]
    ],
    dinner:[
      ['Lentils or beans with vegetables and whole grain',['lentils','beans','vegetables','whole grain']],
      ['Egg-based or dairy-based protein with vegetables',['eggs','cheese','vegetables']]
    ]
  }
};
function chooseMeal(slot,dayIndex){
  const diet=MEAL_CATALOG[dietStyle()]||MEAL_CATALOG.balanced;
  const options=diet[slot]||diet.lunch,dislikes=foodList('food_dislikes'),likes=foodList('food_likes');
  let ranked=options.map((x,idx)=>({x,idx,blocked:dislikes.some(d=>x[1].some(i=>i.includes(d)||d.includes(i))),score:likes.reduce((s,l)=>s+(x[1].some(i=>i.includes(l)||l.includes(i))?2:0),0)}));
  let usable=ranked.filter(r=>!r.blocked);if(!usable.length)usable=ranked;
  usable.sort((a,b)=>b.score-a.score||a.idx-b.idx);
  return usable[dayIndex%usable.length].x[0];
}
function personalWorkoutFor(i){
  const goals=workoutGoals();
  const has=g=>goals.includes(g);
  if(has('ski')){
    const p=['Lower-body strength + core','Zone 2 cardio + mobility','Upper-body strength + core','Ski-leg intervals: step-ups, split squats, lateral work','Recovery cardio + balance','Full-body strength + short ski-conditioning finisher','Rest / mobility'];
    return p[i];
  }
  if(has('cycling')){
    const p=['Endurance ride','Upper-body + core strength','Bike intervals / threshold work','Recovery spin + mobility','Full-body strength','Long endurance ride','Rest'];
    return p[i];
  }
  if(has('running')){
    const p=['Easy run + mobility','Strength: legs + core','Tempo or interval run','Upper-body strength','Easy run','Long run or event-specific session','Rest'];
    return p[i];
  }
  if(has('muscle')){
    const p=['Upper pull + biceps + core','Lower body','Upper push + triceps + core','Zone 2 cardio / recovery','Upper hypertrophy','Lower body + carries','Rest'];
    return p[i];
  }
  if(has('cardio')){
    const p=['Zone 2 cardio','Full-body strength','Intervals','Recovery cardio + mobility','Zone 2 cardio','Longer cardio session','Rest'];
    return p[i];
  }
  const p=['Full-body strength','Zone 2 cardio','Mobility / recovery','Full-body strength','Cardio intervals','Outdoor activity / long easy cardio','Rest'];
  return p[i];
}
function mealMeta(slot){
  const s=mealSchedule()[slot];if(!s)return'';
  return [s.time,s.location].filter(Boolean).join(' • ');
}
function isMealEnabled(slot){
  const s=mealSchedule()[slot];if(s&&s.enabled===false)return false;
  if(personalProfile().intermittent_fasting&&slot==='breakfast')return false;
  return true;
}
function reminderIncomplete(){
  const i=todayIndex(),p=myView();
  const slots=['breakfast','lunch','afternoon','dinner'].filter(isMealEnabled);
  const mealsLeft=slots.filter(k=>!checks()[`${i}-${p}-${k}`]).length;
  const workoutLeft=profile?.workout_enabled!==false&&!workoutChecks()[`${i}-${p}`]?1:0;
  return mealsLeft+workoutLeft;
}
async function maybeBarkReminder(){
  if(!session||!personal||!barkEnabled()||document.visibilityState!=='visible')return;
  const [h,m]=barkTime().split(':').map(Number),now=new Date();
  if(now.getHours()*60+now.getMinutes()<h*60+m||personal.settings?.last_bark_date===localDateKey())return;
  const left=reminderIncomplete();if(!left)return;
  if(playBark()){
    await savePersonal({settings:{...(personal.settings||{}),last_bark_date:localDateKey()}});
    if($('#speech'))$('#speech').textContent=`${pomName()} says: Woof! You still have ${left} item${left===1?'':'s'} to check off today.`;
  }
}

async function signIn(){
  notice('#authMessage','');
  const {error}=await supabase.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value});
  if(error)notice('#authMessage',error.message,true);
}
async function signUp(){
  notice('#authMessage','');
  const name=$('#signupName').value.trim(),email=$('#signupEmail').value.trim(),password=$('#signupPassword').value;
  if(!name)return notice('#authMessage','Please enter a name.',true);
  const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:'https://bonhamca.github.io/pomfit/'}});
  if(error)return notice('#authMessage',error.message,true);
  if(!data.session)notice('#authMessage','Account created. Check your email for the confirmation link, then sign in.');
}
async function signOut(){for(const c of channels)await supabase.removeChannel(c);channels=[];await supabase.auth.signOut();}

async function load(){
  const uid=session.user.id;
  const p=await supabase.from('profiles').select('*').eq('user_id',uid).single();if(p.error)throw p.error;profile=p.data;
  const ps=await supabase.from('personal_state').select('*').eq('user_id',uid).single();if(ps.error)throw ps.error;personal=ps.data;
  ui.view=myView();
  if(!profile.household_id){household=shared=null;return;}
  const [h,s]=await Promise.all([
    supabase.from('households').select('*').eq('id',profile.household_id).single(),
    supabase.from('household_state').select('*').eq('household_id',profile.household_id).single()
  ]);
  if(h.error)throw h.error;if(s.error)throw s.error;household=h.data;shared=s.data;
}
function defaultGroceries(){
  const out=[];for(const [category,items] of Object.entries(DEFAULT_DATA.grocery))items.forEach((text,i)=>out.push({id:`${category}-${i}`,category,text,checked:false}));return out;
}
function defaultPrep(){return [
  'Sunday: make chili double-batch; boil eggs; portion nuts/seeds; wash/chop salad vegetables.',
  'Monday–Friday: cook enough dinner protein for dinner + next-day lunch; reserve lunch portion before extra sauce/butter.',
  'Pack work lunches the night before. Keep dressings, pistachios/pepitas and Swiss separate until eating.',
  'Use the kitchen scale for cooked protein, oil/butter/tallow, nuts/seeds, Swiss and avocado for 2–3 weeks.',
  'Clark: morning fasting drinks are black coffee, plain tea, water and zero-cal flavored water. Fruit, milk, whey and OJ wait until after noon.'
].map((text,i)=>({id:`prep-${i}`,text,checked:false}));}
async function seed(){
  if(!shared)return;
  const needsMenu=!shared.menu||Object.keys(shared.menu).length===0;
  const needsGroceries=!Array.isArray(shared.groceries)||shared.groceries.length===0;
  const needsPrep=!Array.isArray(shared.prep_tasks)||shared.prep_tasks.length===0;
  if(!needsMenu&&!needsGroceries&&!needsPrep)return;
  const r=await supabase.rpc('initialize_household_state',{
    p_menu:DEFAULT_DATA,
    p_groceries:defaultGroceries(),
    p_prep_tasks:defaultPrep()
  });
  if(r.error)throw r.error;
  const s=await supabase.from('household_state').select('*').eq('household_id',profile.household_id).single();
  if(s.error)throw s.error;
  shared=s.data;
}
async function createHousehold(){
  notice('#setupMessage','');const r=await supabase.rpc('create_household',{p_name:'Bonham Household'});
  if(r.error)return notice('#setupMessage',r.error.message,true);
  await load();await seed();ui.tab='account';await enterApp();
}
async function joinHousehold(){
  notice('#setupMessage','');
  const {data:{session:liveSession}}=await supabase.auth.getSession();
  if(!liveSession?.access_token){
    await supabase.auth.signOut().catch(()=>{});
    show('authShell');
    return notice('#authMessage','Your sign-in is not active in this PomFit window. Please sign in here, then join the household.',true);
  }
  const code=$('#joinCode').value.trim().toUpperCase();
  if(!code)return notice('#setupMessage','Enter the household invite code.',true);
  const r=await supabase.rpc('join_household',{p_invite_code:code});
  if(r.error){
    if(r.error.code==='42501'||/permission denied/i.test(r.error.message||'')){
      show('authShell');
      return notice('#authMessage','Your PomFit session expired or is not active in this window. Please sign in again here, then join the household.',true);
    }
    return notice('#setupMessage',r.error.message,true);
  }
  await load();await enterApp();
}
async function enterApp(){show('appShell');$('#headerSub').textContent=`${household.name} • ${myName()}`;await subscribe();render();syncMsg('Synced');}
async function subscribe(){
  for(const c of channels)await supabase.removeChannel(c);channels=[];
  if(!profile?.household_id)return;
  const h=supabase.channel('pomfit-household-'+profile.household_id)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'household_state',filter:`household_id=eq.${profile.household_id}`},p=>{shared=p.new;syncMsg('Shared update received');render();}).subscribe();
  const p=supabase.channel('pomfit-personal-'+session.user.id)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'personal_state',filter:`user_id=eq.${session.user.id}`},x=>{personal=x.new;render();}).subscribe();
  channels=[h,p];
}
async function handleSession(s){
  session=s;if(!s){profile=household=shared=personal=null;show('authShell');return;}
  try{await load();if(!profile.household_id){show('setupShell');return;}await seed();if(!profileReady())ui.tab='profile';await enterApp();}
  catch(e){console.error(e);show('authShell');notice('#authMessage','Could not load PomFit: '+e.message,true);}
}

function menu(){return shared?.menu?.days?shared.menu:DEFAULT_DATA;}
function groceries(){return Array.isArray(shared?.groceries)?shared.groceries:defaultGroceries();}
function prep(){return Array.isArray(shared?.prep_tasks)?shared.prep_tasks:defaultPrep();}
function checks(){return personal?.settings?.meal_checks||{};}
function workoutShown(view){if(view==='Both')return true;if(view===myView())return profile?.workout_enabled!==false;return true;}
function tip(){
  const i=todayIndex();
  let message;
  if(ui.view==='Clark'){
    if(i===0)message='Keep today easy—FTP tomorrow. Salmon lunch, chili dinner, no leg lifting.';
    else if(i===1)message='FTP day: fuel if needed, no strength afterward.';
    else message='Protein first, vegetables second, treats measured.';
  } else if(ui.view==='Elizabeth'){
    message='Chike can be hot or iced. Mix first, then warm—do not boil.';
  } else {
    message='Shared dinners, individual portions. Cook once and reserve tomorrow’s lunch.';
  }
  return `${pomName()} says: ${message}`;
}
function textFor(d,k){
  if(ui.view===myView()&&profileReady()){
    const map={breakfast:'breakfast',lunch:'lunch',afternoon:'afternoon',dinner:'dinner'};
    return chooseMeal(map[k],todayIndex());
  }
  if(ui.view==='Clark')return k==='breakfast'?d.clark_am:k==='afternoon'?d.clark_afternoon:d[k];
  if(ui.view==='Elizabeth')return k==='breakfast'?d.elizabeth_breakfast:k==='afternoon'?d.elizabeth_snack:d[k];
  if(k==='breakfast')return `Clark: ${d.clark_am}\nElizabeth: ${d.elizabeth_breakfast}`;
  if(k==='afternoon')return `Clark: ${d.clark_afternoon}\nElizabeth: ${d.elizabeth_snack}`;
  return d[k];
}
function meal(d,i,k,label){
  if(ui.view===myView()&&profileReady()&&!isMealEnabled(k))return'';
  const t=textFor(d,k);if(!t)return'';
  const id=`${i}-${ui.view}-${k}`,isMine=ui.view===myView();
  const box=isMine?`<input class="check" type="checkbox" data-check="${esc(id)}" ${checks()[id]?'checked':''} aria-label="Mark ${esc(label)} complete">`:'';
  const meta=isMine&&profileReady()?mealMeta(k):'';
  return `<div class="meal">${box}<b>${label}${meta?` <span class="small">• ${esc(meta)}</span>`:''}</b><p>${esc(t)}</p></div>`;
}
function dayCard(d,i){
  let w='';
  if(workoutShown(ui.view)){
    if(ui.view==='Both'){
      w=`<div class="work"><b>Clark:</b> ${esc(d.workout_c)}<br><b>Elizabeth:</b> ${esc(d.workout_e)}</div>`;
    }else{
      const id=`${i}-${ui.view}`,isMine=ui.view===myView();
      const box=isMine?`<input class="check" type="checkbox" data-workout-check="${esc(id)}" ${workoutChecks()[id]?'checked':''} aria-label="Mark workout complete">`:'';
      const workout=isMine&&profileReady()?personalWorkoutFor(i):(ui.view==='Clark'?d.workout_c:d.workout_e);
      w=`<div class="work">${box}<b>Workout:</b> ${esc(workout)}</div>`;
    }
  }
  return `<section class="card"><div class="dayhead"><div><h3>${esc(d.date)}</h3><div class="meta">Shared menu • ${esc(ui.view)} view</div></div>${i===todayIndex()?'<span class="badge">TODAY</span>':''}</div>${meal(d,i,'breakfast','Morning / breakfast')}${meal(d,i,'lunch','Lunch')}${meal(d,i,'afternoon','Afternoon')}${meal(d,i,'dinner','Dinner')}${w}<div class="prep"><b>Prep:</b> ${esc(d.prep)}</div></section>`;
}
function renderToday(){
  const n=personal?.notes?.free_text||'';
  return dayCard(menu().days[todayIndex()],todayIndex())+`<div class="card"><h3>Private notes</h3><textarea id="notes" class="note" placeholder="Weights, BP, substitutions, workout notes…">${esc(n)}</textarea><p class="small">Only your signed-in account can read these notes.</p></div>`;
}
function renderWeek(){return `<div class="weekgrid">${menu().days.map(dayCard).join('')}</div>`;}
function renderPrep(){return `<div class="card"><h2>Shared meal prep</h2><ul class="list">${prep().map(x=>`<li><input type="checkbox" data-prep="${esc(x.id)}" ${x.checked?'checked':''}><label class="${x.checked?'done':''}">${esc(x.text)}</label></li>`).join('')}</ul></div>`;}
function renderGrocery(){
  const cats={};groceries().forEach(x=>(cats[x.category]??=[]).push(x));let h='<div class="gcols">';
  for(const [cat,items] of Object.entries(cats))h+=`<section class="card"><h3>${esc(cat)}</h3><ul class="list">${items.map(x=>`<li><input type="checkbox" data-g="${esc(x.id)}" ${x.checked?'checked':''}><label class="${x.checked?'done':''}">${esc(x.text)}</label></li>`).join('')}</ul></section>`;
  return h+'</div><div class="card"><button class="ghost" id="resetG">Reset shared grocery checks</button></div>';
}
function renderSeason(){return `<div class="card"><h2>Seasoning library</h2><input id="seasonSearch" class="search" placeholder="Search soy, fish, asparagus, smoky…"><div class="season" id="seasonList">${menu().seasonings.map(s=>`<details data-search="${esc((s.name+' '+s.best+' '+s.recipe).toLowerCase())}"><summary>${esc(s.name)} <span class="small">• ${esc(s.sodium)} sodium</span></summary><p><b>Best with:</b> ${esc(s.best)}</p><p><b>Mix:</b> ${esc(s.recipe)}</p></details>`).join('')}</div></div>`;}
function renderWorkout(){
  const p=ui.view==='Both'?myView():ui.view,isMe=p===myView();
  return `<div class="card"><h2>${esc(p)} workout</h2>${isMe?`<label class="toggle"><input type="checkbox" id="profileWorkout" ${profile.workout_enabled!==false?'checked':''}> Workouts ON for ${esc(p)}</label><p class="small">Check off each workout when finished.</p>`:'<p class="small">You can view the plan, but only that person can mark a workout complete.</p>'}</div><div class="weekgrid">${menu().days.map((d,i)=>{const id=`${i}-${p}`,box=isMe?`<input class="check" type="checkbox" data-workout-check="${esc(id)}" ${workoutChecks()[id]?'checked':''} aria-label="Mark workout complete">`:'';const workout=isMe&&profileReady()?personalWorkoutFor(i):(p==='Clark'?d.workout_c:d.workout_e);return `<div class="card"><h3>${esc(d.date)}</h3><div class="work">${box}${esc(workout)}</div></div>`;}).join('')}</div>`;
}
function renderProfile(){
  const p=personalProfile(),m=mealSchedule(),goals=workoutGoals();
  const goal=(g,label)=>`<label class="toggle"><input type="checkbox" data-goal="${g}" ${goals.includes(g)?'checked':''}> ${label}</label>`;
  const mealRow=(key,label)=>{const x=m[key]||{};return `<div class="metric"><b>${label}</b><label class="toggle"><input type="checkbox" data-meal-enabled="${key}" ${x.enabled!==false?'checked':''}> Include</label><label class="small">Time <input type="time" data-meal-time="${key}" value="${esc(x.time||'')}"></label><label class="small">Location <input class="search" data-meal-location="${key}" value="${esc(x.location||'')}" placeholder="Home, work, school…"></label></div>`;};
  return `<div class="card"><h2>My profile</h2><p class="small">Your profile is private and drives your own meal and workout recommendations.</p><div class="account-grid">
  <div class="metric"><b>Basics</b><label class="small">Age <input id="profAge" class="search" type="number" min="13" max="100" value="${esc(p.age||'')}"></label><label class="small">Height (in) <input id="profHeight" class="search" type="number" min="48" max="90" step=".5" value="${esc(p.height_in||'')}"></label><label class="small">Weight (lb) <input id="profWeight" class="search" type="number" min="70" max="600" step=".1" value="${esc(p.weight_lb||'')}"></label></div>
  <div class="metric"><b>Diet style</b><select id="dietStyle" class="search"><option value="balanced">Balanced</option><option value="mediterranean">Mediterranean</option><option value="lowcarb">Low carb</option><option value="keto">Keto</option><option value="pescatarian">Pescatarian</option><option value="vegetarian">Vegetarian</option></select></div>
  <div class="metric"><b>Foods</b><label class="small">Foods I like <input id="foodLikes" class="search" value="${esc(p.food_likes||'')}" placeholder="salmon, asparagus, berries"></label><label class="small">Foods I don't like <input id="foodDislikes" class="search" value="${esc(p.food_dislikes||'')}" placeholder="eggs, yogurt, broccoli"></label></div>
  <div class="metric"><b>Intermittent fasting</b><label class="toggle"><input id="ifToggle" type="checkbox" ${p.intermittent_fasting?'checked':''}> Use intermittent fasting</label><label class="small">Eating window start <input id="ifStart" type="time" value="${esc(p.fasting_start||'12:00')}"></label><label class="small">Eating window end <input id="ifEnd" type="time" value="${esc(p.fasting_end||'20:00')}"></label></div>
  <div class="metric"><b>Workout goals</b><div class="controls">${goal('muscle','Muscle building')}${goal('cardio','Cardio fitness')}${goal('ski','Train for skiing')}${goal('cycling','Train for cycling')}${goal('running','Train for running')}</div></div>
  ${mealRow('breakfast','Breakfast / morning')}${mealRow('lunch','Lunch')}${mealRow('afternoon','Afternoon snack')}${mealRow('dinner','Dinner')}
  </div><button class="primary" id="saveProfileBtn">Save profile</button></div>`;
}
function renderAccount(){
  return `<div class="card"><h2>Account & household</h2><div class="account-grid"><div class="metric"><b>Signed in as</b>${esc(myName())}<div class="small">${esc(session.user.email)}</div></div><div class="metric"><b>Name your Pom</b><input id="pomNameInput" class="search" maxlength="20" value="${esc(pomName())}" placeholder="Gizmo"><div class="small">This is your personal Pom name. PomFit remains the app name.</div></div><div class="metric"><b>Bark reminder</b><label class="toggle"><input type="checkbox" id="barkReminderToggle" ${barkEnabled()?'checked':''}> Bark if today's meals or workout are incomplete</label><label class="small">Reminder time <input id="barkReminderTime" type="time" value="${esc(barkTime())}"></label><button class="ghost" id="testBarkBtn">Test ${esc(pomName())}'s bark</button><div class="small">Off by default. Bark works while PomFit is open or brought to the foreground.</div></div><div class="metric"><b>Household</b>${esc(household?.name||'')}</div><div class="metric"><b>Join code</b><div class="invite">${esc(household?.invite_code||'')}</div><div class="small">Use this code for another household member.</div></div><div class="metric"><b>App version</b>PomFit v16<div class="small">If this is not v16, update the app.</div></div></div><button class="secondary" id="updateAppBtn">Update PomFit</button><button class="ghost" id="signOutBtn">Sign out</button></div>`;
}
function render(){
  if(!shared)return;
  $('#speech').textContent=tip();
  $$('#profileSeg button').forEach(b=>b.classList.toggle('active',b.dataset.p===ui.view));
  $$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===ui.tab));
  $('#workoutToggle').checked=workoutShown(ui.view);
  const pages={today:renderToday,week:renderWeek,prep:renderPrep,grocery:renderGrocery,season:renderSeason,workout:renderWorkout,profile:renderProfile,account:renderAccount};
  $('#content').innerHTML=pages[ui.tab]();bindDynamic();
}
async function savePersonal(patch){
  personal={...personal,...patch,updated_at:new Date().toISOString()};syncMsg('Saving personal changes…');
  const r=await supabase.from('personal_state').update({...patch,updated_at:personal.updated_at}).eq('user_id',session.user.id);syncMsg(r.error?'Save failed':'Synced');
}
async function saveShared(patch){
  shared={...shared,...patch,updated_at:new Date().toISOString(),updated_by:session.user.id};syncMsg('Saving shared changes…');
  const r=await supabase.from('household_state').update({...patch,updated_at:shared.updated_at,updated_by:session.user.id}).eq('household_id',profile.household_id);syncMsg(r.error?'Shared save failed':'Synced');
}
let noteTimer;
function bindDynamic(){
  $$('[data-check]').forEach(x=>x.onchange=()=>savePersonal({settings:{...(personal.settings||{}),meal_checks:{...checks(),[x.dataset.check]:x.checked}}}));
  $$('[data-workout-check]').forEach(x=>x.onchange=()=>savePersonal({settings:{...(personal.settings||{}),workout_checks:{...workoutChecks(),[x.dataset.workoutCheck]:x.checked}}}));
  $$('[data-prep]').forEach(x=>x.onchange=()=>{saveShared({prep_tasks:prep().map(t=>t.id===x.dataset.prep?{...t,checked:x.checked}:t)});x.nextElementSibling.classList.toggle('done',x.checked);});
  $$('[data-g]').forEach(x=>x.onchange=()=>{saveShared({groceries:groceries().map(t=>t.id===x.dataset.g?{...t,checked:x.checked}:t)});x.nextElementSibling.classList.toggle('done',x.checked);});
  if($('#notes'))$('#notes').oninput=e=>{clearTimeout(noteTimer);noteTimer=setTimeout(()=>savePersonal({notes:{...(personal.notes||{}),free_text:e.target.value}}),500);};
  if($('#resetG'))$('#resetG').onclick=()=>saveShared({groceries:groceries().map(x=>({...x,checked:false}))}).then(render);
  if($('#seasonSearch'))$('#seasonSearch').oninput=e=>$$('#seasonList details').forEach(d=>d.classList.toggle('hidden',!d.dataset.search.includes(e.target.value.toLowerCase())));
  if($('#dietStyle'))$('#dietStyle').value=dietStyle();
  if($('#saveProfileBtn'))$('#saveProfileBtn').onclick=async()=>{
    const goals=$$('[data-goal]:checked').map(x=>x.dataset.goal);
    const meals={};
    ['breakfast','lunch','afternoon','dinner'].forEach(k=>{
      meals[k]={enabled:!!$('[data-meal-enabled="'+k+'"]')?.checked,time:$('[data-meal-time="'+k+'"]')?.value||'',location:$('[data-meal-location="'+k+'"]')?.value||''};
    });
    const next={...personalProfile(),onboarding_complete:true,age:Number($('#profAge').value)||null,height_in:Number($('#profHeight').value)||null,weight_lb:Number($('#profWeight').value)||null,diet_style:$('#dietStyle').value,food_likes:$('#foodLikes').value.trim(),food_dislikes:$('#foodDislikes').value.trim(),intermittent_fasting:$('#ifToggle').checked,fasting_start:$('#ifStart').value,fasting_end:$('#ifEnd').value,workout_goals:goals,meals};
    await savePersonal({settings:{...(personal.settings||{}),profile_config:next}});
    ui.tab='today';render();
  };
  if($('#profileWorkout'))$('#profileWorkout').onchange=async e=>{profile={...profile,workout_enabled:e.target.checked};await supabase.from('profiles').update({workout_enabled:e.target.checked,updated_at:new Date().toISOString()}).eq('user_id',session.user.id);render();};
  if($('#pomNameInput'))$('#pomNameInput').onchange=async e=>{const name=(e.target.value.trim()||'Gizmo').slice(0,20);e.target.value=name;await savePersonal({settings:{...(personal.settings||{}),pom_name:name}});render();};
  if($('#barkReminderToggle'))$('#barkReminderToggle').onchange=async e=>{await savePersonal({settings:{...(personal.settings||{}),bark_reminder_enabled:e.target.checked}});if(e.target.checked)playBark();};
  if($('#barkReminderTime'))$('#barkReminderTime').onchange=async e=>{await savePersonal({settings:{...(personal.settings||{}),bark_reminder_time:e.target.value||'20:00'}});};
  if($('#testBarkBtn'))$('#testBarkBtn').onclick=()=>playBark();
  if($('#updateAppBtn'))$('#updateAppBtn').onclick=()=>location.href='./refresh.html?v=16';
  if($('#signOutBtn'))$('#signOutBtn').onclick=signOut;
}

$('#showSignupBtn').onclick=()=>{$('#loginPanel').classList.add('hidden');$('#signupPanel').classList.remove('hidden');};
$('#showLoginBtn').onclick=()=>{$('#signupPanel').classList.add('hidden');$('#loginPanel').classList.remove('hidden');};
$('#signInBtn').onclick=signIn;$('#signUpBtn').onclick=signUp;$('#createHouseholdBtn').onclick=createHousehold;$('#joinHouseholdBtn').onclick=joinHousehold;$('#setupSignOutBtn').onclick=signOut;
$('#profileSeg').onclick=e=>{if(e.target.dataset.p){ui.view=e.target.dataset.p;render();}};
$('#nav').onclick=e=>{if(e.target.dataset.tab){ui.tab=e.target.dataset.tab;render();}};
$('#workoutToggle').onchange=async e=>{if(ui.view===myView()){profile={...profile,workout_enabled:e.target.checked};await supabase.from('profiles').update({workout_enabled:e.target.checked,updated_at:new Date().toISOString()}).eq('user_id',session.user.id);}render();};
$('#accountBtn').onclick=()=>{ui.tab='account';render();};

supabase.auth.onAuthStateChange((_event,s)=>handleSession(s));
const {data:{session:initial}}=await supabase.auth.getSession();await handleSession(initial);
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(console.error);
setInterval(()=>maybeBarkReminder().catch(console.error),60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')maybeBarkReminder().catch(console.error);});
setTimeout(()=>maybeBarkReminder().catch(console.error),1500);
