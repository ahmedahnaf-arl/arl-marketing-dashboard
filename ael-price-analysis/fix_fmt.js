const fs=require('fs');let c=fs.readFileSync('client.frag.html','utf8');
c=c.replace(`      rows+='<tr><td><b>'+fyLab(f)+'</b></td><td>৳'+bcr(o.rev)+' Cr</td>'+`,
`      var partial=o.months<12;
      rows+='<tr><td><b>'+fyLab(f)+'</b>'+(partial?' <span class="small">('+o.months+' mo)</span>':'')+'</td><td>৳'+bcr(o.rev)+' Cr</td>'+`);
c=c.replace("var yoy=(pv&&pv.months>=6&&o.months>=6)?o.rev/pv.rev-1:null;",
"var yoy=(pv&&pv.months>=12&&o.months>=12)?o.rev/pv.rev-1:null;");
c=c.replace("'The gap is <b>৳'+bcr(curRev-prevRev)+' Cr</b> — that is the number the recovery plan has to close.';",
"(curRev<prevRev?('The gap is <b>৳'+bcr(prevRev-curRev)+' Cr behind</b> — that is the number the recovery plan has to close.'):('Revenue is <b>৳'+bcr(curRev-prevRev)+' Cr ahead</b> of last year.'));");
fs.writeFileSync('client.frag.html',c);console.log('formatting fixed');
