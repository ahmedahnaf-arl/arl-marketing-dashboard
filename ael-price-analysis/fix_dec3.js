const fs=require('fs');let c=fs.readFileSync('client.frag.html','utf8');

/* (a) compute real FY YoY per SKU inside the Decision mapping */
c=c.replace(`    var dec=FR.codes.map(function(c){
      var m=META[c]||{}, st=rowStats(c), rs=recentStats(c);
      var gapTP=(m.tp&&st.lastP)?st.lastP/m.tp-1:null;
      return {c:c,n:m.n||c,cat:m.cat||'—',rev:st.totV,gapTP:gapTP,pChg:rs.pChg,vChg:rs.vChg,
        beta:(function(){var e=usableEl(c);return e?e.b:null;})()};
    }).sort(function(a,b){return b.rev-a.rev;});`,
`    var latestFy=fyOf(M[FR.idxs[FR.idxs.length-1]]);
    function fyYoY(code){
      var s=FR.series[code], cur={}, prev={};
      FR.idxs.forEach(function(mi,k){var x=s[k];if(!x||x.v<=0)return;var fy=fyOf(M[mi]),mo=+M[mi].slice(5,7);
        if(fy===latestFy)cur[mo]=(cur[mo]||0)+x.v; else if(fy===latestFy-1)prev[mo]=(prev[mo]||0)+x.v;});
      var cTot=0,pTot=0;
      Object.keys(cur).forEach(function(mo){if(prev[mo]!=null){cTot+=cur[mo];pTot+=prev[mo];}});
      return pTot>0?cTot/pTot-1:null;
    }
    var dec=FR.codes.map(function(c){
      var m=META[c]||{}, st=rowStats(c), rs=recentStats(c);
      var gapTP=(m.tp&&st.lastP)?st.lastP/m.tp-1:null;
      return {c:c,n:m.n||c,cat:m.cat||'—',rev:st.totV,gapTP:gapTP,pChg:rs.pChg,vChg:rs.vChg,fyChg:fyYoY(c),
        beta:(function(){var e=usableEl(c);return e?e.b:null;})()};
    }).sort(function(a,b){return b.rev-a.rev;});`);

/* (b) chart colour: fall back to price direction */
c=c.replace("var col=x.gapTP==null?'#4b5a6b':(x.gapTP<-0.05?'#f26d6d':(x.gapTP<0?'#f5a524':'#2dd4bf'));",
"var col=x.gapTP!=null?(x.gapTP<-0.05?'#f26d6d':(x.gapTP<0?'#f5a524':'#2dd4bf')):(x.pChg==null?'#4b5a6b':(x.pChg<0?'rgba(242,109,109,.45)':'rgba(45,212,191,.45)'));");
c=c.replace("'<span><i style=\"background:#4b5a6b\"></i>no declared price</span></div>';",
"'<span><i style=\"background:#4b5a6b\"></i>no declared price (bar tint = recent price direction)</span></div>';");

/* (c) table column uses fyChg and the correct header label */
c=c.replace("'<td class=\"'+cls(-(x.pChg||0))+'\\\">'+pf(x.pChg)+'</td><td class=\"'+cls(x.gapTP)+'\\\">'",
"'<td class=\"'+cls(x.fyChg)+'\">'+pf(x.fyChg)+'</td><td class=\"'+cls(x.gapTP)+'\">'");

/* (d) decision 3 wording: talk about the long tail, not the top three */
c=c.replace("'<p style=\"font-size:12.4px;margin:6px 0 0\">'+catList.length+' categories are live. The tail beyond the top three ('+catList.slice(3,6).join(', ')+') '+",
"'<p style=\"font-size:12.4px;margin:6px 0 0\">'+catList.length+' categories are live. Below the top three ('+catList[0]+', '+catList[1]+', '+catList[2]+') the tail — '+catList.slice(3,6).join(', ')+' — '");
fs.writeFileSync('client.frag.html',c);console.log('fixed');
