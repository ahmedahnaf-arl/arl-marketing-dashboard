const fs=require('fs');let c=fs.readFileSync('client.frag.html','utf8');

/* ---- 4th decision card + financial chart + 7P ---- */
c=c.replace("    var top=dec.slice(0,15);",
`    /* financial reality */
    var pl=fyPL(), plFys=Object.keys(pl).map(Number).sort(function(a,b){return a-b;});
    var lastFy=plFys[plFys.length-1], p=pl[lastFy]||null;
    if(p&&p.rev>0){
      var gp=p.rev-p.cogs, opex=p.sell+p.log+p.mkt+p.adm, fin=p.fin, np=gp-opex-fin+p.oi;
      document.getElementById('decCards').innerHTML +=
        '<div class="card" style="background:var(--panel2)"><div class="gl" style="color:var(--amber);font-size:10px;letter-spacing:.8px">DECISION 4 · MARGIN vs FINANCING</div>'+
        '<p style="font-size:12.4px;margin:6px 0 0">'+fyLab(lastFy)+' gross margin is <b>'+pf(gp/p.rev)+'</b> (৳'+bcr(gp)+' Cr) against financing cost of <b>৳'+bcr(fin)+' Cr</b> ('+pf(fin/p.rev)+' of revenue). '+
        'Financing alone is '+(gp>0?(fin/gp).toFixed(1)+'×':'more than')+' gross profit — price and cost moves that do not fix this are rearranging the deck chairs.</p></div>';

      var W=560,H=220,pad={l:46,r:52,t:16,b:30};
      var maxAbs=Math.max.apply(null,plFys.map(function(f){var q=pl[f];return Math.max(Math.abs((q.rev-q.cogs)/q.rev),Math.abs(q.fin/q.rev));}).concat([0.05]));
      var bw=(W-pad.l-pad.r)/Math.max(1,plFys.length);
      var s5='<svg viewBox="0 0 '+W+' '+H+'" width="100%">';
      s5+='<line x1="'+pad.l+'" x2="'+(W-pad.r)+'" y1="'+(pad.t+(H-pad.t-pad.b)/2)+'" y2="'+(pad.t+(H-pad.t-pad.b)/2)+'" stroke="#3a4a5e"/>';
      var mid=pad.t+(H-pad.t-pad.b)/2;
      plFys.forEach(function(f,i){var q=pl[f],g=(q.rev-q.cogs)/q.rev,fn=q.fin/q.rev,x=pad.l+i*bw+bw*0.2;
        var hg=(H-pad.t-pad.b)*0.5*Math.abs(g)/maxAbs, hf=(H-pad.t-pad.b)*0.5*Math.abs(fn)/maxAbs;
        s5+='<rect x="'+x+'" y="'+(g>=0?mid-hg:mid)+'" width="'+(bw*0.28)+'" height="'+hg+'" fill="'+(g>=0?'#2dd4bf':'#f26d6d')+'" opacity=".85"/>';
        s5+='<rect x="'+(x+bw*0.32)+'" y="'+mid+'" width="'+(bw*0.28)+'" height="'+hf+'" fill="#f5a524" opacity=".75"/>';
        s5+='<text x="'+(x+bw*0.3)+'" y="'+(H-10)+'" fill="#8b9bb0" font-size="8" text-anchor="middle">FY'+String(f).slice(2)+'</text>';});
      s5+='</svg><div class="legend"><span><i style="background:#2dd4bf"></i>GP % of revenue</span><span><i style="background:#f5a524"></i>Financing % of revenue</span></div>';
      document.getElementById('cFin').innerHTML=s5;
      document.getElementById('decFinNote').innerHTML='<div class="note-box"><b>Why this matters for pricing.</b> With financing at '+pf(fin/p.rev)+' of revenue, every point of gross margin is worth roughly ৳'+
        bcr(p.rev/100)+' Cr a year. The business needs about <b>'+pf((fin+opex)/p.rev)+'</b> gross margin just to break even — '+
        (gp/p.rev<(fin+opex)/p.rev?'it is currently below that line.':'it is currently above that line.')+
        ' That is the bar any price decision has to clear.</div>';
    }

    var top=dec.slice(0,15);`);

