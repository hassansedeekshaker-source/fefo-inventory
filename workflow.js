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
  sb.from('customers').select('id,name,withholding_enabled,withholding_rate').order('name').then(r=>r.data||[]),
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
 document.title=({'purchase-save':'حفظ المشتريات','purchase-saved':'المشتريات المحفوظة','purchase-post':'ترحيل المشتريات','sale-save':'حفظ المبيعات','sale-saved':'المبيعات المحفوظة','sale-post':'ترحيل المبيعات','purchase-return-save':'حفظ مردودات المشتريات','purchase-return-saved':'المردودات المحفوظة للمشتريات','purchase-return-post':'ترحيل مردودات المشتريات','sale-return-save':'حفظ مرتجعات المبيعات','sale-return-saved':'المرتجعات المحفوظة للمبيعات','sale-return-post':'ترحيل مرتجعات المبيعات'})[t]||'نظام المحاسبة';
 if(t==='sale-save'){const saved=new URLSearchParams(location.search).get('saved');if(saved==='1'){document.body.dataset.workflow='sale-saved';buildSaved('sale-saved');}else buildSaleSave();} else if(t==='purchase-save'||t==='purchase-return-save'||t==='sale-return-save'){const saved=new URLSearchParams(location.search).get('saved');if(saved==='1'){document.body.dataset.workflow=t==='purchase-save'?'purchase-saved':t==='purchase-return-save'?'purchase-return-saved':'sale-return-saved';buildSaved(document.body.dataset.workflow);}else buildSave(t);} else if(t==='purchase-saved'||t==='sale-saved'||t==='purchase-return-saved'||t==='sale-return-saved') buildSaved(t); else buildPost(t);
}
function shell(body){
 const t=document.body.dataset.workflow;
 const map={'purchase-save':'purchase-save.html','purchase-post':'purchase-save.html','sale-save':'sale-save.html','sale-post':'sale-save.html','purchase-return-save':'purchase-return-save.html','purchase-return-post':'purchase-return-save.html','sale-return-save':'sale-return-save.html','sale-return-post':'sale-return-save.html'};
 const label={purchase:'➕ حركة مشتريات جديدة',sale:'➕ حركة مبيعات جديدة','purchase-return':'➕ مردود مشتريات جديد','sale-return':'➕ مرتجع مبيعات جديد'};
 const k=t.startsWith('purchase-return')?'purchase-return':t.startsWith('sale-return')?'sale-return':t.startsWith('purchase')?'purchase':'sale';
 const current=map[t]||'accounting.html';
 $('app').innerHTML='<div class="top"><a href="accounting.html">🏠 الرئيسية</a><a class="new-movement" href="'+map[k+'-save']+'">'+label[k]+'</a><a href="'+(k==='purchase'?'purchase-save.html?saved=1':k==='sale'?'sale-save.html?saved=1':k==='purchase-return'?'purchase-return-save.html?saved=1':'sale-return-save.html?saved=1')+'">📋 المحفوظة</a><a href="'+(k==='purchase'?'purchase-post.html':k==='sale'?'sale-post.html':k==='purchase-return'?'purchase-return-post.html':'sale-return-post.html')+'">📤 الترحيل</a></div>'+body;
}
function buildSaleSave(){
 const partyParam=new URLSearchParams(location.search).get('customer_id');
 shell('<div class="card"><div class="invoice-title"><h1>P.O.S</h1><span class="small">فاتورة مبيعات</span></div>'+
 '<div class="header-grid">'+
 '<div class="field"><label>رقم الفاتورة<input id="docno" value="New"></label></div>'+
 '<div class="field"><label>التاريخ<input id="date" type="date" value="'+today()+'"></label></div>'+
 '<div class="field"><label>المخزن<select id="site">'+opts(sites,x=>x.name_ar)+'</select></label></div>'+
 '<div class="field"><label>الصنف / العميل<select id="party">'+opts(customers,x=>x.name)+'</select></label></div>'+
 '<div class="field"><label>الرصيد<input id="partyBalance" class="readonly" value="0.00" readonly></label></div>'+
 '<div class="field notes"><label>ملاحظات<textarea id="notes" placeholder="اكتب أي ملاحظات..."></textarea></label></div>'+
 '</div>'+
 '<div class="table-wrap"><table><thead><tr>'+
 '<th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>سعر البيع</th><th>الرصيد</th><th>التكلفة</th><th>إجمالي التكلفة</th><th>نسبة الخصم</th><th>قيمة الخصم</th><th>القيمة</th><th>نسبة الضريبة</th><th>قيمة الضريبة</th><th>الإجمالي</th><th>حذف</th>'+
 '</tr></thead><tbody id="lines"></tbody></table><div class="add-row" onclick="addSaleLine()">＋ إضافة بند</div></div>'+
 '<div class="totals">'+
 '<div class="total-box"><b>تكلفة الفاتورة</b><div class="total-value" id="invoiceCost">0.00</div></div>'+
 '<div class="total-box"><b>قيمة الخصم</b><div class="total-value" id="discountTotal">0.00</div></div>'+
 '<div class="total-box"><b>قيمة الفاتورة</b><div class="total-value" id="invoiceValue">0.00</div></div>'+
 '<div class="total-box"><b>قيمة الضريبة</b><div class="total-value" id="invoiceTax">0.00</div></div>'+
 '<div class="total-box net"><b>صافي الفاتورة</b><div class="total-value" id="invoiceTotal">0.00</div></div>'+
 '</div>'+
 '<div class="actions"><button class="save" onclick="saveSaleDraft()">💾 حفظ مسودة</button><button class="approve" onclick="location.href=&#39;sale-post.html&#39;">📤 الترحيل</button><button onclick="window.print()">🖨 طباعة</button><button onclick="location.href=\'sale-save.html\'">📄 فاتورة جديدة</button></div><div id="msg"></div></div><div id="returnPreview" style="display:none;position:fixed;inset:0;background:#0008;z-index:99999;padding:4vh 3vw;overflow:auto"><div style="max-width:1100px;margin:auto;background:#fff;border-radius:14px;padding:22px;direction:rtl;color:#17233b"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 id="previewTitle">معاينة المرتجع</h2><button id="closeReturnPreview">✖ إغلاق</button></div><div id="previewInfo">جاري تحميل تفاصيل المستند...</div><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;margin-top:14px"><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الشراء</th><th>الخصم</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody id="previewLines"></tbody></table></div><div id="previewTotals" style="text-align:left;font-weight:bold;margin-top:14px"></div></div></div>');
 if(partyParam){const ps=$('party');if(ps&&[...ps.options].some(o=>o.value===partyParam)){ps.value=partyParam;}}
 window.saleRow=()=>'<tr><td><select class="item" onchange="saleItemChanged(this)">'+opts(items,x=>x.name_ar)+'</select></td><td class="unit">-</td><td><input class="qty" type="number" min=".001" step=".001" value="1" oninput="calcSale()"></td><td><input class="price" type="number" min="0" step=".01" value="0" oninput="calcSale()"></td><td><input class="stock readonly" value="0.00" readonly></td><td><input class="cost readonly" value="0.00" readonly></td><td class="lineCost">0.00</td><td><input class="disc" type="number" min="0" max="100" step=".01" value="0" oninput="calcSale()"></td><td class="discValue">0.00</td><td class="value">0.00</td><td><input class="tax readonly" value="0.00" readonly></td><td class="taxValue">0.00</td><td class="lineTotal">0.00</td><td><button onclick="this.parentElement.parentElement.remove();calcSale()">🗑</button></td></tr>';
 window.addSaleLine=()=>{$('lines').insertAdjacentHTML('beforeend',saleRow());const s=$('lines').lastElementChild.querySelector('.item');saleItemChanged(s);s.focus();};
 window.saleItemChanged=el=>{const tr=el.closest('tr'),x=items.find(i=>i.id===el.value);if(!x)return;tr.querySelector('.unit').textContent=(units.find(u=>u.id===x.unit_id)?.name_ar||'-');tr.querySelector('.price').value=Number(x.sale_price||0).toFixed(2);tr.querySelector('.tax').value=(Number(x.tax_rate||0)*100).toFixed(2);tr.querySelector('.stock').value='0.00';tr.querySelector('.cost').value=Number(x.purchase_price||0).toFixed(2);calcSale();};
 window.calcSale=()=>{let cost=0,disc=0,value=0,tax=0,total=0;document.querySelectorAll('#lines tr').forEach(tr=>{const q=Number(tr.querySelector('.qty')?.value||0),p=Number(tr.querySelector('.price')?.value||0),d=Number(tr.querySelector('.disc')?.value||0),rate=Number(tr.querySelector('.tax')?.value||0),co=Number(tr.querySelector('.cost')?.value||0);const v=q*p,dd=v*d/100,n=v-dd,tx=n*rate/100;cost+=q*co;disc+=dd;value+=n;tax+=tx;total+=n+tx;tr.querySelector('.lineCost').textContent=(q*co).toFixed(2);tr.querySelector('.discValue').textContent=dd.toFixed(2);tr.querySelector('.value').textContent=n.toFixed(2);tr.querySelector('.taxValue').textContent=tx.toFixed(2);tr.querySelector('.lineTotal').textContent=(n+tx).toFixed(2);});$('invoiceCost').textContent=cost.toFixed(2);$('discountTotal').textContent=disc.toFixed(2);$('invoiceValue').textContent=value.toFixed(2);$('invoiceTax').textContent=tax.toFixed(2);$('invoiceTotal').textContent=total.toFixed(2);};
 window.saveSaleDraft=async()=>{try{const customer=$('party').value,site=$('site').value;if(!customer||!site)return msg('اختر العميل والمخزن','bad');const rows=[...document.querySelectorAll('#lines tr')];if(!rows.length)return msg('أضف صنفًا واحدًا على الأقل','bad');const rs=rows.map(r=>{const x=items.find(i=>i.id===r.querySelector('.item').value),q=+r.querySelector('.qty').value,p=+r.querySelector('.price').value,d=+r.querySelector('.disc').value||0,rate=+r.querySelector('.tax').value||0;const v=q*p,dd=v*d/100,n=v-dd;return{item_id:x.id,qty:q,price:p,discount_rate:d,discount_amount:dd,tax_rate:rate/100,tax_amount:n*rate/100};});if(rs.some(x=>x.qty<=0||x.price<0))return msg('راجع الكميات والأسعار','bad');const subtotal=rs.reduce((s,x)=>s+x.qty*x.price-x.discount_amount,0),tax=rs.reduce((s,x)=>s+x.tax_amount,0),total=subtotal+tax;const h=await sb.from('sales').insert({invoice_no:$('docno').value==='New'?null:$('docno').value||null,customer_id:+customer,site_id:site,sale_date:$('date').value,subtotal,tax,total,status:'draft',created_by:user.id,withholding_tax:0}).select().single();if(h.error)throw h.error;const l=await sb.from('sale_lines').insert(rs.map(x=>({sale_id:h.data.id,item_id:x.item_id,qty:x.qty,unit_price:x.price,discount_rate:x.discount_rate,discount_amount:x.discount_amount,tax_rate:x.tax_rate,tax_amount:x.tax_amount})));if(l.error)throw l.error;msg('تم حفظ الفاتورة كمسودة ✓ — لم يتم خصم المخزون حتى الترحيل','ok');$('docno').value=h.data.invoice_no||h.data.id.slice(0,8);history.replaceState(null,'',location.pathname+'?edit='+encodeURIComponent(h.data.id));}catch(e){msg(e.message||e,'bad')}};
 addSaleLine();calcSale();
}
function buildSave(t){
 const isP=t.startsWith('purchase'), isR=t.includes('return');
 if(t==='sale-return-save'){ return buildSaleReturn(); }
 const partyParam=new URLSearchParams(location.search).get(isP?'supplier_id':'customer_id');
 let party=isP?'<label>المورد<select id="party">'+opts(suppliers,x=>x.name)+'</select></label>':'<label>العميل<select id="party">'+opts(customers,x=>x.name)+'</select></label>';
 let rows='<tr><td><select class="item" onchange="itemChanged(this)">'+opts(items,x=>x.name_ar+' — '+x.sku)+'</select></td><td class="unit">-</td><td><input class="qty" type="number" min=".001" step=".001" value="1"></td><td><input class="price" type="number" min="0" step=".01" value="0"></td><td><input class="tax" type="number" min="0" step=".01" value="0"></td><td class="lineTotal">0.00</td><td><button onclick="this.parentElement.parentElement.remove()">حذف</button></td></tr>';
 shell('<div class="card"><h1 id="title"></h1><p>الحفظ يسجل المستند كمسودة فقط.</p><div class="head"><label>رقم المستند<input id="docno"></label><label>التاريخ<input id="date" type="date" value="'+today()+'"></label>'+party+'<label>الموقع<select id="site">'+opts(sites,x=>x.name_ar)+'</select></label></div><table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الضريبة</th><th>الإجمالي</th><th>إجراء</th></tr></thead><tbody id="lines">'+rows+'</tbody></table><button onclick="addLine()">+ إضافة صنف</button><button class="ok" onclick="saveDraft()">💾 حفظ فقط</button><div id="invoiceSummary"><div class="card"><b>قيمة الفاتورة</b><div id="invoiceValue">0.00</div></div><div class="card"><b>إجمالي الضريبة</b><div id="invoiceTax">0.00</div></div><div class="card"><b>إجمالي الفاتورة</b><div id="invoiceTotal">0.00</div></div></div><a class="btn" href="'+(isP?(isR?'purchase-return-post.html':'purchase-post.html'):(isR?'sale-return-post.html':'sale-post.html'))+'">📤 شاشة الترحيل</a><div id="msg"></div></div>');
 if(partyParam){const ps=document.getElementById('party');if(ps&&[...ps.options].some(o=>o.value===partyParam)){ps.value=partyParam;ps.disabled=true;}}
 window.addLine=()=>{$('lines').insertAdjacentHTML('beforeend',rows);const n=$('lines').lastElementChild?.querySelector('.item');if(n)itemChanged(n);updateInvoiceSummary()};
 window.itemChanged=el=>{const tr=el.closest('tr'),x=items.find(i=>i.id===el.value);if(!x)return;tr.querySelector('.unit').textContent=(units.find(u=>u.id===x.unit_id)?.name_ar||'-');tr.querySelector('.price').value=Number((isP?x.purchase_price:x.sale_price)||0).toFixed(2);tr.querySelector('.tax').value=(Number(x.tax_rate||0)*100).toFixed(2);calcPurchaseLine(tr.querySelector('.price'))};
 window.updateInvoiceSummary=()=>{let value=0,tax=0;document.querySelectorAll('#lines tr').forEach(tr=>{const q=Number(tr.querySelector('.qty')?.value||0),p=Number(tr.querySelector('.price')?.value||0),rate=Number(tr.querySelector('.tax')?.value||0);value+=q*p;tax+=q*p*rate/100});$('invoiceValue').textContent=value.toFixed(2);$('invoiceTax').textContent=tax.toFixed(2);$('invoiceTotal').textContent=(value+tax).toFixed(2)};
 window.calcPurchaseLine=el=>{const tr=el.closest('tr');const q=Number(tr.querySelector('.qty')?.value||0),p=Number(tr.querySelector('.price')?.value||0),tax=Number(tr.querySelector('.tax')?.value||0);tr.querySelector('.lineTotal').textContent=(q*p+q*p*tax/100).toFixed(2);updateInvoiceSummary()};
 let editingId=new URLSearchParams(location.search).get('edit');
 window.saveDraft=async()=>{try{const party=$('party').value,site=$('site').value;if(!party||!site)return msg('اختر الطرف والموقع','bad');const rs=[...document.querySelectorAll('#lines tr')].map(r=>({item_id:r.querySelector('.item').value,qty:+r.querySelector('.qty').value,price:+r.querySelector('.price').value,tax:+r.querySelector('.tax').value}));if(!rs.length||rs.some(x=>!x.item_id||x.qty<=0))return msg('راجع الأصناف والكميات','bad');const subtotal=rs.reduce((s,x)=>s+x.qty*x.price,0),taxTotal=rs.reduce((s,x)=>s+x.qty*x.price*x.tax/100,0),total=subtotal+taxTotal;let h,l;if(isP){h=await sb.from('purchases').insert({supplier_id:+party,site_id:site,purchase_date:$('date').value,subtotal,tax:taxTotal,total,status:'draft',created_by:user.id}).select().single();if(h.error)throw h.error;l=await sb.from('purchase_lines').insert(rs.map(x=>({purchase_id:h.data.id,item_id:x.item_id,qty:x.qty,unit_cost:x.price,tax_rate:x.tax/100,tax_amount:x.qty*x.price*x.tax/100})));}if(l?.error)throw l.error;msg('تم الحفظ كمسودة ✓','ok')}catch(e){msg(e.message||e,'bad')}};
}
function buildSaleReturn(){
 const partyParam=new URLSearchParams(location.search).get('customer_id');
 shell('<div class="card sale-return-card"><div class="invoice-title"><h1>مرتجع مبيعات</h1><span class="small">مرتجع عميل</span></div><div class="header-grid"><div class="field"><label>رقم المرتجع<input id="docno" placeholder="يُنشأ تلقائيًا"></label></div><div class="field"><label>التاريخ<input id="date" type="date" value="'+today()+'"></label></div><div class="field"><label>المخزن<select id="site">'+opts(sites,x=>x.name_ar)+'</select></label></div><div class="field"><label>العميل<select id="party">'+opts(customers,x=>x.name)+'</select></label></div><div class="field"><label>الرصيد<input id="partyBalance" value="0.00" readonly></label></div><div class="field notes"><label>ملاحظات<textarea id="notes" placeholder="ملاحظات المرتجع..."></textarea></label></div></div><div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>سعر البيع</th><th>الرصيد</th><th>التكلفة</th><th>إجمالي التكلفة</th><th>نسبة الخصم</th><th>قيمة الخصم</th><th>القيمة</th><th>نسبة الضريبة</th><th>قيمة الضريبة</th><th>الإجمالي</th><th>حذف</th></tr></thead><tbody id="lines"></tbody></table><div class="add-row" onclick="addReturnLine()">＋ إضافة بند</div></div><div class="totals"><div class="total-box"><b>تكلفة المرتجع</b><div id="invoiceCost">0.00</div></div><div class="total-box"><b>قيمة الخصم</b><div id="discountTotal">0.00</div></div><div class="total-box"><b>قيمة المرتجع</b><div id="invoiceValue">0.00</div></div><div class="total-box"><b>قيمة الضريبة</b><div id="invoiceTax">0.00</div></div><div class="total-box net"><b>إجمالي المرتجع</b><div id="invoiceTotal">0.00</div></div></div><div class="actions"><button class="save" onclick="saveReturnDraft()">💾 حفظ مسودة</button><button class="approve" onclick="location.href=\'sale-return-post.html\'">📤 الترحيل</button><button onclick="window.print()">🖨 طباعة</button><button onclick="location.href=\'sale-return-save.html\'">📄 مرتجع جديد</button></div><div id="msg"></div></div>');
 if(partyParam){const ps=$('party');if(ps&&[...ps.options].some(o=>o.value===partyParam))ps.value=partyParam;}
 window.returnRow=()=>'<tr><td><select class="item" onchange="returnItemChanged(this)">'+opts(items,x=>x.name_ar)+'</select></td><td class="unit">-</td><td><input class="qty" type="number" min=".001" step=".001" value="1" oninput="calcReturn()"></td><td><input class="price" type="number" min="0" step=".01" value="0" oninput="calcReturn()"></td><td><input class="stock" value="0.00" readonly></td><td><input class="cost" value="0.00" readonly></td><td class="lineCost">0.00</td><td><input class="disc" type="number" min="0" max="100" step=".01" value="0" oninput="calcReturn()"></td><td class="discValue">0.00</td><td class="value">0.00</td><td><input class="tax" value="0.00" readonly></td><td class="taxValue">0.00</td><td class="lineTotal">0.00</td><td><button onclick="this.closest(\'tr\').remove();calcReturn()">🗑</button></td></tr>';
 window.addReturnLine=()=>{$('lines').insertAdjacentHTML('beforeend',returnRow());const s=$('lines').lastElementChild.querySelector('.item');returnItemChanged(s);s.focus()};
 window.returnItemChanged=async el=>{const tr=el.closest('tr'),x=items.find(i=>i.id===el.value);if(!x)return;tr.querySelector('.unit').textContent=(units.find(u=>u.id===x.unit_id)?.name_ar||'-');tr.querySelector('.price').value=Number(x.sale_price||0).toFixed(2);tr.querySelector('.tax').value=(Number(x.tax_rate||0)*100).toFixed(2);tr.querySelector('.cost').value=Number(x.purchase_price||0).toFixed(2);tr.querySelector('.stock').value='0.00';const site=$('site').value;if(site){const q=await sb.from('inventory_costs').select('qty_on_hand,weighted_avg_cost').eq('item_id',x.id).eq('site_id',site).maybeSingle();if(q.data){tr.querySelector('.stock').value=Number(q.data.qty_on_hand||0).toFixed(3);tr.querySelector('.cost').value=Number(q.data.weighted_avg_cost||x.purchase_price||0).toFixed(2)}}calcReturn()};
 window.calcReturn=()=>{let cost=0,disc=0,value=0,tax=0,total=0;document.querySelectorAll('#lines tr').forEach(tr=>{const q=Number(tr.querySelector('.qty')?.value||0),p=Number(tr.querySelector('.price')?.value||0),d=Number(tr.querySelector('.disc')?.value||0),rate=Number(tr.querySelector('.tax')?.value||0),co=Number(tr.querySelector('.cost')?.value||0),gross=q*p,dd=gross*d/100,n=gross-dd,tx=n*rate/100;cost+=q*co;disc+=dd;value+=n;tax+=tx;total+=n+tx;tr.querySelector('.lineCost').textContent=(q*co).toFixed(2);tr.querySelector('.discValue').textContent=dd.toFixed(2);tr.querySelector('.value').textContent=n.toFixed(2);tr.querySelector('.taxValue').textContent=tx.toFixed(2);tr.querySelector('.lineTotal').textContent=(n+tx).toFixed(2)});$('invoiceCost').textContent=cost.toFixed(2);$('discountTotal').textContent=disc.toFixed(2);$('invoiceValue').textContent=value.toFixed(2);$('invoiceTax').textContent=tax.toFixed(2);$('invoiceTotal').textContent=total.toFixed(2)};
 window.saveReturnDraft=async()=>{try{const customer=$('party').value,site=$('site').value;if(!customer||!site)return msg('اختر العميل والمخزن','bad');const rs=[...document.querySelectorAll('#lines tr')].map(r=>{const item=items.find(i=>i.id===r.querySelector('.item').value),q=+r.querySelector('.qty').value,p=+r.querySelector('.price').value,d=+r.querySelector('.disc').value,co=+r.querySelector('.cost').value,rate=+r.querySelector('.tax').value,gross=q*p,discount=gross*d/100,sub=gross-discount,tax=sub*rate/100;return {item_id:item.id,qty:q,unit_price:p,unit_cost:co,discount_rate:d,discount_amount:discount,tax_rate:rate/100,tax_amount:tax}});if(!rs.length||rs.some(x=>x.qty<=0))return msg('راجع الأصناف والكميات','bad');const subtotal=rs.reduce((s,x)=>s+x.qty*x.unit_price-x.discount_amount,0),discount_total=rs.reduce((s,x)=>s+x.discount_amount,0),tax=rs.reduce((s,x)=>s+x.tax_amount,0),total=subtotal+tax;const cust=customers.find(x=>String(x.id)===String(customer));const withholdingRate= cust?.withholding_enabled ? Number(cust.withholding_rate||0) : 0;const withholding=total*withholdingRate/100;let h,l;const editingId=new URLSearchParams(location.search).get('edit');if(editingId){h=await sb.from('sales_returns').update({customer_id:+customer,site_id:site,return_date:$('date').value,subtotal,tax,discount_total,total,withholding_tax:withholding}).eq('id',editingId).eq('status','draft').select().single();if(h.error)throw h.error;l=await sb.from('sales_return_lines').delete().eq('return_id',editingId);if(l.error)throw l.error;l=await sb.from('sales_return_lines').insert(rs.map(x=>({...x,return_id:editingId})));}else{h=await sb.from('sales_returns').insert({customer_id:+customer,site_id:site,return_date:$('date').value,subtotal,tax,discount_total,total,withholding_tax:withholding,status:'draft',created_by:user.id}).select().single();if(h.error)throw h.error;l=await sb.from('sales_return_lines').insert(rs.map(x=>({...x,return_id:h.data.id})));}if(l.error)throw l.error;msg('تم حفظ مرتجع المبيعات كمسودة ✓','ok')}catch(e){msg(e.message||e,'bad')}}; addReturnLine();
}

