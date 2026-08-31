const SB_URL='https://fyqyodnboryzaejlhdlk.supabase.co';
const SB_KEY='sb_publishable_7-Gz455HgXsWpS_5jrJ71A_VwHCEho2';
const sb=supabase.createClient(SB_URL,SB_KEY);
let user,items=[],sites=[],units=[],suppliers=[],customers=[],accounts=[];
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const today=()=>new Date().toISOString().slice(0,10);
async function init(){
 try{
 const s=await sb.auth.getSession(); if(!s.data.session){location.href='accounting.html';return}
 user=s.data.session.user;
 [items,sites,units,suppliers,customers,accounts]=await Promise.all([
  sb.from('inv_items').select('id,name_ar,sku,unit_id,purchase_price,sale_price,tax_rate').eq('active',true).order('name_ar').then(r=>r.data||[]),
  sb.from('inv_sites').select('id,name_ar,code').eq('active',true).order('name_ar').then(r=>r.data||[]),
  sb.from('inv_units').select('*').order('name_ar').then(r=>r.data||[]),
  sb.from('suppliers').select('id,name').order('name').then(r=>r.data||[]),
  sb.from('customers').select('id,name').order('name').then(r=>r.data||[]),
  sb.from('coa_accounts').select('*').eq('active',true).order('code').then(r=>r.data||[])
 ]);
 render();
 }catch(e){
   document.body.innerHTML='<div style="font-family:Arial;padding:40px;direction:rtl"><h2>تعذر تحميل الشاشة</h2><p>'+esc(e.message||e)+'</p><a href="accounting.html">🏠 العودة للرئيسية</a></div>';
 }
}
function opts(a,label){return '<option value="">-- اختر --</option>'+a.map(x=>'<option value="'+x.id+'">'+esc(label(x))+'</option>').join('')}
function render(){
 const t=document.body.dataset.workflow;
 document.title=({
 'purchase-save':'حفظ المشتريات','purchase-post':'ترحيل المشتريات',
 'sale-save':'حفظ المبيعات','sale-post':'ترحيل المبيعات',
 'purchase-return-save':'حفظ مردودات المشتريات','purchase-return-post':'ترحيل مردودات المشتريات',
 'sale-return-save':'حفظ مرتجعات المبيعات','sale-return-post':'ترحيل مرتجعات المبيعات'
 })[t]||'نظام المحاسبة';
 if(t==='purchase-save'||t==='sale-save'||t==='purchase-return-save'||t==='sale-return-save') buildSave(t); else buildPost(t);
}
function shell(body){
 const t=document.body.dataset.workflow;
 const map={
  'purchase-save':'purchase-save.html','purchase-post':'purchase-save.html',
  'sale-save':'sale-save.html','sale-post':'sale-save.html',
  'purchase-return-save':'purchase-return-save.html','purchase-return-post':'purchase-return-save.html',
  'sale-return-save':'sale-return-save.html','sale-return-post':'sale-return-save.html'
 };
 const label={purchase:'➕ حركة مشتريات جديدة',sale:'➕ حركة مبيعات جديدة','purchase-return':'➕ مردود مشتريات جديد','sale-return':'➕ مرتجع مبيعات جديد'};
 const k=t.startsWith('purchase-return')?'purchase-return':t.startsWith('sale-return')?'sale-return':t.startsWith('purchase')?'purchase':'sale';
 const current=map[t]||'accounting.html';
 $('app').innerHTML='<div class="top"><a href="accounting.html">🏠 الرئيسية</a><a class="new-movement" href="'+map[k+'-save']+'">'+label[k]+'</a><a href="'+(k==='purchase'?'purchase-post.html':k==='sale'?'sale-post.html':k==='purchase-return'?'purchase-return-post.html':'sale-return-post.html')+'">📤 الترحيل</a></div>'+body;
}
function buildSave(t){
 const isP=t.startsWith('purchase'), isR=t.includes('return');
 let party=isP?'<label>المورد<select id="party">'+opts(suppliers,x=>x.name)+'</select></label>':'<label>العميل<select id="party">'+opts(customers,x=>x.name)+'</select></label>';
 let rows='<tr><td><select class="item" onchange="purchaseItemChanged(this)">'+opts(items,x=>x.name_ar+' — '+x.sku)+'</select></td><td class="unit">-</td><td><input class="lastPrice" type="number" step=".01" readonly></td><td><input class="price" type="number" min="0" step=".01" value="0"></td><td><input class="tax" type="number" min="0" step=".01" value="0"></td><td class="lineTotal">0.00</td><td><input class="qty" type="number" min=".001" step=".001" value="1"></td><td><button onclick="this.closest(\'tr\').remove()">حذف</button></td></tr>';
 if(isP && !isR) rows='<tr><td><select class="item" onchange="purchaseItemChanged(this)">'+opts(items,x=>x.name_ar+' — '+x.sku)+'</select></td><td class="unit">-</td><td><input class="qty" type="number" min=".001" step=".001" value="1" oninput="calcPurchaseLine(this)"></td><td><input class="lastPrice" type="number" step=".01" readonly></td><td><input class="price" type="number" min="0" step=".01" value="0" oninput="calcPurchaseLine(this)"></td><td><input class="tax" type="number" min="0" step=".01" value="0" readonly></td><td class="lineTotal">0.00</td><td><button onclick="this.closest(\'tr\').remove()">حذف</button></td></tr>';
 if(isR) rows='<tr><td><select class="item">'+opts(items,x=>x.name_ar+' — '+x.sku)+'</select></td><td><input class="qty" type="number" min=".001" step=".001" value="1"></td><td><input class="price" type="number" min="0" step=".01" value="0"></td><td><input class="cost" type="number" min="0" step=".01" value="0"></td><td><button onclick="this.closest(\'tr\').remove()">حذف</button></td></tr>';
 shell('<div class="card"><h1 id="title"></h1><p>الحفظ يسجل المستند كمسودة فقط. لا يتم تحديث المخزون ولا إنشاء قيد محاسبي حتى الترحيل.</p><div class="head"><label>رقم المستند<input id="docno"></label><label>التاريخ<input id="date" type="date" value="'+today()+'"></label>'+party+'<label>الموقع<select id="site">'+opts(sites,x=>x.name_ar)+'</select></label></div><table><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر/قيمة</th><th>ضريبة/تكلفة</th><th>إجراء</th></tr></thead><tbody id="lines">'+rows+'</tbody></table><button onclick="addLine()">+ إضافة صنف</button><button class="ok" onclick="saveDraft()">💾 حفظ فقط</button><div id="invoiceSummary" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:18px;direction:rtl">
 <div class="card"><b>قيمة الفاتورة</b><div id="invoiceValue">0.00</div></div>
 <div class="card"><b>إجمالي الضريبة</b><div id="invoiceTax">0.00</div></div>
 <div class="card"><b>إجمالي الفاتورة</b><div id="invoiceTotal">0.00</div></div>
</div><a class="btn" href="'+(isP?(isR?'purchase-return-post.html':'purchase-post.html'):(isR?'sale-return-post.html':'sale-post.html'))+'">📤 شاشة الترحيل</a><div id="msg"></div></div>');

 if(isP&&!isR){document.querySelector('thead tr').innerHTML='<th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>آخر سعر شراء</th><th>سعر الشراء الجديد</th><th>القيمة المضافة %</th><th>الإجمالي</th><th>إجراء</th>';setTimeout(()=>{document.querySelectorAll('.item').forEach(purchaseItemChanged);updateInvoiceSummary()},0);}
 if(isR) document.querySelector('thead tr').innerHTML='<th>الصنف</th><th>الكمية</th><th>سعر البيع/الشراء</th><th>تكلفة المخزون</th><th>إجراء</th>';
 window.addLine=()=>{$('lines').insertAdjacentHTML('beforeend',rows);const n=$('lines').lastElementChild?.querySelector('.item');if(n)purchaseItemChanged(n);updateInvoiceSummary()};
 window.purchaseItemChanged=el=>{const tr=el.closest('tr'),x=items.find(i=>i.id===el.value);if(!x)return;tr.querySelector('.unit').textContent=(units.find(u=>u.id===x.unit_id)?.name_ar||units.find(u=>u.id===x.unit_id)?.name||'-');tr.querySelector('.lastPrice').value=Number(x.purchase_price||0).toFixed(2);tr.querySelector('.price').value=Number(x.purchase_price||0).toFixed(2);tr.querySelector('.tax').value=Number(x.tax_rate||0).toFixed(2);calcPurchaseLine(tr.querySelector('.price'))};
 window.updateInvoiceSummary=()=>{
 let value=0,tax=0;
 document.querySelectorAll('#lines tr').forEach(tr=>{
  const q=Number(tr.querySelector('.qty')?.value||0);
  const p=Number(tr.querySelector('.price')?.value||0);
  const cost=Number(tr.querySelector('.cost')?.value||0);
  const item=items.find(i=>i.id===tr.querySelector('.item')?.value);
  const base=p||cost;
  const rate=Number(item?.tax_rate||tr.querySelector('.tax')?.value||0);
  value+=q*base; tax+=q*base*rate/100;
 });
 const v=document.getElementById('invoiceValue'),tx=document.getElementById('invoiceTax'),tot=document.getElementById('invoiceTotal');
 if(v)v.textContent=value.toFixed(2); if(tx)tx.textContent=tax.toFixed(2); if(tot)tot.textContent=(value+tax).toFixed(2);
};
window.calcPurchaseLine=el=>{const tr=el.closest('tr');const q=Number(tr.querySelector('.qty')?.value||0),p=Number(tr.querySelector('.price')?.value||0),tax=Number(tr.querySelector('.tax')?.value||0);const lt=tr.querySelector('.lineTotal');if(lt)lt.textContent=(q*p*(1+tax/100)).toFixed(2);updateInvoiceSummary()};
 window.saveDraft=async()=>{
  try{
   const party=$('party').value,site=$('site').value; if(!party||!site)return msg('اختر الطرف والموقع','bad');
   const rs=[...document.querySelectorAll('#lines tr')].map(r=>{const item=items.find(i=>i.id===r.querySelector('.item').value);return({item_id:r.querySelector('.item').value,qty:+r.querySelector('.qty').value,price:+r.querySelector('.price').value,tax:Number(item?.tax_rate||0),disc:+(r.querySelector('.disc')?.value||0),cost:+(r.querySelector('.cost')?.value||0),batch:r.querySelector('.batch')?.value||null,exp:r.querySelector('.exp')?.value||null})});
   if(!rs.length||rs.some(x=>!x.item_id||x.qty<=0))return msg('راجع الأصناف والكميات','bad');
   let subtotal=0,taxTotal=0,total=0;if(isP&&!isR){subtotal=rs.reduce((s,x)=>s+(x.qty*x.price-x.qty*x.price*x.disc/100),0);taxTotal=rs.reduce((s,x)=>s+x.qty*x.price*(1-x.disc/100)*x.tax/100,0);total=subtotal+taxTotal}else if(isR&&isP){total=rs.reduce((s,x)=>s+x.qty*x.cost,0)}else{total=rs.reduce((s,x)=>s+x.qty*x.price,0);taxTotal=rs.reduce((s,x)=>s+x.qty*x.price*x.tax/100,0);}
   let h,l,rt;
   if(isP&&!isR){h=await sb.from('purchases').insert({invoice_no:$('docno').value||null,supplier_id:+party,site_id:site,purchase_date:$('date').value,subtotal:subtotal,tax:taxTotal,total,status:'draft',created_by:user.id}).select().single();if(h.error)throw h.error; l=await sb.from('purchase_lines').insert(rs.map(x=>({purchase_id:h.data.id,item_id:x.item_id,qty:x.qty,unit_cost:x.price,line_total:x.qty*x.price,discount_rate:0,discount_amount:0,tax_rate:x.tax,tax_amount:x.qty*x.price*x.tax/100,batch_no:x.batch||null,expiry_date:x.exp||null})));rt='purchase';}
   else if(!isP&&!isR){h=await sb.from('sales').insert({invoice_no:$('docno').value||null,customer_id:+party,site_id:site,sale_date:$('date').value,subtotal:total,tax:taxTotal,total,status:'draft',created_by:user.id,withholding_tax:0}).select().single();if(h.error)throw h.error;l=await sb.from('sale_lines').insert(rs.map(x=>({sale_id:h.data.id,item_id:x.item_id,qty:x.qty,unit_price:x.price,line_total:x.qty*x.price,discount_rate:0,discount_amount:0,tax_rate:x.tax,tax_amount:x.qty*x.price*x.tax/100})));rt='sale';}
   else if(isP){h=await sb.from('purchase_returns').insert({supplier_id:+party,site_id:site,return_date:$('date').value,total:total,status:'draft',created_by:user.id}).select().single();if(h.error)throw h.error;l=await sb.from('purchase_return_lines').insert(rs.map(x=>({return_id:h.data.id,item_id:x.item_id,qty:x.qty,unit_cost:x.cost})));rt='purchase_return';}
   else {h=await sb.from('sales_returns').insert({customer_id:+party,site_id:site,return_date:$('date').value,total,status:'draft',created_by:user.id}).select().single();if(h.error)throw h.error;l=await sb.from('sales_return_lines').insert(rs.map(x=>({return_id:h.data.id,item_id:x.item_id,qty:x.qty,unit_price:x.price,unit_cost:x.cost})));rt='sale_return';}
   if(l.error)throw l.error;msg('تم الحفظ كمسودة. المستند جاهز للترحيل ✓','ok');
  }catch(e){msg(e.message||e,'bad')}
 }
}
function msg(s,c){$('msg').innerHTML='<div class="msg '+c+'">'+esc(s)+'</div>'}
async function acct(code,name,type){let a=accounts.find(x=>x.code===code);if(a)return a;const r=await sb.from('coa_accounts').insert({code,name_ar:name,account_type:type,is_postable:true,active:true}).select().single();if(r.error)throw r.error;accounts.push(r.data);return r.data}
async function journal(source,id,date,desc,lines){const e=await sb.from('journal_entries').insert({entry_date:date,source_type:source,source_id:id,description:desc,posted:true,created_by:user.id}).select().single();if(e.error)throw e.error;const r=await sb.from('journal_lines').insert(lines.map(x=>({...x,entry_id:e.data.id})));if(r.error)throw r.error}
async function postPurchase(id){
 const h=(await sb.from('purchases').select('*').eq('id',id).single()).data, ls=(await sb.from('purchase_lines').select('*').eq('purchase_id',id)).data||[]; if(!h||h.status!=='draft')throw Error('المستند غير موجود أو مرحل');
 let sub=0,tax=0;
 for(const x of ls){const net=x.qty*x.unit_cost-x.discount_amount;sub+=net;tax+=x.tax_amount;const uc=net/x.qty;const lot=await sb.from('inv_lots').insert({item_id:x.item_id,site_id:h.site_id,batch_no:x.batch_no,expiry_date:x.expiry_date,qty_on_hand:x.qty,unit_cost:uc,supplier_invoice_no:h.invoice_no,received_at:new Date().toISOString()}).select().single();if(lot.error)throw lot.error;const mv=await sb.from('inv_movements').insert({item_id:x.item_id,site_id:h.site_id,lot_id:lot.data.id,movement_type:'receipt',qty:x.qty,unit_cost:uc,reference_type:'purchase',reference_id:id,notes:'ترحيل فاتورة مشتريات',created_by:user.id});if(mv.error)throw mv.error;const old=(await sb.from('inventory_costs').select('*').eq('item_id',x.item_id).eq('site_id',h.site_id).maybeSingle()).data;const q=+(old?.qty_on_hand||0),v=+(old?.inventory_value||0),nq=q+x.qty,nv=v+net;const cu=await sb.from('inventory_costs').upsert({item_id:x.item_id,site_id:h.site_id,qty_on_hand:nq,inventory_value:nv,weighted_avg_cost:nq?nv/nq:0,updated_at:new Date().toISOString()},{onConflict:'item_id,site_id'});if(cu.error)throw cu.error}
 const inv=await acct('1310','مخزون بضائع','asset'),sup=await acct('2120','الموردون','liability');const j=[{account_id:inv.id,debit:sub,credit:0,description:'مخزون المشتريات',site_id:h.site_id}];if(tax)j.push({account_id:(await acct('1230','ضريبة القيمة المضافة - مدخلات','asset')).id,debit:tax,credit:0,description:'ضريبة مشتريات',site_id:h.site_id});j.push({account_id:sup.id,debit:0,credit:h.total,description:'استحقاق المورد',site_id:h.site_id});await journal('purchase',id,h.purchase_date,'ترحيل مشتريات '+(h.invoice_no||''),j);await sb.from('purchases').update({status:'posted'}).eq('id',id);
}
async function postSale(id){
 const h=(await sb.from('sales').select('*').eq('id',id).single()).data,ls=(await sb.from('sale_lines').select('*').eq('sale_id',id)).data||[];if(!h||h.status!=='draft')throw Error('المستند غير موجود أو مرحل');let cogs=0;
 for(const x of ls){const old=(await sb.from('inventory_costs').select('*').eq('item_id',x.item_id).eq('site_id',h.site_id).maybeSingle()).data;const q=+(old?.qty_on_hand||0),v=+(old?.inventory_value||0),w=+(old?.weighted_avg_cost||0);if(q<x.qty)throw Error('الرصيد غير كافٍ للصنف');cogs+=x.qty*w;let rem=x.qty;const lots=(await sb.from('inv_lots').select('*').eq('item_id',x.item_id).eq('site_id',h.site_id).gt('qty_on_hand',0).order('expiry_date',{ascending:true})).data||[];for(const l of lots){if(rem<=0)break;const take=Math.min(rem,+l.qty_on_hand);const up=await sb.from('inv_lots').update({qty_on_hand:+l.qty_on_hand-take}).eq('id',l.id);if(up.error)throw up.error;const mv=await sb.from('inv_movements').insert({item_id:x.item_id,site_id:h.site_id,lot_id:l.id,movement_type:'issue',qty:take,unit_cost:w,reference_type:'sale',reference_id:id,notes:'ترحيل مبيعات FEFO',created_by:user.id});if(mv.error)throw mv.error;rem-=take}const cu=await sb.from('inventory_costs').upsert({item_id:x.item_id,site_id:h.site_id,qty_on_hand:q-x.qty,inventory_value:Math.max(0,v-x.qty*w),weighted_avg_cost:q-x.qty?(v-x.qty*w)/(q-x.qty):0,updated_at:new Date().toISOString()},{onConflict:'item_id,site_id'});if(cu.error)throw cu.error}
 const ar=await acct('1320','العملاء','asset'),rev=await acct('4100','المبيعات','revenue'),inv=await acct('1310','مخزون بضائع','asset'),cg=await acct('5100','تكلفة البضاعة المباعة','expense');const j=[{account_id:ar.id,debit:h.total,credit:0,description:'استحقاق العميل',site_id:h.site_id},{account_id:rev.id,debit:0,credit:h.subtotal,description:'المبيعات',site_id:h.site_id},{account_id:cg.id,debit:cogs,credit:0,description:'تكلفة المبيعات',site_id:h.site_id},{account_id:inv.id,debit:0,credit:cogs,description:'تخفيض المخزون',site_id:h.site_id}];if(+h.tax)j.push({account_id:(await acct('2220','ضريبة القيمة المضافة - مخرجات','liability')).id,debit:0,credit:h.tax,description:'ضريبة مبيعات',site_id:h.site_id});await journal('sale',id,h.sale_date,'ترحيل مبيعات '+(h.invoice_no||''),j);await sb.from('sales').update({status:'posted'}).eq('id',id);
}
async function postPurchaseReturn(id){
 const h=(await sb.from('purchase_returns').select('*').eq('id',id).single()).data,ls=(await sb.from('purchase_return_lines').select('*').eq('return_id',id)).data||[];if(!h||h.status!=='draft')throw Error('المستند غير موجود أو مرحل');let total=0;for(const x of ls){total+=x.qty*x.unit_cost;let rem=x.qty;const lots=(await sb.from('inv_lots').select('*').eq('item_id',x.item_id).eq('site_id',h.site_id).gt('qty_on_hand',0).order('expiry_date',{ascending:true})).data||[];for(const l of lots){if(rem<=0)break;const take=Math.min(rem,+l.qty_on_hand);await sb.from('inv_lots').update({qty_on_hand:+l.qty_on_hand-take}).eq('id',l.id);await sb.from('inv_movements').insert({item_id:x.item_id,site_id:h.site_id,lot_id:l.id,movement_type:'supplier_return',qty:take,unit_cost:+l.unit_cost,reference_type:'purchase_return',reference_id:id,notes:'ترحيل مردود مشتريات',created_by:user.id});rem-=take}if(rem>0)throw Error('الرصيد غير كافٍ للمردود');const old=(await sb.from('inventory_costs').select('*').eq('item_id',x.item_id).eq('site_id',h.site_id).maybeSingle()).data,q=+(old?.qty_on_hand||0),v=+(old?.inventory_value||0),nv=Math.max(0,v-x.qty*x.unit_cost),nq=q-x.qty;await sb.from('inventory_costs').upsert({item_id:x.item_id,site_id:h.site_id,qty_on_hand:nq,inventory_value:nv,weighted_avg_cost:nq?nv/nq:0,updated_at:new Date().toISOString()},{onConflict:'item_id,site_id'})}const sup=await acct('2120','الموردون','liability'),inv=await acct('1310','مخزون بضائع','asset');await journal('purchase_return',id,h.return_date,'مردود مشتريات',[{account_id:sup.id,debit:h.total,credit:0,description:'خفض مستحق المورد',site_id:h.site_id},{account_id:inv.id,debit:0,credit:h.total,description:'رد مخزون للمورد',site_id:h.site_id}]);await sb.from('purchase_returns').update({status:'posted'}).eq('id',id)
}
async function postSaleReturn(id){
 const h=(await sb.from('sales_returns').select('*').eq('id',id).single()).data,ls=(await sb.from('sales_return_lines').select('*').eq('return_id',id)).data||[];if(!h||h.status!=='draft')throw Error('المستند غير موجود أو مرحل');let total=0,cost=0;for(const x of ls){total+=x.qty*x.unit_price;cost+=x.qty*x.unit_cost;const lot=await sb.from('inv_lots').insert({item_id:x.item_id,site_id:h.site_id,qty_on_hand:x.qty,unit_cost:x.unit_cost,received_at:new Date().toISOString()}).select().single();if(lot.error)throw lot.error;await sb.from('inv_movements').insert({item_id:x.item_id,site_id:h.site_id,lot_id:lot.data.id,movement_type:'receipt',qty:x.qty,unit_cost:x.unit_cost,reference_type:'sale_return',reference_id:id,notes:'ترحيل مرتجع مبيعات',created_by:user.id});const old=(await sb.from('inventory_costs').select('*').eq('item_id',x.item_id).eq('site_id',h.site_id).maybeSingle()).data,q=+(old?.qty_on_hand||0),v=+(old?.inventory_value||0),nq=q+x.qty,nv=v+x.qty*x.unit_cost;await sb.from('inventory_costs').upsert({item_id:x.item_id,site_id:h.site_id,qty_on_hand:nq,inventory_value:nv,weighted_avg_cost:nq?nv/nq:0,updated_at:new Date().toISOString()},{onConflict:'item_id,site_id'})}const cust=await acct('1320','العملاء','asset'),ret=await acct('4200','مرتجعات المبيعات','revenue'),inv=await acct('1310','مخزون بضائع','asset'),cg=await acct('5100','تكلفة البضاعة المباعة','expense');await journal('sale_return',id,h.return_date,'مرتجع مبيعات',[{account_id:ret.id,debit:h.total,credit:0,description:'مرتجع مبيعات',site_id:h.site_id},{account_id:cust.id,debit:0,credit:h.total,description:'خفض مستحق العميل',site_id:h.site_id},{account_id:inv.id,debit:cost,credit:0,description:'إعادة المخزون',site_id:h.site_id},{account_id:cg.id,debit:0,credit:cost,description:'عكس تكلفة المبيعات',site_id:h.site_id}]);await sb.from('sales_returns').update({status:'posted'}).eq('id',id)
}
function buildPost(t){
 const isP=t.startsWith('purchase'),isR=t.includes('return'), table=isP?(isR?'purchase_returns':'purchases'):(isR?'sales_returns':'sales');
 shell('<div class="card"><h1 id="title"></h1><p>هذه شاشة الترحيل فقط. المستندات هنا محفوظة كمسودات ولا تؤثر على المخزون أو الحسابات حتى يتم ترحيلها.</p><button onclick="loadDrafts()">🔄 تحديث</button><a class="btn" href="'+(isP?(isR?'purchase-return-save.html':'purchase-save.html'):(isR?'sale-return-save.html':'sale-save.html'))+'">💾 شاشة الحفظ</a><table><thead><tr><th>تحديد</th><th>رقم</th><th>التاريخ</th><th>الطرف</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody id="drafts"></tbody></table><button class="ok" onclick="postSelected()">📤 ترحيل المحدد</button><div id="msg"></div></div>');
 window.loadDrafts=async()=>{const r=await sb.from(table).select('*').eq('status','draft').order(isR?'return_date':isP?'purchase_date':'sale_date',{ascending:false});if(r.error)return msg(r.error.message,'bad');$('drafts').innerHTML=(r.data||[]).map(x=>'<tr><td><input type="checkbox" class="ck" value="'+x.id+'"></td><td>'+esc(x.invoice_no||x.return_no||x.id.slice(0,8))+'</td><td>'+esc(x.purchase_date||x.sale_date||x.return_date)+'</td><td>'+(isR?(isP?'مورد':'عميل'):(isP?'مورد':'عميل'))+'</td><td>'+Number(x.total||0).toFixed(2)+'</td><td>مسودة</td></tr>').join('')||'<tr><td colspan="6">لا توجد مستندات محفوظة.</td></tr>'};
 window.postSelected=async()=>{const ids=[...document.querySelectorAll('.ck:checked')].map(x=>x.value);if(!ids.length)return msg('حدد مستندًا واحدًا على الأقل','bad');try{for(const id of ids){if(t==='purchase-post')await postPurchase(id);else if(t==='sale-post')await postSale(id);else if(t==='purchase-return-post')await postPurchaseReturn(id);else await postSaleReturn(id)}msg('تم ترحيل المستندات المحددة وتحديث المخزون والقيود المحاسبية ✓','ok');await loadDrafts()}catch(e){msg(e.message||e,'bad')}};
 loadDrafts();
}
init();