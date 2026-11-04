const fs=require('fs');
const pl=JSON.parse(fs.readFileSync('data/pl_monthly.json','utf8')).rows
  .filter(r=>r.ym<='2026-10' && +r.revenue>0);
const fyOf=ym=>{const y=+ym.slice(0,4),m=+ym.slice(5,7);return m>=7?y:y-1;};
const fy={};
pl.forEach(r=>{
  const f=fyOf(r.ym); const o=fy[f]||(fy[f]={rev:0,cogs:0,mfg:0,sell:0,log:0,mkt:0,adm:0,fin:0,oi:0,n:0});
  let cost=+r.cogs;
  // reclass guard: when manufacturing is abnormally large, it is the cost (COGS was reversed)
  if(+r.revenue>0 && (+r.mfg)/(+r.revenue)>0.05) cost=+r.cogs + +r.mfg;
  o.rev+=+r.revenue; o.cogs+=cost; o.sell+=+r.selling; o.log+=+r.logistics; o.mkt+=+r.marketing;
  o.adm+=+r.admin; o.fin+=+r.financial; o.oi+=+r.other_income; o.n++;
});
console.log('FY | rev Cr | GP% | opex Cr | fin Cr | NP Cr | NP%');
Object.keys(fy).map(Number).sort().forEach(f=>{
  const o=fy[f];
  const gp=o.rev-o.cogs;
  const opex=o.sell+o.log+o.mkt+o.adm;
  const np=gp-opex-o.fin+o.oi;
  console.log('FY'+(f)+'-'+String((f+1)%100).padStart(2,'0')+' | '+(o.rev/1e7).toFixed(0)+' | '+(100*gp/o.rev).toFixed(1)+'% | '+(opex/1e7).toFixed(0)+' | '+(o.fin/1e7).toFixed(0)+' | '+(np/1e7).toFixed(0)+' | '+(100*np/o.rev).toFixed(1)+'%  ('+o.n+' mo)');
});
