import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
import { DEFAULT_DATA } from './data.js?v=40';

const supabase=createClient(
  'https://wbskfggewwlkeplswpan.supabase.co',
  'sb_publishable_y9L64jb_Xp3aBUuTsMIK4w_0-4b_S-D',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let session,profile,household,shared,personal,channels=[];
let ui={view:'Clark',tab:'today'};
let profileFormDirty=false;
const TOUR_VERSION=1;
let tour={active:false,index:0,replay:false};
function tourSteps(){
  return [
    {tab:'today',title:'Welcome to PomFit',body:`Hi, I’m ${pomName()}. I’ll show you the basics. PomFit keeps shared household planning together while your Profile, workouts, notes and preferences stay personal.`},
    {tab:'profile',title:'1. Build My Profile',body:'Start here. Add age, height and weight; choose a diet; list foods you like or dislike; set fasting and meal times; pick training goals, sports and equipment. If you use Peloton, Tonal, Hydrow, iFIT or another structured program, enter the program and its usual days so PomFit schedules around it.'},
    {tab:'today',title:'2. Use Today as your dashboard',body:'Check off meals and workouts as you finish them. Breakfast, lunch and snacks can be personalized. Dinner is shared with the household so everyone stays synchronized.'},
    {tab:'week',title:'3. Adjust meals when needed',body:'Use “Not this meal — give me another” when you simply want something different today. It does not mark the meal as disliked. Dinner changes are labeled for the whole household.'},
    {tab:'workout',title:'4. Let PomFit coordinate training',body:'Your workout plan uses your goals, sport preparation and equipment. Structured programs and scheduled tests—such as a Peloton FTP test—take priority so PomFit does not stack conflicting leg strength or HIIT on top of them.'},
    {tab:'grocery',title:'5. Know what is shared',body:'Grocery checks, meal prep and dinners are household-shared. Your Profile, workout completion, measurements and private notes are personal to your signed-in account.'},
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
function programWorkoutForDay(i){
  const programs=trainingPrograms(),entries=[];
  for(const [key,label] of Object.entries(PROGRAM_DEVICES)){
    if(!equipmentList().includes(key))continue;
    const p=programs[key]||{};
    if(!p.name||!programRunsOnDay(p,i))continue;
    const notes=String(p.key_sessions||'').trim();
    entries.push(`${label}: ${p.name}. Follow the scheduled program session${notes?' — '+notes:''}. PomFit will avoid adding conflicting hard leg or HIIT work today.`);
  }
  return entries.join(' ');
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
function renderDrinkPlanner(i){
  const existing=alcoholPlans()[String(i)]||{},type=existing.type||'wine',def=ALCOHOL_DEFAULTS[type]||ALCOHOL_DEFAULTS.wine;
  const amount=existing.amount??def.amount,abv=existing.abv??def.abv,mixer=existing.mixer??def.mixer,cap=existing.cap??alcoholCap(),kind=existing.kind||'',saved=!!existing.saved_at;
  const summary=saved?`${alcoholTypeLabel(type)}${kind?' — '+kind:''}`:'Add a drink',advice=saved?drinkMealAdvice({...existing,cap}):'';
  return `<details class="drink-planner" ${saved?'open':''}><summary>🍷 ${esc(summary)}</summary><div class="drink-grid">
  <label class="small">Type<select class="search" data-drink-type="${i}"><option value="cocktail" ${type==='cocktail'?'selected':''}>Cocktail</option><option value="champagne" ${type==='champagne'?'selected':''}>Champagne / sparkling</option><option value="wine" ${type==='wine'?'selected':''}>Wine</option><option value="beer" ${type==='beer'?'selected':''}>Beer</option><option value="liquor" ${type==='liquor'?'selected':''}>Liquor / spirits</option></select></label>
  <label class="small">What kind?<input class="search" data-drink-kind="${i}" value="${esc(kind)}" placeholder="e.g. Cabernet, IPA, martini, bourbon"></label>
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
    const audio=new Audio('./Gizmo-bark.mp3?v=40');
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
function textFor(d,k,i=todayIndex()){
  if(k==='dinner')return d.dinner;
  if(ui.view===myView()&&profileReady()){
    const key=`${i}-${ui.view}-${k}`;
    return chooseMeal(k,i,key);
  }
  if(ui.view==='Clark')return k==='breakfast'?d.clark_am:k==='afternoon'?d.clark_afternoon:d[k];
  if(ui.view==='Elizabeth')return k==='breakfast'?d.elizabeth_breakfast:k==='afternoon'?d.elizabeth_snack:d[k];
  if(k==='breakfast')return `Clark: ${d.clark_am}\nElizabeth: ${d.elizabeth_breakfast}`;
  if(k==='afternoon')return `Clark: ${d.clark_afternoon}\nElizabeth: ${d.elizabeth_snack}`;
  return d[k];
}
function meal(d,i,k,label){
  if(ui.view===myView()&&profileReady()&&!isMealEnabled(k))return'';
  const t=textFor(d,k,i);if(!t)return'';
  const id=`${i}-${ui.view}-${k}`,isMine=ui.view===myView();
  const box=isMine?`<input class="check" type="checkbox" data-check="${esc(id)}" ${checks()[id]?'checked':''} aria-label="Mark ${esc(label)} complete">`:'';
  const meta=isMine&&profileReady()?mealMeta(k):'';
  const alt=isMine&&profileReady()?`<button class="meal-alt" data-alt-meal="${esc(id)}" data-slot="${esc(k)}" data-current="${esc(t)}">${k==='dinner'?'Change dinner for both of us':'Not this meal — give me another'}</button>`:'';
  return `<div class="meal">${box}<b>${label}${meta?` <span class="small">• ${esc(meta)}</span>`:''}</b><p>${esc(t)}</p>${alt}</div>`;
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
function plannedWorkoutFor(p,i,d){
  const fixed=scheduledWorkoutOverride(p,i,d);
  if(fixed)return fixed;
  if(p===myView()&&profileReady()){
    const programmed=programWorkoutForDay(i);
    if(programmed)return programmed;
    return personalWorkoutFor(i);
  }
  return p==='Clark'?d.workout_c:d.workout_e;
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
  return parts.filter(Boolean).join(' ');
}
function generatedPrepTasks(){
  const old=Array.isArray(shared?.prep_tasks)?shared.prep_tasks:[];
  const checked=Object.fromEntries(old.map(x=>[x.id,!!x.checked]));
  const days=menu().days.map((d,i)=>({
    id:`dinner-prep-${i}`,
    text:`${d.date}: ${prepInstructionForMeal(d.dinner,'dinner')}`,
    checked:checked[`dinner-prep-${i}`]||false
  }));
  const generic=[
    {id:'prep-pack','text':'Pack next-day lunches the night before; keep dressings, sauces, nuts/seeds and cheese separate until eating.'},
    {id:'prep-portion','text':'Portion proteins, oils/fats, nuts/seeds and other calorie-dense add-ons before serving.'},
    {id:'prep-produce','text':'Wash/chop commonly used vegetables and salad produce so substitutions are easy.'}
  ].map(x=>({...x,checked:checked[x.id]||false}));
  return [...days,...generic];
}
function dayCard(d,i){
  let w='';
  if(workoutShown(ui.view)){
    if(ui.view==='Both'){
      w=`<div class="work"><b>Clark:</b> ${esc(d.workout_c)}<br><b>Elizabeth:</b> ${esc(d.workout_e)}</div>`;
    }else{
      const id=`${i}-${ui.view}`,isMine=ui.view===myView();
      const box=isMine?`<input class="check" type="checkbox" data-workout-check="${esc(id)}" ${workoutChecks()[id]?'checked':''} aria-label="Mark workout complete">`:'';
      const workout=plannedWorkoutFor(ui.view,i,d);
      w=`<div class="work">${box}<b>Workout:</b> ${esc(workout)}</div>`;
    }
  }
  const drink=ui.view===myView()?renderDrinkPlanner(i):'';
  return `<section class="card"><div class="dayhead"><div><h3>${esc(d.date)}</h3><div class="meta">Shared menu • ${esc(ui.view)} view</div></div>${i===todayIndex()?'<span class="badge">TODAY</span>':''}</div>${meal(d,i,'breakfast','Morning / breakfast')}${meal(d,i,'lunch','Lunch')}${meal(d,i,'afternoon','Afternoon')}${meal(d,i,'dinner','Dinner')}${drink}${w}<div class="prep"><b>Prep:</b> ${esc(dayPrepText(d,i))}</div></section>`;
}
function renderToday(){
  const n=personal?.notes?.free_text||'',summary=profileSummaryText();
  const profileCard=ui.view===myView()?`<div class="card profile-status"><div class="dayhead"><div><h3>My Profile — ${esc(myName())}</h3><div class="small"><b>Diet:</b> ${esc(summary.diet)}<br><b>Training:</b> ${esc(summary.goals)}</div></div><span class="badge ${vitalsComplete()?'ok-badge':'warn-badge'}">${vitalsComplete()?'SAVED':'VITALS NEEDED'}</span></div><button class="secondary" id="todayProfileBtn">${vitalsComplete()?'Edit my profile':'Finish age, height & weight'}</button></div>`:'';
  const hunger=ui.view===myView()?'<div class="card hunger-card"><h3>Still hungry?</h3><p class="small">Get a small add-on that fits your saved diet, dislikes and fasting window.</p><button class="secondary" id="hungerBtn">I’m still hungry — what can I eat?</button><div id="hungerResult"></div></div>':'';
  return profileCard+dayCard(menu().days[todayIndex()],todayIndex())+hunger+`<div class="card"><h3>Private notes</h3><textarea id="notes" class="note" placeholder="Weights, BP, substitutions, workout notes…">${esc(n)}</textarea><p class="small">Only your signed-in account can read these notes.</p></div>`;
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
  return `<div class="card"><h2>${esc(p)} workout</h2>${isMe?`<label class="toggle"><input type="checkbox" id="profileWorkout" ${profile.workout_enabled!==false?'checked':''}> Workouts ON for ${esc(p)}</label><p class="small">Check off each workout when finished.</p>`:'<p class="small">You can view the plan, but only that person can mark a workout complete.</p>'}</div><div class="weekgrid">${menu().days.map((d,i)=>{const id=`${i}-${p}`,box=isMe?`<input class="check" type="checkbox" data-workout-check="${esc(id)}" ${workoutChecks()[id]?'checked':''} aria-label="Mark workout complete">`:'';const workout=plannedWorkoutFor(p,i,d);return `<div class="card"><h3>${esc(d.date)}</h3><div class="work">${box}${esc(workout)}</div></div>`;}).join('')}</div>`;
}
function renderProfile(){
  const p=personalProfile(),m=mealSchedule(),goals=workoutGoals(),equipment=equipmentList(),programs=trainingPrograms();
  const goal=(g,label)=>`<label class="toggle"><input type="checkbox" data-goal="${g}" ${goals.includes(g)?'checked':''}> ${label}</label>`;
  const equip=(g,label)=>`<label class="toggle"><input type="checkbox" data-equipment="${g}" ${equipment.includes(g)?'checked':''}> ${label}</label>`;
  const programRow=(k,label)=>{const x=programs[k]||{};return `<div class="program-row" data-program-row="${k}"><b>${label} program</b><label class="small">Program / training plan <input id="programName_${k}" class="search" value="${esc(x.name||'')}" placeholder="e.g. Introduction to Power Zones"></label><label class="small">Usual program days <input id="programDays_${k}" class="search" value="${esc(x.days||'')}" placeholder="e.g. Mon, Wed, Fri"></label><label class="small">Key sessions / tests <input id="programSessions_${k}" class="search" value="${esc(x.key_sessions||'')}" placeholder="e.g. Mon FTP test; Wed endurance; Fri intervals"></label></div>`;};
  const mealRow=(key,label)=>{const x=m[key]||{};return `<div class="metric"><b>${label}</b><label class="toggle"><input type="checkbox" data-meal-enabled="${key}" ${x.enabled!==false?'checked':''}> Include</label><label class="small">Time <input type="time" data-meal-time="${key}" value="${esc(x.time||'')}"></label><label class="small">Location <input class="search" data-meal-location="${key}" value="${esc(x.location||'')}" placeholder="Home, work, school…"></label></div>`;};
  return `<div class="card"><h2>My profile</h2><p class="small">Your profile is private and drives your own meal and workout recommendations.</p><div class="account-grid">
  <div class="metric"><b>Basics</b><label class="small">Age <input id="profAge" class="search" type="number" min="13" max="100" value="${esc(p.age??'')}"></label><div class="height-row"><label class="small">Height feet <input id="profHeightFt" class="search" type="number" min="4" max="7" value="${esc(profileHeightParts().ft)}"></label><label class="small">Height inches <input id="profHeightIn" class="search" type="number" min="0" max="11.9" step=".1" value="${esc(profileHeightParts().inch)}"></label></div><label class="small">Weight (lb) <input id="profWeight" class="search" type="number" min="70" max="600" step=".1" value="${esc(p.weight_lb??'')}"></label></div>
  <div class="metric"><b>Diet style</b><select id="dietStyle" class="search"><option value="balanced">Balanced</option><option value="performance">Athletic performance</option><option value="musclegain">Muscle gain / high protein</option><option value="mediterranean">Mediterranean</option><option value="lowcarb">Low carb</option><option value="keto">Keto</option><option value="pescatarian">Pescatarian</option><option value="vegetarian">Vegetarian</option></select><div class="small" style="margin-top:6px">Athletic performance emphasizes protein plus enough carbohydrate to support training. Muscle gain uses a higher-protein, recovery-focused pattern with adequate calories.</div></div>
  <div class="metric"><b>Foods</b><label class="small">Foods I like <input id="foodLikes" class="search" value="${esc(p.food_likes||'')}" placeholder="salmon, asparagus, berries"></label><label class="small">Foods I don't like <input id="foodDislikes" class="search" value="${esc(p.food_dislikes||'')}" placeholder="eggs, yogurt, broccoli"></label><div class="divider">Check a food against this diet</div><input id="foodQuery" class="search" placeholder="e.g. sweet potato, shrimp, oatmeal"><button class="secondary" id="checkFoodBtn">Check & add food</button><div id="foodQueryResult" class="small" style="margin-top:8px"></div></div>
  <div class="metric"><b>Intermittent fasting</b><label class="toggle"><input id="ifToggle" type="checkbox" ${p.intermittent_fasting?'checked':''}> Use intermittent fasting</label><label class="small">Eating window start <input id="ifStart" type="time" value="${esc(p.fasting_start||'12:00')}"></label><label class="small">Eating window end <input id="ifEnd" type="time" value="${esc(p.fasting_end||'20:00')}"></label></div>
  <div class="metric"><b>Workout goals</b><div class="controls">${goal('sculpt','Sculpt / tone')}${goal('strength','Strength without bulk')}${goal('muscle','Muscle building / hypertrophy')}${goal('cardio','Cardio fitness')}${goal('hiit','HIIT / conditioning')}${goal('mobility','Mobility / flexibility')}${goal('core','Core / posture')}</div></div>
  <div class="metric"><b>Sport / event preparation</b><div class="controls">${goal('ski','Skiing')}${goal('cycling','Cycling')}${goal('running','Running')}${goal('tennis','Tennis')}${goal('boxing','Boxing')}${goal('swimming','Swimming')}${goal('soccer','Soccer')}${goal('basketball','Basketball')}</div></div>
  <div class="metric"><b>Resistance equipment available</b><div class="controls">${equip('bowflex','Bowflex / home gym')}${equip('dumbbells','Dumbbells')}${equip('bands','Resistance bands')}${equip('cable','Cable machine')}${equip('barbell','Barbell / rack')}${equip('kettlebell','Kettlebells')}${equip('trx','TRX / suspension trainer')}${equip('bodyweight','Bodyweight only')}</div><label class="small">Device/model or equipment notes <input id="equipmentNotes" class="search" value="${esc(p.equipment_notes||'')}" placeholder="e.g. Bowflex PR3000, adjustable dumbbells to 50 lb"></label></div>
  <div class="metric"><b>Cardio / smart-training devices</b><p class="small">If a device uses a structured program, tell PomFit which program and days. Those sessions take priority when PomFit schedules strength, HIIT and recovery.</p><div class="controls">${equip('peloton_bike','Peloton Bike')}${equip('peloton_tread','Peloton Tread')}${equip('peloton_row','Peloton Row')}${equip('tonal','Tonal')}${equip('hydrow','Hydrow')}${equip('ifit','NordicTrack / iFIT')}${equip('concept2','Concept2')}${equip('other_program','Other program/device')}</div><div class="programs-wrap">${programRow('peloton_bike','Peloton Bike')}${programRow('peloton_tread','Peloton Tread')}${programRow('peloton_row','Peloton Row')}${programRow('tonal','Tonal')}${programRow('hydrow','Hydrow')}${programRow('ifit','NordicTrack / iFIT')}${programRow('concept2','Concept2')}${programRow('other_program','Other')}</div></div>
  ${mealRow('breakfast','Breakfast / morning')}${mealRow('lunch','Lunch')}${mealRow('afternoon','Afternoon snack')}${mealRow('dinner','Dinner')}
  </div><button class="primary" id="saveProfileBtn">Save profile</button><div id="profileSaveStatus" class="small" style="margin-top:8px"></div></div>`;
}
function renderAccount(){
  return `<div class="card"><h2>Account & household</h2><div class="account-grid"><div class="metric"><b>Signed in as</b>${esc(myName())}<div class="small">${esc(session.user.email)}</div><button class="secondary" id="editProfileBtn">Edit my profile</button></div><div class="metric"><b>Name your Pom</b><input id="pomNameInput" class="search" maxlength="20" value="${esc(pomName())}" placeholder="Gizmo"><div class="small">This is your personal Pom name. PomFit remains the app name.</div></div><div class="metric"><b>Bark reminder</b><label class="toggle"><input type="checkbox" id="barkReminderToggle" ${barkEnabled()?'checked':''}> Bark if today's meals or workout are incomplete</label><label class="small">Reminder time <input id="barkReminderTime" type="time" value="${esc(barkTime())}"></label><button class="ghost" id="testBarkBtn">Test ${esc(pomName())}'s bark</button><div class="small">Off by default. Bark works while PomFit is open or brought to the foreground.</div></div><div class="metric"><b>Household</b>${esc(household?.name||'')}</div><div class="metric"><b>Join code</b><div class="invite">${esc(household?.invite_code||'')}</div><div class="small">Use this code for another household member.</div></div><div class="metric"><b>App tour</b><button class="secondary" id="replayTourBtn">Replay app tour</button><div class="small">Gizmo will walk through Profile, meals, workouts, shared tools and reminders.</div></div><div class="metric"><b>App version</b>PomFit v40<div class="small">If this is not v35, update the app.</div></div></div><button class="secondary" id="updateAppBtn">Update PomFit</button><button class="ghost" id="signOutBtn">Sign out</button></div>`;
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
  if(ui.tab==='profile'){
    $$('#content input, #content select, #content textarea').forEach(el=>{
      el.addEventListener('input',()=>{profileFormDirty=true;});
      el.addEventListener('change',()=>{profileFormDirty=true;});
    });
  }
  const syncProgramRows=()=>$$('[data-program-row]').forEach(row=>{const cb=$('[data-equipment="'+row.dataset.programRow+'"]');row.classList.toggle('hidden',!cb?.checked);});
  syncProgramRows();
  $$('[data-equipment]').forEach(cb=>cb.addEventListener('change',syncProgramRows));
  if($('#hungerBtn'))$('#hungerBtn').onclick=()=>{
    const a=hungerSuggestions(),box=$('#hungerResult');
    box.innerHTML=`<div class="hunger-answer"><b>${esc(a.title)}</b><ul>${a.items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
  };
  if($('#editProfileBtn'))$('#editProfileBtn').onclick=()=>{ui.tab='profile';render();};
  if($('#todayProfileBtn'))$('#todayProfileBtn').onclick=()=>{ui.tab='profile';render();};
  if($('#checkFoodBtn'))$('#checkFoodBtn').onclick=async()=>{
    const food=$('#foodQuery').value.trim(),diet=$('#dietStyle').value;
    const result=foodCompatibility(food,diet),out=$('#foodQueryResult');
    out.textContent=result.message;
    if(result.status!=='yes')return;
    const existing=$('#foodLikes').value.split(',').map(x=>x.trim()).filter(Boolean);
    if(!existing.some(x=>x.toLowerCase()===food.toLowerCase()))existing.push(food);
    $('#foodLikes').value=existing.join(', ');
    const next={...collectProfileForm(),diet_style:diet,food_likes:$('#foodLikes').value.trim()};
    try{
      profileFormDirty=true;
      await saveProfileAtomic(next);
      out.textContent=result.message+' Added and saved.';
    }catch(e){
      out.textContent='Could not save the food change: '+e.message;
    }
  };
  if($('#saveProfileBtn'))$('#saveProfileBtn').onclick=async()=>{
    const status=$('#profileSaveStatus');
    try{
      const next=collectProfileForm();
      status.textContent='Saving…';
      await saveProfileAtomic(next);
      const saved=personalProfile();
      const vitalOk=saved.age===next.age&&saved.height_in===next.height_in&&saved.weight_lb===next.weight_lb;
      profileFormDirty=false;
      render();
      if($('#profileSaveStatus'))$('#profileSaveStatus').textContent=vitalOk?'Profile saved and verified.':'Save returned, but vitals did not verify.';
    }catch(e){
      status.textContent='Save failed: '+e.message;
    }
  };
  $$('[data-alt-meal]').forEach(btn=>btn.onclick=async()=>{
    const key=btn.dataset.altMeal,slot=btn.dataset.slot,current=btn.dataset.current;
    try{
      if(slot==='dinner'){
        const day=Number(key.split('-')[0]);
        const next=nextSharedDinner(current);
        const updatedMenu=JSON.parse(JSON.stringify(menu()));
        updatedMenu.days[day]={...updatedMenu.days[day],dinner:next};
        const previousMenu=shared.menu;
        shared={...shared,menu:updatedMenu};
        const updatedPrep=generatedPrepTasks();
        shared={...shared,menu:previousMenu};
        await saveShared({menu:updatedMenu,prep_tasks:updatedPrep});
        render();
        return;
      }
      const alternative=nextMealAlternative(slot,current);
      const overrides={...mealOverrides(),[key]:alternative};
      await savePersonal({settings:{...(personal.settings||{}),meal_overrides:overrides}});
      render();
    }catch(e){syncMsg('Meal swap failed');}
  });
  $$('[data-drink-type]').forEach(sel=>sel.onchange=e=>{
    const i=e.target.dataset.drinkType,def=ALCOHOL_DEFAULTS[e.target.value]||ALCOHOL_DEFAULTS.wine;
    const amount=$('[data-drink-amount="'+i+'"]'),abv=$('[data-drink-abv="'+i+'"]'),mixer=$('[data-drink-mixer="'+i+'"]');
    if(amount)amount.value=def.amount;
    if(abv)abv.value=def.abv;
    if(mixer)mixer.value=def.mixer;
  });
  $$('[data-save-drink]').forEach(btn=>btn.onclick=async()=>{
    const i=btn.dataset.saveDrink;
    const type=$('[data-drink-type="'+i+'"]')?.value||'wine';
    const plan={
      type,
      kind:$('[data-drink-kind="'+i+'"]')?.value.trim()||'',
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
  if($('#updateAppBtn'))$('#updateAppBtn').onclick=()=>location.href='./refresh.html?v=40';
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
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js?v=40',{updateViaCache:'none'}).then(r=>r.update()).catch(console.error);
setInterval(()=>maybeBarkReminder().catch(console.error),60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')maybeBarkReminder().catch(console.error);});
setTimeout(()=>maybeBarkReminder().catch(console.error),1500);
