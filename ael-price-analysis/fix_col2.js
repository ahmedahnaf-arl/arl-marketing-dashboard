const fs=require('fs');let c=fs.readFileSync('client.frag.html','utf8');
const lines=c.split(/\r?\n/);
for(let i=0;i<lines.length;i++){
  if(lines[i].includes("cls(-(x.pChg||0))+'\"+pf(x.pChg)") || lines[i].includes('cls(-(x.pChg||0))' )){
    // only the Decision table row (the one followed by gapTP), not the risk row
    if(lines[i].includes('x.gapTP')){
      lines[i]=lines[i].replace("cls(-(x.pChg||0))+'\"+pf(x.pChg)","cls(x.fyChg)+'\"+pf(x.fyChg)");
      console.log('patched line',i+1);
    }
  }
}
fs.writeFileSync('client.frag.html',lines.join('\n'));
console.log('now:', fs.readFileSync('client.frag.html','utf8').includes('pf(x.fyChg)'));
