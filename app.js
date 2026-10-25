import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
import { DEFAULT_DATA } from './data.js?v=14';

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
  try{await load();if(!profile.household_id){show('setupShell');return;}await seed();await enterApp();}
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
  if(ui.view==='Clark')return k==='breakfast'?d.clark_am:k==='afternoon'?d.clark_afternoon:d[k];
  if(ui.view==='Elizabeth')return k==='breakfast'?d.elizabeth_breakfast:k==='afternoon'?d.elizabeth_snack:d[k];
  if(k==='breakfast')return `Clark: ${d.clark_am}\nElizabeth: ${d.elizabeth_breakfast}`;
  if(k==='afternoon')return `Clark: ${d.clark_afternoon}\nElizabeth: ${d.elizabeth_snack}`;
  return d[k];
}
function meal(d,i,k,label){
  const t=textFor(d,k);if(!t)return'';const id=`${i}-${ui.view}-${k}`;
  return `<div class="meal"><input class="check" type="checkbox" data-check="${esc(id)}" ${checks()[id]?'checked':''}><b>${label}</b><p>${esc(t)}</p></div>`;
}
function dayCard(d,i){
  let w='';if(workoutShown(ui.view)){
    w=ui.view==='Both'? `<div class="work"><b>Clark:</b> ${esc(d.workout_c)}<br><b>Elizabeth:</b> ${esc(d.workout_e)}</div>`
      : `<div class="work"><b>Workout:</b> ${esc(ui.view==='Clark'?d.workout_c:d.workout_e)}</div>`;
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
  return `<div class="card"><h2>${esc(p)} workout</h2>${isMe?`<label class="toggle"><input type="checkbox" id="profileWorkout" ${profile.workout_enabled!==false?'checked':''}> Workouts ON for ${esc(p)}</label><p class="small">Personal setting; shared meals stay unchanged.</p>`:'<p class="small">You can view the plan, but the other person’s private workout log is not shared.</p>'}</div><div class="weekgrid">${menu().days.map(d=>`<div class="card"><h3>${esc(d.date)}</h3><div class="work">${esc(p==='Clark'?d.workout_c:d.workout_e)}</div></div>`).join('')}</div>`;
}
function renderAccount(){
  return `<div class="card"><h2>Account & household</h2><div class="account-grid"><div class="metric"><b>Signed in as</b>${esc(myName())}<div class="small">${esc(session.user.email)}</div></div><div class="metric"><b>Name your Pom</b><input id="pomNameInput" class="search" maxlength="20" value="${esc(pomName())}" placeholder="Gizmo"><div class="small">This is your personal Pom name. PomFit remains the app name.</div></div><div class="metric"><b>Household</b>${esc(household?.name||'')}</div><div class="metric"><b>Join code</b><div class="invite">${esc(household?.invite_code||'')}</div><div class="small">Use this code for another household member.</div></div><div class="metric"><b>App version</b>PomFit v14<div class="small">If this is not v14, update the app.</div></div></div><button class="secondary" id="updateAppBtn">Update PomFit</button><button class="ghost" id="signOutBtn">Sign out</button></div>`;
}
function render(){
  if(!shared)return;
  $('#speech').textContent=tip();
  $$('#profileSeg button').forEach(b=>b.classList.toggle('active',b.dataset.p===ui.view));
  $$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===ui.tab));
  $('#workoutToggle').checked=workoutShown(ui.view);
  const pages={today:renderToday,week:renderWeek,prep:renderPrep,grocery:renderGrocery,season:renderSeason,workout:renderWorkout,account:renderAccount};
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
  $$('[data-prep]').forEach(x=>x.onchange=()=>{saveShared({prep_tasks:prep().map(t=>t.id===x.dataset.prep?{...t,checked:x.checked}:t)});x.nextElementSibling.classList.toggle('done',x.checked);});
  $$('[data-g]').forEach(x=>x.onchange=()=>{saveShared({groceries:groceries().map(t=>t.id===x.dataset.g?{...t,checked:x.checked}:t)});x.nextElementSibling.classList.toggle('done',x.checked);});
  if($('#notes'))$('#notes').oninput=e=>{clearTimeout(noteTimer);noteTimer=setTimeout(()=>savePersonal({notes:{...(personal.notes||{}),free_text:e.target.value}}),500);};
  if($('#resetG'))$('#resetG').onclick=()=>saveShared({groceries:groceries().map(x=>({...x,checked:false}))}).then(render);
  if($('#seasonSearch'))$('#seasonSearch').oninput=e=>$$('#seasonList details').forEach(d=>d.classList.toggle('hidden',!d.dataset.search.includes(e.target.value.toLowerCase())));
  if($('#profileWorkout'))$('#profileWorkout').onchange=async e=>{profile={...profile,workout_enabled:e.target.checked};await supabase.from('profiles').update({workout_enabled:e.target.checked,updated_at:new Date().toISOString()}).eq('user_id',session.user.id);render();};
  if($('#pomNameInput'))$('#pomNameInput').onchange=async e=>{const name=(e.target.value.trim()||'Gizmo').slice(0,20);e.target.value=name;await savePersonal({settings:{...(personal.settings||{}),pom_name:name}});render();};
  if($('#updateAppBtn'))$('#updateAppBtn').onclick=()=>location.href='./refresh.html?v=14';
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
