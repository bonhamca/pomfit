import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
import { DEFAULT_DATA } from './data.js?v=56';

const supabase=createClient(
  'https://wbskfggewwlkeplswpan.supabase.co',
  'sb_publishable_y9L64jb_Xp3aBUuTsMIK4w_0-4b_S-D',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let session,profile,household,shared,personal,channels=[];
const APP_VERSION=60;
let ui={view:'Clark',tab:'today'};
let groceryMode='all';
let profileFormDirty=false;
const TOUR_VERSION=1;
let tour={active:false,index:0,replay:false};
function tourSteps(){
  return [
    {tab:'today',title:'Welcome to PomFit',body:`Hi, I’m ${pomName()}. I’ll show you the basics. PomFit keeps shared household planning together while your Profile, workouts, notes and preferences stay personal.`},
    {tab:'profile',title:'1. Build My Profile',body:'Start here. Add age, height, current and goal weight, calorie-estimate settings; choose a diet; list foods you like or dislike; set fasting and meal times; pick training goals, sports and equipment. If you use Peloton, Tonal, Hydrow, iFIT or another structured program, enter the program and its usual days so PomFit schedules around it.'},
    {tab:'today',title:'2. Use Today as your dashboard',body:'Use the Energy & weight card to track calorie intake, workout burn, and weight. Check off meals and workouts as you finish them. Breakfast, lunch and snacks can be personalized. Dinner is shared with the household. Use Different flavor when you want the same protein and sides with a new seasoning.'},
    {tab:'week',title:'3. Adjust meals when needed',body:'Use “Not this meal — give me another” when you simply want something different today. It does not mark the meal as disliked. Dinner changes are labeled for the whole household.'},
    {tab:'workout',title:'4. Let PomFit coordinate training',body:'Your workout plan uses your goals, sport preparation and equipment. Structured programs and scheduled tests—such as a Peloton FTP test—take priority. For recognized Peloton Power Zone programs, PomFit uses the program name plus start date to calculate the current week/day and protect legs around hard rides and FTP tests.'},
    {tab:'grocery',title:'5. Know what is shared',body:'Grocery checks, meal prep and dinners are household-shared. Use the Grocery screen to confirm what is available, add ingredients you already have and want to use, mark an item Unavailable, then either shop for it or let PomFit change affected meals. Your Profile, workout completion, measurements and private notes are personal.'},
    {tab:'today',title:'6. Ask for a little more food',body:'If you are still hungry, use “I’m still hungry — what can I eat?” PomFit suggests a small add-on that respects your diet, disliked foods and fasting window.'},
    {tab:'account',title:'7. Reminders and Gizmo',body:`In Account you can rename your Pom, test ${pomName()}’s bark, turn bark reminders on or off, choose the reminder time, update PomFit and replay this tour anytime.`},
    {tab:'today',title:'You’re ready',body:'Use Today for the daily plan, Profile whenever your goals or equipment change, and Week to look ahead. You can replay this walkthrough from Account whenever you want.'}
  ];
}
function shouldAutoTour(){
  return Number(personal?.settings?.app_tour_version||0)<TOUR_VERSION;
}
function removeTour(){
  const el=document.getElementById('tourOverlay');
  if(el)el.remove();
}
function renderTourStep(){
  if(!tour.active)return;
  const steps=tourSteps(),step=steps[tour.index];
  if(!step){finishTour();return;}
  if(step.tab&&ui.tab!==step.tab){ui.tab=step.tab;render();}
  removeTour();
  const overlay=document.createElement('div');
  overlay.id='tourOverlay';
  overlay.className='tour-overlay';
  overlay.innerHTML=`<div class="tour-card" role="dialog" aria-modal="true" aria-label="PomFit app tour">
    <div class="tour-head"><div class="tour-pom">🐾</div><div><div class="tour-kicker">${esc(pomName())}’s tour</div><h2>${esc(step.title)}</h2></div></div>
    <p class="tour-body">${esc(step.body)}</p>
    <div class="tour-progress">Step ${tour.index+1} of ${steps.length}</div>
    <div class="tour-actions">
      <button class="ghost" id="tourSkipBtn">${tour.replay?'Close tour':'Skip tour'}</button>
      <div class="tour-spacer"></div>
      <button class="ghost" id="tourBackBtn" ${tour.index===0?'disabled':''}>Back</button>
      <button class="primary" id="tourNextBtn">${tour.index===steps.length-1?'Finish':'Next'}</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  document.getElementById('tourSkipBtn').onclick=()=>finishTour(true);
  document.getElementById('tourBackBtn').onclick=()=>{if(tour.index>0){tour.index--;renderTourStep();}};
  document.getElementById('tourNextBtn').onclick=()=>{if(tour.index>=steps.length-1)finishTour(false);else{tour.index++;renderTourStep();}};
}
function startTour(replay=false){
  if(!session||!personal||!shared)return;
  tour={active:true,index:0,replay};
  renderTourStep();
}
async function finishTour(skipped=false){
  const wasReplay=tour.replay;
  tour={active:false,index:0,replay:false};
  removeTour();
  if(!wasReplay){
    try{
      await savePersonal({settings:{...(personal.settings||{}),app_tour_version:TOUR_VERSION,app_tour_completed_at:new Date().toISOString(),app_tour_skipped:!!skipped}});
    }catch(e){console.error('Tour completion save failed',e);}
  }
}
function maybeStartTour(){
  if(shouldAutoTour()&&!tour.active)setTimeout(()=>startTour(false),250);
}

function show(id){['authShell','setupShell','appShell'].forEach(x=>$('#'+x).classList.toggle('hidden',x!==id));}
function notice(id,msg,bad=false){const e=$(id);if(!msg){e.classList.add('hidden');return;}e.textContent=msg;e.className='notice'+(bad?' error':'');}
function myName(){return profile?.display_name||session?.user?.user_metadata?.display_name||session?.user?.email?.split('@')[0]||'Me';}
function myView(){return myName().toLowerCase().includes('elizabeth')?'Elizabeth':'Clark';}
function pomName(){return String(personal?.settings?.pom_name||'Gizmo').trim()||'Gizmo';}
function syncMsg(t){if($('#syncStatus'))$('#syncStatus').textContent=t;}
function todayIndex(){const d=new Date().getDay();return d===0?0:Math.min(6,d);}
function storedVitals(){
  const m=personal?.measurements;
  if(m && !Array.isArray(m) && m.profile_vitals && typeof m.profile_vitals==='object')return m.profile_vitals;
  return {};
}
function personalProfile(){
  const base=personal?.settings?.profile_config||{};
  const v=storedVitals();
  return {
    ...base,
    age:v.age??base.age??null,
    height_in:v.height_in??base.height_in??null,
    weight_lb:v.weight_lb??base.weight_lb??null
  };
}
function profileReady(){return personalProfile().onboarding_complete===true;}
function vitalsComplete(){
  const p=personalProfile();
  return Number.isFinite(Number(p.age))&&Number(p.age)>0&&Number.isFinite(Number(p.height_in))&&Number(p.height_in)>0&&Number.isFinite(Number(p.weight_lb))&&Number(p.weight_lb)>0;
}
function energyLog(){const x=personal?.settings?.energy_log;return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}
function isoDateForDay(i,d){
  const date=menuDateForDay(d,i);
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),day=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function energyDay(i,d){return energyLog()[isoDateForDay(i,d)]||{};}
function loggedWeightForDay(i,d){
  const n=Number(energyDay(i,d).weight_lb);
  return Number.isFinite(n)&&n>0?n:null;
}
function currentWeightForEnergy(i=todayIndex(),d=menu().days[i]){
  return loggedWeightForDay(i,d)||Number(personalProfile().weight_lb)||null;
}
function energySex(){return personalProfile().calorie_equation_sex||'';}
function baselineActivity(){return personalProfile().baseline_activity||'light';}
function goalWeight(){const n=Number(personalProfile().goal_weight_lb);return Number.isFinite(n)&&n>0?n:null;}
function goalRate(){const n=Number(personalProfile().goal_rate_lb_week);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0.5;}
function bmrEstimate(weightLb=currentWeightForEnergy()){
  const p=personalProfile(),age=Number(p.age),heightIn=Number(p.height_in),sex=energySex();
  if(!weightLb||!age||!heightIn||!sex||age<18)return null;
  const kg=weightLb*0.45359237,cm=heightIn*2.54;
  const c=sex==='male'?5:sex==='female'?-161:-78;
  return 10*kg+6.25*cm-5*age+c;
}
function baselineMaintenance(weightLb=currentWeightForEnergy()){
  const bmr=bmrEstimate(weightLb); if(!bmr)return null;
  const factors={sedentary:1.2,light:1.3,moderate:1.4,active:1.5};
  return bmr*(factors[baselineActivity()]||1.3);
}
function workoutMinutes(text){
  const t=String(text||'');
  const range=t.match(/(\d+)\s*[–-]\s*(\d+)\s*min/i);
  if(range)return (Number(range[1])+Number(range[2]))/2;
  const all=[...t.matchAll(/(\d+)\s*[- ]?min/i)].map(m=>Number(m[1])).filter(Number.isFinite);
  return all.length?Math.max(...all):30;
}
function workoutMet(text){
  const t=String(text||'').toLowerCase();
  if(/ftp|power zone max|max ride|race|sprint|hiit|hard intervals/.test(t))return 8.5;
  if(/power zone ride|threshold|interval/.test(t))return 7.5;
  if(/power zone endurance|endurance ride|peloton|cycling|bike/.test(t))return 6.0;
  if(/strength|bowflex|weights|resistance/.test(t))return 4.5;
  if(/walk|walking/.test(t))return 3.8;
  if(/mobility|stretch|recovery/.test(t))return 2.5;
  if(/rest/.test(t))return 1.5;
  return 4.0;
}
function estimateWorkoutCalories(text,weightLb=currentWeightForEnergy()){
  if(!weightLb||!text)return 0;
  const kg=weightLb*0.45359237,mins=workoutMinutes(text),met=workoutMet(text);
  return Math.max(0,Math.round(met*3.5*kg/200*mins));
}
function loggedWorkoutCalories(i,d){
  const n=Number(energyDay(i,d).workout_calories);
  return Number.isFinite(n)&&n>=0?n:null;
}
function workoutCaloriesForTarget(i,d){
  const actual=loggedWorkoutCalories(i,d);
  if(actual!==null)return actual;
  return estimateWorkoutCalories(plannedWorkoutFor(myView(),i,d));
}
function mealPortionOz(text,person=myView()){
  const t=String(text||'');
  const named=t.match(new RegExp(person+'\\s*(\\d+(?:\\.\\d+)?)\\s*oz','i'));
  if(named)return Number(named[1]);
  const generic=t.match(/(\d+(?:\.\d+)?)\s*oz(?:\s+cooked)?/i);
  return generic?Number(generic[1]):null;
}
function estimateMealCalories(text){
  const t=String(text||'').toLowerCase();
  if(!t||/\bfast\b/.test(t))return 0;
  let c=0;
  if(/\bchike\b/.test(t))c+=110;
  else if(/\blevels\b/.test(t))c+=130;
  else if(/protein shake|whey|protein drink/.test(t))c+=130;
  if(/salmon/.test(t))c+=360;
  else if(/beef|steak|sirloin|flank/.test(t))c+=360;
  else if(/chicken/.test(t))c+=300;
  else if(/cod|tilapia|sole|branzino|sea bass|catfish|trout/.test(t))c+=250;
  else if(/shrimp|tuna/.test(t))c+=220;
  if(/egg/.test(t))c+=140;
  if(/swiss|cheese|parmesan/.test(t))c+=100;
  if(/milk/.test(t))c+=100;
  if(/pistachio|pepita|nuts|seeds/.test(t))c+=160;
  if(/avocado/.test(t))c+=100;
  if(/berries|grapefruit|fruit/.test(t))c+=60;
  if(/bread|bun|rice|potato|oats|whole-grain|whole grain|beans/.test(t))c+=140;
  if(/olive oil|butter|tallow/.test(t))c+=80;
  if(/asparagus|broccoli|green beans|zucchini|mushroom|salad|romaine|spinach|vegetable|greens/.test(t))c+=80;
  return Math.max(100,Math.round(c||350));
}
function estimateMealProtein(text){
  const raw=String(text||''),t=raw.toLowerCase();
  if(!t||/\bfast\b/.test(t))return 0;
  let g=0;
  if(/\bchike\b/.test(t))g+=20;
  else if(/\blevels\b/.test(t))g+=24;
  else if(/protein shake|whey|protein drink/.test(t))g+=24;
  if(/salmon|beef|steak|sirloin|flank|chicken|cod|tilapia|sole|branzino|sea bass|catfish|trout|shrimp|tuna/.test(t)){
    const oz=mealPortionOz(raw);
    g+=oz?oz*7:28;
  }
  const eggs=t.match(/(\d+(?:\.\d+)?)\s*(?:boiled\s+)?eggs?/);
  if(eggs)g+=Number(eggs[1])*6; else if(/\begg\b/.test(t))g+=6;
  const cheese=t.match(/(\d+(?:\.\d+)?)\s*oz\s*(?:swiss|cheese|parmesan)/);
  if(cheese)g+=Number(cheese[1])*7; else if(/swiss|cheese|parmesan/.test(t))g+=7;
  if(/\bmilk\b/.test(t))g+=8;
  if(/pistachio|pepita|nuts|seeds/.test(t))g+=6;
  if(/beans|lentils|chickpeas|hummus/.test(t))g+=7;
  return Math.max(0,Math.round(g));
}
function loggedMealCalories(i,d,k){
  const n=Number(energyDay(i,d)?.meals?.[k]);
  return Number.isFinite(n)&&n>=0?n:null;
}
function loggedMealProtein(i,d,k){
  const n=Number(energyDay(i,d)?.protein_meals?.[k]);
  return Number.isFinite(n)&&n>=0?n:null;
}
function supplementEntries(i,d){
  const a=energyDay(i,d)?.supplements;
  return Array.isArray(a)?a:[];
}
function supplementCaloriesLogged(i,d){return supplementEntries(i,d).reduce((sum,x)=>sum+(Number(x?.calories)||0),0);}
function supplementProteinLogged(i,d){return supplementEntries(i,d).reduce((sum,x)=>sum+(Number(x?.protein_g)||0),0);}
function foodCaloriesLogged(i,d){
  const e=energyDay(i,d),meals=e.meals&&typeof e.meals==='object'?e.meals:{};
  const mealTotal=Object.values(meals).reduce((sum,v)=>sum+(Number(v)||0),0);
  return mealTotal+(Number(e.other_calories)||0)+supplementCaloriesLogged(i,d);
}
function proteinLogged(i,d){
  const e=energyDay(i,d),meals=e.protein_meals&&typeof e.protein_meals==='object'?e.protein_meals:{};
  const mealTotal=Object.values(meals).reduce((sum,v)=>sum+(Number(v)||0),0);
  return Math.round(mealTotal+(Number(e.other_protein_g)||0)+supplementProteinLogged(i,d));
}
function calorieTargetForDay(i,d){
  const weight=currentWeightForEnergy(i,d),base=baselineMaintenance(weight);
  if(!base)return null;
  const goal=goalWeight(),rate=goalRate();
  let adjust=0;
  if(goal&&Math.abs(goal-weight)>=0.5){
    const daily=500*rate;
    adjust=goal<weight?-daily:daily;
  }
  const target=Math.round(base+workoutCaloriesForTarget(i,d)+adjust);
  return Math.max(1200,target);
}
function proteinTargetForDay(i,d){
  const override=Number(personalProfile().protein_target_g);
  if(Number.isFinite(override)&&override>=40)return Math.round(override);
  const weight=currentWeightForEnergy(i,d);
  if(!weight)return null;
  const goal=goalWeight(),basis=goal&&goal<weight?goal:weight;
  const goals=workoutGoals(),highProtein=dietStyle()==='musclegain'||dietStyle()==='performance'||goals.some(x=>['strength','muscle','cycling','running','ski'].includes(x));
  return Math.max(50,Math.round(basis*(highProtein?0.8:0.7)));
}
function energyRemaining(i,d){
  const target=calorieTargetForDay(i,d);
  return target===null?null:Math.round(target-foodCaloriesLogged(i,d));
}
function proteinRemaining(i,d){
  const target=proteinTargetForDay(i,d);
  return target===null?null:Math.max(0,Math.round(target-proteinLogged(i,d)));
}
const PROTEIN_PRODUCTS={
  levels:{label:'Levels whey',serving_scoops:1,protein_g:24,calories:130,caffeine_mg:0},
  chike:{label:'Chike Mocha',serving_scoops:2,protein_g:20,calories:110,caffeine_mg:150}
};
function proteinSupplementAdvice(i,d){
  const gap=proteinRemaining(i,d),target=proteinTargetForDay(i,d);
  if(target===null)return 'Set your weight (or a protein target override) to get a protein recommendation.';
  if(gap<=5)return 'Protein target is essentially met. No shake is needed just to add more protein.';
  if(gap<=12)return 'Small gap: about 1/2 scoop Levels (≈12 g) or 1 scoop Chike (≈10 g) would cover most of it.';
  if(gap<=24)return 'One serving is usually enough: Levels 1 scoop = 24 g protein; Chike 2 scoops = 20 g protein.';
  return 'Larger gap: use a protein-rich meal plus, if useful, one powder serving. PomFit will not automatically stack multiple shakes.';
}
function supplementHistoryHtml(i,d){
  const entries=supplementEntries(i,d);
  if(!entries.length)return '';
  const rows=entries.map(x=>`<span class="supplement-chip">${esc(x.label||'Protein powder')} • ${esc(x.scoops)} scoop${Number(x.scoops)===1?'':'s'} • +${esc(x.protein_g)} g • +${esc(x.calories)} kcal</span>`).join('');
  return `<div class="supplement-history">${rows}<button class="ghost" data-undo-protein-supplement="${i}">Undo last powder</button></div>`;
}
function renderEnergyDashboard(i,d){
  if(ui.view!==myView())return '';
  const p=personalProfile(),target=calorieTargetForDay(i,d),eaten=foodCaloriesLogged(i,d),burn=workoutCaloriesForTarget(i,d),remaining=energyRemaining(i,d);
  const pTarget=proteinTargetForDay(i,d),pEaten=proteinLogged(i,d),pRemaining=proteinRemaining(i,d);
  const weight=loggedWeightForDay(i,d)??p.weight_lb??'',goal=goalWeight();
  const ready=target!==null,pReady=pTarget!==null;
  return `<div class="card energy-card"><div class="dayhead"><div><h3>Calories & protein</h3><div class="small">${goal?`Goal weight: ${esc(goal)} lb`:'Set a goal weight in Profile'} • ${esc(profileSummaryText().diet)}</div></div><span class="badge ${ready&&pReady?'ok-badge':'warn-badge'}">${ready&&pReady?'TRACKING':'SETUP'}</span></div>
    ${ready?`<div class="energy-grid"><div><b>${target}</b><span>calorie target</span></div><div><b>${eaten}</b><span>calories logged</span></div><div><b>${remaining}</b><span>calories remaining</span></div><div><b>${burn}</b><span>workout burn${loggedWorkoutCalories(i,d)!==null?' actual/logged':' est.'}</span></div>${pReady?`<div><b>${pTarget} g</b><span>protein target</span></div><div><b>${pEaten} g</b><span>protein logged</span></div><div><b>${pRemaining} g</b><span>protein remaining</span></div>`:''}</div>`:`<p class="small">To calculate targets, complete age, height, weight and the calorie-estimate fields in Profile.</p>`}
    <div class="energy-entry"><label class="small">Today's weight (lb)<input class="search" type="number" step=".1" min="70" max="600" data-energy-weight="${i}" value="${esc(weight)}"></label><label class="small">Other / drink calories<input class="search" type="number" step="1" min="0" data-energy-other="${i}" value="${esc(energyDay(i,d).other_calories??'')}"></label><label class="small">Other protein (g)<input class="search" type="number" step="1" min="0" data-energy-other-protein="${i}" value="${esc(energyDay(i,d).other_protein_g??'')}"></label><button class="secondary" data-save-energy-day="${i}">Save daily totals</button></div>
    <div class="supplement-log"><div><b>Protein powder quick log</b><div class="small">${esc(proteinSupplementAdvice(i,d))}</div></div><div class="supplement-controls"><label class="small">Powder<select class="search" data-protein-product><option value="levels">Levels whey</option><option value="chike">Chike Mocha</option></select></label><label class="small">Amount<select class="search" data-protein-servings><option value=".5">½ serving</option><option value="1" selected>1 serving</option><option value="1.5">1½ servings</option><option value="2">2 servings</option></select></label><button class="secondary" data-log-protein-supplement="${i}">Log powder</button></div><div class="small">Levels: 1 scoop = 1 serving = 24 g protein (PomFit uses 130 kcal as the powder estimate). Chike Mocha: 2 scoops = 1 serving = 20 g protein, 110 kcal and 150 mg caffeine. Powder only; milk, fruit or other mix-ins are logged separately. Chike is caffeinated, so count it toward your day's caffeine.</div>${supplementHistoryHtml(i,d)}</div>
    <p class="small">Calorie, protein and workout numbers are estimates unless you enter label/device values. The automatic protein target uses about 0.7 g/lb of target body weight, or 0.8 g/lb for performance/strength-focused profiles; you can override it in Profile.</p><button class="ghost" id="editEnergyProfileBtn">Edit calorie, protein & weight goals</button></div>`;
}
function profileSummaryText(){
  const p=personalProfile();
  const dietLabels={balanced:'Balanced',performance:'Athletic performance',musclegain:'Muscle gain / high protein',mediterranean:'Mediterranean',lowcarb:'Low carb',keto:'Keto',pescatarian:'Pescatarian',vegetarian:'Vegetarian'};
  const goals=workoutGoals().map(g=>({sculpt:'Sculpt / tone',strength:'Strength',muscle:'Muscle building',cardio:'Cardio',hiit:'HIIT',mobility:'Mobility',core:'Core',ski:'Skiing',cycling:'Cycling',running:'Running',tennis:'Tennis',boxing:'Boxing',swimming:'Swimming',soccer:'Soccer',basketball:'Basketball'}[g]||g));
  return {diet:dietLabels[p.diet_style]||'Balanced',goals:goals.join(', ')||'Not selected'};
}
function dietStyle(){return personalProfile().diet_style||'balanced';}
function foodList(key){return String(personalProfile()[key]||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);}
function mealSchedule(){return personalProfile().meals||{
  breakfast:{enabled:true,time:'08:00',location:'Home'},
  lunch:{enabled:true,time:'12:30',location:'Work'},
  afternoon:{enabled:true,time:'16:00',location:'Work'},
  dinner:{enabled:true,time:'19:00',location:'Home'}
};}
function workoutGoals(){const g=personalProfile().workout_goals;return Array.isArray(g)?g:[];}
function equipmentList(){const e=personalProfile().equipment;return Array.isArray(e)?e:[];}
function equipmentNotes(){return String(personalProfile().equipment_notes||'').trim();}
function trainingPrograms(){const p=personalProfile().training_programs;return p&&typeof p==='object'&&!Array.isArray(p)?p:{};}
const PROGRAM_DEVICES={
  peloton_bike:'Peloton Bike',
  peloton_tread:'Peloton Tread',
  peloton_row:'Peloton Row',
  tonal:'Tonal',
  hydrow:'Hydrow',
  ifit:'NordicTrack / iFIT',
  concept2:'Concept2',
  other_program:'Other structured training device/app'
};
const PELOTON_PROGRAM_TEMPLATES={
  discover:{
    label:'Discover Your Power Zones',weeks:5,
    aliases:['discover your power zones','introduction to power zones','intro to power zones'],
    schedule:{
      1:[{day:1,load:'easy',text:'Intro to Power Zones + beginner ride'},{day:3,load:'test',text:'FTP warm-up + 20-min FTP test'},{day:4,load:'moderate',text:'Power Zone Endurance ride'},{day:5,load:'recovery',text:'Low Impact ride'},{day:6,load:'moderate',text:'Power Zone Endurance ride'}],
      2:[{day:1,load:'moderate',text:'Power Zone ride'},{day:3,load:'moderate',text:'Power Zone Endurance ride'},{day:4,load:'moderate',text:'Power Zone Endurance ride'},{day:6,load:'moderate',text:'Power Zone Endurance ride'}],
      3:[{day:1,load:'hard',text:'Power Zone ride'},{day:3,load:'hard',text:'Power Zone ride'},{day:4,load:'moderate',text:'Power Zone Endurance ride'},{day:6,load:'moderate',text:'Power Zone Endurance ride'}],
      4:[{day:1,load:'hard',text:'Power Zone ride'},{day:3,load:'hard',text:'Power Zone ride'},{day:4,load:'moderate',text:'Power Zone Endurance ride'},{day:6,load:'long',text:'60-min Power Zone Endurance ride'}],
      5:[{day:1,load:'moderate',text:'Power Zone Endurance ride'},{day:2,load:'recovery',text:'Low Impact ride'},{day:3,load:'moderate',text:'Power Zone Endurance ride'},{day:4,load:'moderate',text:'Power Zone Endurance ride'},{day:6,load:'test',text:'FTP warm-up + 20-min FTP test'}]
    }
  },
  build:{
    label:'Build Your Power Zones',weeks:5,
    aliases:['build your power zones','build your power zone'],
    schedule:{
      1:[{day:1,load:'moderate',text:'45-min Power Zone Endurance ride'},{day:3,load:'moderate',text:'45-min Power Zone Endurance ride'},{day:6,load:'long',text:'60-min Power Zone Endurance ride'}],
      2:[{day:1,load:'hard',text:'45-min Power Zone ride'},{day:3,load:'moderate',text:'45-min Power Zone Endurance ride'},{day:6,load:'long',text:'60-min Power Zone Endurance ride'}],
      3:[{day:1,load:'hard',text:'45-min Power Zone ride'},{day:3,load:'hard',text:'45-min Power Zone ride'},{day:6,load:'long',text:'60-min Power Zone Endurance ride'}],
      4:[{day:1,load:'max',text:'45-min Power Zone Max ride'},{day:3,load:'hard',text:'45-min Power Zone ride'},{day:6,load:'long',text:'60-min Power Zone ride'}],
      5:[{day:1,load:'recovery',text:'45-min Power Zone Endurance ride'},{day:3,load:'recovery',text:'45-min Power Zone Endurance ride'},{day:6,load:'test',text:'FTP warm-up + 20-min FTP test'}]
    }
  },
  peak:{
    label:'Peak Your Power Zones',weeks:8,
    aliases:['peak your power zones','peak your power zone'],
    schedule:{
      1:[{day:1,load:'moderate',text:'45-min Power Zone Endurance ride'},{day:3,load:'moderate',text:'45-min Power Zone Endurance ride'},{day:6,load:'long',text:'60-min Power Zone Endurance ride'}],
      2:[{day:1,load:'hard',text:'45-min Power Zone ride'},{day:3,load:'moderate',text:'45-min Power Zone Endurance ride'},{day:6,load:'long',text:'60-min Power Zone Endurance ride'}],
      3:[{day:1,load:'hard',text:'45-min Power Zone ride'},{day:3,load:'hard',text:'45-min Power Zone ride'},{day:6,load:'long',text:'60-min Power Zone Endurance ride'}],
      4:[{day:1,load:'recovery',text:'45-min Power Zone Endurance ride'},{day:3,load:'recovery',text:'45-min Power Zone Endurance ride'},{day:6,load:'long',text:'60-min Power Zone Endurance ride'}],
      5:[{day:1,load:'hard',text:'45-min Power Zone ride'},{day:3,load:'hard',text:'45-min Power Zone ride'},{day:6,load:'long',text:'60-min Power Zone Endurance ride'}],
      6:[{day:1,load:'hard',text:'45-min Power Zone ride'},{day:3,load:'hard',text:'45-min Power Zone ride'},{day:6,load:'long',text:'60-min Power Zone ride'}],
      7:[{day:1,load:'max',text:'45-min Power Zone Max ride'},{day:3,load:'hard',text:'45-min Power Zone ride'},{day:6,load:'long',text:'90-min Power Zone Endurance ride'}],
      8:[{day:1,load:'recovery',text:'45-min Power Zone Endurance ride'},{day:3,load:'recovery',text:'45-min Power Zone Endurance ride'},{day:6,load:'test',text:'FTP warm-up + 20-min FTP test'}]
    }
  },
  boost:{
    label:'Boost Your Base: Power Zones',weeks:8,
    aliases:['boost your base power zones','boost your base: power zones','boost your base'],
    schedule:Object.fromEntries(Array.from({length:8},(_,idx)=>{
      const week=idx+1,recovery=week===4||week===8;
      return [week,[
        {day:1,load:recovery?'recovery':'moderate',text:'Power Zone Endurance ride'},
        {day:3,load:recovery?'recovery':'moderate',text:'Power Zone Endurance ride'},
        {day:6,load:recovery?'moderate':'long',text:recovery?'Long easy Power Zone Endurance ride':'Progressive long Power Zone Endurance ride'}
      ]];
    }))
  }
};
function normalizeProgramName(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function pelotonTemplateFor(name){
  const n=normalizeProgramName(name);
  for(const [key,t] of Object.entries(PELOTON_PROGRAM_TEMPLATES)){
    if(t.aliases.some(a=>n.includes(normalizeProgramName(a))||normalizeProgramName(a).includes(n)))return {key,...t};
  }
  return null;
}
function dayTokens(i){
  return [
    ['sun','sunday'],['mon','monday'],['tue','tues','tuesday'],['wed','wednesday'],
    ['thu','thur','thurs','thursday'],['fri','friday'],['sat','saturday']
  ][i]||[];
}
function programRunsOnDay(program,i){
  const text=(String(program?.days||'')+' '+String(program?.key_sessions||'')).toLowerCase();
  return dayTokens(i).some(t=>new RegExp('(^|[^a-z])'+t+'([^a-z]|$)','i').test(text));
}
function menuDateForDay(d,i){
  const m=String(d?.date||'').match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\b/i);
  if(m){
    const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    const now=new Date(),month=months[m[1].slice(0,3).toLowerCase()];
    let year=now.getFullYear();
    if(month===0&&now.getMonth()===11)year++;
    if(month===11&&now.getMonth()===0)year--;
    return new Date(year,month,Number(m[2]),12,0,0,0);
  }
  const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-todayIndex(),12,0,0,0);
  start.setDate(start.getDate()+i);
  return start;
}
function knownPelotonSessionForDay(i,d){
  if(!equipmentList().includes('peloton_bike'))return null;
  const p=trainingPrograms().peloton_bike||{},template=pelotonTemplateFor(p.name);
  if(!template||!p.start_date)return null;
  const start=new Date(p.start_date+'T12:00:00'),date=menuDateForDay(d,i);
  if(Number.isNaN(start.getTime())||Number.isNaN(date.getTime()))return null;
  const diff=Math.round((date-start)/86400000);
  if(diff<0)return null;
  const week=Math.floor(diff/7)+1,day=(diff%7)+1;
  if(week<1||week>template.weeks)return null;
  const session=(template.schedule[week]||[]).find(x=>x.day===day);
  return session?{...session,week,program:template.label,program_key:template.key}:null;
}
function programWorkoutForDay(i,d){
  const programs=trainingPrograms(),entries=[];
  const known=knownPelotonSessionForDay(i,d);
  if(known){
    entries.push(`Peloton Bike: ${known.program} — Week ${known.week}, Day ${known.day}: ${known.text}. This session is locked into the plan before PomFit places other training.`);
  }
  for(const [key,label] of Object.entries(PROGRAM_DEVICES)){
    if(key==='peloton_bike'&&known)continue;
    if(!equipmentList().includes(key))continue;
    const p=programs[key]||{};
    if(!p.name||!programRunsOnDay(p,i))continue;
    const notes=String(p.key_sessions||'').trim();
    entries.push(`${label}: ${p.name}. Follow the scheduled program session${notes?' — '+notes:''}. PomFit will avoid adding conflicting hard leg or HIIT work today.`);
  }
  return entries.join(' ');
}
function programProtectionForDay(i,d){
  const days=menu().days;
  const prev=i>0?knownPelotonSessionForDay(i-1,days[i-1]):null;
  const next=i<days.length-1?knownPelotonSessionForDay(i+1,days[i+1]):null;
  const demanding=x=>x&&['hard','max','test','long'].includes(x.load);
  if(demanding(next))return `Protect legs for tomorrow's Peloton ${next.program} session. Do upper-body strength, core, and mobility only; no hard leg strength or HIIT.`;
  if(demanding(prev))return `Recovery/upper-body day after yesterday's demanding Peloton session. No heavy leg strength; use upper body, core, mobility, or easy Zone 1–2 recovery.`;
  return '';
}
function pelotonProgramStatus(p){
  const t=pelotonTemplateFor(p?.name);
  if(!p?.name)return 'Enter a Peloton program name. Recognized Power Zone programs can sync by start date.';
  if(!t)return 'Custom/unrecognized program: PomFit will use the days and key sessions you enter manually.';
  if(!p.start_date)return `Recognized: ${t.label} (${t.weeks} weeks). Add the program start date to synchronize the week-by-week schedule.`;
  return `PomFit preset: ${t.label} • ${t.weeks} weeks • start ${p.start_date}.`;
}
function resistancePrescription(mode='strength'){
  const e=equipmentList(),notes=equipmentNotes();
  const suffix=notes?` Device notes: ${notes}.`:'';
  if(e.includes('bowflex')){
    return mode==='sculpt'
      ?`Bowflex/home gym: 2–3 rounds of chest press, seated row or lat pulldown, shoulder work, curls/triceps and leg work your model supports; 12–15 controlled reps, moderate resistance.${suffix}`
      :`Bowflex/home gym: chest press, row or lat pulldown, shoulder press, leg extension/curl or squat pattern your model supports; 3 sets of 8–12 with good form.${suffix}`;
  }
  if(e.includes('cable'))return `Cable machine: presses, rows/pulldowns, face pulls, lateral raises, curls/triceps and cable leg/hip work; ${mode==='sculpt'?'12–15 controlled reps':'8–12 reps'}.${suffix}`;
  if(e.includes('dumbbells'))return `Dumbbells: squat or split squat, Romanian deadlift, row, press, lateral raise and curls/triceps; ${mode==='sculpt'?'2–3 rounds of 12–15 controlled reps':'3 sets of 8–12 reps'}.${suffix}`;
  if(e.includes('barbell'))return `Barbell/rack: squat or hinge, press and row/pull; use moderate loads and leave 1–3 good reps in reserve.${suffix}`;
  if(e.includes('kettlebell'))return `Kettlebells: goblet squat, hinge/deadlift, row, press, carries and controlled swings if experienced.${suffix}`;
  if(e.includes('trx'))return `Suspension trainer/TRX: rows, presses, split squats, hamstring curls and anti-rotation core work.${suffix}`;
  if(e.includes('bands'))return `Resistance bands: rows, presses, lateral walks, glute work, curls/triceps and anti-rotation core; 12–20 controlled reps.${suffix}`;
  return `Bodyweight: squats/split squats, hip hinge or bridge, push-ups, supported rows if available, calf raises and core.${suffix}`;
}
function strengthSession(label,mode='strength'){return `${label}. ${resistancePrescription(mode)}`;}
function mealOverrides(){return personal?.settings?.meal_overrides||{};}
function mealRejections(){const r=personal?.settings?.meal_rejections;return Array.isArray(r)?r:[];}
function profileHeightParts(){
  const total=Number(personalProfile().height_in)||0;
  return {ft:total?Math.floor(total/12):'',inch:total?Math.round((total%12)*10)/10:''};
}
function collectProfileForm(){
  const base=personalProfile();
  if(!$('#profAge'))return base;
  const goals=$$('[data-goal]:checked').map(x=>x.dataset.goal);
  const meals={};
  ['breakfast','lunch','afternoon','dinner'].forEach(k=>{
    meals[k]={
      enabled:!!$('[data-meal-enabled="'+k+'"]')?.checked,
      time:$('[data-meal-time="'+k+'"]')?.value||'',
      location:$('[data-meal-location="'+k+'"]')?.value||''
    };
  });
  const ft=Number($('#profHeightFt')?.value)||0,inch=Number($('#profHeightIn')?.value)||0;
  const height=ft||inch?ft*12+inch:null;
  return {
    ...base,
    onboarding_complete:true,
    age:Number($('#profAge').value)||null,
    height_in:height,
    weight_lb:Number($('#profWeight').value)||null,
    goal_weight_lb:Number($('#profGoalWeight')?.value)||null,
    protein_target_g:Number($('#profProteinTarget')?.value)||null,
    calorie_equation_sex:$('#calorieSex')?.value||'',
    baseline_activity:$('#baselineActivity')?.value||'light',
    goal_rate_lb_week:Number($('#goalRate')?.value)||0,
    diet_style:$('#dietStyle').value,
    food_likes:$('#foodLikes').value.trim(),
    food_dislikes:$('#foodDislikes').value.trim(),
    intermittent_fasting:$('#ifToggle').checked,
    fasting_start:$('#ifStart').value,
    fasting_end:$('#ifEnd').value,
    workout_goals:goals,
    equipment:$$('[data-equipment]:checked').map(x=>x.dataset.equipment),
    equipment_notes:$('#equipmentNotes')?.value.trim()||'',
    training_programs:Object.fromEntries(Object.keys(PROGRAM_DEVICES).map(k=>[k,{
      name:$('#programName_'+k)?.value.trim()||'',
      start_date:$('#programStart_'+k)?.value||'',
      days:$('#programDays_'+k)?.value.trim()||'',
      key_sessions:$('#programSessions_'+k)?.value.trim()||''
    }])),
    meals
  };
}
const FOOD_GROUPS={
  meat:['beef','steak','ground beef','hamburger','pork','bacon','ham','sausage','hot dog','salami','pepperoni','lamb','veal','turkey','chicken','duck'],
  fish:['salmon','tuna','cod','tilapia','catfish','trout','branzino','sole','sardines','anchovies','shrimp','prawns','crab','lobster','scallops','mussels','clams','oysters','fish','shellfish'],
  dairy:['milk','cheese','swiss','parmesan','yogurt','greek yogurt','cottage cheese','cream','butter'],
  eggs:['egg','eggs'],
  grains:['bread','toast','bagel','pasta','rice','oatmeal','oats','cereal','quinoa','barley','farro','tortilla','bun','cracker','crackers','corn'],
  legumes:['beans','black beans','kidney beans','chickpeas','hummus','lentils','peas'],
  fruit:['apple','banana','orange','grapefruit','grapes','mango','pineapple','pear','peach','plum','cherries','berries','strawberries','blueberries','raspberries','blackberries','watermelon','melon'],
  juice:['orange juice','apple juice','juice','sports drink','soda','cola'],
  starchy:['potato','potatoes','sweet potato','sweet potatoes','yam','yams'],
  sweets:['sugar','candy','cookie','cookies','cake','brownie','ice cream','dessert','donut','doughnut','syrup','honey'],
  nuts:['pistachios','almonds','walnuts','pecans','macadamia','peanuts','peanut butter','nuts','pepitas','pumpkin seeds','seeds'],
  vegetables:['asparagus','broccoli','cauliflower','spinach','zucchini','green beans','mushrooms','tomato','tomatoes','cucumber','lettuce','romaine','greens','peppers','bell peppers','onion','onions','celery','cabbage','kale','eggplant'],
  fats:['olive oil','avocado','olives','tallow']
};
function normalizeFoodName(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ');}
function foodGroups(food){
  const f=normalizeFoodName(food),groups=[];
  for(const [group,items] of Object.entries(FOOD_GROUPS)){
    if(items.some(x=>f===x||f.includes(x)||x.includes(f)))groups.push(group);
  }
  return groups;
}
function foodCompatibility(food,diet){
  const f=normalizeFoodName(food),g=foodGroups(f);
  if(!f)return{status:'unknown',message:'Enter a food first.'};
  if(!g.length)return{status:'unknown',message:`I don't recognize “${food}” well enough to add it automatically. Try a simpler food name or add it manually.`};
  if(diet==='vegetarian'&&(g.includes('meat')||g.includes('fish')))return{status:'no',message:`“${food}” does not fit a vegetarian diet because it contains meat, fish, or shellfish.`};
  if(diet==='pescatarian'&&g.includes('meat'))return{status:'no',message:`“${food}” does not fit a pescatarian diet because it is meat or poultry.`};
  if(diet==='keto'){
    if(g.some(x=>['grains','legumes','juice','starchy','sweets'].includes(x)))return{status:'no',message:`“${food}” is generally too carbohydrate-dense for the current keto setting.`};
    if(g.includes('fruit')&&!['berries','strawberries','blueberries','raspberries','blackberries','avocado'].some(x=>f.includes(x)))return{status:'no',message:`“${food}” is usually too high in carbohydrate for the current keto setting; berries are the main fruit exception in PomFit.`};
  }
  if(diet==='lowcarb'){
    if(g.some(x=>['juice','sweets'].includes(x)))return{status:'no',message:`“${food}” is too sugar/carbohydrate-dense for the current low-carb setting.`};
    if(g.includes('grains')||g.includes('starchy'))return{status:'limited',message:`“${food}” can fit only in a measured portion on a low-carb diet. PomFit will not auto-add it as a preferred staple.`};
  }
  if(diet==='mediterranean'){
    if(g.includes('sweets')||g.includes('juice'))return{status:'limited',message:`“${food}” is not a preferred Mediterranean-diet staple. Keep it occasional rather than adding it as a default food.`};
    if(g.includes('meat')&&['bacon','sausage','hot dog','salami','pepperoni'].some(x=>f.includes(x)))return{status:'limited',message:`“${food}” can be occasional, but processed meat is not a preferred Mediterranean-diet staple.`};
  }
  return{status:'yes',message:`“${food}” is compatible with the selected ${diet==='lowcarb'?'low-carb':diet} diet.`};
}
function wheyFlavorPlans(){const x=personal?.settings?.whey_flavors_by_meal;return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}
const DEFAULT_WHEY_FLAVORS=['Chocolate','Vanilla','Mocha','Strawberry','Cookies & Cream','Unflavored'];
function wheyFlavorForMeal(id){return wheyFlavorPlans()[id]||'';}
function mealUsesWhey(text){return /\b(whey|protein shake|protein drink)\b/i.test(String(text||''));}
function workoutChecks(){return personal?.settings?.workout_checks||{};}
function barkEnabled(){return personal?.settings?.bark_reminder_enabled===true;}
function barkTime(){return personal?.settings?.bark_reminder_time||'20:00';}
function alcoholPlans(){const x=personal?.settings?.alcohol_plans;return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}
function alcoholCap(){const n=Number(personal?.settings?.alcohol_daily_cap);return Number.isFinite(n)?Math.max(0,Math.min(2,n)):1;}
const ALCOHOL_DEFAULTS={cocktail:{amount:6,abv:15,mixer:'regular'},champagne:{amount:5,abv:12,mixer:'none'},wine:{amount:5,abv:12,mixer:'none'},beer:{amount:12,abv:5,mixer:'none'},liquor:{amount:1.5,abv:40,mixer:'zero'}};
function alcoholTypeLabel(t){return({cocktail:'Cocktail',champagne:'Champagne / sparkling wine',wine:'Wine',beer:'Beer',liquor:'Liquor / spirits'}[t]||'Drink');}
function standardDrinksFor(amount,abv){const oz=Number(amount),pct=Number(abv);if(!Number.isFinite(oz)||!Number.isFinite(pct)||oz<=0||pct<=0)return 0;return (oz*(pct/100))/0.6;}
function maxOuncesForCap(cap,abv){const c=Number(cap),pct=Number(abv);if(!Number.isFinite(c)||!Number.isFinite(pct)||c<=0||pct<=0)return 0;return (c*0.6)/(pct/100);}
function drinkMealAdvice(plan){
  const type=plan?.type||'wine',amount=Number(plan?.amount)||0,abv=Number(plan?.abv)||0,cap=Number(plan?.cap ?? alcoholCap());
  const std=standardDrinksFor(amount,abv),maxOz=maxOuncesForCap(cap,abv);
  const mixer=plan?.mixer||'none',diet=dietStyle(),over=cap===0?std>0:std>cap+0.01;
  let adjust='Keep the planned protein and non-starchy vegetables. ';
  if(type==='beer')adjust+='If you have the beer, skip or reduce optional bread, bun, rice, potato, dessert, or another starch at that meal.';
  else if(type==='cocktail')adjust+=mixer==='regular'?'If the cocktail uses juice, syrup, tonic, or another sweet mixer, skip dessert and reduce or omit the meal’s optional starch.':'With a zero-calorie mixer, keep protein and vegetables and trim an optional starch, dessert, or added fat rather than shrinking the protein serving.';
  else if(type==='champagne'||type==='wine')adjust+='Keep protein and vegetables; reduce or skip an optional starch/dessert rather than cutting the main protein.';
  else adjust+='Plain spirits or a zero-calorie mixer add little carbohydrate, but alcohol still adds energy; trim an optional starch, dessert, or added fat rather than protein.';
  if((diet==='keto'||diet==='lowcarb')&&(type==='beer'||(type==='cocktail'&&mixer==='regular')))adjust+=' This choice is relatively harder to fit into a low-carb/keto day; a dry wine/sparkling wine or spirit with a zero-calorie mixer is usually easier to accommodate.';
  const limitText=cap<=0?'Your PomFit planning ceiling is 0 standard drinks.':`At ${abv||'?'}% ABV, a ${amount||'?'} oz serving is about ${std.toFixed(2)} standard drinks. With a ${cap}-drink planning ceiling, about ${maxOz.toFixed(1)} oz would equal that ceiling.`;
  const status=over?'This serving is above your selected planning ceiling.':'This serving is within your selected planning ceiling.';
  return `${limitText} ${status} ${adjust} Do not use alcohol calories as a substitute for protein, vegetables, or hydration.`;
}
const DRINK_KIND_OPTIONS={
  cocktail:['Martini','Margarita','Old Fashioned','Manhattan','Mojito','Vodka soda','Gin & tonic'],
  champagne:['Brut Champagne','Brut sparkling wine','Prosecco','Cava','Rosé sparkling'],
  wine:['Cabernet Sauvignon','Pinot Noir','Merlot','Chardonnay','Sauvignon Blanc','Dry Rosé'],
  beer:['Light beer','Lager','Pilsner','IPA','Hazy IPA','Stout'],
  liquor:['Bourbon','Scotch','Rye','Vodka','Gin','Tequila','Rum']
};
function drinkKindOptions(type,current=''){
  const opts=[...(DRINK_KIND_OPTIONS[type]||[])];
  if(current&&!opts.includes(current))opts.unshift(current);
  return opts;
}
function renderDrinkPlanner(i){
  const existing=alcoholPlans()[String(i)]||{},type=existing.type||'wine',def=ALCOHOL_DEFAULTS[type]||ALCOHOL_DEFAULTS.wine;
  const amount=existing.amount??def.amount,abv=existing.abv??def.abv,mixer=existing.mixer??def.mixer,cap=existing.cap??alcoholCap(),kind=existing.kind||'',saved=!!existing.saved_at;
  const summary=saved?`${alcoholTypeLabel(type)}${kind?' — '+kind:''}`:'Add a drink',advice=saved?drinkMealAdvice({...existing,cap}):'';
  return `<details class="drink-planner" ${saved?'open':''}><summary>🍷 ${esc(summary)}</summary><div class="drink-grid">
  <label class="small">Type<select class="search" data-drink-type="${i}"><option value="cocktail" ${type==='cocktail'?'selected':''}>Cocktail</option><option value="champagne" ${type==='champagne'?'selected':''}>Champagne / sparkling</option><option value="wine" ${type==='wine'?'selected':''}>Wine</option><option value="beer" ${type==='beer'?'selected':''}>Beer</option><option value="liquor" ${type==='liquor'?'selected':''}>Liquor / spirits</option></select></label>
  <label class="small">What kind?<select class="search" data-drink-kind="${i}">${drinkKindOptions(type,kind).map(x=>`<option value="${esc(x)}" ${kind===x?'selected':''}>${esc(x)}</option>`).join('')}<option value="Other" ${kind==='Other'?'selected':''}>Other</option></select></label>
  <label class="small">Serving size (oz)<input class="search" type="number" min="0" step=".1" data-drink-amount="${i}" value="${esc(amount)}"></label>
  <label class="small">ABV %<input class="search" type="number" min="0" max="100" step=".1" data-drink-abv="${i}" value="${esc(abv)}"></label>
  <label class="small">Mixer<select class="search" data-drink-mixer="${i}"><option value="none" ${mixer==='none'?'selected':''}>None / not applicable</option><option value="zero" ${mixer==='zero'?'selected':''}>Zero-calorie / soda water</option><option value="regular" ${mixer==='regular'?'selected':''}>Juice / syrup / tonic / sweet mixer</option></select></label>
  <label class="small">Personal planning ceiling<select class="search" data-drink-cap="${i}"><option value="0" ${Number(cap)===0?'selected':''}>0 standard drinks</option><option value="1" ${Number(cap)===1?'selected':''}>1 standard drink</option><option value="2" ${Number(cap)===2?'selected':''}>2 standard drinks</option></select></label>
  </div><p class="small">U.S. standard-drink math uses serving size and ABV. Cocktails can contain more than one standard drink, so edit both fields if stronger or larger than the default.</p>
  <p class="small">General CDC reference: on days alcohol is consumed, up to 1 drink/day for women and up to 2/day for men; less is better. Some people should not drink at all.</p>
  <button class="secondary" data-save-drink="${i}">Calculate & save drink</button>${saved?`<button class="ghost" data-clear-drink="${i}">Remove drink</button>`:''}<div class="drink-result" data-drink-result="${i}">${esc(advice)}</div></details>`;
}
function localDateKey(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function playBark(){
  try{
    const audio=new Audio('./Gizmo-bark.mp3?v=56');
    audio.preload='auto';
    audio.volume=.95;
    audio.playbackRate=1;
    const p=audio.play();
    if(p&&typeof p.catch==='function')p.catch(()=>{});
    return true;
  }catch(e){
    return false;
  }
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
  performance:{
    breakfast:[
      ['High-protein shake with milk, banana or berries, and oats if training demands it',['protein','whey','milk','banana','berries','oats']],
      ['Eggs with whole-grain toast and fruit',['eggs','bread','fruit']],
      ['Greek yogurt with berries, nuts and a measured whole-grain carbohydrate',['yogurt','berries','nuts','whole grain']]
    ],
    lunch:[
      ['Chicken, vegetables and rice or another whole-food carbohydrate',['chicken','vegetables','rice']],
      ['Salmon with vegetables and potato or whole grain',['salmon','vegetables','potato','whole grain']],
      ['Lean beef, beans and vegetables with a measured carbohydrate',['beef','beans','vegetables','whole grain']]
    ],
    afternoon:[
      ['Protein shake plus fruit; add a measured carbohydrate before or after hard training',['protein','whey','fruit','whole grain']],
      ['Swiss cheese, fruit and pistachios',['swiss','fruit','pistachios']],
      ['Tuna or chicken with whole-grain crackers and vegetables',['tuna','chicken','crackers','vegetables']]
    ],
    dinner:[
      ['Lean protein, vegetables and a training-appropriate whole-food carbohydrate',['protein','vegetables','whole grain']],
      ['Fish, vegetables, olive oil and potato/rice as training needs dictate',['fish','vegetables','olive oil','potato','rice']]
    ]
  },
  musclegain:{
    breakfast:[
      ['High-protein shake with milk, whey, berries and oats',['protein','whey','milk','berries','oats']],
      ['Eggs, whole-grain toast, fruit and an extra lean protein serving',['eggs','bread','fruit','protein']],
      ['Greek yogurt with berries, nuts and added protein',['yogurt','berries','nuts','protein']]
    ],
    lunch:[
      ['6–8 oz chicken with vegetables and rice or potato',['chicken','vegetables','rice','potato']],
      ['6–8 oz salmon with vegetables and whole grain',['salmon','vegetables','whole grain']],
      ['Lean beef bowl with beans, vegetables and a measured carbohydrate',['beef','beans','vegetables','whole grain']]
    ],
    afternoon:[
      ['Protein shake with milk plus fruit',['protein','whey','milk','fruit']],
      ['Swiss cheese plus lean protein and fruit',['swiss','protein','fruit']],
      ['Tuna/chicken snack with whole-grain crackers',['tuna','chicken','crackers']]
    ],
    dinner:[
      ['Generous lean protein, vegetables and a whole-food carbohydrate',['protein','vegetables','whole grain']],
      ['Fish or lean meat, vegetables, olive oil and rice/potato',['fish','meat','vegetables','olive oil','rice','potato']]
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
function mealCandidates(slot){
  const diet=MEAL_CATALOG[dietStyle()]||MEAL_CATALOG.balanced;
  const options=diet[slot]||diet.lunch,dislikes=foodList('food_dislikes'),likes=foodList('food_likes');
  let ranked=options.map((x,idx)=>({
    x,idx,
    blocked:dislikes.some(d=>x[1].some(i=>i.includes(d)||d.includes(i))),
    score:likes.reduce((sum,l)=>sum+(x[1].some(i=>i.includes(l)||l.includes(i))?2:0),0)
  }));
  let usable=ranked.filter(r=>!r.blocked);if(!usable.length)usable=ranked;
  usable.sort((a,b)=>b.score-a.score||a.idx-b.idx);
  return usable.map(r=>r.x[0]);
}
function chooseMeal(slot,dayIndex,key=''){
  if(key&&mealOverrides()[key])return mealOverrides()[key];
  const candidates=mealCandidates(slot);
  return candidates[dayIndex%candidates.length]||'Choose a compatible meal';
}
function nextMealAlternative(slot,current){
  const candidates=mealCandidates(slot);
  return candidates.find(x=>x.toLowerCase()!==String(current).toLowerCase())||current;
}
function personalWorkoutFor(i){
  const goals=workoutGoals(),has=g=>goals.includes(g),sculpt=has('sculpt');

  if(has('tennis')){
    const p=[
      strengthSession('Tennis lower-body lateral strength + rotational core',sculpt?'sculpt':'strength'),
      'Tennis court movement: split-step, lateral shuffle, crossover and 6–10 short acceleration/deceleration reps',
      strengthSession('Shoulder/scapular stability + upper body for serves and groundstrokes','sculpt'),
      'Recovery: hips, calves, thoracic rotation and easy Zone 2 cardio',
      'Tennis footwork intervals + rotational medicine-ball or band work if available',
      'Tennis play / drills: 45–75 minutes with controlled point-play conditioning',
      'Rest / mobility'
    ];return p[i];
  }
  if(has('boxing')){
    const p=[
      'Boxing technique: shadowboxing or bag work, 6–8 × 2-minute rounds + footwork',
      strengthSession('Boxing strength: legs, back, shoulders and anti-rotation core',sculpt?'sculpt':'strength'),
      'Boxing conditioning: jump rope or low-impact intervals + 4–6 short bag/shadow rounds',
      'Recovery: shoulder mobility, hips and easy Zone 2',
      'Bag or mitt rounds: combinations, defense and footwork, 8–10 × 2 minutes',
      'Boxing conditioning + core endurance; keep technique crisp rather than chasing fatigue',
      'Rest / mobility'
    ];return p[i];
  }
  if(has('swimming')){
    const p=[
      'Swim technique + aerobic endurance: easy/moderate continuous work with form focus',
      strengthSession('Swimmer strength: back/scapula, posterior chain and core','sculpt'),
      'Swim intervals: short repeats with generous enough rest to preserve stroke quality',
      'Recovery: shoulder/scapular mobility + easy walk or spin',
      'Swim pull/kick technique + core stability',
      'Longer easy aerobic swim or mixed-stroke endurance session',
      'Rest / mobility'
    ];return p[i];
  }
  if(has('soccer')){
    const p=[
      strengthSession('Soccer lower-body strength + hamstrings/calves/core',sculpt?'sculpt':'strength'),
      'Soccer acceleration/deceleration: 6–10 short sprints + controlled stops',
      'Aerobic intervals or small-sided conditioning',
      strengthSession('Upper-body maintenance + hip/ankle mobility','sculpt'),
      'Soccer change-of-direction + ball touches/dribbling; quality over fatigue',
      'Game, small-sided play, or longer aerobic field session',
      'Rest / mobility'
    ];return p[i];
  }
  if(has('basketball')){
    const p=[
      strengthSession('Basketball lower-body strength + ankle/knee resilience',sculpt?'sculpt':'strength'),
      'Court conditioning: short sprints, defensive slides and controlled change of direction',
      strengthSession('Upper body + core','sculpt'),
      'Recovery: mobility, calves/ankles and easy Zone 2',
      'Basketball jump/landing mechanics + lateral quickness + skill work',
      'Shooting/skills plus game-style conditioning',
      'Rest / mobility'
    ];return p[i];
  }
  if(has('ski')){
    const p=[
      strengthSession(sculpt?'Lower-body sculpt + core':'Lower-body strength + core',sculpt?'sculpt':'strength'),
      'Zone 2 cardio + mobility',
      strengthSession(sculpt?'Upper-body sculpt: shoulders/back/arms':'Upper-body strength + core',sculpt?'sculpt':'strength'),
      'Ski-leg intervals: step-ups, split squats, lateral work and balance',
      'Recovery cardio + balance',
      strengthSession('Full-body work + short ski-conditioning finisher',sculpt?'sculpt':'strength'),
      'Rest / mobility'
    ];return p[i];
  }
  if(has('cycling')){
    const p=[
      'Endurance ride',
      strengthSession('Upper-body + core',sculpt?'sculpt':'strength'),
      'Bike intervals / threshold work',
      'Recovery spin + mobility',
      strengthSession('Full-body resistance session',sculpt?'sculpt':'strength'),
      'Long endurance ride',
      'Rest'
    ];return p[i];
  }
  if(has('running')){
    const p=[
      'Easy run + mobility',
      strengthSession('Runner lower-body + core',sculpt?'sculpt':'strength'),
      'Tempo or interval run',
      strengthSession('Upper-body maintenance',sculpt?'sculpt':'strength'),
      'Easy run',
      'Long run or event-specific session',
      'Rest'
    ];return p[i];
  }
  if(sculpt){
    return [
      strengthSession('Upper-body sculpt: shoulders, back, arms + core','sculpt'),
      strengthSession('Glutes/legs sculpt + balance','sculpt'),
      'Zone 2 cardio + mobility',
      strengthSession('Chest/triceps + core sculpt','sculpt'),
      strengthSession('Full-body sculpt circuit','sculpt'),
      'Conditioning + posture/core',
      'Rest / mobility'
    ][i];
  }
  if(has('strength'))return [strengthSession('Upper-body strength'),strengthSession('Lower-body strength + core'),'Mobility / recovery',strengthSession('Upper-body strength'),strengthSession('Lower-body strength + carries'),'Zone 2 cardio','Rest'][i];
  if(has('hiit'))return [strengthSession('Full-body strength'),'HIIT intervals','Mobility / recovery',strengthSession('Upper-body + core'),'Conditioning circuit','Zone 2 cardio','Rest'][i];
  if(has('mobility'))return ['Mobility + core','Zone 2 cardio',strengthSession('Full-body strength'),'Mobility + balance','Core/posture','Long easy movement session','Rest'][i];
  if(has('core'))return [strengthSession('Upper body + core'),strengthSession('Lower body + core'),'Zone 2 cardio + posture','Core stability + mobility',strengthSession('Full-body strength + core'),'Conditioning + carries','Rest'][i];
  if(has('muscle'))return [strengthSession('Upper pull + biceps + core'),strengthSession('Lower body'),strengthSession('Upper push + triceps + core'),'Zone 2 cardio / recovery',strengthSession('Upper hypertrophy'),strengthSession('Lower body + carries'),'Rest'][i];
  if(has('cardio'))return ['Zone 2 cardio',strengthSession('Full-body strength'),'Intervals','Recovery cardio + mobility','Zone 2 cardio','Longer cardio session','Rest'][i];
  return [strengthSession('Full-body strength'),'Zone 2 cardio','Mobility / recovery',strengthSession('Full-body strength'),'Cardio intervals','Outdoor activity / long easy cardio','Rest'][i];
}
function withinEatingWindow(){
  const p=personalProfile();
  if(!p.intermittent_fasting)return true;
  const toMin=t=>{const [h,m]=String(t||'').split(':').map(Number);return h*60+(m||0);};
  const start=toMin(p.fasting_start||'12:00'),end=toMin(p.fasting_end||'20:00'),n=new Date(),now=n.getHours()*60+n.getMinutes();
  return start<=end?(now>=start&&now<=end):(now>=start||now<=end);
}
function hungerSuggestions(){
  if(personalProfile().intermittent_fasting&&!withinEatingWindow()){
    return {title:'You are outside your eating window',items:['Water or sparkling water','Plain tea or black coffee if appropriate for you','If hunger is strong or persistent, it is reasonable to end the fast and choose a protein-forward snack rather than forcing it.']};
  }
  const diet=dietStyle(),dislikes=foodList('food_dislikes'),likes=foodList('food_likes');
  const sets={
    performance:[
      ['3–4 oz lean protein plus fruit',['protein','chicken','fish','fruit']],
      ['Protein shake with milk plus berries or banana',['protein','whey','milk','berries','banana']],
      ['Swiss cheese, fruit and a measured handful of pistachios',['swiss','fruit','pistachios']],
      ['If training soon, add a small whole-food carbohydrate with protein',['whole grain','protein']]
    ],
    musclegain:[
      ['25–35 g protein from a shake or lean food source',['protein','whey','chicken','fish']],
      ['3–4 oz lean protein plus fruit or a measured whole-food carbohydrate',['protein','fruit','whole grain']],
      ['Swiss cheese plus a protein shake',['swiss','protein','whey']],
      ['Tuna or chicken with vegetables and whole-grain crackers',['tuna','chicken','vegetables','crackers']]
    ],
    keto:[
      ['3–4 oz salmon, tuna, chicken or lean beef with cucumber/asparagus',['salmon','tuna','chicken','beef','cucumber','asparagus']],
      ['Swiss or another cheese with cucumber or tomato',['swiss','cheese','cucumber','tomato']],
      ['A low-carb protein shake with water or unsweetened milk',['protein','whey','milk']],
      ['1 oz pistachios or pepitas plus water',['pistachios','pepitas']]
    ],
    lowcarb:[
      ['3–4 oz lean protein with non-starchy vegetables',['protein','chicken','fish','vegetables']],
      ['Protein shake plus a small portion of berries',['protein','berries']],
      ['Swiss cheese with cucumber/tomato',['swiss','cucumber','tomato']],
      ['1 oz pistachios or pepitas',['pistachios','pepitas']]
    ],
    mediterranean:[
      ['Fruit plus a measured handful of nuts',['fruit','nuts']],
      ['Greek yogurt with berries',['yogurt','berries']],
      ['3–4 oz fish or chicken with vegetables',['fish','chicken','vegetables']],
      ['White beans or hummus with vegetables',['beans','hummus','vegetables']]
    ],
    pescatarian:[
      ['3–4 oz salmon, tuna or shrimp with vegetables',['salmon','tuna','shrimp','vegetables']],
      ['Protein shake with berries',['protein','berries']],
      ['Greek yogurt or cheese with fruit',['yogurt','cheese','fruit']],
      ['1 oz pistachios or pepitas',['pistachios','pepitas']]
    ],
    vegetarian:[
      ['Greek yogurt with berries and a few nuts',['yogurt','berries','nuts']],
      ['Eggs with vegetables',['eggs','vegetables']],
      ['Protein shake plus fruit',['protein','fruit']],
      ['Beans/lentils or hummus with vegetables',['beans','lentils','hummus','vegetables']]
    ],
    balanced:[
      ['3–4 oz lean protein with vegetables',['protein','chicken','fish','vegetables']],
      ['Protein shake plus fruit or berries',['protein','fruit','berries']],
      ['Fruit plus a measured handful of nuts',['fruit','nuts']],
      ['Swiss cheese with fruit or vegetables',['swiss','fruit','vegetables']]
    ]
  };
  let options=(sets[diet]||sets.balanced).map((x,idx)=>({x,idx,blocked:dislikes.some(d=>x[1].some(t=>t.includes(d)||d.includes(t))),score:likes.reduce((n,l)=>n+(x[1].some(t=>t.includes(l)||l.includes(t))?2:0),0)}));
  options=options.filter(x=>!x.blocked).sort((a,b)=>b.score-a.score||a.idx-b.idx);
  return {title:'Still hungry? Choose one small add-on',items:(options.length?options:sets[diet]||sets.balanced).slice(0,3).map(x=>Array.isArray(x)?x[0]:x.x[0])};
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
  const email=$('#loginEmail')?.value.trim()||'',password=$('#loginPassword')?.value||'';
  if(!email||!password)return notice('#authMessage','Enter both email and password.',true);
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error)return notice('#authMessage',error.message,true);
  if(data?.session)await handleSession(data.session);
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
  const out=[];for(const [category,items] of Object.entries(DEFAULT_DATA.grocery||{}))(Array.isArray(items)?items:[]).forEach((text,i)=>out.push({id:`${category}-${i}`,category,text,checked:false}));return out;
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
async function enterApp(){show('appShell');$('#headerSub').textContent=`${household.name} • ${myName()}`;await subscribe();render();syncMsg('Synced');maybeStartTour();}
async function subscribe(){
  for(const c of channels)await supabase.removeChannel(c);channels=[];
  if(!profile?.household_id)return;
  const h=supabase.channel('pomfit-household-'+profile.household_id)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'household_state',filter:`household_id=eq.${profile.household_id}`},p=>{shared=p.new;syncMsg('Shared update received');render();}).subscribe();
  const p=supabase.channel('pomfit-personal-'+session.user.id)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'personal_state',filter:`user_id=eq.${session.user.id}`},x=>{
      personal=x.new;
      if(ui.tab==='profile'&&profileFormDirty){syncMsg('Synced');return;}
      render();
    }).subscribe();
  channels=[h,p];
}
async function handleSession(s){
  session=s;if(!s){profile=household=shared=personal=null;show('authShell');return;}
  try{await load();if(!profile.household_id){show('setupShell');return;}await seed();if(!profileReady())ui.tab='profile';await enterApp();}
  catch(e){console.error(e);show('authShell');notice('#authMessage','Could not load PomFit: '+e.message,true);}
}

function menu(){return shared?.menu?.days?shared.menu:DEFAULT_DATA;}
function groceries(){return Array.isArray(shared?.groceries)?shared.groceries:defaultGroceries();}
function groceryActive(){return groceries().filter(x=>x.resolved!==true);}
function groceryUnchecked(){return groceryActive().filter(x=>!x.checked&&!x.unavailable);}
function groceryUnavailable(){return groceryActive().filter(x=>x.unavailable===true);}
function normFood(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function prefMatchesText(pref,text){
  const p=normFood(pref),t=normFood(text);
  if(!p||!t)return false;
  const ps=p.endsWith('s')?p.slice(0,-1):p;
  return t.includes(p)||t.includes(ps);
}
function groceryPreference(item){
  const dislikes=foodList('food_dislikes'),likes=foodList('food_likes');
  const dislike=dislikes.find(x=>prefMatchesText(x,item.text));
  const like=likes.find(x=>prefMatchesText(x,item.text));
  return {dislike,like};
}
const GROCERY_TERMS=[
  'green beans','whole grain','orange juice','olive oil','liquid smoke','soy sauce','worcestershire',
  'ground beef','black beans','kidney beans','pumpkin seeds','pepitas','pistachios','parmesan',
  'salmon','branzino','sea bass','chicken','tilapia','sirloin','flank','sole','catfish','shrimp',
  'beef','hot dog','eggs','egg','swiss','milk','whey','chike','asparagus','broccoli','zucchini',
  'mushrooms','spinach','romaine','cucumber','tomato','peppers','onion','garlic','ginger','lemon',
  'lime','dill','parsley','cilantro','avocado','grapefruit','berries','peas','beans','harissa',
  'butter','capers','bread','bun','rice','potato','nuts','seeds'
];
function groceryTerms(text){
  const t=normFood(text);
  return [...new Set(GROCERY_TERMS.filter(term=>t.includes(normFood(term))))];
}
const SYNC_GROCERY_LIBRARY=[
  {key:'salmon',category:'Proteins & dairy',label:'Salmon',terms:['salmon']},
  {key:'white-fish',category:'Proteins & dairy',label:'White fish / cod / tilapia / sole',terms:['cod','tilapia','sole','branzino','sea bass','trout','catfish','fish']},
  {key:'shrimp',category:'Proteins & dairy',label:'Shrimp / shellfish',terms:['shrimp','shellfish']},
  {key:'tuna',category:'Proteins & dairy',label:'Tuna',terms:['tuna']},
  {key:'chicken',category:'Proteins & dairy',label:'Chicken',terms:['chicken']},
  {key:'beef',category:'Proteins & dairy',label:'Lean beef / sirloin',terms:['beef','steak','sirloin','flank','ground beef']},
  {key:'eggs',category:'Proteins & dairy',label:'Eggs',terms:['egg','eggs','frittata']},
  {key:'cheese',category:'Proteins & dairy',label:'Swiss / cheese',terms:['swiss','cheese','parmesan']},
  {key:'yogurt',category:'Proteins & dairy',label:'Greek yogurt',terms:['greek yogurt','yogurt']},
  {key:'milk',category:'Proteins & dairy',label:'Milk / unsweetened milk',terms:['milk']},
  {key:'whey',category:'Proteins & dairy',label:'Protein powder / whey',terms:['whey','protein shake','protein drink','protein coffee']},
  {key:'chike',category:'Proteins & dairy',label:'Chike',terms:['chike']},
  {key:'tofu',category:'Proteins & dairy',label:'Tofu / tempeh',terms:['tofu','tempeh']},
  {key:'greens',category:'Produce',label:'Greens / spinach / romaine',terms:['greens','spinach','romaine','lettuce','salad']},
  {key:'asparagus',category:'Produce',label:'Asparagus',terms:['asparagus']},
  {key:'broccoli',category:'Produce',label:'Broccoli',terms:['broccoli']},
  {key:'green-beans',category:'Produce',label:'Green beans',terms:['green beans']},
  {key:'zucchini',category:'Produce',label:'Zucchini',terms:['zucchini']},
  {key:'mushrooms',category:'Produce',label:'Mushrooms',terms:['mushroom','mushrooms']},
  {key:'cucumber',category:'Produce',label:'Cucumber',terms:['cucumber']},
  {key:'tomatoes',category:'Produce',label:'Tomatoes',terms:['tomato','tomatoes']},
  {key:'peppers',category:'Produce',label:'Bell peppers / peppers',terms:['peppers','pepper']},
  {key:'onion',category:'Produce',label:'Onion',terms:['onion']},
  {key:'garlic',category:'Produce',label:'Garlic',terms:['garlic']},
  {key:'ginger',category:'Produce',label:'Fresh ginger',terms:['ginger']},
  {key:'lemon',category:'Produce',label:'Lemons',terms:['lemon']},
  {key:'lime',category:'Produce',label:'Limes',terms:['lime']},
  {key:'avocado',category:'Produce',label:'Avocado',terms:['avocado']},
  {key:'berries',category:'Produce',label:'Berries',terms:['berries','berry']},
  {key:'fruit',category:'Produce',label:'Fruit',terms:['fruit','banana','apple','orange','grapefruit']},
  {key:'peas',category:'Produce',label:'Peas',terms:['peas']},
  {key:'beans',category:'Pantry / grains',label:'Beans / chickpeas',terms:['beans','bean','chickpeas']},
  {key:'lentils',category:'Pantry / grains',label:'Lentils',terms:['lentils','lentil']},
  {key:'hummus',category:'Pantry / grains',label:'Hummus',terms:['hummus']},
  {key:'whole-grain',category:'Pantry / grains',label:'Whole-grain bread / grain',terms:['whole grain','whole-grain','bread','toast','crackers']},
  {key:'rice',category:'Pantry / grains',label:'Rice',terms:['rice']},
  {key:'potato',category:'Pantry / grains',label:'Potatoes',terms:['potato','potatoes']},
  {key:'oats',category:'Pantry / grains',label:'Oats / oatmeal',terms:['oats','oatmeal']},
  {key:'olive-oil',category:'Pantry / seasonings',label:'Olive oil',terms:['olive oil']},
  {key:'nuts',category:'Pantry / seasonings',label:'Nuts / pistachios / walnuts',terms:['nuts','pistachios','walnuts','almonds']},
  {key:'seeds',category:'Pantry / seasonings',label:'Pepitas / seeds',terms:['pepitas','seeds','pumpkin seeds']},
  {key:'soy',category:'Pantry / seasonings',label:'Low-sodium soy sauce',terms:['soy sauce','soy-ginger']},
  {key:'harissa',category:'Pantry / seasonings',label:'Harissa',terms:['harissa']},
  {key:'worcestershire',category:'Pantry / seasonings',label:'Worcestershire sauce',terms:['worcestershire']},
  {key:'butter',category:'Pantry / seasonings',label:'Butter',terms:['butter']},
  {key:'capers',category:'Pantry / seasonings',label:'Capers',terms:['capers']}
];
const VEGETARIAN_SHARED_DINNERS=[
  'MEDITERRANEAN LENTIL BOWL: lentils with spinach, tomato, cucumber and olive oil. Optional whole grain on the side.',
  'VEGETABLE FRITTATA: eggs with spinach, mushrooms, tomato and Swiss cheese. Side salad with olive oil.'
];
function dietAllowsMealText(text,diet=dietStyle()){
  const t=normFood(text);
  if(diet==='vegetarian' && /\b(chicken|beef|steak|sirloin|flank|pork|salmon|tuna|cod|tilapia|sole|branzino|sea bass|catfish|trout|shrimp|fish|shellfish|meat)\b/.test(t))return false;
  if(diet==='pescatarian' && /\b(chicken|beef|steak|sirloin|flank|pork|hot dog|meat)\b/.test(t))return false;
  return true;
}
function mealFitsProfile(text){
  if(!dietAllowsMealText(text))return false;
  return !foodList('food_dislikes').some(d=>prefMatchesText(d,text));
}
function rankedDinnerChoices(){
  let choices=[...sharedDinnerAlternatives(),...VEGETARIAN_SHARED_DINNERS].filter(x=>dietAllowsMealText(x));
  const dislikes=foodList('food_dislikes'),likes=foodList('food_likes');
  const clean=choices.filter(x=>!dislikes.some(d=>prefMatchesText(d,x)));
  if(clean.length)choices=clean;
  return choices.sort((a,b)=>{
    const sa=likes.reduce((n,l)=>n+(prefMatchesText(l,a)?2:0),0);
    const sb=likes.reduce((n,l)=>n+(prefMatchesText(l,b)?2:0),0);
    return sb-sa;
  });
}
function buildSyncedMenuFromProfile(){
  const current=JSON.parse(JSON.stringify(menu()));
  const choices=rankedDinnerChoices();
  if(!Array.isArray(current.days))current.days=[];
  current.days=current.days.slice(0,7).map((d,i)=>{
    if(mealFitsProfile(d?.dinner||''))return d;
    const replacement=choices[i%Math.max(choices.length,1)]||d?.dinner||'Choose a compatible shared dinner';
    return {...d,dinner:replacement};
  });
  return current;
}
function cleanMealOverridesForProfile(){
  const source=mealOverrides(),out={};
  for(const [key,value] of Object.entries(source)){
    if(mealFitsProfile(value))out[key]=value;
  }
  return out;
}
function effectivePlanTexts(menuObj=menu()){
  const texts=[];
  const days=Array.isArray(menuObj?.days)?menuObj.days:[];
  days.forEach((d,i)=>{
    if(d?.dinner)texts.push(d.dinner);
    if(d?.flavor_override?.recipe)texts.push(d.flavor_override.recipe);
    if(profileReady()){
      for(const slot of ['breakfast','lunch','afternoon']){
        if(!isMealEnabled(slot))continue;
        try{
          const id=`${i}-${myView()}-${slot}`,t=chooseMeal(slot,i,id);
          if(t)texts.push(t);
          const flavor=personalFlavorOverrides()[id];
          if(flavor?.recipe)texts.push(flavor.recipe);
        }catch{}
      }
    }
    // Keep baseline household foods represented so syncing one person's profile does not erase the other person's known staples.
    for(const t of [d?.lunch,d?.elizabeth_breakfast,d?.elizabeth_snack,d?.clark_am,d?.clark_afternoon])if(t)texts.push(t);
  });
  return texts;
}
function groceryMatchCount(texts,item){
  return texts.reduce((n,text)=>{
    const t=normFood(text);
    return n+(item.terms.some(term=>t.includes(normFood(term)))?1:0);
  },0);
}
function generateSyncedGroceries(menuObj=menu()){
  const texts=effectivePlanTexts(menuObj);
  const old=Array.isArray(shared?.groceries)?shared.groceries:[];
  const oldById=new Map(old.filter(Boolean).map(x=>[x.id,x]));
  const generated=SYNC_GROCERY_LIBRARY.map(item=>({...item,count:groceryMatchCount(texts,item)}))
    .filter(item=>item.count>0)
    .map(item=>{
      const id=`sync-${item.key}`,prior=oldById.get(id)||old.find(x=>normFood(x?.text).includes(normFood(item.label.split(' / ')[0])));
      return {
        id,category:item.category,
        text:`${item.label} • ${item.count} planned use${item.count===1?'':'s'}`,
        checked:!!prior?.checked,unavailable:!!prior?.unavailable,synced:true
      };
    });
  const custom=old.filter(x=>x?.custom||x?.use_this_week).map(x=>({...x}));
  const seen=new Set(generated.map(x=>x.id));
  for(const x of custom)if(!seen.has(x.id)){generated.push(x);seen.add(x.id);}
  return generated;
}
function synchronizedPrepTasks(){
  const old=Array.isArray(shared?.prep_tasks)?shared.prep_tasks:[];
  const checked=Object.fromEntries(old.map(x=>[x.id,!!x.checked]));
  const days=(Array.isArray(menu()?.days)?menu().days:[]).slice(0,7).map((d,i)=>({
    id:`day-prep-${i}`,
    text:`${d.date}: ${dayPrepText(d,i)}`,
    checked:checked[`day-prep-${i}`]||checked[`dinner-prep-${i}`]||false
  }));
  const generic=[
    {id:'prep-pack',text:'Pack next-day lunches the night before; keep dressings, sauces, nuts/seeds and cheese separate until eating.'},
    {id:'prep-portion',text:'Portion proteins, oils/fats, nuts/seeds and other calorie-dense add-ons before serving.'},
    {id:'prep-produce',text:'Wash/chop the produce used by this week’s selected meals so substitutions are easy.'}
  ].map(x=>({...x,checked:checked[x.id]||false}));
  return [...days,...generic];
}
async function syncWeeklyPlanFromSelections(statusEl=null){
  if(statusEl){statusEl.textContent='Syncing menu, prep and groceries…';statusEl.className='small';}
  const cleaned=cleanMealOverridesForProfile();
  const priorOverrides=mealOverrides();
  if(JSON.stringify(cleaned)!==JSON.stringify(priorOverrides))await saveSettingAtomic('meal_overrides',cleaned);
  const updatedMenu=buildSyncedMenuFromProfile();
  const priorMenu=shared?.menu;
  shared={...shared,menu:updatedMenu};
  const updatedPrep=synchronizedPrepTasks();
  const updatedGroceries=generateSyncedGroceries(updatedMenu);
  shared={...shared,menu:priorMenu};
  await saveShared({menu:updatedMenu,prep_tasks:updatedPrep,groceries:updatedGroceries});
  if(statusEl){statusEl.textContent=`Synced: ${updatedMenu.days?.length||0} menu days • ${updatedPrep.length} prep tasks • ${updatedGroceries.length} grocery items.`;statusEl.className='small save-ok';}
  return {menu:updatedMenu,prep:updatedPrep,groceries:updatedGroceries};
}
async function syncArtifactsFromCurrentPlan(statusEl=null){
  if(statusEl){statusEl.textContent='Syncing prep and groceries to the current meal plan…';statusEl.className='small';}
  const currentMenu=JSON.parse(JSON.stringify(menu()));
  const updatedPrep=synchronizedPrepTasks();
  const updatedGroceries=generateSyncedGroceries(currentMenu);
  await saveShared({prep_tasks:updatedPrep,groceries:updatedGroceries});
  if(statusEl){statusEl.textContent=`Synced current plan: ${updatedPrep.length} prep tasks • ${updatedGroceries.length} grocery items.`;statusEl.className='small save-ok';}
  return {menu:currentMenu,prep:updatedPrep,groceries:updatedGroceries};
}
async function saveMenuAndSyncArtifacts(updatedMenu,statusEl=null){
  if(statusEl){statusEl.textContent='Syncing changed meal with prep and groceries…';statusEl.className='small';}
  const priorMenu=shared?.menu;
  shared={...shared,menu:updatedMenu};
  const updatedPrep=synchronizedPrepTasks();
  const updatedGroceries=generateSyncedGroceries(updatedMenu);
  shared={...shared,menu:priorMenu};
  await saveShared({menu:updatedMenu,prep_tasks:updatedPrep,groceries:updatedGroceries});
  if(statusEl){statusEl.textContent=`Meal synced: ${updatedPrep.length} prep tasks • ${updatedGroceries.length} grocery items.`;statusEl.className='small save-ok';}
  return {menu:updatedMenu,prep:updatedPrep,groceries:updatedGroceries};
}
async function resolveUnavailableMealsAndSync(statusEl=null){
  let affected=[];
  try{affected=affectedMeals();}catch(e){console.error('Unavailable-meal resolution failed',e);}
  if(!affected.length)return syncArtifactsFromCurrentPlan(statusEl);
  const updatedMenu=JSON.parse(JSON.stringify(menu()));
  const overrides={...mealOverrides()};
  affected.forEach(a=>{
    if(a.slot==='dinner'){
      updatedMenu.days[a.day]={...updatedMenu.days[a.day],dinner:sharedDinnerReplacement(a.text)};
    }else{
      const key=`${a.day}-${myView()}-${a.slot}`;
      overrides[key]=personalMealReplacement(a.slot,a.text);
    }
  });
  await saveSettingAtomic('meal_overrides',overrides);
  return saveMenuAndSyncArtifacts(updatedMenu,statusEl);
}

function unavailableTerms(){
  return [...new Set(groceryUnavailable().flatMap(x=>groceryTerms(x.text)))];
}
function mealUnavailableTerms(text){
  const t=normFood(text),terms=unavailableTerms();
  return terms.filter(term=>t.includes(normFood(term)));
}
function affectedMeals(){
  const out=[];
  (Array.isArray(menu()?.days)?menu().days:[]).forEach((d,i)=>{
    const dinnerTerms=mealUnavailableTerms(d.dinner);
    if(dinnerTerms.length)out.push({day:i,slot:'dinner',label:d.date,text:d.dinner,terms:dinnerTerms,shared:true});
    if(ui.view===myView()&&profileReady()){
      ['breakfast','lunch','afternoon'].forEach(slot=>{
        const text=textFor(d,slot,i),terms=mealUnavailableTerms(text);
        if(text&&terms.length)out.push({day:i,slot,label:d.date,text,terms,shared:false});
      });
    }
  });
  return out;
}
function sharedDinnerReplacement(current){
  const unavailable=unavailableTerms(),dislikes=foodList('food_dislikes'),likes=foodList('food_likes');
  let choices=sharedDinnerAlternatives()
    .filter(x=>x!==current)
    .filter(x=>!unavailable.some(t=>normFood(x).includes(normFood(t))));
  const clean=choices.filter(x=>!dislikes.some(d=>prefMatchesText(d,x)));
  if(clean.length)choices=clean;
  choices.sort((a,b)=>{
    const sa=likes.reduce((n,l)=>n+(prefMatchesText(l,a)?1:0),0);
    const sb=likes.reduce((n,l)=>n+(prefMatchesText(l,b)?1:0),0);
    return sb-sa;
  });
  return choices[0]||nextSharedDinner(current);
}
function personalMealReplacement(slot,current){
  const unavailable=unavailableTerms();
  const choices=mealCandidates(slot)
    .filter(x=>x!==current)
    .filter(x=>!unavailable.some(t=>normFood(x).includes(normFood(t))));
  return choices[0]||nextMealAlternative(slot,current);
}
function grocerySummary(){
  const total=groceryActive().length,checked=groceryActive().filter(x=>x.checked).length;
  return {total,checked,unchecked:groceryUnchecked().length,unavailable:groceryUnavailable().length};
}
function menuSuggestionForOnHand(item){
  const text=String(item?.text||'').trim();
  if(!text)return null;
  const terms=groceryTerms(text);
  let choices=sharedDinnerAlternatives().filter(x=>{
    const nx=normFood(x);
    return terms.some(t=>nx.includes(normFood(t))) || nx.includes(normFood(text));
  });
  if(!choices.length)return null;
  const dislikes=foodList('food_dislikes'),likes=foodList('food_likes');
  const clean=choices.filter(x=>!dislikes.some(d=>prefMatchesText(d,x)));
  if(clean.length)choices=clean;
  choices.sort((a,b)=>{
    const sa=likes.reduce((n,l)=>n+(prefMatchesText(l,a)?1:0),0);
    const sb=likes.reduce((n,l)=>n+(prefMatchesText(l,b)?1:0),0);
    return sb-sa;
  });
  return choices[0]||null;
}
function onHandUsedInMenu(item){
  const text=String(item?.text||'').trim(),terms=groceryTerms(text);
  return menu().days.some(d=>{
    const nx=normFood(d.dinner);
    return nx.includes(normFood(text))||terms.some(t=>nx.includes(normFood(t)));
  });
}
function nextDinnerDayForOnHand(suggestion){
  const start=todayIndex(),days=menu().days;
  for(let offset=0;offset<days.length;offset++){
    const i=(start+offset)%days.length;
    if(days[i].dinner!==suggestion)return i;
  }
  return start;
}
function prep(){return generatedPrepTasks();}
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
function sharedDinnerAlternatives(){
  return [
    'LEMON-GARLIC SALMON: salmon with asparagus or green beans. Optional whole-grain side for anyone not eating low-carb.',
    'HARISSA-LEMON CHICKEN: chicken with roasted peppers, zucchini and greens. Optional grain or bread on the side.',
    'SOY-GINGER BRANZINO: branzino with green beans and mushrooms. Optional rice on the side.',
    'SMOKY WORCESTERSHIRE LEAN BEEF: lean beef with mushrooms and green beans. Optional potato or whole-grain side.',
    'LEMON-DILL COD: cod with asparagus and salad. Optional whole-grain side.',
    'CHILI-LIME SHRIMP: shrimp with zucchini, peppers and greens. Optional rice on the side.'
  ];
}
function nextSharedDinner(current){
  const choices=sharedDinnerAlternatives();
  return choices.find(x=>x!==current) || choices[0];
}
function defaultPersonMealText(d,k,person=ui.view){
  if(k==='dinner')return d?.dinner||'';
  if(person==='Clark')return k==='breakfast'?d?.clark_am:k==='afternoon'?d?.clark_afternoon:d?.[k]||'';
  if(person==='Elizabeth')return k==='breakfast'?d?.elizabeth_breakfast:k==='afternoon'?d?.elizabeth_snack:d?.[k]||'';
  if(k==='breakfast')return `Clark: ${d?.clark_am||''}\nElizabeth: ${d?.elizabeth_breakfast||''}`;
  if(k==='afternoon')return `Clark: ${d?.clark_afternoon||''}\nElizabeth: ${d?.elizabeth_snack||''}`;
  return d?.[k]||'';
}
function textFor(d,k,i=todayIndex()){
  if(k==='dinner')return d?.dinner||'';
  if(ui.view===myView()&&profileReady()){
    try{
      const key=`${i}-${ui.view}-${k}`,candidate=chooseMeal(k,i,key);
      if(candidate)return candidate;
    }catch(e){console.error('Personal meal fallback',ui.view,k,i,e);}
    return defaultPersonMealText(d,k,ui.view);
  }
  return defaultPersonMealText(d,k,ui.view);
}
function personalFlavorOverrides(){const x=personal?.settings?.meal_flavors;return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}
function mealFlavorOptions(text){
  const t=String(text||'').toLowerCase();
  const proteinTerms=['salmon','trout','sole','branzino','sea bass','tilapia','cod','catfish','shrimp','chicken','beef','steak','sirloin'];
  const present=proteinTerms.filter(p=>t.includes(p));
  let opts=(menu().seasonings||[]).filter(s=>{
    const best=String(s.best||'').toLowerCase();
    return present.some(p=>best.includes(p));
  });
  if(!opts.length){
    const vegTerms=['asparagus','broccoli','green beans','zucchini','mushrooms'];
    const veg=vegTerms.filter(v=>t.includes(v));
    opts=(menu().seasonings||[]).filter(s=>veg.some(v=>String(s.best||'').toLowerCase().includes(v)));
  }
  return opts;
}
function flavorOverrideFor(d,i,k){
  if(k==='dinner')return d?.flavor_override||null;
  return personalFlavorOverrides()[`${i}-${myView()}-${k}`]||null;
}
function flavorDisplay(d,i,k,text){
  const f=flavorOverrideFor(d,i,k);
  if(!f)return '';
  return `<div class="flavor-note"><b>Flavor:</b> ${esc(f.name)} <span class="small">— use this instead of the seasoning named in the meal; keep the same protein and sides. Mix: ${esc(f.recipe||'')}</span></div>`;
}
function nextFlavorForMeal(text,currentName=''){
  const opts=mealFlavorOptions(text);
  if(!opts.length)return null;
  const idx=opts.findIndex(x=>x.name===currentName);
  return opts[(idx+1+opts.length)%opts.length]||opts[0];
}
function leftoverPlans(){const x=personal?.settings?.leftover_plans;return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}
function mealProtein(text){
  const t=String(text||'').toLowerCase();
  const proteins=['salmon','cod','branzino','sea bass','tilapia','trout','sole','catfish','shrimp','chicken','beef','steak','sirloin','tuna'];
  return proteins.find(p=>t.includes(p))||'protein';
}
function dinnerServingOz(text,person=myView()){
  const t=String(text||'');
  const rx=person==='Elizabeth'?/Elizabeth\s*(\d+(?:\.\d+)?)\s*oz/i:/Clark\s*(\d+(?:\.\d+)?)\s*oz/i;
  const m=t.match(rx);
  if(m)return Number(m[1]);
  return person==='Elizabeth'?5:7;
}
function lunchReserveOz(person=myView()){return person==='Elizabeth'?4:6;}
function leftoverLunchText(dinner,person=myView()){
  const protein=mealProtein(dinner),oz=lunchReserveOz(person);
  return `LEFTOVER ${protein.toUpperCase()} LUNCH: reserve ${oz} oz cooked ${protein} from dinner. Add salad or available vegetables; keep dressing/sauce separate until eating.`;
}
function leftoverPlanForDay(i){return leftoverPlans()[String(i)]||null;}
function leftoverPlanner(d,i){
  if(i>=menu().days.length-1||ui.view!==myView()||!profileReady())return '';
  const plan=leftoverPlanForDay(i),protein=mealProtein(d.dinner),reserve=lunchReserveOz(),dinnerOz=dinnerServingOz(d.dinner),total=dinnerOz+reserve;
  const status=plan?.use===true
    ?`Planned: reserve ${reserve} oz cooked ${protein} for tomorrow's lunch. For your dinner + lunch portions, plan about ${total} oz cooked ${protein} total.`
    :plan?.use===false
      ?`Tomorrow's lunch will be different; no ${protein} needs to be reserved for you.`
      :`Will you use this for lunch tomorrow? If yes, reserve ${reserve} oz cooked ${protein}. Your dinner + lunch portions would require about ${total} oz cooked ${protein} total.`;
  return `<div class="leftover-plan"><b>Tomorrow's lunch</b><p class="small">${esc(status)}</p><div class="meal-actions"><button class="secondary" data-leftover-yes="${i}">Use leftovers</button><button class="ghost" data-leftover-no="${i}">Not enough / different lunch</button></div></div>`;
}
function meal(d,i,k,label){
  if(ui.view===myView()&&profileReady()&&!isMealEnabled(k))return'';
  const t=textFor(d,k,i);if(!t)return'';
  const id=`${i}-${ui.view}-${k}`,isMine=ui.view===myView();
  const box=isMine?`<input class="check" type="checkbox" data-check="${esc(id)}" ${checks()[id]?'checked':''} aria-label="Mark ${esc(label)} complete">`:'';
  const meta=isMine&&profileReady()?mealMeta(k):'';
  const alt=isMine&&profileReady()?`<button class="meal-alt" data-alt-meal="${esc(id)}" data-slot="${esc(k)}" data-current="${esc(t)}">${k==='dinner'?'Change dinner for both of us':'Not this meal — give me another'}</button>`:'';
  const flavors=isMine&&profileReady()?mealFlavorOptions(t):[];
  const flavor=flavorOverrideFor(d,i,k);
  const flavorBtn=flavors.length?`<button class="ghost flavor-btn" data-flavor-meal="${esc(id)}" data-slot="${esc(k)}" data-current="${esc(t)}">Different flavor</button>`:'';
  const resetFlavor=flavor?`<button class="ghost flavor-reset-btn" data-reset-flavor="${esc(id)}" data-slot="${esc(k)}">Original flavor</button>`:'';
  const whey=mealUsesWhey(t)?`<label class="small whey-choice">Whey flavor <select data-whey-flavor="${esc(id)}" class="search"><option value="">Choose flavor</option>${DEFAULT_WHEY_FLAVORS.map(x=>`<option value="${esc(x)}" ${wheyFlavorForMeal(id)===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label>`:'';
  const leftover=k==='dinner'?leftoverPlanner(d,i):'';
  const estimate=estimateMealCalories(t),logged=loggedMealCalories(i,d,k),proteinEstimate=estimateMealProtein(t),proteinLogged=loggedMealProtein(i,d,k);
  const calorieLogger=isMine?`<div class="calorie-log"><label class="small">Calories eaten <input class="search" type="number" min="0" step="1" data-meal-calories="${i}" data-meal-slot="${esc(k)}" value="${logged??''}" placeholder="~${estimate}"></label><button class="ghost" data-use-meal-calories="${i}" data-meal-slot="${esc(k)}" data-estimate="${estimate}">Use ~${estimate}</button><label class="small">Protein (g) <input class="search" type="number" min="0" step="1" data-meal-protein="${i}" data-meal-slot="${esc(k)}" value="${proteinLogged??''}" placeholder="~${proteinEstimate}"></label><button class="ghost" data-use-meal-protein="${i}" data-meal-slot="${esc(k)}" data-estimate="${proteinEstimate}">Use ~${proteinEstimate} g</button></div>`:'';
  return `<div class="meal">${box}<b>${label}${meta?` <span class="small">• ${esc(meta)}</span>`:''}</b><p>${esc(t)}</p>${flavorDisplay(d,i,k,t)}${whey}${calorieLogger}<div class="meal-actions">${alt}${flavorBtn}${resetFlavor}</div>${leftover}</div>`;
}
function scheduledWorkoutOverride(p,i,d){
  const raw=p==='Clark'?d.workout_c:d.workout_e;
  const next=menu().days[i+1];
  const nextRaw=next?(p==='Clark'?next.workout_c:next.workout_e):'';
  const event=/\b(ftp|test|race|event|competition|taper)\b/i;
  const protectedDay=/no leg|fresh for|recovery as scheduled|program ride|power zone program|low impact|rest\b/i;
  if(event.test(raw)||protectedDay.test(raw))return raw;
  if(event.test(nextRaw))return raw;
  return '';
}
function defaultWorkoutForPerson(p,d){
  return p==='Clark'?(d?.workout_c||'Rest / mobility'):(d?.workout_e||'Rest / mobility');
}
function plannedWorkoutFor(p,i,d){
  try{
    const fixed=scheduledWorkoutOverride(p,i,d);
    if(fixed)return fixed;
    if(p===myView()&&profileReady()){
      const programmed=programWorkoutForDay(i,d);
      if(programmed)return programmed;
      const protection=programProtectionForDay(i,d);
      if(protection)return protection;
      return personalWorkoutFor(i)||defaultWorkoutForPerson(p,d);
    }
  }catch(e){console.error('Personal workout fallback',p,i,e);}
  return defaultWorkoutForPerson(p,d);
}
function mealTitle(text){
  const s=String(text||'').replace(/\s+/g,' ').trim();
  if(!s)return 'Meal';
  return (s.split(':')[0]||s).replace(/\.$/,'').trim();
}
function prepInstructionForMeal(text,slot='meal'){
  const t=String(text||''),low=t.toLowerCase(),title=mealTitle(t);
  if(!t)return '';
  if(/\bfast\b/.test(low))return 'No food prep needed; have your approved fasting drinks ready.';
  if(/whey|protein shake|chike|protein drink/.test(low)){
    return `${title}: pre-portion powder; chill milk/water and any fruit or nuts you plan to use.`;
  }
  const proteins=['salmon','branzino','tilapia','cod','trout','sole','catfish','shrimp','tuna','chicken','beef','steak','sirloin','hot dog','eggs','egg'];
  const vegetables=['asparagus','broccoli','green beans','zucchini','mushrooms','spinach','romaine','cucumber','tomato','peppers','salad','greens'];
  const p=[...new Set(proteins.filter(x=>low.includes(x)))];
  const v=[...new Set(vegetables.filter(x=>low.includes(x)))];
  if(slot==='lunch'){
    return `${title}: pack ahead${p.length?' and portion '+p.slice(0,2).join('/') : ''}${v.length?'; wash/chop '+v.slice(0,3).join(', '):''}. Keep dressing/sauce separate until eating.`;
  }
  if(slot==='afternoon'||slot==='breakfast'){
    return `${title}: portion the ingredients in advance so it is ready at the planned time.`;
  }
  return `${title}: ${p.length?'thaw/portion '+p.slice(0,2).join('/'):'set out the main protein'}${v.length?'; wash/chop '+v.slice(0,3).join(', '):'; prep the listed vegetables'}. Measure sauce/seasoning before cooking.`;
}
function dayPrepText(d,i){
  const parts=[];
  if(ui.view===myView()&&profileReady()){
    const breakfast=textFor(d,'breakfast',i),lunch=textFor(d,'lunch',i),afternoon=textFor(d,'afternoon',i);
    if(breakfast)parts.push(prepInstructionForMeal(breakfast,'breakfast'));
    if(lunch)parts.push(prepInstructionForMeal(lunch,'lunch'));
    if(afternoon)parts.push(prepInstructionForMeal(afternoon,'afternoon'));
  }
  parts.push(prepInstructionForMeal(d.dinner,'dinner'));
  const dinnerFlavor=flavorOverrideFor(d,i,'dinner');
  if(dinnerFlavor)parts.push(`Flavor mix: ${dinnerFlavor.name} — ${dinnerFlavor.recipe}.`);
  const lp=leftoverPlanForDay(i);
  if(lp?.use===true)parts.push(`Reserve ${lunchReserveOz()} oz cooked ${mealProtein(d.dinner)} before serving/adding extra sauce for tomorrow's lunch.`);
  return parts.filter(Boolean).join(' ');
}
function generatedPrepTasks(){return synchronizedPrepTasks();}
function dayCard(d,i){
  let w='';
  if(workoutShown(ui.view)){
    if(ui.view==='Both'){
      w=`<div class="work"><b>Clark:</b> ${esc(d.workout_c)}<br><b>Elizabeth:</b> ${esc(d.workout_e)}</div>`;
    }else{
      const id=`${i}-${ui.view}`,isMine=ui.view===myView();
      const box=isMine?`<input class="check" type="checkbox" data-workout-check="${esc(id)}" ${workoutChecks()[id]?'checked':''} aria-label="Mark workout complete">`:'';
      const workout=plannedWorkoutFor(ui.view,i,d),burnLogged=loggedWorkoutCalories(i,d),burnEst=estimateWorkoutCalories(workout);
      const burn=isMine?`<div class="calorie-log"><label class="small">Workout calories burned <input class="search" type="number" min="0" step="1" data-workout-calories="${i}" value="${burnLogged??''}" placeholder="~${burnEst}"></label><button class="ghost" data-use-workout-calories="${i}" data-estimate="${burnEst}">Use ~${burnEst}</button></div>`:'';
      w=`<div class="work">${box}<b>Workout:</b> ${esc(workout)}${burn}</div>`;
    }
  }
  const drink=ui.view===myView()?renderDrinkPlanner(i):'';
  return `<section class="card"><div class="dayhead"><div><h3>${esc(d.date)}</h3><div class="meta">Shared menu • ${esc(ui.view)} view</div></div>${i===todayIndex()?'<span class="badge">TODAY</span>':''}</div>${meal(d,i,'breakfast','Morning / breakfast')}${meal(d,i,'lunch','Lunch')}${meal(d,i,'afternoon','Afternoon')}${meal(d,i,'dinner','Dinner')}${drink}${w}<div class="prep"><b>Prep:</b> ${esc(dayPrepText(d,i))}</div></section>`;
}
function renderToday(){
  const n=personal?.notes?.free_text||'',idx=todayIndex(),day=(Array.isArray(menu()?.days)?menu().days[idx]:null)||DEFAULT_DATA.days[idx];
  let summary={diet:'Balanced',goals:'Not selected'},gs={checked:0,total:0,unchecked:0,unavailable:0};
  try{summary=profileSummaryText();}catch(e){console.error('Profile summary fallback',e);}
  try{gs=grocerySummary();}catch(e){console.error('Grocery summary fallback',e);}
  const profileCard=ui.view===myView()?`<div class="card profile-status"><div class="dayhead"><div><h3>My Profile — ${esc(myName())}</h3><div class="small"><b>Diet:</b> ${esc(summary.diet)}<br><b>Training:</b> ${esc(summary.goals)}</div></div><span class="badge ${vitalsComplete()?'ok-badge':'warn-badge'}">${vitalsComplete()?'SAVED':'VITALS NEEDED'}</span></div><button class="secondary" id="todayProfileBtn">${vitalsComplete()?'Edit my profile':'Finish age, height & weight'}</button></div>`:'';
  const groceryCard=`<div class="card grocery-readiness"><div class="dayhead"><div><h3>Weekly groceries</h3><div class="small">${gs.checked} of ${gs.total} confirmed${gs.unavailable?` • ${gs.unavailable} unavailable`:''}.</div></div><span class="badge ${gs.unchecked===0&&gs.unavailable===0?'ok-badge':'warn-badge'}">${gs.unchecked===0&&gs.unavailable===0?'READY':'CHECK'}</span></div><p class="small">Are the groceries needed for this week available? Confirm what you have or bought. If something cannot be obtained, mark it Unavailable and PomFit can offer menu changes.</p><button class="secondary" id="weeklyGroceryBtn">Check weekly groceries</button></div>`;
  const hunger=ui.view===myView()?'<div class="card hunger-card"><h3>Still hungry?</h3><p class="small">Get a small add-on that fits your saved diet, dislikes and fasting window.</p><button class="secondary" id="hungerBtn">I’m still hungry — what can I eat?</button><div id="hungerResult"></div></div>':'';
  let energy='',todayCard='';
  try{energy=renderEnergyDashboard(idx,day);}catch(e){console.error('Energy dashboard fallback',e);}
  try{todayCard=dayCard(day,idx);}catch(e){console.error('Today card fallback',e);todayCard=weekDayCard(day,idx);}
  return profileCard+energy+groceryCard+todayCard+hunger+`<div class="card"><h3>Private notes</h3><textarea id="notes" class="note" placeholder="Weights, BP, substitutions, workout notes…">${esc(n)}</textarea><p class="small">Only your signed-in account can read these notes.</p></div>`;
}
function rawWeekMealText(d,k){
  if(k==='dinner')return d?.dinner||'';
  if(ui.view==='Clark')return k==='breakfast'?d?.clark_am:k==='afternoon'?d?.clark_afternoon:d?.[k]||'';
  if(ui.view==='Elizabeth')return k==='breakfast'?d?.elizabeth_breakfast:k==='afternoon'?d?.elizabeth_snack:d?.[k]||'';
  if(k==='breakfast')return `Clark: ${d?.clark_am||''} | Elizabeth: ${d?.elizabeth_breakfast||''}`;
  if(k==='afternoon')return `Clark: ${d?.clark_afternoon||''} | Elizabeth: ${d?.elizabeth_snack||''}`;
  return d?.[k]||'';
}
function safeWeekMealText(d,i,k){
  try{return textFor(d,k,i)||rawWeekMealText(d,k);}catch(e){console.error('Week meal render fallback',i,k,e);return rawWeekMealText(d,k);}
}
function weekDayCard(d,i){
  const row=(label,k)=>`<div class="week-meal-row"><b>${label}</b><span>${esc(safeWeekMealText(d,i,k))}</span></div>`;
  return `<section class="card week-menu-card"><div class="dayhead"><div><h3>${esc(d?.date||`Day ${i+1}`)}</h3><div class="meta">7-day menu • ${esc(ui.view)} view</div></div>${i===todayIndex()?'<span class="badge">TODAY</span>':''}</div>${row('Morning / breakfast','breakfast')}${row('Lunch','lunch')}${row('Afternoon','afternoon')}${row('Dinner','dinner')}<div class="prep"><b>Prep:</b> ${esc(d?.prep||'')}</div></section>`;
}
function renderWeek(){
  const source=Array.isArray(menu()?.days)&&menu().days.length?menu().days:(Array.isArray(DEFAULT_DATA?.days)?DEFAULT_DATA.days:[]);
  const days=source.slice(0,7);
  return `<div class="card week-summary"><div class="dayhead"><div><h2>Weekly menu</h2><div class="small">${days.length} day${days.length===1?'':'s'} loaded • ${esc(ui.view)} view</div></div><span class="badge ${days.length===7?'ok-badge':'warn-badge'}">${days.length===7?'7 DAYS':'CHECK MENU'}</span></div><p class="small">This view is intentionally menu-only so one calorie, workout, or drink control cannot prevent the rest of the week from displaying.</p></div><div class="weekgrid">${days.map((d,i)=>weekDayCard(d,i)).join('')}</div>`;
}
function renderPrep(){return `<div class="card"><h2>Shared meal prep</h2><ul class="list">${prep().map(x=>`<li><input type="checkbox" data-prep="${esc(x.id)}" ${x.checked?'checked':''}><label class="${x.checked?'done':''}">${esc(x.text)}</label></li>`).join('')}</ul></div>`;}
function renderGroceryBody(){
  const all=groceryActive().filter(x=>x&&typeof x==='object'&&x.id&&x.text);
  const visible=groceryMode==='needs'?all.filter(x=>!x.checked||x.unavailable):all;
  const cats={};visible.forEach(x=>(cats[x.category||'Other']??=[]).push(x));
  const gs={total:all.length,checked:all.filter(x=>x.checked).length,unchecked:all.filter(x=>!x.checked&&!x.unavailable).length,unavailable:all.filter(x=>x.unavailable).length};
  let affected=[];try{affected=affectedMeals();}catch(e){console.error('Affected-meal check failed',e);}
  let h=`<div class="card grocery-audit"><div class="dayhead"><div><h2>Weekly groceries</h2><div class="small">Synced to the current menu/profile selections.</div></div><button class="secondary" id="syncWeeklyPlanBtn">Sync weekly plan</button></div><div id="planSyncStatus" class="small"></div><p>Check items you already have or have purchased. If an item cannot be obtained, mark it <b>Unavailable</b>.</p><div class="small"><b>${gs.checked}</b> confirmed • <b>${gs.unchecked}</b> still to get/confirm • <b>${gs.unavailable}</b> unavailable</div><div class="controls"><button class="secondary" id="shopRemainingBtn">Shop / show remaining</button><button class="ghost" id="showAllGroceriesBtn">Show all</button></div></div>`;
  h+=`<div class="card on-hand-card"><h3>Already have something you want to use?</h3><p class="small">Add an ingredient that is already in the house. It will be preserved when the weekly plan is re-synced.</p><div class="on-hand-entry"><input id="onHandGroceryInput" class="search" placeholder="e.g. cod, asparagus, ground beef"><button class="secondary" id="addOnHandGroceryBtn">Add on hand</button></div><div id="onHandGroceryStatus" class="small"></div></div>`;
  if(gs.unavailable){
    h+=`<div class="card grocery-action"><h3>${gs.unavailable} unavailable item${gs.unavailable===1?'':'s'}</h3><p>${affected.length?`${affected.length} current meal${affected.length===1?' is':'s are'} affected.`:'No current meal appears to depend on them.'}</p>${affected.length?`<button class="primary" id="changeAffectedMealsBtn">Change affected meals and re-sync</button>`:''}<button class="secondary" id="keepMenuShopBtn">Keep menu — I’ll shop for them</button></div>`;
  }else if(gs.unchecked){
    h+=`<div class="card"><h3>${gs.unchecked} items still unconfirmed</h3><p class="small">Check items when available. Only unavailable items force meal substitutions.</p></div>`;
  }else{
    h+=`<div class="card"><h3>Groceries confirmed</h3><p class="small">Everything currently required is marked available/purchased.</p></div>`;
  }
  h+='<div class="gcols">';
  for(const [cat,items] of Object.entries(cats)){
    h+=`<section class="card"><h3>${esc(cat)}</h3><ul class="list grocery-list">${items.map(x=>{const p=groceryPreference(x);return `<li class="${x.unavailable?'grocery-unavailable':''}"><input type="checkbox" data-g="${esc(x.id)}" ${x.checked?'checked':''}><div class="grocery-item-text"><label class="${x.checked?'done':''}">${esc(x.text)}</label>${p.dislike?`<div class="small pref-warn">Your profile dislikes: ${esc(p.dislike)}</div>`:p.like?`<div class="small pref-like">Matches a liked food: ${esc(p.like)}</div>`:''}</div>${x.use_this_week?'<span class="badge">ON HAND</span>':''}<button class="ghost grocery-unavailable-btn" data-g-unavailable="${esc(x.id)}">${x.unavailable?'Available after all':'Unavailable'}</button></li>`}).join('')}</ul></section>`;
  }
  h+='</div><div class="card"><button class="ghost" id="resetG">Reset shared grocery checks</button></div>';
  return h;
}
function renderGrocery(){
  try{return renderGroceryBody();}
  catch(e){
    console.error('Grocery render failed',e);
    return `<div class="card"><h2>Weekly groceries</h2><p>The grocery screen hit a rendering problem, but your saved data is still intact.</p><p class="small">${esc(e?.message||'Unknown grocery render error')}</p><button class="primary" id="repairGroceryBtn">Rebuild groceries from weekly plan</button><div id="planSyncStatus" class="small"></div></div>`;
  }
}
function renderSeason(){return `<div class="card"><h2>Seasoning library</h2><input id="seasonSearch" class="search" placeholder="Search soy, fish, asparagus, smoky…"><div class="season" id="seasonList">${menu().seasonings.map(s=>`<details data-search="${esc((s.name+' '+s.best+' '+s.recipe).toLowerCase())}"><summary>${esc(s.name)} <span class="small">• ${esc(s.sodium)} sodium</span></summary><p><b>Best with:</b> ${esc(s.best)}</p><p><b>Mix:</b> ${esc(s.recipe)}</p></details>`).join('')}</div></div>`;}
function renderPelotonRoadmap(){
  if(!equipmentList().includes('peloton_bike'))return '';
  const p=trainingPrograms().peloton_bike||{},t=pelotonTemplateFor(p.name);
  if(!t)return p.name?`<div class="card"><h3>Peloton program</h3><p class="small">Custom program: ${esc(p.name)}. PomFit is using the custom days/key sessions entered in Profile.</p></div>`:'';
  const start=p.start_date?new Date(p.start_date+'T12:00:00'):null;
  const today=new Date(),currentWeek=start&&!Number.isNaN(start.getTime())?Math.floor((today-start)/604800000)+1:null;
  const weeks=Array.from({length:t.weeks},(_,idx)=>{
    const week=idx+1,sessions=(t.schedule[week]||[]);
    return `<details ${currentWeek===week?'open':''}><summary>Week ${week}${currentWeek===week?' • current':''}</summary><ul>${sessions.map(x=>`<li>Day ${x.day}: ${esc(x.text)} <span class="small">• ${esc(x.load)}</span></li>`).join('')}</ul></details>`;
  }).join('');
  return `<div class="card peloton-roadmap"><h3>${esc(t.label)} roadmap</h3><p class="small">${p.start_date?'Start date: '+esc(p.start_date)+'. ':'Add a start date in Profile to synchronize calendar dates. '}PomFit reserves these rides first, then places strength/recovery around them.</p>${weeks}</div>`;
}
function renderWorkout(){
  const p=ui.view==='Both'?myView():ui.view,isMe=p===myView(),days=Array.isArray(menu()?.days)?menu().days:DEFAULT_DATA.days;
  let roadmap='';try{roadmap=isMe?renderPelotonRoadmap():'';}catch(e){console.error('Workout roadmap fallback',e);}
  const cards=days.map((d,i)=>{
    try{
      const id=`${i}-${p}`,box=isMe?`<input class="check" type="checkbox" data-workout-check="${esc(id)}" ${workoutChecks()[id]?'checked':''} aria-label="Mark workout complete">`:'';
      const workout=plannedWorkoutFor(p,i,d)||defaultWorkoutForPerson(p,d),burnLogged=isMe?loggedWorkoutCalories(i,d):null,burnEst=isMe?estimateWorkoutCalories(workout):0;
      const burn=isMe?`<div class="calorie-log"><label class="small">Calories burned <input class="search" type="number" min="0" step="1" data-workout-calories="${i}" value="${burnLogged??''}" placeholder="~${burnEst}"></label><button class="ghost" data-use-workout-calories="${i}" data-estimate="${burnEst}">Use ~${burnEst}</button></div>`:'';
      return `<div class="card"><h3>${esc(d?.date||`Day ${i+1}`)}</h3><div class="work">${box}${esc(workout)}${burn}</div></div>`;
    }catch(e){
      console.error('Workout card fallback',p,i,e);
      return `<div class="card"><h3>${esc(d?.date||`Day ${i+1}`)}</h3><div class="work">${esc(defaultWorkoutForPerson(p,d))}</div></div>`;
    }
  }).join('');
  return `<div class="card"><h2>${esc(p)} workout</h2>${isMe?`<label class="toggle"><input type="checkbox" id="profileWorkout" ${profile?.workout_enabled!==false?'checked':''}> Workouts ON for ${esc(p)}</label><p class="small">Check off each workout when finished.</p>`:'<p class="small">You can view the plan, but only that person can mark a workout complete.</p>'}</div>${roadmap}<div class="weekgrid">${cards}</div>`;
}
function renderProfile(){
  const p=personalProfile(),m=mealSchedule(),goals=workoutGoals(),equipment=equipmentList(),programs=trainingPrograms();
  const goal=(g,label)=>`<label class="toggle"><input type="checkbox" data-goal="${g}" ${goals.includes(g)?'checked':''}> ${label}</label>`;
  const equip=(g,label)=>`<label class="toggle"><input type="checkbox" data-equipment="${g}" ${equipment.includes(g)?'checked':''}> ${label}</label>`;
  const programRow=(k,label)=>{const x=programs[k]||{},peloton=k==='peloton_bike';return `<div class="program-row" data-program-row="${k}"><b>${label} program</b><label class="small">Program / training plan <input id="programName_${k}" class="search" ${peloton?'list="pelotonProgramOptions"':''} value="${esc(x.name||'')}" placeholder="${peloton?'e.g. Discover Your Power Zones':'Program name'}"></label><label class="small">Program start date <input id="programStart_${k}" class="search" type="date" value="${esc(x.start_date||'')}"></label>${peloton?`<datalist id="pelotonProgramOptions"><option value="Discover Your Power Zones"><option value="Build Your Power Zones"><option value="Peak Your Power Zones"><option value="Boost Your Base: Power Zones"></datalist><div class="small program-sync-status">${esc(pelotonProgramStatus(x))}</div>`:''}<label class="small">Custom / usual program days <input id="programDays_${k}" class="search" value="${esc(x.days||'')}" placeholder="Used when PomFit does not recognize the program"></label><label class="small">Key sessions / tests or notes <input id="programSessions_${k}" class="search" value="${esc(x.key_sessions||'')}" placeholder="Optional notes or custom schedule details"></label></div>`;};
  const mealRow=(key,label)=>{const x=m[key]||{};return `<div class="metric"><b>${label}</b><label class="toggle"><input type="checkbox" data-meal-enabled="${key}" ${x.enabled!==false?'checked':''}> Include</label><label class="small">Time <input type="time" data-meal-time="${key}" value="${esc(x.time||'')}"></label><label class="small">Location <input class="search" data-meal-location="${key}" value="${esc(x.location||'')}" placeholder="Home, work, school…"></label></div>`;};
  return `<div class="card"><h2>My profile</h2><p class="small">Your profile is private and drives your own meal and workout recommendations.</p><div class="account-grid">
  <div class="metric"><b>Basics & weight goal</b><label class="small">Age <input id="profAge" class="search" type="number" min="18" max="100" value="${esc(p.age??'')}"></label><div class="height-row"><label class="small">Height feet <input id="profHeightFt" class="search" type="number" min="4" max="7" value="${esc(profileHeightParts().ft)}"></label><label class="small">Height inches <input id="profHeightIn" class="search" type="number" min="0" max="11.9" step=".1" value="${esc(profileHeightParts().inch)}"></label></div><label class="small">Current weight (lb) <input id="profWeight" class="search" type="number" min="70" max="600" step=".1" value="${esc(p.weight_lb??'')}"></label><label class="small">Goal weight (lb) <input id="profGoalWeight" data-profile-autosave class="search" type="number" min="70" max="600" step=".1" value="${esc(p.goal_weight_lb??'')}"></label><label class="small">Daily protein target override (g, optional) <input id="profProteinTarget" data-profile-autosave class="search" type="number" min="40" max="400" step="1" value="${esc(p.protein_target_g??'')}" placeholder="Automatic if blank"></label><div id="profileAutosaveStatus" class="small profile-autosave-status">Goal and calorie-target fields save automatically when changed.</div></div>
  <div class="metric"><b>Calorie target setup</b><label class="small">Calorie-equation sex <select id="calorieSex" data-profile-autosave class="search"><option value="">Select</option><option value="male" ${p.calorie_equation_sex==='male'?'selected':''}>Male</option><option value="female" ${p.calorie_equation_sex==='female'?'selected':''}>Female</option><option value="neutral" ${p.calorie_equation_sex==='neutral'?'selected':''}>Neutral midpoint estimate</option></select></label><label class="small">Normal daily activity outside workouts <select id="baselineActivity" data-profile-autosave class="search"><option value="sedentary" ${p.baseline_activity==='sedentary'?'selected':''}>Mostly sitting</option><option value="light" ${(p.baseline_activity||'light')==='light'?'selected':''}>Light movement</option><option value="moderate" ${p.baseline_activity==='moderate'?'selected':''}>Moderately active / on feet</option><option value="active" ${p.baseline_activity==='active'?'selected':''}>Very active outside workouts</option></select></label><label class="small">Desired weight-change pace <select id="goalRate" data-profile-autosave class="search"><option value="0" ${Number(p.goal_rate_lb_week)===0?'selected':''}>Maintain / no calorie adjustment</option><option value=".25" ${Number(p.goal_rate_lb_week)===.25?'selected':''}>0.25 lb/week</option><option value=".5" ${Number(p.goal_rate_lb_week??.5)===.5?'selected':''}>0.5 lb/week</option><option value="1" ${Number(p.goal_rate_lb_week)===1?'selected':''}>1 lb/week</option></select></label><div class="small">Diet style affects meal choices; calorie target is based on body size, daily activity, goal direction, and workout energy. PomFit floors calculated targets at 1,200 kcal/day and labels them as estimates.</div></div>
  <div class="metric"><b>Diet style</b><select id="dietStyle" class="search"><option value="balanced">Balanced</option><option value="performance">Athletic performance</option><option value="musclegain">Muscle gain / high protein</option><option value="mediterranean">Mediterranean</option><option value="lowcarb">Low carb</option><option value="keto">Keto</option><option value="pescatarian">Pescatarian</option><option value="vegetarian">Vegetarian</option></select><div class="small" style="margin-top:6px">Athletic performance emphasizes protein plus enough carbohydrate to support training. Muscle gain uses a higher-protein, recovery-focused pattern with adequate calories.</div></div>
  <div class="metric"><b>Foods</b><label class="small">Foods I like <input id="foodLikes" class="search" value="${esc(p.food_likes||'')}" placeholder="salmon, asparagus, berries"></label><label class="small">Foods I don't like <input id="foodDislikes" class="search" value="${esc(p.food_dislikes||'')}" placeholder="eggs, yogurt, broccoli"></label><div class="divider">Check a food against this diet</div><input id="foodQuery" class="search" placeholder="e.g. sweet potato, shrimp, oatmeal"><button class="secondary" id="checkFoodBtn">Check & add food</button><div id="foodQueryResult" class="food-check-result" role="status" aria-live="polite"></div></div>
  <div class="metric"><b>Intermittent fasting</b><label class="toggle"><input id="ifToggle" type="checkbox" ${p.intermittent_fasting?'checked':''}> Use intermittent fasting</label><label class="small">Eating window start <input id="ifStart" type="time" value="${esc(p.fasting_start||'12:00')}"></label><label class="small">Eating window end <input id="ifEnd" type="time" value="${esc(p.fasting_end||'20:00')}"></label></div>
  <div class="metric"><b>Workout goals</b><div class="controls">${goal('sculpt','Sculpt / tone')}${goal('strength','Strength without bulk')}${goal('muscle','Muscle building / hypertrophy')}${goal('cardio','Cardio fitness')}${goal('hiit','HIIT / conditioning')}${goal('mobility','Mobility / flexibility')}${goal('core','Core / posture')}</div></div>
  <div class="metric"><b>Sport / event preparation</b><div class="controls">${goal('ski','Skiing')}${goal('cycling','Cycling')}${goal('running','Running')}${goal('tennis','Tennis')}${goal('boxing','Boxing')}${goal('swimming','Swimming')}${goal('soccer','Soccer')}${goal('basketball','Basketball')}</div></div>
  <div class="metric"><b>Resistance equipment available</b><div class="controls">${equip('bowflex','Bowflex / home gym')}${equip('dumbbells','Dumbbells')}${equip('bands','Resistance bands')}${equip('cable','Cable machine')}${equip('barbell','Barbell / rack')}${equip('kettlebell','Kettlebells')}${equip('trx','TRX / suspension trainer')}${equip('bodyweight','Bodyweight only')}</div><label class="small">Device/model or equipment notes <input id="equipmentNotes" class="search" value="${esc(p.equipment_notes||'')}" placeholder="e.g. Bowflex PR3000, adjustable dumbbells to 50 lb"></label></div>
  <div class="metric"><b>Cardio / smart-training devices</b><p class="small">If a device uses a structured program, enter its program name and start date. Recognized Peloton Power Zone programs use PomFit's built-in week-by-week planning presets from the start date; this is not live Peloton-account sync. Other devices/programs can still use custom days. Program sessions take priority when PomFit schedules strength, HIIT and recovery.</p><div class="controls">${equip('peloton_bike','Peloton Bike')}${equip('peloton_tread','Peloton Tread')}${equip('peloton_row','Peloton Row')}${equip('tonal','Tonal')}${equip('hydrow','Hydrow')}${equip('ifit','NordicTrack / iFIT')}${equip('concept2','Concept2')}${equip('other_program','Other program/device')}</div><div class="programs-wrap">${programRow('peloton_bike','Peloton Bike')}${programRow('peloton_tread','Peloton Tread')}${programRow('peloton_row','Peloton Row')}${programRow('tonal','Tonal')}${programRow('hydrow','Hydrow')}${programRow('ifit','NordicTrack / iFIT')}${programRow('concept2','Concept2')}${programRow('other_program','Other')}</div></div>
  ${mealRow('breakfast','Breakfast / morning')}${mealRow('lunch','Lunch')}${mealRow('afternoon','Afternoon snack')}${mealRow('dinner','Dinner')}
  </div><div class="profile-save-actions"><button class="primary" id="saveProfileBtn">Save profile & sync weekly plan</button><button class="secondary" id="syncProfilePlanBtn">Sync menu, prep & groceries</button></div><div id="profileSaveStatus" class="small" style="margin-top:8px"></div><div id="profilePlanSyncStatus" class="small" style="margin-top:6px"></div></div>`;
}
function renderAccount(){
  return `<div class="card"><h2>Account & household</h2><div class="account-grid"><div class="metric"><b>Signed in as</b>${esc(myName())}<div class="small">${esc(session.user.email)}</div><button class="secondary" id="editProfileBtn">Edit my profile</button></div><div class="metric"><b>Name your Pom</b><input id="pomNameInput" class="search" maxlength="20" value="${esc(pomName())}" placeholder="Gizmo"><div class="small">This is your personal Pom name. PomFit remains the app name.</div></div><div class="metric"><b>Bark reminder</b><label class="toggle"><input type="checkbox" id="barkReminderToggle" ${barkEnabled()?'checked':''}> Bark if today's meals or workout are incomplete</label><label class="small">Reminder time <input id="barkReminderTime" type="time" value="${esc(barkTime())}"></label><button class="ghost" id="testBarkBtn">Test ${esc(pomName())}'s bark</button><div class="small">Off by default. Bark works while PomFit is open or brought to the foreground.</div></div><div class="metric"><b>Household</b>${esc(household?.name||'')}</div><div class="metric"><b>Join code</b><div class="invite">${esc(household?.invite_code||'')}</div><div class="small">Use this code for another household member.</div></div><div class="metric"><b>App tour</b><button class="secondary" id="replayTourBtn">Replay app tour</button><div class="small">Gizmo will walk through Profile, meals, workouts, shared tools and reminders.</div></div><div class="metric"><b>App version</b>PomFit v60<div class="small">Use “Update PomFit” whenever you want to refresh to the newest published build.</div></div></div><button class="secondary" id="updateAppBtn">Update PomFit</button><button class="ghost" id="signOutBtn">Sign out</button></div>`;
}
function render(){
  if(!shared)return;
  $('#speech').textContent=tip();
  $$('#profileSeg button').forEach(b=>b.classList.toggle('active',b.dataset.p===ui.view));
  $$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===ui.tab));
  $('#workoutToggle').checked=workoutShown(ui.view);
  const pages={today:renderToday,week:renderWeek,prep:renderPrep,grocery:renderGrocery,season:renderSeason,workout:renderWorkout,profile:renderProfile,account:renderAccount};
  try{$('#content').innerHTML=(pages[ui.tab]||renderToday)();}
  catch(e){console.error('Page render failed',ui.tab,e);$('#content').innerHTML=`<div class="card"><h2>PomFit page error</h2><p>This page could not render, but the rest of PomFit is still available.</p><p class="small">${esc(e?.message||'Unknown render error')}</p></div>`;}
  bindDynamic();
}
async function saveSettingAtomic(key,value){
  const r=await supabase.rpc('save_my_setting',{p_key:key,p_value:value});
  if(r.error)throw r.error;
  const row=Array.isArray(r.data)?r.data[0]:r.data;
  if(row)personal=row;
  return row;
}
async function saveProfileAtomic(next){
  const vitalRecord={
    age:next.age,
    height_in:next.height_in,
    weight_lb:next.weight_lb,
    saved_at:new Date().toISOString()
  };
  const r=await supabase.rpc('save_my_profile',{
    p_profile:next,
    p_vitals:vitalRecord
  });
  if(r.error)throw r.error;
  const row=Array.isArray(r.data)?r.data[0]:r.data;
  if(row)personal=row;
  return row;
}
function profileCoreMatches(saved,next){
  const numEq=(a,b)=>{const x=Number(a),y=Number(b);return (a==null&&b==null)||(Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<0.001);};
  return numEq(saved.goal_weight_lb,next.goal_weight_lb)
    && String(saved.calorie_equation_sex||'')===String(next.calorie_equation_sex||'')
    && String(saved.baseline_activity||'light')===String(next.baseline_activity||'light')
    && numEq(saved.goal_rate_lb_week,next.goal_rate_lb_week)
    && numEq(saved.protein_target_g,next.protein_target_g);
}
async function saveProfileFormNow(statusEl){
  const next=collectProfileForm();
  if(statusEl)statusEl.textContent='Saving…';
  await saveProfileAtomic(next);
  const saved=personalProfile(),ok=profileCoreMatches(saved,next);
  profileFormDirty=false;
  if(statusEl){
    statusEl.textContent=ok?'Saved.':'Save returned, but one or more target settings did not verify.';
    statusEl.className='small profile-autosave-status '+(ok?'save-ok':'save-warn');
  }
  return {next,saved,ok};
}
async function checkAndAddFood(){
  const input=$('#foodQuery'),dietEl=$('#dietStyle'),out=$('#foodQueryResult'),likesEl=$('#foodLikes');
  if(!input||!dietEl||!out||!likesEl)return;
  const food=String(input.value||'').trim(),diet=dietEl.value;
  if(!food){out.className='food-check-result status-warn';out.textContent='Enter a food to check.';return;}
  const result=foodCompatibility(food,diet);
  const labels={yes:'✓ OK',limited:'△ LIMITED',no:'✕ NOT COMPATIBLE',unknown:'? NEEDS REVIEW'};
  out.className='food-check-result status-'+result.status;
  out.innerHTML=`<b>${esc(labels[result.status]||'CHECK')}</b><span>${esc(result.message)}</span>`;
  if(result.status!=='yes')return;
  const existing=likesEl.value.split(',').map(x=>x.trim()).filter(Boolean);
  if(!existing.some(x=>x.toLowerCase()===food.toLowerCase()))existing.push(food);
  likesEl.value=existing.join(', ');
  try{
    profileFormDirty=true;
    const next={...collectProfileForm(),diet_style:diet,food_likes:likesEl.value.trim()};
    await saveProfileAtomic(next);
    const savedLikes=String(personalProfile().food_likes||'').toLowerCase();
    const saved=savedLikes.split(',').map(x=>x.trim()).includes(food.toLowerCase());
    out.className='food-check-result '+(saved?'status-yes':'status-warn');
    out.innerHTML=saved
      ?`<b>✓ OK — ADDED</b><span>${esc(result.message)} Saved to Foods I like.</span>`
      :`<b>△ SAVE NOT VERIFIED</b><span>The food is compatible, but PomFit could not verify that it was saved.</span>`;
    if(saved)input.value='';
  }catch(e){
    out.className='food-check-result status-no';
    out.innerHTML=`<b>✕ SAVE FAILED</b><span>${esc(e.message||'Unknown save error')}</span>`;
  }
}
async function savePersonal(patch){
  syncMsg('Saving personal changes…');
  const updatedAt=new Date().toISOString();
  const r=await supabase.from('personal_state')
    .update({...patch,updated_at:updatedAt})
    .eq('user_id',session.user.id)
    .select('*')
    .single();
  if(r.error){syncMsg('Save failed');throw r.error;}
  personal=r.data;
  syncMsg('Synced');
  return r.data;
}
async function saveShared(patch){
  const prior=shared,updatedAt=new Date().toISOString();
  shared={...shared,...patch,updated_at:updatedAt,updated_by:session.user.id};syncMsg('Saving shared changes…');
  const r=await supabase.from('household_state').update({...patch,updated_at:updatedAt,updated_by:session.user.id}).eq('household_id',profile.household_id);
  if(r.error){shared=prior;syncMsg('Shared save failed');throw r.error;}
  syncMsg('Synced');return shared;
}
let noteTimer;
function bindDynamic(){
  $$('[data-check]').forEach(x=>x.onchange=()=>savePersonal({settings:{...(personal.settings||{}),meal_checks:{...checks(),[x.dataset.check]:x.checked}}}));
  $$('[data-workout-check]').forEach(x=>x.onchange=()=>savePersonal({settings:{...(personal.settings||{}),workout_checks:{...workoutChecks(),[x.dataset.workoutCheck]:x.checked}}}));
  $$('[data-prep]').forEach(x=>x.onchange=()=>{saveShared({prep_tasks:prep().map(t=>t.id===x.dataset.prep?{...t,checked:x.checked}:t)});x.nextElementSibling.classList.toggle('done',x.checked);});
  $$('[data-g]').forEach(x=>x.onchange=async()=>{
    const updated=groceries().map(t=>t.id===x.dataset.g?{...t,checked:x.checked,unavailable:x.checked?false:t.unavailable}:t);
    await saveShared({groceries:updated});
    render();
  });
  if($('#notes'))$('#notes').oninput=e=>{clearTimeout(noteTimer);noteTimer=setTimeout(()=>savePersonal({notes:{...(personal.notes||{}),free_text:e.target.value}}),500);};
  if($('#resetG'))$('#resetG').onclick=()=>saveShared({groceries:groceries().map(x=>({...x,checked:false,unavailable:false}))}).then(render);
  if($('#weeklyGroceryBtn'))$('#weeklyGroceryBtn').onclick=()=>{ui.tab='grocery';groceryMode='needs';render();};
  if($('#syncWeeklyPlanBtn'))$('#syncWeeklyPlanBtn').onclick=async()=>{
    const status=$('#planSyncStatus');
    try{await syncWeeklyPlanFromSelections(status);render();}catch(e){if(status){status.textContent='Sync failed: '+e.message;status.className='small save-warn';}}
  };
  if($('#repairGroceryBtn'))$('#repairGroceryBtn').onclick=async()=>{
    const status=$('#planSyncStatus');
    try{await syncWeeklyPlanFromSelections(status);ui.tab='grocery';groceryMode='all';render();}catch(e){if(status){status.textContent='Repair failed: '+e.message;status.className='small save-warn';}}
  };
  if($('#shopRemainingBtn'))$('#shopRemainingBtn').onclick=()=>{groceryMode='needs';render();};
  if($('#showAllGroceriesBtn'))$('#showAllGroceriesBtn').onclick=()=>{groceryMode='all';render();};
  if($('#addOnHandGroceryBtn'))$('#addOnHandGroceryBtn').onclick=async()=>{
    const input=$('#onHandGroceryInput'),status=$('#onHandGroceryStatus');
    const text=String(input?.value||'').trim();
    if(!text){if(status)status.textContent='Enter a grocery or ingredient first.';return;}
    const existing=groceries().find(x=>normFood(x.text).includes(normFood(text))||normFood(text).includes(normFood(x.text)));
    let updated;
    if(existing){
      updated=groceries().map(x=>x.id===existing.id?{...x,checked:true,unavailable:false,use_this_week:true}:x);
    }else{
      const id='onhand-'+Date.now().toString(36);
      updated=[...groceries(),{id,category:'On hand / use this week',text,checked:true,unavailable:false,use_this_week:true,custom:true,added_at:new Date().toISOString()}];
    }
    await saveShared({groceries:updated});
    if(status)status.textContent='Added as on hand; syncing weekly plan…';
    await syncArtifactsFromCurrentPlan(status);
    render();
  };
  $$('[data-use-on-hand]').forEach(btn=>btn.onclick=async()=>{
    const item=groceries().find(x=>x.id===btn.dataset.useOnHand);
    if(!item)return;
    const suggestion=menuSuggestionForOnHand(item);
    if(!suggestion)return;
    const day=nextDinnerDayForOnHand(suggestion);
    const updatedMenu=JSON.parse(JSON.stringify(menu()));
    updatedMenu.days[day]={...updatedMenu.days[day],dinner:suggestion};
    await saveMenuAndSyncArtifacts(updatedMenu);
    render();
  });
  $$('[data-g-unavailable]').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.gUnavailable;
    const updated=groceries().map(x=>x.id===id?{...x,unavailable:!x.unavailable,checked:x.unavailable?x.checked:false}:x);
    await saveShared({groceries:updated});
    await resolveUnavailableMealsAndSync($('#planSyncStatus'));
    render();
  });
  if($('#keepMenuShopBtn'))$('#keepMenuShopBtn').onclick=()=>{groceryMode='needs';render();};
  if($('#changeAffectedMealsBtn'))$('#changeAffectedMealsBtn').onclick=async()=>{
    await resolveUnavailableMealsAndSync($('#planSyncStatus'));
    render();
  };
  if($('#seasonSearch'))$('#seasonSearch').oninput=e=>$$('#seasonList details').forEach(d=>d.classList.toggle('hidden',!d.dataset.search.includes(e.target.value.toLowerCase())));
  if($('#dietStyle'))$('#dietStyle').value=dietStyle();
  if(ui.tab==='profile'){
    $$('#content input, #content select, #content textarea').forEach(el=>{
      el.addEventListener('input',()=>{profileFormDirty=true;});
      el.addEventListener('change',()=>{profileFormDirty=true;});
    });
  }
  const syncProgramRows=()=>$$('[data-program-row]').forEach(row=>{const cb=$('[data-equipment="'+row.dataset.programRow+'"]');row.classList.toggle('hidden',!cb?.checked);});
  syncProgramRows();
  $$('[data-equipment]').forEach(cb=>cb.addEventListener('change',syncProgramRows));
  $$('[id^="programName_"],[id^="programStart_"]').forEach(el=>el.addEventListener('change',()=>{profileFormDirty=true;}));
  if($('#editEnergyProfileBtn'))$('#editEnergyProfileBtn').onclick=()=>{profileFormDirty=false;ui.tab='profile';render();};
  $$('[data-use-meal-calories]').forEach(btn=>btn.onclick=async()=>{
    const i=Number(btn.dataset.useMealCalories),d=menu().days[i],slot=btn.dataset.mealSlot,estimate=Number(btn.dataset.estimate)||0;
    const log={...energyLog()},key=isoDateForDay(i,d),day={...(log[key]||{})},meals={...(day.meals||{}),[slot]:estimate};
    log[key]={...day,meals}; await saveSettingAtomic('energy_log',log); render();
  });
  $$('[data-meal-calories]').forEach(inp=>inp.onchange=async()=>{
    const i=Number(inp.dataset.mealCalories),d=menu().days[i],slot=inp.dataset.mealSlot,val=inp.value===''?null:Math.max(0,Number(inp.value)||0);
    const log={...energyLog()},key=isoDateForDay(i,d),day={...(log[key]||{})},meals={...(day.meals||{})};
    if(val===null)delete meals[slot];else meals[slot]=val;
    log[key]={...day,meals}; await saveSettingAtomic('energy_log',log); render();
  });
  $$('[data-use-meal-protein]').forEach(btn=>btn.onclick=async()=>{
    const i=Number(btn.dataset.useMealProtein),d=menu().days[i],slot=btn.dataset.mealSlot,estimate=Number(btn.dataset.estimate)||0;
    const log={...energyLog()},key=isoDateForDay(i,d),day={...(log[key]||{})},protein_meals={...(day.protein_meals||{}),[slot]:estimate};
    log[key]={...day,protein_meals}; await saveSettingAtomic('energy_log',log); render();
  });
  $$('[data-meal-protein]').forEach(inp=>inp.onchange=async()=>{
    const i=Number(inp.dataset.mealProtein),d=menu().days[i],slot=inp.dataset.mealSlot,val=inp.value===''?null:Math.max(0,Number(inp.value)||0);
    const log={...energyLog()},key=isoDateForDay(i,d),day={...(log[key]||{})},protein_meals={...(day.protein_meals||{})};
    if(val===null)delete protein_meals[slot];else protein_meals[slot]=val;
    log[key]={...day,protein_meals}; await saveSettingAtomic('energy_log',log); render();
  });
  $$('[data-use-workout-calories]').forEach(btn=>btn.onclick=async()=>{
    const i=Number(btn.dataset.useWorkoutCalories),d=menu().days[i],estimate=Number(btn.dataset.estimate)||0;
    const log={...energyLog()},key=isoDateForDay(i,d),day={...(log[key]||{}),workout_calories:estimate};
    log[key]=day; await saveSettingAtomic('energy_log',log); render();
  });
  $$('[data-workout-calories]').forEach(inp=>inp.onchange=async()=>{
    const i=Number(inp.dataset.workoutCalories),d=menu().days[i],val=inp.value===''?null:Math.max(0,Number(inp.value)||0);
    const log={...energyLog()},key=isoDateForDay(i,d),day={...(log[key]||{})};
    if(val===null)delete day.workout_calories;else day.workout_calories=val;
    log[key]=day; await saveSettingAtomic('energy_log',log); render();
  });
  $$('[data-save-energy-day]').forEach(btn=>btn.onclick=async()=>{
    const i=Number(btn.dataset.saveEnergyDay),d=menu().days[i],weight=$('[data-energy-weight="'+i+'"]'),other=$('[data-energy-other="'+i+'"]'),otherProtein=$('[data-energy-other-protein="'+i+'"]');
    const log={...energyLog()},key=isoDateForDay(i,d),day={...(log[key]||{})};
    const w=Number(weight?.value); if(Number.isFinite(w)&&w>0)day.weight_lb=w;
    const o=Number(other?.value); if(Number.isFinite(o)&&o>=0)day.other_calories=o;
    const op=Number(otherProtein?.value); if(Number.isFinite(op)&&op>=0)day.other_protein_g=op;
    log[key]=day; await saveSettingAtomic('energy_log',log); render();
  });
  $$('[data-log-protein-supplement]').forEach(btn=>btn.onclick=async()=>{
    const i=Number(btn.dataset.logProteinSupplement),d=menu().days[i],card=btn.closest('.supplement-log');
    const key=card?.querySelector('[data-protein-product]')?.value||'levels',servings=Math.max(.5,Number(card?.querySelector('[data-protein-servings]')?.value)||1),p=PROTEIN_PRODUCTS[key]||PROTEIN_PRODUCTS.levels;
    const entry={product:key,label:p.label,servings,scoops:Number((p.serving_scoops*servings).toFixed(1)),protein_g:Math.round(p.protein_g*servings),calories:Math.round(p.calories*servings),caffeine_mg:Math.round(p.caffeine_mg*servings),logged_at:new Date().toISOString()};
    const log={...energyLog()},dateKey=isoDateForDay(i,d),day={...(log[dateKey]||{})},supplements=[...supplementEntries(i,d),entry];
    log[dateKey]={...day,supplements}; await saveSettingAtomic('energy_log',log); render();
  });
  $$('[data-undo-protein-supplement]').forEach(btn=>btn.onclick=async()=>{
    const i=Number(btn.dataset.undoProteinSupplement),d=menu().days[i],log={...energyLog()},dateKey=isoDateForDay(i,d),day={...(log[dateKey]||{})},supplements=[...supplementEntries(i,d)];
    supplements.pop(); log[dateKey]={...day,supplements}; await saveSettingAtomic('energy_log',log); render();
  });
  if($('#hungerBtn'))$('#hungerBtn').onclick=()=>{
    const a=hungerSuggestions(),box=$('#hungerResult');
    box.innerHTML=`<div class="hunger-answer"><b>${esc(a.title)}</b><ul>${a.items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
  };
  if($('#editProfileBtn'))$('#editProfileBtn').onclick=()=>{ui.tab='profile';render();};
  if($('#todayProfileBtn'))$('#todayProfileBtn').onclick=()=>{ui.tab='profile';render();};
  if($('#checkFoodBtn'))$('#checkFoodBtn').onclick=()=>checkAndAddFood();
  if($('#foodQuery'))$('#foodQuery').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();checkAndAddFood();}};
  $$('[data-profile-autosave]').forEach(el=>el.onchange=async()=>{
    const status=$('#profileAutosaveStatus');
    try{profileFormDirty=true;await saveProfileFormNow(status);}catch(e){if(status){status.textContent='Autosave failed: '+e.message;status.className='small profile-autosave-status save-warn';}}
  });
  if($('#saveProfileBtn'))$('#saveProfileBtn').onclick=async()=>{
    const status=$('#profileSaveStatus'),syncStatusEl=$('#profilePlanSyncStatus');
    try{
      const {next,saved}=await saveProfileFormNow(status);
      const vitalOk=Number(saved.age)===Number(next.age)&&Number(saved.height_in)===Number(next.height_in)&&Number(saved.weight_lb)===Number(next.weight_lb);
      if(status)status.textContent=vitalOk?'Profile saved and verified.':'Profile saved, but age/height/weight did not verify.';
      await syncWeeklyPlanFromSelections(syncStatusEl);
    }catch(e){if(status)status.textContent='Save/sync failed: '+e.message;}
  };
  if($('#syncProfilePlanBtn'))$('#syncProfilePlanBtn').onclick=async()=>{
    const status=$('#profilePlanSyncStatus');
    try{profileFormDirty=true;await saveProfileFormNow($('#profileSaveStatus'));await syncWeeklyPlanFromSelections(status);}catch(e){if(status){status.textContent='Sync failed: '+e.message;status.className='small save-warn';}}
  };
  $$('[data-whey-flavor]').forEach(sel=>sel.onchange=async()=>{
    const all={...wheyFlavorPlans()};
    if(sel.value)all[sel.dataset.wheyFlavor]=sel.value;else delete all[sel.dataset.wheyFlavor];
    await saveSettingAtomic('whey_flavors_by_meal',all);
  });
  $$('[data-leftover-yes]').forEach(btn=>btn.onclick=async()=>{
    const day=Number(btn.dataset.leftoverYes),d=menu().days[day],nextDay=day+1;
    const plans={...leftoverPlans(),[String(day)]:{use:true,protein:mealProtein(d.dinner),reserve_oz:lunchReserveOz(),saved_at:new Date().toISOString()}};
    const overrides={...mealOverrides(),[`${nextDay}-${myView()}-lunch`]:leftoverLunchText(d.dinner)};
    await saveSettingAtomic('leftover_plans',plans);
    await saveSettingAtomic('meal_overrides',overrides);
    await syncArtifactsFromCurrentPlan();
    render();
  });
  $$('[data-leftover-no]').forEach(btn=>btn.onclick=async()=>{
    const day=Number(btn.dataset.leftoverNo),nextDay=day+1,d=menu().days[nextDay];
    if(!d)return;
    const current=textFor(d,'lunch',nextDay),alternative=personalMealReplacement('lunch',current);
    const plans={...leftoverPlans(),[String(day)]:{use:false,saved_at:new Date().toISOString()}};
    const overrides={...mealOverrides(),[`${nextDay}-${myView()}-lunch`]:alternative};
    await saveSettingAtomic('leftover_plans',plans);
    await saveSettingAtomic('meal_overrides',overrides);
    await syncArtifactsFromCurrentPlan();
    render();
  });
  $$('[data-flavor-meal]').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.flavorMeal,slot=btn.dataset.slot,current=btn.dataset.current;
    const day=Number(id.split('-')[0]);
    const d=menu().days[day],existing=flavorOverrideFor(d,day,slot);
    const next=nextFlavorForMeal(current,existing?.name||'');
    if(!next)return;
    const flavor={name:next.name,recipe:next.recipe,sodium:next.sodium||''};
    if(slot==='dinner'){
      const updatedMenu=JSON.parse(JSON.stringify(menu()));
      updatedMenu.days[day]={...updatedMenu.days[day],flavor_override:flavor};
      await saveMenuAndSyncArtifacts(updatedMenu);
    }else{
      const all={...personalFlavorOverrides(),[id]:flavor};
      await saveSettingAtomic('meal_flavors',all);
      await syncArtifactsFromCurrentPlan();
    }
    render();
  });
  $$('[data-reset-flavor]').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.resetFlavor,slot=btn.dataset.slot,day=Number(id.split('-')[0]);
    if(slot==='dinner'){
      const updatedMenu=JSON.parse(JSON.stringify(menu()));
      delete updatedMenu.days[day].flavor_override;
      await saveMenuAndSyncArtifacts(updatedMenu);
    }else{
      const all={...personalFlavorOverrides()};
      delete all[id];
      await saveSettingAtomic('meal_flavors',all);
      await syncArtifactsFromCurrentPlan();
    }
    render();
  });
  $$('[data-alt-meal]').forEach(btn=>btn.onclick=async()=>{
    const key=btn.dataset.altMeal,slot=btn.dataset.slot,current=btn.dataset.current;
    try{
      if(slot==='dinner'){
        const day=Number(key.split('-')[0]);
        const next=nextSharedDinner(current);
        const updatedMenu=JSON.parse(JSON.stringify(menu()));
        updatedMenu.days[day]={...updatedMenu.days[day],dinner:next};
        await saveMenuAndSyncArtifacts(updatedMenu);
        render();
        return;
      }
      const alternative=nextMealAlternative(slot,current);
      const overrides={...mealOverrides(),[key]:alternative};
      await saveSettingAtomic('meal_overrides',overrides);
      await syncArtifactsFromCurrentPlan();
      render();
    }catch(e){syncMsg('Meal swap failed');}
  });
  $$('[data-drink-type]').forEach(sel=>sel.onchange=e=>{
    const i=e.target.dataset.drinkType,type=e.target.value,def=ALCOHOL_DEFAULTS[type]||ALCOHOL_DEFAULTS.wine;
    const amount=$('[data-drink-amount="'+i+'"]'),abv=$('[data-drink-abv="'+i+'"]'),mixer=$('[data-drink-mixer="'+i+'"]'),kind=$('[data-drink-kind="'+i+'"]');
    if(amount)amount.value=def.amount;
    if(abv)abv.value=def.abv;
    if(mixer)mixer.value=def.mixer;
    if(kind){
      const opts=drinkKindOptions(type,'');
      kind.innerHTML=opts.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'<option value="Other">Other</option>';
    }
  });
  $$('[data-save-drink]').forEach(btn=>btn.onclick=async()=>{
    const i=btn.dataset.saveDrink;
    const type=$('[data-drink-type="'+i+'"]')?.value||'wine';
    const plan={
      type,
      kind:$('[data-drink-kind="'+i+'"]')?.value||'',
      amount:Number($('[data-drink-amount="'+i+'"]')?.value)||0,
      abv:Number($('[data-drink-abv="'+i+'"]')?.value)||0,
      mixer:$('[data-drink-mixer="'+i+'"]')?.value||'none',
      cap:Number($('[data-drink-cap="'+i+'"]')?.value)||0,
      saved_at:new Date().toISOString()
    };
    const plans={...alcoholPlans(),[String(i)]:plan};
    try{
      await saveSettingAtomic('alcohol_plans',plans);
      await saveSettingAtomic('alcohol_daily_cap',plan.cap);
      render();
    }catch(e){
      const out=$('[data-drink-result="'+i+'"]');
      if(out)out.textContent='Could not save drink plan: '+e.message;
    }
  });
  $$('[data-clear-drink]').forEach(btn=>btn.onclick=async()=>{
    const i=btn.dataset.clearDrink,plans={...alcoholPlans()};
    delete plans[String(i)];
    try{await saveSettingAtomic('alcohol_plans',plans);render();}catch(e){syncMsg('Drink save failed');}
  });
  if($('#profileWorkout'))$('#profileWorkout').onchange=async e=>{profile={...profile,workout_enabled:e.target.checked};await supabase.from('profiles').update({workout_enabled:e.target.checked,updated_at:new Date().toISOString()}).eq('user_id',session.user.id);render();};
  if($('#pomNameInput'))$('#pomNameInput').onchange=async e=>{const name=(e.target.value.trim()||'Gizmo').slice(0,20);e.target.value=name;await savePersonal({settings:{...(personal.settings||{}),pom_name:name}});render();};
  if($('#barkReminderToggle'))$('#barkReminderToggle').onchange=async e=>{await savePersonal({settings:{...(personal.settings||{}),bark_reminder_enabled:e.target.checked}});if(e.target.checked)playBark();};
  if($('#barkReminderTime'))$('#barkReminderTime').onchange=async e=>{await savePersonal({settings:{...(personal.settings||{}),bark_reminder_time:e.target.value||'20:00'}});};
  if($('#testBarkBtn'))$('#testBarkBtn').onclick=()=>playBark();
  if($('#replayTourBtn'))$('#replayTourBtn').onclick=()=>startTour(true);
  if($('#updateAppBtn'))$('#updateAppBtn').onclick=()=>location.href=`./refresh.html?v=${APP_VERSION}`;
  if($('#signOutBtn'))$('#signOutBtn').onclick=signOut;
}

if($('#showSignupBtn'))$('#showSignupBtn').onclick=()=>{$('#loginPanel')?.classList.add('hidden');$('#signupPanel')?.classList.remove('hidden');};
if($('#showLoginBtn'))$('#showLoginBtn').onclick=()=>{$('#signupPanel')?.classList.add('hidden');$('#loginPanel')?.classList.remove('hidden');};
if($('#signInBtn'))$('#signInBtn').onclick=signIn;
if($('#signUpBtn'))$('#signUpBtn').onclick=signUp;
if($('#createHouseholdBtn'))$('#createHouseholdBtn').onclick=createHousehold;
if($('#joinHouseholdBtn'))$('#joinHouseholdBtn').onclick=joinHousehold;
if($('#setupSignOutBtn'))$('#setupSignOutBtn').onclick=signOut;
if($('#profileSeg'))$('#profileSeg').onclick=e=>{if(e.target.dataset.p){ui.view=e.target.dataset.p;render();}};
if($('#nav'))$('#nav').onclick=e=>{if(e.target.dataset.tab){if(ui.tab==='profile'&&e.target.dataset.tab!=='profile')profileFormDirty=false;ui.tab=e.target.dataset.tab;render();}};
if($('#workoutToggle'))$('#workoutToggle').onchange=async e=>{if(ui.view===myView()){profile={...profile,workout_enabled:e.target.checked};await supabase.from('profiles').update({workout_enabled:e.target.checked,updated_at:new Date().toISOString()}).eq('user_id',session.user.id);}render();};
if($('#profileBtn'))$('#profileBtn').onclick=()=>{profileFormDirty=false;ui.tab='profile';render();};
if($('#accountBtn'))$('#accountBtn').onclick=()=>{ui.tab='account';render();};

supabase.auth.onAuthStateChange((_event,s)=>handleSession(s));
const {data:{session:initial}}=await supabase.auth.getSession();await handleSession(initial);
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`,{updateViaCache:'none'}).then(r=>r.update()).catch(console.error);
setInterval(()=>maybeBarkReminder().catch(console.error),60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')maybeBarkReminder().catch(console.error);});
setTimeout(()=>maybeBarkReminder().catch(console.error),1500);
