const fs=require('fs'),path=require('path'),os=require('os');
const DIR=path.join(os.homedir(),'.local','share','opencode','tool-output');
const files=fs.readdirSync(DIR).map(f=>{const p=path.join(DIR,f);const st=fs.statSync(p);return{f,p,t:st.mtimeMs,s:st.size};}).filter(x=>x.s>50000).sort((a,b)=>a.t-b.t);
let chans={}, offerRows=[];
for(const f of files){
  let j; try{ j=JSON.parse(fs.readFileSync(f.p,'utf8')); }catch(e){ continue; }
  if(!j.rows||!j.rows.length) continue;
  const r0=j.rows[0];
  if('ch' in r0 && 'ym' in r0 && 'c' in r0){ chans[r0.ym]={f:f.f,rows:j.rows.length}; }
  else if('id' in r0 && 'bf' in r0){ offerRows.push({f:f.f,rows:j.rows.length,t:f.t}); }
}
const months=Object.keys(chans).sort();
const panel=[];
for(const m of months){
  const j=JSON.parse(fs.readFileSync(path.join(DIR,chans[m].f),'utf8'));
  for(const r of j.rows) panel.push({m, ch:+r.ch, c:String(r.c), q:+r.q, v:+r.v});
}
fs.writeFileSync('data/channel_full.json',JSON.stringify({months,rows:panel}));
console.log('channel months',months.length,'rows',panel.length);
// merge offer rows (split pulls), dedupe
const seen=new Set(), merged=[];
for(const f of offerRows){
  const j=JSON.parse(fs.readFileSync(path.join(DIR,f.f),'utf8'));
  for(const r of j.rows){
    const k=[r.id,r.bf,r.bt,r.oc,r.qty,r.pct,r.amt].join('|');
    if(seen.has(k)) continue; seen.add(k); merged.push(r);
  }
}
fs.writeFileSync('data/offers_row.json',JSON.stringify({rows:merged,count:merged.length}));
console.log('offer rows merged',merged.length,'from',offerRows.length,'files');
