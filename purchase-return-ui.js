(function(){
const css=`
:root{--erp-blue:#1769e0;--erp-green:#1fa45b;--erp-bg:#f5f7fb;--erp-border:#dce3ee;--erp-text:#18263d}
body[data-workflow="purchase-return-save"]{background:var(--erp-bg);font-family:Arial,"Tahoma",sans-serif;color:var(--erp-text)}
body[data-workflow="purchase-return-save"] #app{width:min(1500px,98%);margin:0 auto 40px}
body[data-workflow="purchase-return-save"] .top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#fff;padding:12px 18px;border-bottom:1px solid var(--erp-border);box-shadow:0 2px 10px #0000000a}
body[data-workflow="purchase-return-save"] .top a{border-radius:7px;padding:9px 14px;font-weight:700;text-decoration:none}
body[data-workflow="purchase-return-save"] .top a:first-child{background:#fff;color:var(--erp-text);border:1px solid var(--erp-border)}
body[data-workflow="purchase-return-save"] .top .new-movement{background:#eaf2ff;color:var(--erp-blue)}
body[data-workflow="purchase-return-save"] .top a:last-child{background:#eef3fa}
body[data-workflow="purchase-return-save"] .card{border-radius:10px;box-shadow:0 3px 18px #0000000b;padding:28px;margin-top:18px;border:1px solid #e7ebf2;background:#fff}
body[data-workflow="purchase-return-save"] #title{font-size:30px;margin:4px 0 18px;font-weight:800}
body[data-workflow="purchase-return-save"] .erp-actions{display:flex;gap:10px;position:absolute;left:28px;top:28px}
body[data-workflow="purchase-return-save"] .erp-actions button{font-weight:700;border-radius:7px;padding:10px 18px;border:1px solid var(--erp-border)}
body[data-workflow="purchase-return-save"] .erp-save{background:var(--erp-green)!important;color:#fff!important;border-color:var(--erp-green)!important}
body[data-workflow="purchase-return-save"] .erp-post{background:var(--erp-blue)!important;color:#fff!important;border-color:var(--erp-blue)!important}
body[data-workflow="purchase-return-save"] .erp-tabs{display:flex;gap:0;margin:-4px 0 22px;border-bottom:1px solid var(--erp-border)}
body[data-workflow="purchase-return-save"] .erp-tab{padding:12px 28px;font-weight:700;color:#65748b;background:#f3f6fa;border-radius:8px 8px 0 0}
body[data-workflow="purchase-return-save"] .erp-tab.active{background:#fff;color:var(--erp-blue);border-bottom:3px solid var(--erp-blue)}
body[data-workflow="purchase-return-save"] .head{grid-template-columns:repeat(4,1fr);gap:18px;background:#fbfcfe;border:1px solid var(--erp-border);border-radius:8px;padding:18px;margin:0 0 22px}
body[data-workflow="purchase-return-save"] .head label{font-size:14px;font-weight:700}
body[data-workflow="purchase-return-save"] .head input,body[data-workflow="purchase-return-save"] .head select{height:42px;border-radius:6px;border:1px solid #cfd8e6;background:#fff;font-size:14px}
body[data-workflow="purchase-return-save"] table{margin:0;border:1px solid var(--erp-border);border-radius:8px;overflow:hidden}
body[data-workflow="purchase-return-save"] th{background:#edf2f8;color:#33445d;font-size:14px;font-weight:800;padding:12px 9px;white-space:nowrap}
body[data-workflow="purchase-return-save"] td{padding:10px 8px;vertical-align:middle;background:#fff}
body[data-workflow="purchase-return-save"] td input,body[data-workflow="purchase-return-save"] td select{height:40px;border-radius:6px;border:1px solid #cbd5e1;font-size:14px}
body[data-workflow="purchase-return-save"] .sourceInvoice{min-width:235px;background:#fff}
body[data-workflow="purchase-return-save"] .price.locked,body[data-workflow="purchase-return-save"] .cost.locked{background:#f1f3f6!important;color:#49566b;font-weight:700}
body[data-workflow="purchase-return-save"] .hint{color:#718096;margin-top:4px}
body[data-workflow="purchase-return-save"] #invoiceSummary{display:grid!important;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:22px!important}
body[data-workflow="purchase-return-save"] #invoiceSummary .card{margin:0;padding:16px 20px;text-align:right;border-radius:8px;box-shadow:none;border:1px solid var(--erp-border);background:#fff}
body[data-workflow="purchase-return-save"] #invoiceSummary .card b{display:block;color:#56657a;margin-bottom:8px}
body[data-workflow="purchase-return-save"] #invoiceSummary .card div{font-size:24px;font-weight:800}
body[data-workflow="purchase-return-save"] .return-section-title{font-size:22px;font-weight:800;margin:28px 0 12px;display:flex;align-items:center;gap:8px}
body[data-workflow="purchase-return-save"] .return-section-title:before{content:"☷";color:var(--erp-blue);font-size:26px}
body[data-workflow="purchase-return-save"] .btn{border:1px solid var(--erp-border)}
body[data-workflow="purchase-return-save"] .erp-add{background:#eef3fa;color:#26364d;font-weight:700;margin-top:12px}
body[data-workflow="purchase-return-save"] .erp-post-link{display:inline-block;background:var(--erp-blue);color:#fff;border-radius:7px;padding:10px 18px;text-decoration:none;font-weight:700;margin-top:12px}
body[data-workflow="purchase-return-save"] #msg{margin-top:14px}
@media(max-width:1000px){body[data-workflow="purchase-return-save"] .head{grid-template-columns:1fr 1fr}body[data-workflow="purchase-return-save"] #invoiceSummary{grid-template-columns:1fr}}
@media(max-width:650px){body[data-workflow="purchase-return-save"] .head{grid-template-columns:1fr}.erp-actions{position:static!important;margin-bottom:12px}}
`;
function enhance(){
 if(document.getElementById('purchaseReturnUiStyle'))return;
 const s=document.createElement('style');s.id='purchaseReturnUiStyle';s.textContent=css;document.head.appendChild(s);
}
function decorate(){
 enhance();
 const card=document.querySelector('#app .card');if(!card)return;
 const title=document.getElementById('title');if(title)title.textContent='مردود مشتريات جديد';
 if(!card.querySelector('.erp-tabs')){
  const tabs=document.createElement('div');tabs.className='erp-tabs';tabs.innerHTML='<div class="erp-tab active">بيانات عامة</div><div class="erp-tab">الأصناف</div>';card.insertBefore(tabs,title?.nextSibling||card.firstChild);
 }
 if(!card.querySelector('.return-section-title')){
  const h=document.createElement('div');h.className='return-section-title';h.textContent='الأصناف';
  const table=card.querySelector('table');if(table)card.insertBefore(h,table);
 }
 const btns=[...card.querySelectorAll('button')];
 const save=btns.find(b=>b.textContent.includes('حفظ فقط'));
 if(save&&!save.classList.contains('erp-save')){save.classList.add('erp-save');save.textContent='💾 حفظ';}
 const add=btns.find(b=>b.textContent.includes('إضافة صنف'));
 if(add)add.classList.add('erp-add');
 const post=card.querySelector('a[href*="purchase-return-post"]');
 if(post)post.classList.add('erp-post-link');
 const top=document.querySelector('#app .top');
 if(top&&!top.querySelector('.erp-title')){
   const crumb=document.createElement('div');crumb.className='erp-title';crumb.style.cssText='font-weight:800;font-size:16px;margin-right:auto;color:#18263d';crumb.textContent='الرئيسية  ‹  عمليات المشتريات  ‹  مردود مشتريات جديد';top.appendChild(crumb);
 }
}
const obs=new MutationObserver(decorate);obs.observe(document.body,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate);else decorate();
})();
