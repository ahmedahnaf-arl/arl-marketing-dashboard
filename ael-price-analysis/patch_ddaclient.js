const fs=require('fs');let c=fs.readFileSync('client.frag.html','utf8');
const a=c.indexOf('function skuCall(c){');
const b=c.indexOf('function renderAll(){');
if(a<0||b<0){console.log('markers missing');process.exit(1);}

const block = String.raw`
/* ================= DDA · 5 blocks ================= */
function fyOf(ym){var y=+ym.slice(0,4), m=+ym.slice(5,7); return m>=7?y:y-1;}
function fyLab(fy){return 'FY'+fy+'-'+String((fy+1)%100).padStart(2,'0');}

function fyRollup(){
  var out={};
  FR.idxs.forEach(function(mi,k){
    var fy=fyOf(M[mi]);
    var o=out[fy]||(out[fy]={rev:0,months:0,skus:{},q:0});
    o.rev+=FR.agg[mi].v; o.q+=FR.agg[mi].q; o.months++;
    FR.codes.forEach(function(c){var s=FR.series[c][k];if(s&&s.v>0)o.skus[c]=1;});
  });
  var del={}; (D.delFy||[]).forEach(function(d){del[+d.fy]=d;});
  Object.keys(out).forEach(function(fy){var o=out[fy];o.skus=Object.keys(o.skus).length;o.del=(del[fy]||{}).deliveries||null;});
  return out;
}
function sameMonthGap(){
  var cur={},prev={};
  FR.idxs.forEach(function(mi,k){
    var ym=M[mi], mo=+ym.slice(5,7), fy=fyOf(ym);
    var latestFy=fyOf(M[FR.idxs[FR.idxs.length-1]]);
    if(fy===latestFy) cur[mo]=(cur[mo]||0)+FR.agg[mi].v;
    if(fy===latestFy-1) prev[mo]=(prev[mo]||0)+FR.agg[mi].v;
  });
  var months=Object.keys(cur).map(Number).sort(function(x,y){return x-y;});
  return {cur:cur,prev:prev,months:months};
}

function renderDDA(){
  if(!document.getElementById('tFy')) return;
  var fy=fyRollup(), fys=Object.keys(fy).map(Number).sort(function(a,b){return a-b;});
  var gap=sameMonthGap();
  var curRev=gap.months.reduce(function(s,m){return s+(gap.cur[m]||0);},0);
  var prevRev=gap.months.reduce(function(s,m){return s+(gap.prev[m]||0);},0);
  var dPct=prevRev?curRev/prevRev-1:null;

  document.getElementById('ddaHead').innerHTML =
    'Latest fiscal year in view: <b>'+fyLab(fys[fys.length-1])+'</b>, covering '+gap.months.length+' month(s) so far. '+
    'Revenue over those months is <b>৳'+bcr(curRev)+' Cr</b> against ৳'+bcr(prevRev)+' Cr in the same months last year ('+pf(dPct)+'). '+
    'The gap is <b>৳'+bcr(curRev-prevRev)+' Cr</b> — that is the number the recovery plan has to close.';

  /* ---------- 01 Direction ---------- */
  (function(){
    var W=980,H=260,pad={l:52,r:60,t:16,b:34};
    var data=FR.idxs.map(function(mi){return {m:M[mi],v:FR.agg[mi].v,fy:fyOf(M[mi])};});
    var maxV=Math.max.apply(null,data.map(function(d){return d.v;}).concat([1]));
    var bw=(W-pad.l-pad.r)/Math.max(1,data.length);
    var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%">';
    for(var i=0;i<=4;i++){var y=pad.t+(H-pad.t-pad.b)*i/4;
      s+='<line x1="'+pad.l+'" x2="'+(W-pad.r)+'" y1="'+y+'" y2="'+y+'" stroke="#22303f"/>';
      s+='<text x="'+(pad.l-6)+'" y="'+(y+3)+'" fill="#8b9bb0" font-size="8.5" text-anchor="end">'+Math.round(maxV*(1-i/4)/1e7)+'</text>';}
    var lastFy=null;
    data.forEach(function(d,k){var h=(H-pad.t-pad.b)*d.v/maxV,x=pad.l+k*bw+bw*0.15;
      s+='<rect x="'+x+'" y="'+(H-pad.b-h)+'" width="'+(bw*0.7)+'" height="'+h+'" rx="1.5" fill="rgba(96,165,250,.6)"/>';
      s+='<rect data-tip="<b>'+d.m+'</b><br>'+fyLab(d.fy)+'<br>Revenue ৳'+bcr(d.v)+' Cr" x="'+pad.l+k*bw+'" y="'+pad.t+'" width="'+bw+'" height="'+(H-pad.t-pad.b)+'" fill="transparent"/>';
      if(d.fy!==lastFy){ if(k>0)s+='<line x1="'+(pad.l+k*bw)+'" x2="'+(pad.l+k*bw)+'" y1="'+pad.t+'" y2="'+(H-pad.b)+'" stroke="#f5a524" stroke-dasharray="3,3" opacity=".7"/>';
        s+='<text x="'+(pad.l+k*bw+3)+'" y="'+(pad.t+9)+'" fill="#f5a524" font-size="8">'+fyLab(d.fy)+'</text>'; lastFy=d.fy; }
    });
    var step=Math.ceil(data.length/12);
    data.forEach(function(d,k){if(k%step===0)s+='<text x="'+(pad.l+k*bw+bw/2)+'" y="'+(H-12)+'" fill="#8b9bb0" font-size="8" text-anchor="middle">'+d.m.slice(2)+'</text>';});
    s+='</svg>';
    document.getElementById('cDir').innerHTML=s; bindAll(document.getElementById('cDir'));

    var rows='';
    fys.forEach(function(f,i){
      var o=fy[f], pv=i>0?fy[fys[i-1]]:null;
      var yoy=(pv&&pv.months>=6&&o.months>=6)?o.rev/pv.rev-1:null;
      rows+='<tr><td><b>'+fyLab(f)+'</b></td><td>৳'+bcr(o.rev)+' Cr</td>'+
        '<td class="'+cls(yoy)+'">'+pf(yoy)+'</td>'+
        '<td>'+(o.del!=null?nf(o.del):'—')+'</td><td>'+nf(o.skus)+'</td></tr>';
    });
    document.querySelector('#tFy tbody').innerHTML=rows;

    var topDecl=FR.codes.slice(0,3).map(function(c){return (META[c]||{}).n||c;}).join(', ');
    document.getElementById('smartDir').innerHTML=
      '<div class="smart">'+
      '<div><span class="sk">S</span><p>Revenue of ৳'+bcr(curRev)+' Cr across '+gap.months.length+' month(s) of '+fyLab(fys[fys.length-1])+', '+pf(dPct)+' versus the same months last year.</p></div>'+
      '<div><span class="sk">M</span><p>Close the ৳'+bcr(curRev-prevRev)+' Cr gap: that is ৳'+bcr((curRev-prevRev)/Math.max(1,gap.months.length))+' Cr per month of run-rate.</p></div>'+
      '<div><span class="sk">A</span><p>The book is concentrated — the top three SKUs ('+topDecl+') carry a large share, so recovery depends on a few codes.</p></div>'+
      '<div><span class="sk">R</span><p>Reachable only if the declining categories recover volume, not just price: '+gap.months.length+' months of data already show where the volume went.</p></div>'+
      '<div><span class="sk">T</span><p>Monthly tracking against the gap; checkpoint at the Q3 review (Jan-2027).</p></div>'+
      '</div>';
  })();

  /* ---------- 02 Decision ---------- */
  (function(){
    var dec=FR.codes.map(function(c){
      var m=META[c]||{}, st=rowStats(c), rs=recentStats(c);
      var gapTP=(m.tp&&st.lastP)?st.lastP/m.tp-1:null;
      return {c:c,n:m.n||c,cat:m.cat||'—',rev:st.totV,gapTP:gapTP,pChg:rs.pChg,vChg:rs.vChg,
        beta:(function(){var e=usableEl(c);return e?e.b:null;})()};
    }).sort(function(a,b){return b.rev-a.rev;});
    var declared=FR.codes.filter(function(c){var m=META[c];return m&&(m.dp!=null||m.tp!=null||m.mrp!=null);});
    var below=declared.filter(function(c){var m=META[c],st=rowStats(c);return m.tp&&st.lastP&&st.lastP<m.tp*0.95;});
    var top10=dec.slice(0,10).reduce(function(s,x){return s+x.rev;},0);
    var tot=dec.reduce(function(s,x){return s+x.rev;},0)||1;
    var cats={}; dec.forEach(function(x){cats[x.cat]=(cats[x.cat]||0)+x.rev;});
    var catList=Object.keys(cats).sort(function(a,b){return cats[b]-cats[a];});

    document.getElementById('decCards').innerHTML=
      '<div class="card" style="background:var(--panel2)"><div class="gl" style="color:var(--amber);font-size:10px;letter-spacing:.8px">DECISION 1 · PRICE ARCHITECTURE</div>'+
      '<p style="font-size:12.4px;margin:6px 0 0">'+below.length+' of '+declared.length+' declared SKUs trade more than 5% below their declared TP. '+
      'Either re-declare the grid or enforce it — the current grid is not the price the market pays.</p></div>'+
      '<div class="card" style="background:var(--panel2)"><div class="gl" style="color:var(--amber);font-size:10px;letter-spacing:.8px">DECISION 2 · CONCENTRATION</div>'+
      '<p style="font-size:12.4px;margin:6px 0 0">The top 10 SKUs are '+pf(top10/tot,0)+' of revenue; '+catList[0]+' alone is '+pf(cats[catList[0]]/tot,0)+'. '+
      'Pricing on a handful of codes decides the P&amp;L — govern those as a separate tier.</p></div>'+
      '<div class="card" style="background:var(--panel2)"><div class="gl" style="color:var(--amber);font-size:10px;letter-spacing:.8px">DECISION 3 · PORTFOLIO SHAPE</div>'+
      '<p style="font-size:12.4px;margin:6px 0 0">'+catList.length+' categories are live. The tail beyond the top three ('+catList.slice(3,6).join(', ')+') '+
      'is where a niche margin can be built without disturbing the bulk price.</p></div>';

    var top=dec.slice(0,15);
    var W=980,rowH=22,H=top.length*rowH+40,x0=300,wd=520;
    var maxR=Math.max.apply(null,top.map(function(x){return x.rev;}).concat([1]));
    var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%">';
    top.forEach(function(x,i){
      var y=10+i*rowH, len=Math.max(2,x.rev/maxR*wd);
      var col=x.gapTP==null?'#4b5a6b':(x.gapTP<-0.05?'#f26d6d':(x.gapTP<0?'#f5a524':'#2dd4bf'));
      var tip='<b>'+esc(x.n)+'</b><br>Revenue ৳'+bcr(x.rev)+' Cr<br>Realized vs TP '+(x.gapTP!=null?pf(x.gapTP):'—')+'<br>Price Δ '+pf(x.pChg)+' · Volume Δ '+pf(x.vChg);
      s+='<text x="0" y="'+(y+11)+'" fill="#8b9bb0" font-size="8.6">'+x.n.slice(0,42)+'</text>';
      s+='<rect x="'+x0+'" y="'+y+'" width="'+len+'" height="11" rx="2" fill="'+col+'" opacity=".85"/>';
      s+='<text x="'+(x0+len+5)+'" y="'+(y+10)+'" fill="#8b9bb0" font-size="8.2">৳'+bcr(x.rev)+' Cr</text>';
      s+='<rect data-tip="'+esc(tip)+'" data-code="'+x.c+'" x="0" y="'+(y-2)+'" width="'+W+'" height="15" fill="transparent"/>';
    });
    s+='</svg><div class="legend"><span><i style="background:#2dd4bf"></i>at or above declared TP</span><span><i style="background:#f5a524"></i>0 to -5% vs TP</span><span><i style="background:#f26d6d"></i>more than 5% below TP</span><span><i style="background:#4b5a6b"></i>no declared price</span></div>';
    document.getElementById('cDec').innerHTML=s; bindAll(document.getElementById('cDec'));

    document.querySelector('#tDec tbody').innerHTML=dec.slice(0,25).map(function(x){
      var read=x.gapTP==null?'No declared price — set the grid before pricing actions':(x.gapTP<-0.05?'Trading below declared TP — re-declare or enforce':'Within the declared grid');
      return '<tr data-code="'+x.c+'"><td><b>'+x.n+'</b><div class="small">'+x.c+'</div></td><td>'+x.cat+'</td><td>৳'+bcr(x.rev)+' Cr</td>'+
        '<td class="'+cls(-(x.pChg||0))+'">'+pf(x.pChg)+'</td><td class="'+cls(x.gapTP)+'">'+(x.gapTP!=null?pf(x.gapTP):'—')+'</td>'+
        '<td>'+(x.beta!=null?x.beta.toFixed(2):'—')+'</td><td class="small">'+read+'</td></tr>';
    }).join('');
    bindAll(document.getElementById('tDec'));
  })();

  /* ---------- 03 Action ---------- */
  (function(){
    var dec=FR.codes.map(function(c){var m=META[c]||{},st=rowStats(c),rs=recentStats(c);
      return {c:c,n:m.n||c,cat:m.cat||'—',rev:st.totV,tp:m.tp||null,lastP:st.lastP,gapTP:(m.tp&&st.lastP)?st.lastP/m.tp-1:null,pChg:rs.pChg,vChg:rs.vChg};})
      .sort(function(a,b){return b.rev-a.rev;});
    var below=dec.filter(function(x){return x.gapTP!=null&&x.gapTP<-0.05;});
    var failedCuts=dec.filter(function(x){return x.pChg!=null&&x.pChg<-0.02&&x.vChg!=null&&x.vChg<0;});
    var risers=dec.filter(function(x){return x.pChg!=null&&x.pChg>0.02&&x.vChg!=null&&x.vChg>=0;});
    var noGrid=dec.filter(function(x){return x.tp==null;}).length;
    var acts=[
      ['High','Re-declare or enforce TP on the '+below.length+' SKUs trading >5% below grid','Realized vs TP gap: '+below.slice(0,3).map(function(x){return x.n.slice(0,22)+' '+pf(x.gapTP);}).join(' · '),'Brand & Pricing'],
      ['High','Stop the price cuts that did not buy volume ('+failedCuts.length+' SKUs)','Price and volume both fell: '+failedCuts.slice(0,3).map(function(x){return x.n.slice(0,22);}).join(' · '),'Sales'],
      ['Medium','Extend price on the '+risers.length+' SKUs where a rise held volume','Price + volume both positive — test the next increment','Brand & Pricing'],
      ['Medium','Set a declared grid for the '+noGrid+' SKUs that have none','No DP/TP/MRP in the ERP — pricing is uncontrolled','Finance & Pricing'],
      ['Low','Hold recovery review monthly against the ৳'+bcr((function(){var g=sameMonthGap();var a=g.months.reduce(function(s,m){return s+(g.cur[m]||0);},0),b=g.months.reduce(function(s,m){return s+(g.prev[m]||0);},0);return a-b;})())+' Cr gap','Gap vs same months last FY','CEO / SBU Head']
    ];
    document.querySelector('#tAct tbody').innerHTML=acts.map(function(a,i){
      var tag=a[0]==='High'?'t-pos':(a[0]==='Medium'?'t-neg':'t-mut');
      return '<tr><td>'+(i+1)+'</td><td><span class="tag '+tag+'">'+a[0]+'</span></td><td>'+a[1]+'</td><td class="small">'+a[2]+'</td><td class="small">'+a[3]+'</td></tr>';
    }).join('');
  })();

  /* ---------- 04 At-risk ---------- */
  (function(){
    var risk=FR.codes.map(function(c){var m=META[c]||{},st=rowStats(c),rs=recentStats(c);
      var gap=(m.tp&&st.lastP)?st.lastP/m.tp-1:null;
      return {c:c,n:m.n||c,cat:m.cat||'—',rev:st.totV,lastP:st.lastP,tp:m.tp,gap:gap,pChg:rs.pChg,vChg:rs.vChg};})
      .filter(function(x){return (x.gap!=null&&x.gap<-0.05)||(x.pChg!=null&&x.pChg<-0.02&&x.vChg!=null&&x.vChg<0);})
      .sort(function(a,b){return b.rev-a.rev;});
    var W=980,H=Math.max(180,Math.min(risk.length,22)*20+30),x0=300,wd=520;
    var maxAbs=Math.max.apply(null,risk.map(function(x){return Math.abs(x.gap||0);}).concat([0.05]));
    var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%"><line x1="'+x0+'" x2="'+x0+'" y1="8" y2="'+(H-12)+'" stroke="#3a4a5e"/>';
    risk.slice(0,22).forEach(function(x,i){var y=8+i*20,len=Math.min(Math.abs(x.gap||0)/maxAbs*wd,wd);
      var col=(x.gap!=null&&x.gap<-0.05)?'#f26d6d':'#f5a524';
      s+='<text x="0" y="'+(y+11)+'" fill="#8b9bb0" font-size="8.5">'+x.n.slice(0,42)+'</text>';
      s+='<rect x="'+x0+'" y="'+y+'" width="'+Math.max(len,1)+'" height="10" rx="2" fill="'+col+'" opacity=".85"/>';
      s+='<text x="'+(x0+len+5)+'" y="'+(y+9)+'" fill="'+col+'" font-size="8.2">'+(x.gap!=null?pf(x.gap):'—')+'</text>';});
    s+='</svg>';
    document.getElementById('cRisk').innerHTML=s;

    document.querySelector('#tRisk tbody').innerHTML=risk.slice(0,30).map(function(x){
      var dir=x.gap!=null&&x.gap<-0.05?'Re-declare / enforce':'Restore price';
      var act=x.gap!=null&&x.gap<-0.05?'Rebase the declared TP to the transacted price, or stop approving the discount':'Reverse the cut; check availability and competitor price first';
      return '<tr data-code="'+x.c+'"><td><b>'+x.n+'</b><div class="small">'+x.c+'</div></td><td>'+x.cat+'</td><td>৳'+bcr(x.rev)+' Cr</td>'+
        '<td>'+nf(x.lastP,2)+'</td><td>'+(x.tp!=null?nf(x.tp,2):'—')+'</td><td class="neg">'+(x.gap!=null?pf(x.gap):'—')+'</td>'+
        '<td class="'+cls(-(x.pChg||0))+'">'+pf(x.pChg)+'</td><td class="'+cls(x.vChg||0)+'">'+pf(x.vChg)+'</td>'+
        '<td>'+dir+'</td><td class="small">'+act+'</td></tr>';
    }).join('');
    bindAll(document.getElementById('tRisk'));

    document.getElementById('riskNote').innerHTML='<b>Why this is not a P&amp;L loss list.</b> AEL posts no COGS: 0 of 234,781 delivery lines carry a cost, and the item master average rate implies every top SKU sells below cost (e.g. Atta 1 kg ৳64.3 cost vs ৳53 realised), which is not credible. Rather than publish a fake gross margin, this block screens <b>price realisation</b> — the gap between the price actually transacted and the price the business declared. '+risk.length+' SKUs fail that screen.';
  })();

  /* ---------- 05 Recovery ---------- */
  (function(){
    var g=sameMonthGap();
    var names={7:'Jul',8:'Aug',9:'Sep',10:'Oct',11:'Nov',12:'Dec',1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'May',6:'Jun'};
    var rows='',totalC=0,totalP=0;
    g.months.forEach(function(m){
      var cv=g.cur[m]||0, pv=g.prev[m]||0; totalC+=cv; totalP+=pv;
      rows+='<tr><td>'+names[m]+'</td><td>৳'+bcr(cv)+' Cr</td><td>৳'+bcr(pv)+' Cr</td>'+
        '<td class="'+cls(cv-pv)+'">'+bcr(cv-pv)+'</td><td class="'+cls(cv-pv)+'">'+pf(pv?cv/pv-1:null)+'</td></tr>';
    });
    rows+='<tr style="border-top:2px solid var(--line)"><td><b>Total</b></td><td><b>৳'+bcr(totalC)+' Cr</b></td><td><b>৳'+bcr(totalP)+' Cr</b></td>'+
      '<td class="neg"><b>'+bcr(totalC-totalP)+'</b></td><td class="neg"><b>'+pf(totalP?totalC/totalP-1:null)+'</b></td></tr>';
    document.querySelector('#tRec tbody').innerHTML=rows;

    var W=980,H=250,pad={l:52,r:16,t:16,b:36};
    var maxV=Math.max.apply(null,g.months.map(function(m){return Math.max(g.cur[m]||0,g.prev[m]||0);}).concat([1]));
    var bw=(W-pad.l-pad.r)/Math.max(1,g.months.length);
    var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%">';
    for(var i=0;i<=4;i++){var y=pad.t+(H-pad.t-pad.b)*i/4;
      s+='<line x1="'+pad.l+'" x2="'+(W-pad.r)+'" y1="'+y+'" y2="'+y+'" stroke="#22303f"/>';
      s+='<text x="'+(pad.l-6)+'" y="'+(y+3)+'" fill="#8b9bb0" font-size="8.5" text-anchor="end">'+Math.round(maxV*(1-i/4)/1e7)+'</text>';}
    g.months.forEach(function(m,k){
      var x=pad.l+k*bw;
      var hc=(H-pad.t-pad.b)*(g.cur[m]||0)/maxV, hp=(H-pad.t-pad.b)*(g.prev[m]||0)/maxV;
      s+='<rect x="'+(x+bw*0.12)+'" y="'+(H-pad.b-hp)+'" width="'+(bw*0.36)+'" height="'+hp+'" fill="rgba(139,155,176,.35)"/>';
      s+='<rect x="'+(x+bw*0.52)+'" y="'+(H-pad.b-hc)+'" width="'+(bw*0.36)+'" height="'+hc+'" fill="'+(hc<hp?'#f26d6d':'#2dd4bf')+'"/>';
      s+='<text x="'+(x+bw/2)+'" y="'+(H-14)+'" fill="#8b9bb0" font-size="9" text-anchor="middle">'+names[m]+'</text>';
    });
    s+='</svg><div class="legend"><span><i style="background:rgba(139,155,176,.5)"></i>Same month last FY</span><span><i style="background:#f26d6d"></i>This FY (below last year)</span></div>';
    document.getElementById('cRec').innerHTML=s;

    // drivers by category
    var cur={},prev={};
    FR.codes.forEach(function(cc){
      var s2=FR.series[cc],cat=(META[cc]||{}).cat||'Unmapped';
      FR.idxs.forEach(function(mi,k){var x=s2[k];if(!x)return;var mo=+M[mi].slice(5,7),fy=fyOf(M[mi]);
        var latest=fyOf(M[FR.idxs[FR.idxs.length-1]]);
        if(fy===latest) cur[cat]=(cur[cat]||0)+x.v; else if(fy===latest-1) prev[cat]=(prev[cat]||0)+x.v;});
    });
    var cats=Object.keys(cur).map(function(k){return {k:k,d:(cur[k]||0)-(prev[k]||0),c:cur[k]||0,p:prev[k]||0};}).sort(function(a,b){return a.d-b.d;});
    var maxD=Math.max.apply(null,cats.map(function(x){return Math.abs(x.d);}).concat([1]));
    var drv='<div style="display:flex;flex-direction:column;gap:6px">';
    cats.slice(0,8).forEach(function(x){
      drv+='<div style="display:grid;grid-template-columns:130px 1fr 80px;gap:8px;align-items:center">'+
        '<div style="font-size:11px">'+x.k+'</div>'+
        '<div style="background:#16202e;border-radius:4px;height:9px"><div style="width:'+(Math.abs(x.d)/maxD*100)+'%;height:100%;border-radius:4px;background:'+(x.d<0?'#f26d6d':'#2dd4bf')+'"></div></div>'+
        '<div style="text-align:right;font-size:10.5px;color:'+(x.d<0?'#f26d6d':'#2dd4bf')+'">'+bcr(x.d)+' Cr</div></div>';
    });
    drv+='</div>';
    document.getElementById('recDrivers').innerHTML=drv;

    var worst=cats.slice(0,3).map(function(x){return x.k;}).join(', ');
    var gapCr=totalC-totalP;
    document.getElementById('recPlan').innerHTML=
      '<div class="smart">'+
      '<div><span class="sk">S</span><p>Recover ৳'+bcr(Math.abs(gapCr))+' Cr over the remaining '+fyLab(fyOf(M[FR.idxs[FR.idxs.length-1]]))+' months, led by '+worst+'.</p></div>'+
      '<div><span class="sk">M</span><p>Monthly run-rate needs to move from ৳'+bcr(totalC/g.months.length)+' Cr to ৳'+bcr(totalP/g.months.length)+' Cr — a '+pf(totalP?totalC/totalP-1:null)+' gap to close.</p></div>'+
      '<div><span class="sk">A</span><p>Levers that exist today: re-declare the grid on the at-risk SKUs, stop cuts that lost volume, and push the categories where price rose with volume.</p></div>'+
      '<div><span class="sk">R</span><p>Assumes no further price war in bulk commodities; a competitor cut would move the gap, not close it.</p></div>'+
      '<div><span class="sk">T</span><p>Review monthly; Q3 checkpoint (Jan-2027) against the '+names[g.months[0]]+'–'+names[g.months[g.months.length-1]]+' baseline.</p></div>'+
      '</div>'+
      '<div class="small" style="margin-top:10px;line-height:1.7"><b>7P check.</b> '+
      '<b>Product</b> — bulk commodity codes dominate, so differentiation is thin. '+
      '<b>Price</b> — the declared grid is above transacted price on most declared SKUs. '+
      '<b>Place</b> — Chittagong and Narayanganj zones carry the largest delivered value. '+
      '<b>Promotion</b> — schemes exist only on Distributor and only from Dec-2025. '+
      '<b>People</b> — the sales force is incentivised on volume, not realisation. '+
      '<b>Process</b> — discount approvals sit outside the declared grid. '+
      '<b>Physical evidence</b> — MRP on pack is not the price the market pays.</div>'+
      '<div class="small" style="margin-top:8px;line-height:1.7"><b>Game theory.</b> In bulk rice/wheat the competitor set is fragmented (12 brands surveyed); a unilateral price cut is matched within weeks, so the cut buys share only temporarily while permanently lowering the reference price. The credible move is to hold price on elastic SKUs and compete on availability, not to lead a cut.</div>';
  })();
}

`;
c=c.slice(0,a)+block+c.slice(b);
c=c.replace("renderJumps(); renderPg(); renderEl(); renderDecision();","renderJumps(); renderPg(); renderEl(); renderDDA();");
fs.writeFileSync('client.frag.html',c);console.log('DDA renderer installed');
