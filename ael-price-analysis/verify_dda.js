const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync('AEL_Price_Elasticity_Cockpit.html','utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
setTimeout(()=>{
 const d=dom.window.document,q=s=>d.querySelector(s);
 console.log(JSON.stringify({
  errors:errs.slice(0,3),
  head:(q('#ddaHead')?.textContent||'').slice(0,180),
  fyRows:d.querySelectorAll('#tFy tbody tr').length,
  smart:q('#smartDir')?.querySelectorAll('.smart>div').length,
  decCards:q('#decCards')?.querySelectorAll('.card').length,
  decChart:q('#cDec')?.innerHTML.length,
  decRows:d.querySelectorAll('#tDec tbody tr').length,
  actRows:d.querySelectorAll('#tAct tbody tr').length,
  riskRows:d.querySelectorAll('#tRisk tbody tr').length,
  riskChart:q('#cRisk')?.innerHTML.length,
  recRows:d.querySelectorAll('#tRec tbody tr').length,
  recChart:q('#cRec')?.innerHTML.length,
  drivers:q('#recDrivers')?.innerHTML.length,
  plan:q('#recPlan')?.innerHTML.length,
  fyText:[...d.querySelectorAll('#tFy tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim()).join(' | '))
 },null,1));
 process.exit(0);
},3200);
