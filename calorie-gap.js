import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
const s=createClient('https://wbskfggewwlkeplswpan.supabase.co','sb_publishable_y9L64jb_Xp3aBUuTsMIK4w_0-4b_S-D',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const E=x=>String(x??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let lock=false,sig='';
const idx=()=>{const d=new Date().getDay();return d===0?0:Math.min(6,d)};
function key(i){const n=new Date(),d=new Date(n);d.setHours(12,0,0,0);d.setDate(n.getDate()-n.getDay()+i);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function list(v){return String(v||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)}
function bad(x,ds){const t=(x.n+' '+x.t).toLowerCase();return ds.some(d=>t.includes(d)||d.includes(t))}
const food=[
 {n:'Protein shake with unsweetened milk',c:180,p:24,t:'protein whey milk'},
 {n:'3 oz extra lean protein + vegetables',c:220,p:24,t:'protein chicken fish beef vegetables'},
 {n:'1 oz pistachios + 1 oz Swiss',c:270,p:13,t:'pistachios swiss cheese'},
 {n:'Berries + measured nuts',c:180,p:5,t:'berries nuts'}
];
const dessert={
 keto:[
  {n:'Chocolate protein mousse — whey + cocoa + unsweetened milk',c:180,p:24,t:'protein whey cocoa milk'},
  {n:'½ cup berries + 2 Tbsp whipped cream',c:120,p:2,t:'berries cream'},
  {n:'1 oz 85% dark chocolate + 1 oz pistachios',c:250,p:6,t:'chocolate pistachios'}
 ],
 lowcarb:[
  {n:'Chocolate protein mousse',c:180,p:24,t:'protein whey cocoa'},
  {n:'Berries + whipped cream',c:140,p:2,t:'berries cream'},
  {n:'Dark chocolate + pistachios',c:250,p:6,t:'chocolate pistachios'}
 ],
 balanced:[
  {n:'Greek yogurt + berries',c:180,p:18,t:'yogurt berries'},
  {n:'Small measured ice-cream serving',c:180,p:4,t:'ice cream'},
  {n:'Fruit + dark chocolate',c:200,p:3,t:'fruit chocolate'}
 ]
};
async function data(){
 const {data:{session}}=await s.auth.getSession();if(!session)return null;
 const r=await s.from('personal_state').select('settings').eq('user_id',session.user.id).single();if(r.error)return null;
 return {session,st:r.data?.settings||{}};
}
function calc(st){
 const p=st.profile_config||{},d=st.energy_log?.[key(idx())]||{},w=Number(d.weight_lb)||Number(p.weight_lb),a=Number(p.age),h=Number(p.height_in),sex=p.calorie_equation_sex;
 if(!w||!a||!h||!sex)return null;
 const b=10*w*.45359237+6.25*h*2.54-5*a+(sex==='male'?5:sex==='female'?-161:-78),f={sedentary:1.2,light:1.3,moderate:1.4,active:1.5}[p.baseline_activity]||1.3,burn=Number(d.workout_calories)||0,g=Number(p.goal_weight_lb),rate=Math.max(0,Math.min(1,Number(p.goal_rate_lb_week??.5))),adj=g&&Math.abs(g-w)>=.5?(g<w?-500*rate:500*rate):0,target=Math.max(1200,Math.round(b*f+burn+adj));
 const m=d.meals&&typeof d.meals==='object'?d.meals:{},sup=Array.isArray(d.supplements)?d.supplements:[],e=Object.values(m).reduce((x,v)=>x+(Number(v)||0),0)+(Number(d.other_calories)||0)+sup.reduce((x,v)=>x+(Number(v?.calories)||0),0);
 return {p,d,target,e,rem:target-e};
}
function choose(xs,rem){const want=rem>500?300:rem>300?200:150;return [...xs].sort((a,b)=>Math.abs(a.c-want)-Math.abs(b.c-want)).slice(0,3)}
function html(x){
 const ds=list(x.p.food_dislikes),diet=x.p.diet_style||'balanced',fd=choose(food.filter(v=>!bad(v,ds)),x.rem),dd=choose((dessert[diet]||dessert.balanced).filter(v=>!bad(v,ds)),x.rem);
 const msg=x.rem>500?'You are well below target. Consider eating more, especially on a training day.':x.rem>300?'You are moderately below target. A small add-on is reasonable if you are hungry or trained.':x.rem>0?'You are close to target. You do not need to force food.':'You are at or above today’s estimated target.';
 const row=v=>'<div class="gap-option"><div><b>'+E(v.n)+'</b><div class="small">~'+v.c+' kcal • ~'+v.p+' g protein</div></div><button class="ghost" data-gap-c="'+v.c+'" data-gap-p="'+v.p+'" data-gap-n="'+E(v.n)+'">Log this</button></div>';
 return '<div class="card calorie-gap-card"><div class="dayhead"><div><h3>Need more calories?</h3><div class="small">'+Math.max(0,Math.round(x.rem))+' kcal remaining</div></div><span class="badge '+(x.rem>500?'warn-badge':'ok-badge')+'">'+(x.rem>500?'EAT MORE':x.rem>300?'CONSIDER':'OPTIONAL')+'</span></div><p>'+E(msg)+'</p><h4>Food add-ons</h4>'+fd.map(row).join('')+'<h4>Desserts that fit</h4>'+dd.map(row).join('')+'<p class="small">Dessert is optional. These are portion estimates, not exact label values.</p><div id="gapStatus" class="small"></div></div>';
}
async function log(c,p,n){
 const z=await data();if(!z)return;const k=key(idx()),all={...(z.st.energy_log||{})},d={...(all[k]||{})};
 d.other_calories=(Number(d.other_calories)||0)+Number(c||0);d.other_protein_g=(Number(d.other_protein_g)||0)+Number(p||0);all[k]=d;
 const r=await s.rpc('save_my_setting',{p_key:'energy_log',p_value:all});const o=document.getElementById('gapStatus');if(o)o.textContent=r.error?'Could not log: '+r.error.message:'Logged '+n+'.';sig='';setTimeout(run,100);
}
async function run(){if(lock)return;lock=true;try{
 if(document.querySelector('#nav button.active')?.dataset?.tab!=='today')return;
 const z=await data();if(!z)return;const x=calc(z.st);if(!x)return;const q=[x.target,x.e,x.rem,z.st.profile_config?.diet_style,z.st.profile_config?.food_dislikes].join('|');
 const root=document.getElementById('content');if(!root)return;if(q===sig&&root.querySelector('.calorie-gap-card'))return;
 root.querySelector('.calorie-gap-card')?.remove();const a=root.querySelector('.tracking-jump')||root.firstElementChild;if(a)a.insertAdjacentHTML('afterend',html(x));
 root.querySelectorAll('[data-gap-c]').forEach(b=>b.onclick=()=>log(b.dataset.gapC,b.dataset.gapP,b.dataset.gapN));sig=q;
}finally{lock=false}}
new MutationObserver(()=>setTimeout(run,60)).observe(document.body,{childList:true,subtree:true});setInterval(run,5000);setTimeout(run,700);