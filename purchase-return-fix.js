(function(){
  function enhance(){
    const table=document.querySelector('#lines'); if(!table)return;
    const head=table.closest('table')?.querySelector('thead tr');
    if(head&&!head.querySelector('.source-head')){
      const th=document.createElement('th');th.className='source-head';th.textContent='إذن الشراء الأصلي';head.insertBefore(th,head.children[1]);
      const tx=document.createElement('th');tx.className='tax-head';tx.textContent='الضريبة';
      const ph=[...head.children].find(x=>x.textContent.includes('سعر'));if(ph)ph.after(tx);
    }
    table.querySelectorAll('tr').forEach(row=>{
      if(row.dataset.returnSourceReady==='1')return;
      const item=row.querySelector('.item');if(!item)return;row.dataset.returnSourceReady='1';
      const td=document.createElement('td');td.innerHTML='<select class="sourceInvoice" style="min-width:240px"><option value="">اختر إذن الشراء</option></select><div class="hint">اختر الإذن الذي سترجع منه</div>';row.insertBefore(td,row.children[1]);
      const price=row.querySelector('.price');if(price){price.readOnly=true;price.classList.add('locked');price.title='السعر مأخوذ تلقائيًا من إذن الشراء';}
      const taxTd=document.createElement('td');taxTd.className='sourceTaxDisplay';taxTd.textContent='-';if(price)price.parentElement.after(taxTd);else row.insertBefore(taxTd,row.children[3]);
      const load=()=>loadSources(row);item.addEventListener('change',load);document.getElementById('site')?.addEventListener('change',load);load();
    });
  }
  async function loadSources(row){
    const item=row.querySelector('.item'),sel=row.querySelector('.sourceInvoice'),site=document.getElementById('site')?.value;if(!sel)return;
    sel.innerHTML='<option value="">جاري تحميل أذون الشراء...</option>';if(!item?.value||!site){sel.innerHTML='<option value="">اختر الصنف والموقع أولاً</option>';return;}
    try{
      const p=await sb.from('purchases').select('id,invoice_no,purchase_date').eq('site_id',site).eq('status','posted').order('purchase_date',{ascending:false});if(p.error)throw p.error;
      const ps=p.data||[];if(!ps.length){sel.innerHTML='<option value="">لا توجد أذون مشتريات مرحّلة لهذا الموقع</option>';return;}
      const ids=ps.map(x=>x.id);const l=await sb.from('purchase_lines').select('id,purchase_id,item_id,qty,unit_cost,tax_rate').eq('item_id',item.value).in('purchase_id',ids);if(l.error)throw l.error;
      const lines=l.data||[];sel.innerHTML='<option value="">اختر إذن الشراء</option>';
      lines.forEach(x=>{const p0=ps.find(p=>p.id===x.purchase_id);if(!p0)return;const o=document.createElement('option');o.value=x.id;o.dataset.qty=x.qty;o.dataset.cost=x.unit_cost;o.dataset.tax=x.tax_rate||0;o.textContent='إذن '+(p0.invoice_no||p0.id)+' — '+(p0.purchase_date||'')+' — سعر '+Number(x.unit_cost||0).toFixed(2)+(Number(x.tax_rate||0)>0?' — ضريبة '+Number(x.tax_rate).toFixed(2)+'%':' — بدون ضريبة');sel.appendChild(o);});
      if(!lines.length)sel.innerHTML='<option value="">لا يوجد شراء لهذا الصنف في أذون مرحّلة</option>';sel.onchange=()=>applySource(row);
    }catch(e){sel.innerHTML='<option value="">تعذر تحميل أذون الشراء</option>';console.error(e);}
  }
  function applySource(row){const o=row.querySelector('.sourceInvoice')?.selectedOptions?.[0];if(!o?.value)return;const cost=Number(o.dataset.cost||0),tax=Number(o.dataset.tax||0),max=Number(o.dataset.qty||0);const p=row.querySelector('.price');if(p){p.value=cost.toFixed(2);p.readOnly=true;p.classList.add('locked');}const c=row.querySelector('.cost');if(c){c.value=cost.toFixed(2);c.readOnly=true;c.classList.add('locked');}const td=row.querySelector('.sourceTaxDisplay');if(td)td.textContent=tax>0?tax.toFixed(2)+'%':'بدون ضريبة';let h=row.querySelector('.source_purchase_line_id');if(!h){h=document.createElement('input');h.type='hidden';h.className='source_purchase_line_id';row.appendChild(h);}h.value=o.value;const q=row.querySelector('.qty');if(q){q.max=String(max);q.title='الحد الأقصى من هذا الإذن: '+max;if(Number(q.value)>max)q.value=max;}window.updateInvoiceSummary?.();}
  const obs=new MutationObserver(enhance);obs.observe(document.body,{childList:true,subtree:true});setTimeout(enhance,50);setTimeout(enhance,300);setTimeout(enhance,1000);
})();