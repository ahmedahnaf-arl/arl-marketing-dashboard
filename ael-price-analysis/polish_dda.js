const fs=require('fs');let c=fs.readFileSync('client.frag.html','utf8');

/* recovery table: proper currency + sign */
c=c.replace("'<td class=\"'+cls(cv-pv)+'\">'+bcr(cv-pv)+'</td><td class=\"'+cls(cv-pv)+'\">'+pf(pv?cv/pv-1:null)+'</td></tr>';",
"'<td class=\"'+cls(cv-pv)+'\">'+(cv-pv<0?'−':'')+'৳'+bcr(Math.abs(cv-pv))+'</td><td class=\"'+cls(cv-pv)+'\">'+pf(pv?cv/pv-1:null)+'</td></tr>';");
c=c.replace("'<td class=\"neg\"><b>'+bcr(totalC-totalP)+'</b></td><td class=\"neg\"><b>'+pf(totalP?totalC/totalP-1:null)+'</b></td></tr>';",
"'<td class=\"neg\"><b>−৳'+bcr(Math.abs(totalC-totalP))+'</b></td><td class=\"neg\"><b>'+pf(totalP?totalC/totalP-1:null)+'</b></td></tr>';");

/* at-risk: distinguish a true grid breach from a wind-down */
c=c.replace("var dir=x.gap!=null&&x.gap<-0.05?'Re-declare / enforce':'Restore price';",
"var breach=(x.gap!=null&&x.gap<-0.05);\n      var dir=breach?'Re-declare / enforce':'Investigate';");
c=c.replace("var act=x.gap!=null&&x.gap<-0.05?'Rebase the declared TP to the transacted price, or stop approving the discount':'Reverse the cut; check availability and competitor price first';",
"var act=breach?'Rebase the declared TP to the transacted price, or stop approving the discount':'Price and volume both fell: check availability, credit and tender timing before restoring price';");

/* base-effect guard on the FY column */
c=c.replace("'<td class=\"'+cls(x.fyChg)+'\">'+pf(x.fyChg)+'</td>",
"'<td class=\"'+cls(x.fyChg)+'\">'+(x.fyChg!=null&&Math.abs(x.fyChg)>3?((x.fyChg>0?'&gt;+300%':'&lt;−75%')):pf(x.fyChg))+'</td>");
fs.writeFileSync('client.frag.html',c);console.log('polished');
