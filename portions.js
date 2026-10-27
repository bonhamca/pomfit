(()=>{
  const root=document.getElementById('content');
  if(!root)return;

  function namedOz(text,name){
    const rx=new RegExp(name+'\\s*(\\d+(?:\\.\\d+)?)\\s*oz','i');
    const m=String(text||'').match(rx);
    return m?Number(m[1]):null;
  }
  function hasProtein(text){
    return /salmon|cod|branzino|sea bass|tilapia|trout|sole|catfish|shrimp|chicken|beef|steak|sirloin|flank|tuna|hot dog/i.test(String(text||''));
  }
  function guide(text,slot){
    if(!hasProtein(text))return '';
    let clark=namedOz(text,'Clark'),elizabeth=namedOz(text,'Elizabeth');
    if(slot==='dinner'){
      clark=clark??7;elizabeth=elizabeth??5;
    }else if(slot==='lunch'){
      clark=clark??6;elizabeth=elizabeth??4;
    }else return '';
    const total=clark+elizabeth;
    return `<div class="portion-guide"><b>Serving amounts:</b> Clark ${clark} oz cooked protein • Elizabeth ${elizabeth} oz cooked protein • <b>${total} oz cooked total</b><br><span class="small">Vegetables: about 1–1½ cups each. Use any starch/extra side only if it is listed for that person.</span></div>`;
  }
  function apply(){
    root.querySelectorAll('.meal').forEach(el=>{
      if(el.querySelector('.portion-guide'))return;
      const bold=(el.querySelector('b')?.textContent||'').toLowerCase();
      const slot=bold.includes('dinner')?'dinner':bold.includes('lunch')?'lunch':'';
      if(!slot)return;
      const p=el.querySelector('p');
      if(!p)return;
      const html=guide(p.textContent,slot);
      if(html)p.insertAdjacentHTML('afterend',html);
    });
    root.querySelectorAll('.week-meal-row').forEach(el=>{
      if(el.querySelector('.portion-guide'))return;
      const label=(el.querySelector('b')?.textContent||'').toLowerCase();
      const slot=label.includes('dinner')?'dinner':label.includes('lunch')?'lunch':'';
      if(!slot)return;
      const spans=[...el.querySelectorAll(':scope > span')];
      const meal=spans.find(x=>!x.classList.contains('badge'));
      if(!meal)return;
      const html=guide(meal.textContent,slot);
      if(html)meal.insertAdjacentHTML('afterend',html);
    });
    root.querySelectorAll('.prep-meal-row').forEach(el=>{
      if(el.querySelector('.portion-guide'))return;
      const label=(el.querySelector('b')?.textContent||'').toLowerCase();
      const slot=label.includes('dinner')?'dinner':label.includes('lunch')?'lunch':'';
      if(!slot)return;
      const meal=el.querySelector('.prep-meal-name');
      if(!meal)return;
      const html=guide(meal.textContent,slot);
      if(html)meal.insertAdjacentHTML('afterend',html);
    });
    root.querySelectorAll('.season details').forEach(el=>{
      if(el.querySelector('.recipe-scale-note'))return;
      const mix=[...el.querySelectorAll('p')].find(p=>/^Mix:/i.test(p.textContent.trim()));
      if(mix)mix.insertAdjacentHTML('afterend','<p class="small recipe-scale-note"><b>For two:</b> use the mix as written unless it explicitly says “per person.”</p>');
    });
  }
  const observer=new MutationObserver(()=>apply());
  observer.observe(root,{childList:true,subtree:true});
  window.addEventListener('DOMContentLoaded',apply);
  setTimeout(apply,0);
})();