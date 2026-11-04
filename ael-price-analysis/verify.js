const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync('AEL_Price_Elasticity_Cockpit.html','utf8');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>errs.push(e.message));vc.on('error',e=>errs.push(String(e)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
setTimeout(()=>{
 const d=dom.window.document,q=s=>d.querySelector(s);
 const out={
  errors:errs.slice(0,4),
  guides:d.querySelectorAll('.guide').length,
  kpi:[q('#k1')?.textContent,q('#k2')?.textContent,q('#k3')?.textContent,q('#k4')?.textContent,q('#k5')?.textContent],
  pg:[q('#p1')?.textContent,q('#p2')?.textContent,q('#p3')?.textContent,q('#p4')?.textContent],
  skuRows:d.querySelectorAll('#tSku tbody tr').length,
  momRows:d.querySelectorAll('#tMom tbody tr').length,
  pgRows:d.querySelectorAll('#tPg tbody tr').length,
  gapChart:q('#cGap')?.innerHTML.length,
  ladder:q('#cLadder')?.innerHTML.length,
  tips:d.querySelectorAll('[data-tip]').length,
  clickable:d.querySelectorAll('[data-code]').length,
  jumps:d.querySelectorAll('#tJump tbody tr').length
 };
 console.log(JSON.stringify(out,null,1));
 process.exit(0);
},2600);
