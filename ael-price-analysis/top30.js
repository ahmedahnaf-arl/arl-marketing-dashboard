const fs=require('fs');
const P=JSON.parse(fs.readFileSync('data/panel_full.json','utf8'));
const rev={},qty={};
for(const r of P.rows){ if(r.m>= '2025-11'){ rev[r.c]=(rev[r.c]||0)+r.v; qty[r.c]=(qty[r.c]||0)+r.q; } }
const top=Object.keys(rev).sort((a,b)=>rev[b]-rev[a]).slice(0,30);
console.log(top.map(c=>"'"+c+"'").join(','));
