const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync('AEL_Price_Elasticity_Cockpit.html','utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
setTimeout(()=>{
 const d=dom.window.document,q=s=>d.querySelector(s);
 const fy=[...d.querySelectorAll('#tFy tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim()).join(' | '));
 console.log(JSON.stringify({
  errors:errs.slice(0,3),
  fyRows:fy,
  decCards:q('#decCards')?.querySelectorAll('.card').length,
  finChart:q('#cFin')?.innerHTML.length,
  finNote:(q('#decFinNote')?.textContent||'').slice(0,220),
  p7:q('#p7')?.querySelectorAll('.card').length,
  p7text:(q('#p7')?.textContent||'').replace(/\s+/g,' ').slice(0,400)
 },null,1));
 process.exit(0);
},3400);
