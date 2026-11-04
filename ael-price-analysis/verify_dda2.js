const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync('AEL_Price_Elasticity_Cockpit.html','utf8');
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
setTimeout(()=>{
 const d=dom.window.document;
 const rows=[...d.querySelectorAll('#tDec tbody tr')].slice(0,6).map(tr=>[...tr.children].map(td=>td.textContent.trim()));
 const rec=[...d.querySelectorAll('#tRec tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim()).join(' | '));
 const risk=[...d.querySelectorAll('#tRisk tbody tr')].slice(0,4).map(tr=>[...tr.children].map(td=>td.textContent.trim()).join(' | '));
 console.log('errors',errs.slice(0,2));
 console.log('DEC rows:'); rows.forEach(r=>console.log('  '+r.join(' | ')));
 console.log('REC:'); rec.forEach(r=>console.log('  '+r));
 console.log('RISK sample:'); risk.forEach(r=>console.log('  '+r));
 process.exit(0);
},3200);