/* 7P */
c=c.replace("  /* ---------- 05 Recovery ---------- */",
`  /* ---------- 06 · 7P ---------- */
  (function(){
    var tot=0; FR.idxs.forEach(function(mi){tot+=FR.agg[mi].v;})||1;
    var chT={}; for(var i=0;i<CHROWS.length;i++){var r=CHROWS[i];if(r[0]<F.from||r[0]>F.to)continue;
      if(F.cats.size){var mm=META[r[2]];if(!mm||!F.cats.has(mm.cat||'Unmapped'))continue;}
      chT[r[1]]=(chT[r[1]]||0)+r[4];}
    var chSum=Object.keys(chT).reduce(function(a,k){return a+chT[k];},0)||1;
    var chs=Object.keys(chT).map(Number).sort(function(a,b){return chT[b]-chT[a];}).slice(0,3)
      .map(function(c){return (CHN[c]||c)+' '+pf(chT[c]/chSum,0);}).join(' · ');
    var cats={}; FR.codes.forEach(function(cc){var k=(META[cc]||{}).cat||'Unmapped';cats[k]=(cats[k]||0)+1;});
    var catTop=Object.keys(cats).sort(function(a,b){return cats[b]-cats[a];}).slice(0,3).join(', ');
    var decl=FR.codes.filter(function(cc){var m=META[cc];return m&&(m.dp!=null||m.tp!=null||m.mrp!=null);});
    var below=decl.filter(function(cc){var m=META[cc],st=rowStats(cc);return m.tp&&st.lastP&&st.lastP<m.tp*0.95;});
    var mrpReal=[]; FR.codes.forEach(function(cc){var m=META[cc],st=rowStats(cc);if(m&&m.mrp&&st.lastP)mrpReal.push(st.lastP/m.mrp);});
    mrpReal.sort(function(a,b){return a-b;});
    var medMrp=mrpReal.length?mrpReal[Math.floor(mrpReal.length/2)]:null;
    var schemes=(D.schemes||[]).length, active=(D.schemes||[]).filter(function(x){return x.act;}).length;
    var booked=(D.booked||[]).filter(function(b){return b.ym>=FR.months[0]&&b.ym<=FR.months[FR.months.length-1];})
      .reduce(function(a,b){return a+b.amt;},0);
    var free=0; Object.keys(FR.agg).forEach(function(i){free+=FR.agg[i].f;});
    var zones=(D.zones||[]).slice(0,3).map(function(z){return z.zone+' ৳'+bcr(z.value)+' Cr';}).join(' · ');
    var delfy=(D.delFy||[]).filter(function(d){return d.partners;});
    var partners=delfy.length?delfy[delfy.length-1].partners:null;
    var pricePoints=(D.decl||[]).reduce(function(a,d){return a+d.pts.length;},0);
    var els=[];FR.codes.forEach(function(cc){var e=usableEl(cc);if(e)els.push(e.b);});
    els.sort(function(a,b){return a-b;});
    var medEl=els.length?els[Math.floor(els.length/2)]:null;

    var card=function(k,v,t){return '<div class="card" style="background:var(--panel2)"><div class="gl" style="color:var(--amber);font-size:10px;letter-spacing:.8px">'+k+'</div><div style="font-size:15px;font-weight:600;margin:6px 0 2px">'+v+'</div><p class="small" style="margin:0;line-height:1.5">'+t+'</p></div>';};
    document.getElementById('p7').innerHTML=
      card('PRODUCT', nf(FR.codes.length)+' SKUs · '+Object.keys(cats).length+' categories',
        'Top categories by SKU count: '+catTop+'. The bulk commodity tail dominates revenue, so product decisions are really range decisions.')+
      card('PRICE', (medEl!=null?'median β '+medEl.toFixed(2):'β not measurable')+' · '+(mrpReal.length?('realized '+pf(medMrp,0)+' of MRP'):'no MRP on file'),
        decl.length+' SKUs carry a declared price; '+below.length+' trade >5% below declared TP. That gap is the single clearest pricing failure.')+
      card('PLACE', chs||'—',
        'Channel concentration is extreme: three channels carry most of the revenue. Top delivery zones: '+(zones||'—')+'.')+
      card('PROMOTION', schemes+' schemes · ৳'+bcr(booked)+' Cr booked',
        active+' schemes active, all on the Distributor channel. Free goods issued in view: '+nf(free)+' units. Discount booking only started Oct-2026, so history is thin.')+
      card('PEOPLE', partners!=null?nf(partners)+' buying partners':'partners not available',
        'Deliveries per partner and coverage drive volume more than price in bulk. The sales book is wide; realisation discipline is not.')+
      card('PROCESS', decl.length+' of '+FR.codes.length+' SKUs priced ('+pf(FR.codes.length?decl.length/FR.codes.length:null,0)+')',
        pricePoints+' declared price points on file. COGS is posted only at BU level in the GL, so SKU profitability is not auditable end-to-end — a governance gap.')+
      card('PHYSICAL EVIDENCE', medMrp!=null?('realized '+pf(medMrp,0)+' of MRP'):'MRP not on file',
        (mrpReal.length?mrpReal.length:'0')+' SKUs have an MRP on record. Where MRP exists, the shelf price is far above what the trade actually pays — the pack price is not the reference price.');
  })();

  /* ---------- 05 Recovery ---------- */`);
fs.writeFileSync('client.frag.html',c);console.log('4th card + 7P added');