async function loadDraftForEdit(id){try{const wf=document.body.dataset.workflow,isR=wf.includes('return'),isP=wf.startsWith('purchase'),normal=!isR;const table=normal?(isP?'purchases':'sales'):(isP?'purchase_returns':'sales_returns'),dateCol=normal?(isP?'purchase_date':'sale_date'):'return_date',rel=isP?'suppliers(name)':'customers(name)';const h=await sb.from(table).select('*, '+rel).eq('id',id).eq('status','draft').single();if(h.error||!h.data)throw Error('المسودة غير موجودة أو تم ترحيلها');const x=h.data;$('docno').value=normal?(x.invoice_no||''):(x.return_no||'');$('date').value=x[dateCol]||today();$('party').value=isP?x.supplier_id:x.customer_id;$('site').value=x.site_id;const lineTable=normal?(isP?'purchase_lines':'sale_lines'):(isP?'purchase_return_lines':'sales_return_lines'),fk=normal?(isP?'purchase_id':'sale_id'):'return_id';const lr=await sb.from(lineTable).select('*').eq(fk,id);if(lr.error)throw lr.error;const ls=lr.data||[];if(ls.length){$('lines').innerHTML='';for(const z of ls){$('lines').insertAdjacentHTML('beforeend',normal?'<tr><td><select class="item" onchange="itemChanged(this)">'+opts(items,x=>x.name_ar+' — '+x.sku)+'</select></td><td class="unit">-</td><td><input class="qty" type="number" min=".001" step=".001" value="1" oninput="calcPurchaseLine(this)"></td><td><input class="lastPrice" type="number" step=".01" readonly></td><td><input class="price" type="number" min="0" step=".01" value="0" oninput="calcPurchaseLine(this)"></td><td><input class="tax" type="number" min="0" step=".01" value="0" readonly></td><td class="unitTax">0.00</td><td class="taxValue">0.00</td><td class="lineTotal">0.00</td><td><button onclick="this.closest(\'tr\').remove();updateInvoiceSummary()">حذف</button></td></tr>':'<tr><td><select class="item">'+opts(items,x=>x.name_ar+' — '+x.sku)+'</select></td><td><input class="qty" type="number" min=".001" step=".001" value="1"></td><td><input class="price" type="number" min="0" step=".01" value="0"></td><td><input class="cost" type="number" min="0" step=".01" value="0"></td><td><button onclick="this.closest(\'tr\').remove()">حذف</button></td></tr>');const tr=$('lines').lastElementChild,sel=tr.querySelector('.item');sel.value=z.item_id;if(normal){itemChanged(sel);tr.querySelector('.qty').value=z.qty;tr.querySelector('.price').value=isP?z.unit_cost:z.unit_price;calcPurchaseLine(tr.querySelector('.price'));}else{tr.querySelector('.qty').value=z.qty;tr.querySelector('.price').value=isP?z.unit_cost:z.unit_price;tr.querySelector('.cost').value=z.unit_cost;}}}const ttl=document.getElementById('title');if(ttl)ttl.textContent='✏️ تعديل '+(isR?(isP?'مردود مشتريات':'مرتجع مبيعات'):(isP?'فاتورة مشتريات':'فاتورة مبيعات'));const b=document.querySelector('button.ok');if(b)b.textContent='💾 حفظ التعديل';}catch(e){msg(e.message||e,'bad')}}function msg(s,c){$('msg').innerHTML='<div class="msg '+c+'">'+esc(s)+'</div>'}
async function acct(code,name,type){let a=accounts.find(x=>x.code===code);if(a)return a;const r=await sb.from('coa_accounts').insert({code,name_ar:name,account_type:type,is_postable:true,active:true}).select().single();if(r.error)throw r.error;accounts.push(r.data);return r.data}
async function journal(source,id,date,desc,lines){const e=await sb.from('journal_entries').insert({entry_date:date,source_type:source,source_id:id,description:desc,posted:true,created_by:user.id}).select().single();if(e.error)throw e.error;const r=await sb.from('journal_lines').insert(lines.map(x=>({...x,entry_id:e.data.id})));if(r.error)throw r.error}
async function postPurchase(id){const h=(await sb.from('purchases').select('*').eq('id',id).single()).data,ls=(await sb.from('purchase_lines').select('*').eq('purchase_id',id)).data||[];if(!h||h.status!=='draft')throw Error('المستند غير موجود أو مرحل');let sub=0,tax=0;for(const x of ls){const net=x.qty*x.unit_cost-x.discount_amount;sub+=net;tax+=x.tax_amount;const uc=net/x.qty;const lot=await sb.from('inv_lots').insert({item_id:x.item_id,site_id:h.site_id,batch_no:x.batch_no,expiry_date:x.expiry_date,qty_on_hand:x.qty,unit_cost:uc,supplier_invoice_no:h.invoice_no,received_at:new Date().toISOString()}).select().single();if(lot.error)throw lot.error;const mv=await sb.from('inv_movements').insert({item_id:x.item_id,site_id:h.site_id,lot_id:lot.data.id,movement_type:'receipt',qty:x.qty,unit_cost:uc,reference_type:'purchase',reference_id:id,notes:'ترحيل فاتورة مشتريات',created_by:user.id});if(mv.error)throw mv.error;const old=(await sb.from('inventory_costs').select('*').eq('item_id',x.item_id).eq('site_id',h.site_id).maybeSingle()).data;const q=+(old?.qty_on_hand||0),v=+(old?.inventory_value||0),nq=q+x.qty,nv=v+net;const cu=await sb.from('inventory_costs').upsert({item_id:x.item_id,site_id:h.site_id,qty_on_hand:nq,inventory_value:nv,weighted_avg_cost:nq?nv/nq:0,updated_at:new Date().toISOString()},{onConflict:'item_id,site_id'});if(cu.error)throw cu.error}const inv=await acct('1310','مخزون بضائع','asset'),sup=await acct('2120','الموردون','liability');const j=[{account_id:inv.id,debit:sub,credit:0,description:'مخزون المشتريات',site_id:h.site_id}];if(tax)j.push({account_id:(await acct('1230','ضريبة القيمة المضافة - مدخلات','asset')).id,debit:tax,credit:0,description:'ضريبة مشتريات',site_id:h.site_id});j.push({account_id:sup.id,debit:0,credit:h.total,description:'استحقاق المورد',site_id:h.site_id});await journal('purchase',id,h.purchase_date,'ترحيل مشتريات '+(h.invoice_no||''),j);await sb.from('purchases').update({status:'posted'}).eq('id',id)}
async function postSale(id){const h=(await sb.from('sales').select('*').eq('id',id).single()).data,ls=(await sb.from('sale_lines').select('*').eq('sale_id',id)).data||[];if(!h||h.status!=='draft')throw Error('المستند غير موجود أو مرحل');let cogs=0;for(const x of ls){const old=(await sb.from('inventory_costs').select('*').eq('item_id',x.item_id).eq('site_id',h.site_id).maybeSingle()).data;const q=+(old?.qty_on_hand||0),v=+(old?.inventory_value||0),w=+(old?.weighted_avg_cost||0);if(q<x.qty)throw Error('الرصيد غير كافٍ للصنف');cogs+=x.qty*w;let rem=x.qty;const lots=(await sb.from('inv_lots').select('*').eq('item_id',x.item_id).eq('site_id',h.site_id).gt('qty_on_hand',0).order('expiry_date',{ascending:true})).data||[];for(const l of lots){if(rem<=0)break;const take=Math.min(rem,+l.qty_on_hand);const up=await sb.from('inv_lots').update({qty_on_hand:+l.qty_on_hand-take}).eq('id',l.id);if(up.error)throw up.error;const mv=await sb.from('inv_movements').insert({item_id:x.item_id,site_id:h.site_id,lot_id:l.id,movement_type:'issue',qty:take,unit_cost:w,reference_type:'sale',reference_id:id,notes:'ترحيل مبيعات FEFO',created_by:user.id});if(mv.error)throw mv.error;rem-=take}const cu=await sb.from('inventory_costs').upsert({item_id:x.item_id,site_id:h.site_id,qty_on_hand:q-x.qty,inventory_value:Math.max(0,v-x.qty*w),weighted_avg_cost:q-x.qty?(v-x.qty*w)/(q-x.qty):0,updated_at:new Date().toISOString()},{onConflict:'item_id,site_id'});if(cu.error)throw cu.error}const ar=await acct('1320','العملاء','asset'),rev=await acct('4100','المبيعات','revenue'),inv=await acct('1310','مخزون بضائع','asset'),cg=await acct('5100','تكلفة البضاعة المباعة','expense');const withholding=+h.withholding_tax||0,netReceivable=+h.total-withholding;const j=[{account_id:ar.id,debit:netReceivable,credit:0,description:'استحقاق العميل بعد خصم المنبع',site_id:h.site_id},{account_id:rev.id,debit:0,credit:h.subtotal,description:'المبيعات',site_id:h.site_id},{account_id:cg.id,debit:cogs,credit:0,description:'تكلفة المبيعات',site_id:h.site_id},{account_id:inv.id,debit:0,credit:cogs,description:'تخفيض المخزون',site_id:h.site_id}];if(+h.tax)j.push({account_id:(await acct('2220','ضريبة القيمة المضافة - مخرجات','liability')).id,debit:0,credit:h.tax,description:'ضريبة مبيعات',site_id:h.site_id});if(withholding)j.push({account_id:(await acct('1350','ضريبة خصم من المنبع','asset')).id,debit:withholding,credit:0,description:'ضريبة خصم من المنبع',site_id:h.site_id});await journal('sale',id,h.sale_date,'ترحيل مبيعات '+(h.invoice_no||''),j);await sb.from('sales').update({status:'posted'}).eq('id',id)}
async function postPurchaseReturn(id){
 const hr=await sb.from('purchase_returns').select('*').eq('id',id).single();if(hr.error)throw hr.error;
 const h=hr.data;if(!h||h.status!=='draft')throw Error('المستند غير موجود أو مرحل');
 const lr=await sb.from('purchase_return_lines').select('*').eq('return_id',id);if(lr.error)throw lr.error;
 const ls=lr.data||[];if(!ls.length)throw Error('مردود المشتريات لا يحتوي على بنود.');
 const sourceIds=[...new Set(ls.map(x=>x.source_purchase_line_id||x.purchase_line_id).filter(Boolean))];
 if(sourceIds.length!==ls.length)throw Error('لا يمكن ترحيل المردود: يوجد بند غير مرتبط ببند من فاتورة الشراء الأصلية.');
 const sr=await sb.from('purchase_lines').select('id,purchase_id,item_id,qty,unit_cost,discount_rate,discount_amount,tax_rate,tax_amount,line_total').in('id',sourceIds);if(sr.error)throw sr.error;
 const selectedLines=sr.data||[];if(selectedLines.length!==sourceIds.length)throw Error('تعذر العثور على بند من فاتورة الشراء الأصلية.');
 const purchaseIds=[...new Set(selectedLines.map(x=>x.purchase_id))];
 const phr=await sb.from('purchases').select('id,status,site_id,supplier_id,invoice_no').in('id',purchaseIds);if(phr.error)throw phr.error;
 const purchaseMap=new Map((phr.data||[]).map(x=>[x.id,x]));
 for(const p of selectedLines){const ph=purchaseMap.get(p.purchase_id);if(!ph||ph.status!=='posted')throw Error('لا يمكن ترحيل المرتجع إلا على فاتورة شراء أصلية مُرحّلة.');if(ph.site_id!==h.site_id||String(ph.supplier_id)!==String(h.supplier_id))throw Error('المورد أو المخزن لا يطابق فاتورة الشراء الأصلية.');}
 const allLinesResult=await sb.from('purchase_lines').select('id,purchase_id,item_id,qty,unit_cost,discount_rate,discount_amount,tax_rate,tax_amount,line_total').in('purchase_id',purchaseIds);if(allLinesResult.error)throw allLinesResult.error;
 const allSourceLines=allLinesResult.data||[],allSourceIds=allSourceLines.map(x=>x.id);
 const mv=await sb.from('inv_movements').select('reference_id,item_id,qty,site_id').eq('movement_type','receipt').eq('reference_type','purchase').eq('site_id',h.site_id).in('reference_id',purchaseIds);
 if(mv.error)throw Error('تعذر التحقق من الاستلام الفعلي للمشتريات: '+mv.error.message);
 const received={};for(const m of mv.data||[]){const k=m.reference_id+'|'+m.item_id;received[k]=(received[k]||0)+Number(m.qty||0)}
 const priorLines=allSourceIds.length?await sb.from('purchase_return_lines').select('return_id,source_purchase_line_id,qty').in('source_purchase_line_id',allSourceIds):{data:[],error:null};
 if(priorLines.error)throw priorLines.error;
 const priorReturnIds=[...new Set((priorLines.data||[]).map(x=>x.return_id))];
 const postedHeaders=priorReturnIds.length?await sb.from('purchase_returns').select('id').eq('status','posted').in('id',priorReturnIds):{data:[],error:null};
 if(postedHeaders.error)throw postedHeaders.error;
 const postedIds=new Set((postedHeaders.data||[]).map(x=>x.id));
 const sourceMap=new Map(allSourceLines.map(x=>[x.id,x])),returned={};
 for(const r of priorLines.data||[]){if(!postedIds.has(r.return_id))continue;const source=sourceMap.get(r.source_purchase_line_id);if(!source)continue;const k=source.purchase_id+'|'+source.item_id;returned[k]=(returned[k]||0)+Number(r.qty||0)}
 const current={},currentBySource={};let calculatedTotal=0;
 const roundMoney=n=>Math.round((Number(n)||0)*100)/100;
 for(const x of ls){
  const source=sourceMap.get(x.source_purchase_line_id||x.purchase_line_id);if(!source)throw Error('يوجد بند مرتجع غير مرتبط بالفاتورة الأصلية.');
  const qty=Number(x.qty||0),sourceQty=Number(source.qty||0);if(qty<=0)throw Error('كمية بند المرتجع يجب أن تكون أكبر من صفر.');
  const sourceKey=source.id;currentBySource[sourceKey]=(currentBySource[sourceKey]||0)+qty;
  const gross=roundMoney(qty*Number(source.unit_cost||0));
  const discount=sourceQty>0?roundMoney(Number(source.discount_amount||0)*qty/sourceQty):roundMoney(gross*Number(source.discount_rate||0)/100);
  const net=roundMoney(gross-discount);
  const tax=sourceQty>0?roundMoney(Number(source.tax_amount||0)*qty/sourceQty):roundMoney(net*Number(source.tax_rate||0));
  const lineTotal=roundMoney(net+tax);
  if(Math.abs(Number(x.discount_amount||0)-discount)>0.02||Math.abs(Number(x.tax_amount||0)-tax)>0.02||Math.abs(Number(x.line_total||0)-lineTotal)>0.02||Math.abs(Number(x.unit_cost||0)-Number(source.unit_cost||0))>0.001)
   throw Error('تم إيقاف الترحيل: قيم الخصم أو الضريبة أو الإجمالي لا تطابق فاتورة الشراء الأصلية. احفظ المرتجع من جديد بعد تحديث الشاشة.');
  calculatedTotal+=lineTotal;
  const k=source.purchase_id+'|'+source.item_id;current[k]=(current[k]||0)+qty;
 }
 for(const [sourceId,qty] of Object.entries(currentBySource)){const source=sourceMap.get(sourceId);if(qty>Number(source.qty||0))throw Error('إجمالي الكمية المرتجعة من بند الفاتورة الأصلية أكبر من الكمية المشتراة.');}
 if(Math.abs(Number(h.total||0)-roundMoney(calculatedTotal))>0.02)throw Error('تم إيقاف الترحيل: إجمالي رأس المرتجع لا يساوي مجموع البنود.');
 for(const [k,qty] of Object.entries(current)){const available=Math.max(0,(received[k]||0)-(returned[k]||0));if(available<=0||qty>available)throw Error('تم إيقاف الترحيل: الكمية المرتجعة أكبر من الكمية المستلمة فعليًا. المتاح لهذا الصنف من الفاتورة الأصلية '+available.toFixed(3)+'.')}
 const required={};for(const x of ls)required[x.item_id]=(required[x.item_id]||0)+Number(x.qty||0);
 const costInfo={};
 // فحص المخزون والتكلفة لكل صنف قبل إجراء أي خصم.
 for(const [itemId,qty] of Object.entries(required)){
  const lotsResult=await sb.from('inv_lots').select('qty_on_hand').eq('item_id',itemId).eq('site_id',h.site_id).gt('qty_on_hand',0);if(lotsResult.error)throw lotsResult.error;
  const lotsQty=(lotsResult.data||[]).reduce((sum,l)=>sum+Number(l.qty_on_hand||0),0);
  const costResult=await sb.from('inventory_costs').select('qty_on_hand,inventory_value,weighted_avg_cost').eq('item_id',itemId).eq('site_id',h.site_id).maybeSingle();if(costResult.error)throw costResult.error;
  const old=costResult.data,q=Number(old?.qty_on_hand||0),v=Number(old?.inventory_value||0),avg=Number(old?.weighted_avg_cost||0)||(q?v/q:0);
  if(lotsQty<qty||q<qty)throw Error('الرصيد المخزني غير كافٍ لترحيل المردود. المتاح للصنف '+Math.min(lotsQty,q).toFixed(3)+'.');
  costInfo[itemId]={qty:q,value:v,avg,returnCost:qty*avg};
 }
 // إخراج الكميات من التشغيلات، مع تقييم حركة المردود بمتوسط التكلفة المرجح.
 for(const [itemId,qty] of Object.entries(required)){
  let rem=qty;
  const lotsResult=await sb.from('inv_lots').select('*').eq('item_id',itemId).eq('site_id',h.site_id).gt('qty_on_hand',0).order('expiry_date',{ascending:true});if(lotsResult.error)throw lotsResult.error;
  for(const l of lotsResult.data||[]){if(rem<=0)break;const take=Math.min(rem,Number(l.qty_on_hand||0));const upd=await sb.from('inv_lots').update({qty_on_hand:Number(l.qty_on_hand||0)-take}).eq('id',l.id);if(upd.error)throw upd.error;const movement=await sb.from('inv_movements').insert({item_id:itemId,site_id:h.site_id,lot_id:l.id,movement_type:'supplier_return',qty:take,unit_cost:costInfo[itemId].avg,reference_type:'purchase_return',reference_id:id,notes:'ترحيل مردود مشتريات — متوسط التكلفة المرجح',created_by:user.id});if(movement.error)throw movement.error;rem-=take}
  const old=costInfo[itemId],nq=old.qty-qty,nv=Math.max(0,old.value-old.returnCost);
  const costUpdate=await sb.from('inventory_costs').upsert({item_id:itemId,site_id:h.site_id,qty_on_hand:nq,inventory_value:nv,weighted_avg_cost:nq?nv/nq:0,updated_at:new Date().toISOString()},{onConflict:'item_id,site_id'});if(costUpdate.error)throw costUpdate.error;
 }
 const supplierTotal=Number(h.total||ls.reduce((sum,x)=>sum+Number(x.line_total||0),0));
 const taxTotal=ls.reduce((sum,x)=>sum+Number(x.tax_amount||0),0);
 const supplierNet=supplierTotal-taxTotal;
 const stockCost=roundMoney(Object.values(costInfo).reduce((sum,x)=>sum+x.returnCost,0));
 const variance=roundMoney(supplierNet-stockCost);
 const sup=await acct('2120','الموردون','liability'),inv=await acct('1310','مخزون بضائع','asset');
 const journalLines=[
  {account_id:sup.id,debit:supplierTotal,credit:0,description:'خفض مستحق المورد بسعر فاتورة المرتجع',site_id:h.site_id},
  {account_id:inv.id,debit:0,credit:stockCost,description:'تخفيض المخزون بمتوسط التكلفة المرجح',site_id:h.site_id}
 ];
 if(taxTotal>0){const vat=await acct('1230','ضريبة القيمة المضافة - مدخلات','asset');journalLines.push({account_id:vat.id,debit:0,credit:taxTotal,description:'عكس ضريبة مدخلات المشتريات المرتجعة',site_id:h.site_id})}
 if(Math.abs(variance)>0.005){const varAcct=await acct('5310','فروق أسعار مردودات المشتريات','expense');journalLines.push({account_id:varAcct.id,debit:variance<0?Math.abs(variance):0,credit:variance>0?variance:0,description:'فرق سعر مردود المشتريات عن متوسط التكلفة',site_id:h.site_id})}
 await journal('purchase_return',id,h.return_date,'مردود مشتريات',journalLines);
 const update=await sb.from('purchase_returns').update({status:'posted'}).eq('id',id).eq('status','draft');if(update.error)throw update.error;
}async function postSaleReturn(id){const h=(await sb.from('sales_returns').select('*').eq('id',id).single()).data,ls=(await sb.from('sales_return_lines').select('*').eq('return_id',id)).data||[];if(!h||h.status!=='draft')throw Error('المستند غير موجود أو مرحل');let cost=0;for(const x of ls){cost+=x.qty*x.unit_cost;const lot=await sb.from('inv_lots').insert({item_id:x.item_id,site_id:h.site_id,qty_on_hand:x.qty,unit_cost:x.unit_cost,received_at:new Date().toISOString()}).select().single();if(lot.error)throw lot.error;await sb.from('inv_movements').insert({item_id:x.item_id,site_id:h.site_id,lot_id:lot.data.id,movement_type:'receipt',qty:x.qty,unit_cost:x.unit_cost,reference_type:'sale_return',reference_id:id,notes:'ترحيل مرتجع مبيعات',created_by:user.id});const old=(await sb.from('inventory_costs').select('*').eq('item_id',x.item_id).eq('site_id',h.site_id).maybeSingle()).data,q=+(old?.qty_on_hand||0),v=+(old?.inventory_value||0),nq=q+x.qty,nv=v+x.qty*x.unit_cost;await sb.from('inventory_costs').upsert({item_id:x.item_id,site_id:h.site_id,qty_on_hand:nq,inventory_value:nv,weighted_avg_cost:nq?nv/nq:0,updated_at:new Date().toISOString()},{onConflict:'item_id,site_id'})}const cust=await acct('1320','العملاء','asset'),ret=await acct('4200','مرتجعات المبيعات','revenue'),inv=await acct('1310','مخزون بضائع','asset'),cg=await acct('5100','تكلفة البضاعة المباعة','expense'),vat=await acct('2200','ضريبة القيمة المضافة','liability'),wh=await acct('1350','ضريبة خصم من المنبع','asset');const netReceivable=Number(h.total||0)-Number(h.withholding_tax||0);const lines=[{account_id:ret.id,debit:Number(h.subtotal||h.total||0),credit:0,description:'مرتجع مبيعات',site_id:h.site_id},{account_id:cust.id,debit:0,credit:netReceivable,description:'خفض مستحق العميل',site_id:h.site_id},{account_id:inv.id,debit:cost,credit:0,description:'إعادة المخزون',site_id:h.site_id},{account_id:cg.id,debit:0,credit:cost,description:'عكس تكلفة المبيعات',site_id:h.site_id}];if(Number(h.tax||0)>0)lines.push({account_id:vat.id,debit:Number(h.tax||0),credit:0,description:'عكس ضريبة المبيعات',site_id:h.site_id});if(Number(h.withholding_tax||0)>0)lines.push({account_id:wh.id,debit:0,credit:Number(h.withholding_tax||0),description:'عكس خصم من المنبع',site_id:h.site_id});await journal('sale_return',id,h.return_date,'مرتجع مبيعات',lines);await sb.from('sales_returns').update({status:'posted'}).eq('id',id)}
async function buildSaved(t){
 const isR=t.includes('-return-saved'),isP=t.startsWith('purchase'),table=isR?(isP?'purchase_returns':'sales_returns'):(isP?'purchases':'sales'),lineTable=isR?(isP?'purchase_return_lines':'sales_return_lines'):(isP?'purchase_lines':'sale_lines'),dateCol=isR?'return_date':(isP?'purchase_date':'sale_date'),rel=isP?'suppliers(name)':'customers(name)',savePage=isR?(isP?'purchase-return-save.html':'sale-return-save.html'):(isP?'purchase-save.html':'sale-save.html'),postPage=isR?(isP?'purchase-return-post.html':'sale-return-post.html'):(isP?'purchase-post.html':'sale-post.html'),title=isR?(isP?'مردودات المشتريات المحفوظة':'مرتجعات المبيعات المحفوظة'):(isP?'المشتريات المحفوظة':'المبيعات المحفوظة');
 shell('<div class="card"><h1>📋 '+title+'</h1><p>المستندات المحفوظة كمسودات ولم يتم ترحيلها.</p><button id="refreshSaved">🔄 تحديث</button><div id="savedMsg"></div><table><thead><tr><th>رقم المستند</th><th>التاريخ</th><th>الطرف</th><th>القيمة</th><th>الضريبة</th><th>الإجمالي</th><th>إجراءات</th></tr></thead><tbody id="savedBody"><tr><td colspan="7">جاري التحميل...</td></tr></tbody></table></div>');
 function show(s,c){$('savedMsg').innerHTML='<div class="msg '+c+'">'+esc(s)+'</div>'}
 window.loadSaved=async function(){
  $('savedBody').innerHTML='<tr><td colspan="7">جاري تحميل المسودات...</td></tr>';$('savedMsg').innerHTML='';
  try{
   let q=sb.from(table).select('*, '+rel).eq('status','draft');
   const partyParam=new URLSearchParams(location.search).get(isP?'supplier_id':'customer_id');
   if(partyParam)q=q.eq(isP?'supplier_id':'customer_id',partyParam);
   const result=await q.order(dateCol,{ascending:false});
   if(result.error)throw result.error;
   const rows=result.data||[];
   $('savedBody').innerHTML='';
   if(!rows.length){$('savedBody').innerHTML='<tr><td colspan="7">لا توجد مسودات محفوظة حاليًا.</td></tr>';return}
   rows.forEach(function(x){
    const tr=document.createElement('tr');
    const vals=[x.return_no||x.invoice_no||String(x.id).slice(0,8),x[dateCol]||'',(isP?x.suppliers?.name:x.customers?.name)||'-',Number(isR?x.total:(x.subtotal||0)).toFixed(2),Number(isR?0:(x.tax||0)).toFixed(2),Number(x.total||0).toFixed(2)];
    vals.forEach(function(v){const td=document.createElement('td');td.textContent=String(v??'');tr.appendChild(td)});
    const td=document.createElement('td');
    const open=document.createElement('button');open.textContent='فتح';open.onclick=function(){location.href=savePage+'?edit='+encodeURIComponent(x.id)};
    const post=document.createElement('button');post.textContent='ترحيل';post.className='ok';post.onclick=function(){location.href=postPage+'?select='+encodeURIComponent(x.id)};
    const del=document.createElement('button');del.textContent='حذف';del.onclick=async function(){
     if(!confirm('هل تريد إلغاء هذه المسودة؟'))return;
     const fk=isR?'return_id':(isP?'purchase_id':'sale_id');
     const d=await sb.from(lineTable).delete().eq(fk,x.id);if(d.error){show(d.error.message,'bad');return}
     const h=await sb.from(table).update({status:'cancelled'}).eq('id',x.id).eq('status','draft');if(h.error){show(h.error.message,'bad');return}
     show('تم إلغاء المسودة.','ok');await loadSaved();
    };
    td.append(open,post,del);tr.appendChild(td);$('savedBody').appendChild(tr);
   });
  }catch(e){$('savedBody').innerHTML='<tr><td colspan="7">تعذر تحميل القائمة.</td></tr>';show(e.message||String(e),'bad')}
 };
 $('refreshSaved').onclick=window.loadSaved;
 await window.loadSaved();
}
function buildPost(t){
 const isP=t.startsWith('purchase'),isR=t.includes('return'),table=isP?(isR?'purchase_returns':'purchases'):(isR?'sales_returns':'sales');
 const lineTable=isP?'purchase_return_lines':'sales_return_lines',fk='return_id';
 shell('<div class="card"><h1 id="title"></h1><p>هذه شاشة الترحيل فقط. المستندات هنا محفوظة كمسودات ولا تؤثر على المخزون أو الحسابات حتى يتم ترحيلها.</p><button id="refreshDrafts">🔄 تحديث</button><a class="btn" href="'+(isP?(isR?'purchase-return-save.html?saved=1':'purchase-save.html'):(isR?'sale-return-save.html':'sale-save.html'))+'">💾 شاشة الحفظ</a><table><thead><tr><th>تحديد</th><th>رقم</th><th>التاريخ</th><th>الطرف</th><th>المبلغ</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody id="drafts"></tbody></table><button class="ok" id="postSelectedBtn">📤 ترحيل المحدد</button><div id="msg"></div></div><div id="returnPreview" style="display:none;position:fixed;inset:0;background:#0008;z-index:99999;padding:4vh 3vw;overflow:auto"><div style="max-width:1100px;margin:auto;background:#fff;border-radius:14px;padding:22px;direction:rtl;color:#17233b"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 id="previewTitle">معاينة المرتجع</h2><button id="closeReturnPreview" type="button">✖ إغلاق</button></div><div id="previewInfo">جاري تحميل تفاصيل المستند...</div><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;margin-top:14px"><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الشراء</th><th>الخصم</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody id="previewLines"></tbody></table></div><div id="previewTotals" style="text-align:left;font-weight:bold;margin-top:14px"></div></div></div>');
 if(t==='purchase-return-post'){const nav=document.querySelector('#app .top');if(nav)nav.innerHTML='<a href="accounting.html">🏠 الرئيسية</a><button type="button" class="workflow-back" onclick="if(history.length>1)history.back();else location.href=\'accounting.html\'">↩ رجوع للشاشة السابقة</button>';}
 $('title').textContent=isR?(isP?'ترحيل مردودات المشتريات':'ترحيل مرتجعات المبيعات'):(isP?'ترحيل المشتريات':'ترحيل المبيعات');
 window.loadDrafts=async()=>{
  const body=$('drafts');body.innerHTML='<tr><td colspan="7">جاري تحميل المستندات...</td></tr>';
  try{
   let q=sb.from(table).select('*').eq('status','draft');
   const partyParam=new URLSearchParams(location.search).get(isP?'supplier_id':'customer_id');
   if(partyParam)q=q.eq(isP?'supplier_id':'customer_id',partyParam);
   const result=await q.order(isR?'return_date':isP?'purchase_date':'sale_date',{ascending:false});
   if(result.error)throw result.error;
   const rows=result.data||[];
   body.innerHTML='';
   if(!rows.length){body.innerHTML='<tr><td colspan="7">لا توجد مستندات محفوظة.</td></tr>';return}
   for(const x of rows){
    const tr=document.createElement('tr');
    const ckTd=document.createElement('td'),ck=document.createElement('input');ck.type='checkbox';ck.className='ck';ck.value=x.id;ckTd.appendChild(ck);tr.appendChild(ckTd);
    const vals=[x.invoice_no||x.return_no||String(x.id).slice(0,8),x.purchase_date||x.sale_date||x.return_date||'',isR?(isP?'مورد':'عميل'):(isP?'مورد':'عميل'),Number(x.total||0).toFixed(2),'مسودة'];
    vals.forEach((v,i)=>{const td=document.createElement('td');td.textContent=String(v??'');tr.appendChild(td)});
    const action=document.createElement('td');
    if(isP&&isR){
     const eye=document.createElement('button');eye.type='button';eye.textContent='👁️ عرض الفاتورة';eye.title='عرض تفاصيل المرتجع قبل الترحيل';eye.style.cssText='padding:6px 9px;margin-left:6px;border:1px solid #d7dee8;border-radius:7px;background:#eef6ff;cursor:pointer';eye.onclick=()=>previewPurchaseReturn(x);action.appendChild(eye);
     const cancel=document.createElement('button');cancel.textContent='إلغاء مسودة فارغة';cancel.title='يظهر الإلغاء فقط للمسودة التي لا تحتوي على أي بنود';cancel.disabled=true;cancel.style.cssText='padding:6px 9px;border:1px solid #d7dee8;border-radius:7px;background:#fff;cursor:pointer';
     const lr=await sb.from(lineTable).select('id').eq(fk,x.id).limit(1);
     if(lr.error)throw lr.error;
     if((lr.data||[]).length===0){cancel.disabled=false;cancel.style.background='#fdecec';cancel.onclick=async()=>{
       if(!confirm('تأكيد إلغاء المسودة الفارغة رقم '+(x.return_no||x.id.slice(0,8))+'؟ لن يتم حذف أي مستند مرحّل.'))return;
       cancel.disabled=true;
       try{
        const check=await sb.from(lineTable).select('id').eq(fk,x.id).limit(1);if(check.error)throw check.error;
        if((check.data||[]).length){throw new Error('المسودة لم تعد فارغة؛ تم إيقاف الإلغاء لحماية البيانات.')}
        const upd=await sb.from(table).update({status:'cancelled'}).eq('id',x.id).eq('status','draft').select('id');
        if(upd.error)throw upd.error;
        if(!upd.data||!upd.data.length)throw new Error('لم يتم إلغاء المسودة؛ ربما تغيرت حالتها.');
        msg('تم إلغاء المسودة الفارغة رقم '+(x.return_no||x.id.slice(0,8)),'ok');await loadDrafts();
       }catch(e){msg(e.message||String(e),'bad');cancel.disabled=false}
      }}else{cancel.textContent='تحتوي على بنود';cancel.title='لا يمكن إلغاء هذا المستند من هنا لأنه يحتوي على بنود';}
     action.appendChild(cancel);
    }else{action.textContent='—'}
    tr.appendChild(action);body.appendChild(tr);
   }
   const wanted=new URLSearchParams(location.search).get('select');
   if(wanted){const ck=[...document.querySelectorAll('.ck')].find(el=>el.value===wanted);if(ck)ck.checked=true}
  }catch(e){body.innerHTML='<tr><td colspan="7">تعذر تحميل المستندات.</td></tr>';msg(e.message||String(e),'bad')}
 };
 window.postSelected=async()=>{
  const ids=[...document.querySelectorAll('.ck:checked')].map(x=>x.value);
  if(!ids.length)return msg('حدد مستندًا واحدًا على الأقل','bad');
  try{for(const id of ids){if(t==='purchase-post')await postPurchase(id);else if(t==='sale-post')await postSale(id);else if(t==='purchase-return-post')await postPurchaseReturn(id);else await postSaleReturn(id)}msg('تم ترحيل المستندات المحددة وتحديث المخزون والقيود المحاسبية ✓','ok');await loadDrafts()}catch(e){msg(e.message||e,'bad')}
 };
 async function previewPurchaseReturn(h){
  const modal=$('returnPreview'),info=$('previewInfo'),linesBox=$('previewLines'),totals=$('previewTotals');
  modal.style.display='block';linesBox.innerHTML='';totals.textContent='';info.textContent='جاري تحميل تفاصيل المرتجع...';
  try{
   const lr=await sb.from('purchase_return_lines').select('*').eq('return_id',h.id);
   if(lr.error)throw lr.error;
   const lines=lr.data||[];
   const itemIds=[...new Set(lines.map(z=>z.item_id).filter(Boolean))];
   let itemMap={};
   if(itemIds.length){const ir=await sb.from('inv_items').select('id,name_ar,unit_name').in('id',itemIds);if(ir.error)throw ir.error;for(const it of ir.data||[])itemMap[it.id]=it}
   const sourceIds=[...new Set(lines.map(z=>z.source_purchase_line_id||z.purchase_line_id).filter(Boolean))];
   let invoiceLabel='غير محددة';
   if(sourceIds.length){
    const pl=await sb.from('purchase_lines').select('id,purchase_id').in('id',sourceIds);
    if(pl.error)throw pl.error;
    const purchaseIds=[...new Set((pl.data||[]).map(z=>z.purchase_id).filter(Boolean))];
    if(purchaseIds.length===1){const ph=await sb.from('purchases').select('invoice_no,purchase_date').eq('id',purchaseIds[0]).maybeSingle();if(ph.error)throw ph.error;if(ph.data)invoiceLabel=String(ph.data.invoice_no||'')+' — '+String(ph.data.purchase_date||'')}
    else if(purchaseIds.length>1)invoiceLabel='تنبيه: البنود مرتبطة بأكثر من فاتورة شراء';
   }
   info.textContent='رقم المرتجع: '+String(h.return_no||h.id)+' | التاريخ: '+String(h.return_date||'')+' | فاتورة الشراء الأصلية: '+invoiceLabel+' | الحالة: مسودة';
   let subtotal=0,tax=0,discount=0,total=0;
   for(const line of lines){
    const item=itemMap[line.item_id]||{},tr=document.createElement('tr');
    const vals=[item.name_ar||String(line.item_id||'—'),String(line.qty??0)+(item.unit_name?' '+item.unit_name:''),Number(line.unit_cost||0).toFixed(2),Number(line.discount_amount||0).toFixed(2),Number(line.tax_amount||0).toFixed(2),Number(line.line_total||0).toFixed(2)];
    vals.forEach(v=>{const td=document.createElement('td');td.textContent=v;td.style.cssText='padding:9px;border-bottom:1px solid #e5e9f0;text-align:right';tr.appendChild(td)});
    linesBox.appendChild(tr);subtotal+=Number(line.qty||0)*Number(line.unit_cost||0)-Number(line.discount_amount||0);discount+=Number(line.discount_amount||0);tax+=Number(line.tax_amount||0);total+=Number(line.line_total||0);
   }
   if(!lines.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='لا توجد بنود في هذا المستند.';tr.appendChild(td);linesBox.appendChild(tr)}
   totals.textContent='قيمة الأصناف بعد الخصم: '+subtotal.toFixed(2)+' | إجمالي الخصم: '+discount.toFixed(2)+' | إجمالي الضريبة: '+tax.toFixed(2)+' | مجموع البنود: '+total.toFixed(2)+' | إجمالي رأس المستند: '+Number(h.total||0).toFixed(2);
   if(Math.abs(total-Number(h.total||0))>0.02){totals.style.color='#b42318';totals.textContent+=' — تحذير: إجمالي البنود لا يطابق إجمالي المستند'}
   else totals.style.color='#087f4f';
  }catch(e){info.textContent='تعذر تحميل تفاصيل المرتجع: '+(e.message||String(e))}
 }
 $('closeReturnPreview').onclick=()=>{$('returnPreview').style.display='none'};
 $('returnPreview').addEventListener('click',e=>{if(e.target===$('returnPreview'))$('returnPreview').style.display='none'});
 $('refreshDrafts').onclick=loadDrafts;$('postSelectedBtn').onclick=postSelected;loadDrafts();
}

/* زر رجوع موحّد لكل شاشات سير العمل. يتم تركيبه بعد بناء الشاشة حتى لا يحذفه render. */
(function(){
 function installBack(){
  if(!document.body||!document.body.dataset.workflow)return;
  const top=document.querySelector('#app .top')||document.querySelector('.top');
  if(!top)return;
  if(top.querySelector('.workflow-back'))return;
  const b=document.createElement('button');
  b.type='button'; b.className='workflow-back'; b.textContent='↩ رجوع للشاشة السابقة';
  b.style.cssText='margin-left:8px;border:0;border-radius:9px;padding:10px 16px;background:#e8edf5;color:#17233b;cursor:pointer;font-weight:700;';
  b.onclick=function(){if(window.history.length>1)window.history.back();else window.location.href='accounting.html';};
  top.prepend(b);
 }
 const obs=new MutationObserver(installBack);
 obs.observe(document.documentElement,{childList:true,subtree:true});
 document.addEventListener('DOMContentLoaded',installBack);
 setInterval(installBack,300);
})();

init();