const fs=require('fs');let b=fs.readFileSync('build.js','utf8');
if(!b.includes('.smart{')){
b=b.replace('.tip{position:fixed;',
`.smart{display:flex;flex-direction:column;gap:7px}
.smart>div{display:grid;grid-template-columns:22px 1fr;gap:9px;align-items:start}
.sk{width:20px;height:20px;border-radius:6px;background:rgba(245,165,36,.15);border:1px solid rgba(245,165,36,.45);color:var(--amber);font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px}
.smart p{margin:0;font-size:12px;color:#c3d1e2;line-height:1.5}
.tip{position:fixed;`);
fs.writeFileSync('build.js',b);}
console.log('smart css:', b.includes('.smart{'));
