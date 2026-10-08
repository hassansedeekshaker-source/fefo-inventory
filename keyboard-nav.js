/* Keyboard navigation for data-entry screens */
(function(){
 function optsFor(box){return [...box.querySelectorAll('[data-id],button,.item-option,.party-option,[role="option"]')].filter(x=>x.offsetParent!==null)}
 function attachSearch(input){
  if(input.dataset.kbAttached)return; input.dataset.kbAttached='1';
  input.addEventListener('keydown',function(e){
   const box=input.closest('.item-picker,.party-search,.field')?.querySelector('.item-results,.party-results,[role="listbox"]');
   if(!box)return;
   const opts=optsFor(box);
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    if(!opts.length)return;
    e.preventDefault();
    let idx=Number(input.dataset.kbIndex??-1);
    idx=e.key==='ArrowDown'?Math.min(idx+1,opts.length-1):Math.max(idx-1,0);
    input.dataset.kbIndex=idx;
    opts.forEach((o,i)=>o.style.background=i===idx?'#eaf2ff':'');
    opts[idx].scrollIntoView({block:'nearest'}); return;
   }
   if(e.key==='Enter'){
    const idx=Number(input.dataset.kbIndex??-1), chosen=idx>=0&&opts[idx]?opts[idx]:opts[0];
    if(chosen){e.preventDefault();chosen.click();input.dataset.kbIndex='-1';}
   }
  });
  input.addEventListener('input',()=>input.dataset.kbIndex='-1');
 }
 function focusables(){
  return [...document.querySelectorAll('input:not([type="hidden"]):not([disabled]):not([readonly]),select:not([disabled]),textarea:not([disabled])')].filter(x=>x.offsetParent!==null);
 }
 function nextFor(el){
  const row=el.closest('tr');
  if(row){
   const inside=[...row.querySelectorAll('input:not([type="hidden"]):not([disabled]):not([readonly]),select:not([disabled]),textarea:not([disabled])')].filter(x=>x.offsetParent!==null);
   const i=inside.indexOf(el);
   if(i>=0&&inside[i+1])return inside[i+1];
   let nr=row.nextElementSibling;
   while(nr){
    const n=nr.querySelector('input:not([type="hidden"]):not([disabled]):not([readonly]),select:not([disabled]),textarea:not([disabled])');
    if(n&&n.offsetParent!==null)return n; nr=nr.nextElementSibling;
   }
  }
  const all=focusables(),i=all.indexOf(el); return i>=0?all[i+1]:null;
 }
 document.addEventListener('keydown',function(e){
  const t=e.target;
  if(!(t instanceof HTMLElement))return;
  if(e.key!=='Enter'||e.ctrlKey||e.altKey||e.shiftKey)return;
  if(t.tagName==='TEXTAREA')return;
  if(t.matches('.item-search,.party-search input'))return;
  const n=nextFor(t);
  if(n){e.preventDefault();n.focus();if(n.select&&n.tagName==='INPUT')n.select();}
 });
 document.addEventListener('focusin',e=>{
  const t=e.target;
  if(t instanceof HTMLInputElement&&(t.classList.contains('item-search')||t.closest('.party-search')))attachSearch(t);
 });
 document.querySelectorAll('.item-search,.party-search input').forEach(attachSearch);
})();