const SB_URL='https://fyqyodnboryzaejlhdlk.supabase.co';
const SB_KEY='sb_publishable_7-Gz455HgXsWpS_5jrJ71A_VwHCEho2';
const sbReturn=supabase.createClient(SB_URL,SB_KEY);
let prUser,prItems=[],prSites=[],prSuppliers=[],prSources=[];
const q=id=>document.getElementById(id);
const escR=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const todayR=()=>new Date().toISOString().slice(0,10);
function optsR(a,label){return '<option value="">-- اختر --</option>'+a.map(x=>'<option value="'+x.id+'">'+escR(label(x))+'</option>').join('');}
async function loadPurchaseSources(){
 const supplier=q('party')?.value,site=q('site')?.value;
 prSources=[];
 if(!supplier||!site){document.querySelectorAll('.source').forEach(s=>s.innerHTML='<option value="">اختر المورد والموقع أولاً</option>');return;}
 const [ph,pl,ret]=await Promise.all([
  sbReturn.from('purchases').select('id,invoice_no,purchase_date,supplier_id,site_id').eq('supplier_id',supplier).eq('site_id',site).eq('status','posted').order('purchase_date',{ascending:false}),
  sbReturn.from('purchase_lines').select('id,purchase_id,item_id,qty,unit_cost,batch_no,expiry_date').order('id'),
  sbReturn.from('purchase_return_lines').select('purchase_line_id,qty,purchase_returns!inner(status)').not('purchase_line_id','is',null)
 ]);
 if(ph.error) throw ph.error; if(pl.error) throw pl.error; if(ret.error) throw ret.error;
 const heads=ph.data||[], headMap=new Map(heads.map(x=>[x.id,x]));
 const returned=new Map();
 (ret.data||[]).forEach(x=>{if(x.purchase_line_id && !['cancelled','rejected'].includes(x.purchase_returns?.status)) returned.set(x.purchase_line_id,(returned.get(x.purchase_line_id)||0)+Number(x.qty||0));});
 prSources=(pl.data||[]).filter(l=>headMap.has(l.purchase_id)).map(l=>{const h=headMap.get(l.purchase_id),used=returned.get(l.id)||0;return {...l,invoice_no:h.invoice_no,purchase_date:h.purchase_date,available:Math.max(0,Number(l.qty||0)-used)};}).filter(l=>l.available>0);
 document.querySelectorAll('.item').forEach(el=>refreshSourceForRow(el.closest('tr')));
}
function refreshSourceForRow(tr){
 if(!tr)return; const itemId=tr.querySelector('.item')?.value; const s=tr.querySelector('.source'); if(!s)return;
 const list=prSources.filter(x=>x.item_id===itemId);
 s.innerHTML='<option value="">-- اختر إذن الشراء --</option>'+list.map(x=>'<option value="'+x.id+'">'+escR(x.invoice_no||('إذن '+String(x.purchase_id).slice(0,8)))+' | '+escR(x.purchase_date||'')+' | متاح '+Number(x.available).toFixed(3)+'</option>').join('');
 tr.querySelector('.available').value='';tr.querySelector('.cost').value='';
}
function sourceChanged(el){const tr=el.closest('tr'),x=prSources.find(v=>v.id===el.value);if(!x)return;tr.querySelector('.available').value=Number(x.available).toFixed(3);tr.querySelector('.cost').value=Number(x.unit_cost||0).toFixed(2);tr.querySelector('.qty').max=Number(x.available);if(Number(tr.querySelector('.qty').value)>x.available)tr.querySelector('.qty').value=x.available;}
function addReturnRow(){q('lines').insertAdjacentHTML('beforeend',rowHtml());const tr=q('lines').lastElementChild;refreshSourceForRow(tr);tr.querySelector('.item').focus();}
function rowHtml(){return '<tr><td><select class="item" onchange="refreshSourceForRow(this.closest(\'tr\'))">'+optsR(prItems,x=>x.name_ar+' — '+x.sku)+'</select></td><td><select class="source" onchange="sourceChanged(this)"><option value="">-- اختر إذن الشراء --</option></select></td><td><input class="qty" type="number" min=".001" step=".001" value="1"></td><td><input class="available" type="number" readonly></td><td><input class="cost" type="number" readonly></td><td><button type="button" onclick="this.closest(\'tr\').remove();updateReturnTotal()">حذف</button></td></tr>';}
function updateReturnTotal(){let total=0;document.querySelectorAll('#lines tr').forEach(tr=>total+=Number(tr.querySelector('.qty')?.value||0)*Number(tr.querySelector('.cost')?.value||0));q('total').textContent=total.toFixed(2);}
async function saveReturnDraft(){
 try{
  const supplier=q('party').value,site=q('site').value;if(!supplier||!site)return msgR('اختر المورد والموقع','bad');
  const lines=[...document.querySelectorAll('#lines tr')].map(tr=>({tr,item_id:tr.querySelector('.item').value,purchase_line_id:tr.querySelector('.source').value,qty:Number(tr.querySelector('.qty').value)}));
  if(!lines.length||lines.some(x=>!x.item_id||!x.purchase_line_id||x.qty<=0))return msgR('كل صنف لازم تختار له إذن شراء وتحدد كمية صحيحة','bad');
  for(const x of lines){const src=prSources.find(v=>v.id===x.purchase_line_id);if(!src||src.item_id!==x.item_id)return msgR('إذن الشراء المختار لا يخص الصنف المحدد','bad');if(x.qty>src.available+0.000001)return msgR('الكمية المرتجعة أكبر من الكمية المتاحة في إذن الشراء: '+src.invoice_no,'bad');}
  const total=lines.reduce((s,x)=>{const src=prSources.find(v=>v.id===x.purchase_line_id);return s+x.qty*Number(src.unit_cost||0)},0);
  const {data:maxData,error:maxErr}=await sbReturn.from('purchase_returns').select('return_no').order('return_no',{ascending:false}).limit(1);if(maxErr)throw maxErr;
  const returnNo=(Number(maxData?.[0]?.return_no||0)||0)+1;
  const {data:ret,error:re}=await sbReturn.from('purchase_returns').insert({return_no:returnNo,supplier_id:supplier,site_id:site,return_date:q('date').value,total,status:'draft',created_by:prUser.id}).select('id').single();if(re)throw re;
  const payload=lines.map(x=>{const src=prSources.find(v=>v.id===x.purchase_line_id);return{return_id:ret.id,item_id:x.item_id,qty:x.qty,unit_cost:Number(src.unit_cost||0),purchase_line_id:x.purchase_line_id};});
  const {error:le}=await sbReturn.from('purchase_return_lines').insert(payload);if(le){await sbReturn.from('purchase_returns').delete().eq('id',ret.id);throw le;}
  msgR('تم حفظ مردود المشتريات رقم '+returnNo+' مع ربط كل صنف بإذن الشراء الأصلي','ok');setTimeout(()=>location.href='purchase-return-save.html?saved=1',700);
 }catch(e){msgR(e.message||e,'bad');}
}
function msgR(t,c){q('msg').className='msg '+c;q('msg').textContent=t;}
async function initPurchaseReturn(){
 const s=await sbReturn.auth.getSession();if(!s.data.session){location.href='accounting.html';return;}prUser=s.data.session.user;
 const [it,si,su]=await Promise.all([
  sbReturn.from('inv_items').select('id,name_ar,sku').eq('active',true).order('name_ar'),
  sbReturn.from('inv_sites').select('id,name_ar').eq('active',true).order('name_ar'),
  sbReturn.from('suppliers').select('id,name').order('name')
 ]);prItems=it.data||[];prSites=si.data||[];prSuppliers=su.data||[];
 const params=new URLSearchParams(location.search),supplierParam=params.get('supplier_id');
 q('app').innerHTML='<div class="top"><a href="accounting.html">🏠 الرئيسية</a><button type="button" onclick="history.length>1?history.back():location.href=\'accounting.html\'">↩ رجوع للشاشة السابقة</button></div><div class="card"><h1>مردود مشتريات</h1><p>كل صنف في المرتجع يجب ربطه بإذن/فاتورة الشراء الأصلي. التكلفة تؤخذ من الإذن المختار، وليس من متوسط تكلفة المخزون.</p><div class="head"><label>رقم المستند<input id="docno" readonly placeholder="يُنشأ تلقائياً"></label><label>التاريخ<input id="date" type="date" value="'+todayR()+'"></label><label>المورد<select id="party" onchange="loadPurchaseSources()">'+optsR(prSuppliers,x=>x.name)+'</select></label><label>الموقع<select id="site" onchange="loadPurchaseSources()">'+optsR(prSites,x=>x.name_ar)+'</select></label></div><table><thead><tr><th>الصنف</th><th>إذن الشراء الأصلي</th><th>الكمية المرتجعة</th><th>المتاح من الإذن</th><th>تكلفة الوحدة</th><th>إجراء</th></tr></thead><tbody id="lines">'+rowHtml()+'</tbody></table><button type="button" onclick="addReturnRow()">+ إضافة صنف</button><div style="margin-top:18px;font-size:18px;font-weight:700">إجمالي المرتجع: <span id="total">0.00</span></div><button class="ok" type="button" onclick="saveReturnDraft()">💾 حفظ المرتجع</button><div id="msg"></div></div>';
 if(supplierParam&&[...q('party').options].some(o=>o.value===supplierParam))q('party').value=supplierParam;
 await loadPurchaseSources();
 document.addEventListener('input',e=>{if(e.target.classList.contains('qty'))updateReturnTotal();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPurchaseReturn);else initPurchaseReturn();