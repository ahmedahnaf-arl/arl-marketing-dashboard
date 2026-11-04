const fs=require('fs'),path=require('path'),os=require('os');
const DIR=path.join(os.homedir(),'.local','share','opencode','tool-output');
const files=fs.readdirSync(DIR).map(f=>{const p=path.join(DIR,f);const st=fs.statSync(p);return{f,p,t:st.mtimeMs,s:st.size};}).filter(x=>x.s>40000).sort((a,b)=>a.t-b.t);
let market=null, bench=null;
for(const f of files){
  let j; try{ j=JSON.parse(fs.readFileSync(f.p,'utf8')); }catch(e){ continue; }
  if(!j.rows||!j.rows.length) continue;
  const r0=j.rows[0];
  if('ym' in r0 && 'sku' in r0 && 'brands' in r0) market={f:f.f,rows:j.rows.length};
  else if('b' in r0 && 'sku' in r0 && 'mrp' in r0 && !('ym' in r0)) bench={f:f.f,rows:j.rows.length};
}
if(market){ const j=JSON.parse(fs.readFileSync(path.join(DIR,market.f),'utf8')); fs.writeFileSync('data/competitor_market.json',JSON.stringify(j)); console.log('market rows',j.rows.length); } else console.log('market MISSING');
if(bench){ const j=JSON.parse(fs.readFileSync(path.join(DIR,bench.f),'utf8')); fs.writeFileSync('data/competitor_bench.json',JSON.stringify(j)); console.log('bench rows',j.rows.length); } else console.log('bench MISSING');
