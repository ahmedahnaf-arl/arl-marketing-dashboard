const fs=require('fs');let c=fs.readFileSync('client.frag.html','utf8');
const before=c;
c=c.replace("'<td class=\"'+cls(-(x.pChg||0))+'\\\">'+pf(x.pChg)+'</td><td class=\"'+cls(x.gapTP)+'\\\">'",
            "'<td class=\"'+cls(x.fyChg)+'\">'+pf(x.fyChg)+'</td><td class=\"'+cls(x.gapTP)+'\">'");
if(before===c){
  // fallback: locate the exact substring and swap the two tokens
  const needle="cls(-(x.pChg||0))+'\\\">'+pf(x.pChg)";
  const i=c.indexOf(needle);
  console.log('needle at',i);
  if(i>=0){ c=c.replace(needle,"cls(x.fyChg)+'\">'+pf(x.fyChg)"); }
}
fs.writeFileSync('client.frag.html',c);
console.log('fyChg wired:', c.includes('pf(x.fyChg)'));
