const fs=require('fs'),path=require('path'),os=require('os');
const DIR=path.join(os.homedir(),'.local','share','opencode','tool-output');
const files=fs.readdirSync(DIR).map(f=>{const p=path.join(DIR,f);const st=fs.statSync(p);return{f,p,t:st.mtimeMs,s:st.size};}).filter(x=>x.s>50000).sort((a,b)=>a.t-b.t);
let best=null;
for(const f of files){
  let j; try{ j=JSON.parse(fs.readFileSync(f.p,'utf8')); }catch(e){ continue; }
  if(!j.rows||!j.rows.length) continue;
  if('slabs' in j.rows[0]) best={f:f.f,rows:j.rows.length};
}
if(!best){console.log('scheme summary file not found');process.exit(1);}
const j=JSON.parse(fs.readFileSync(path.join(DIR,best.f),'utf8'));
fs.writeFileSync('data/schemes.json',JSON.stringify(j));
console.log('schemes',j.rows.length);
