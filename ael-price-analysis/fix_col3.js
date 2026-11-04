const fs=require('fs');let lines=fs.readFileSync('client.frag.html','utf8').split(/\r?\n/);
let done=0;
lines=lines.map(function(l){
  if(l.includes('x.gapTP')&&l.includes('x.pChg')&&l.includes('tDec')===false&&l.includes('<td')){
    const before=l;
    l=l.replace(/cls\(-\(x\.pChg\|\|0\)\)/,'cls(x.fyChg)').replace(/pf\(x\.pChg\)/,'pf(x.fyChg)');
    if(l!==before)done++;
  }
  return l;
});
fs.writeFileSync('client.frag.html',lines.join('\n'));
console.log('lines changed:',done);
console.log('has fyChg:', fs.readFileSync('client.frag.html','utf8').includes('pf(x.fyChg)'));
