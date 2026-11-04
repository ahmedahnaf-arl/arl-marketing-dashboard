const fs=require('fs');let c=fs.readFileSync('client.frag.html','utf8');

/* ---- P&L helper ---- */
c=c.replace("function renderDDA(){",
`function fyPL(){
  var lo=FR.months[0], hi=FR.months[FR.months.length-1];
  var out={};
  (D.plMonthly||[]).forEach(function(r){
    if(r.ym<lo||r.ym>hi) return;
    if(!(+r.revenue>0)) return;
    var f=fyOf(r.ym), o=out[f]||(out[f]={rev:0,cogs:0,sell:0,log:0,mkt:0,adm:0,fin:0,oi:0,n:0});
    var cost=+r.cogs;
    // reclass guard: when manufacturing is abnormally large it IS the cost of sales (COGS was reversed)
    if(+r.revenue>0 && (+r.mfg)/(+r.revenue)>0.05) cost=+r.cogs + +r.mfg;
    o.rev+=+r.revenue; o.cogs+=cost; o.sell+=+r.selling; o.log+=+r.logistics; o.mkt+=+r.marketing;
    o.adm+=+r.admin; o.fin+=+r.financial; o.oi+=+r.other_income; o.n++;
  });
  return out;
}
function renderDDA(){`);

/* ---- Direction: GP%/NP% columns ---- */
c=c.replace("var fy=fyRollup(), fys=Object.keys(fy).map(Number).sort(function(a,b){return a-b;});",
"var fy=fyRollup(), pl=fyPL(), fys=Object.keys(fy).map(Number).sort(function(a,b){return a-b;});");
c=c.replace(`      rows+='<tr><td><b>'+fyLab(f)+'</b>'+(partial?' <span class="small">('+o.months+' mo)</span>':'')+'</td><td>৳'+bcr(o.rev)+' Cr</td>'+
        '<td class="'+cls(yoy)+'">'+pf(yoy)+'</td>'+
        '<td>'+(o.del!=null?nf(o.del):'—')+'</td><td>'+nf(o.skus)+'</td></tr>';`,
`      var p=pl[f], gpPct=null, npPct=null;
      if(p&&p.rev>0){ gpPct=(p.rev-p.cogs)/p.rev; npPct=((p.rev-p.cogs)-(p.sell+p.log+p.mkt+p.adm)-p.fin+p.oi)/p.rev; }
      rows+='<tr><td><b>'+fyLab(f)+'</b>'+(partial?' <span class="small">('+o.months+' mo)</span>':'')+'</td><td>৳'+bcr(o.rev)+' Cr</td>'+
        '<td class="'+cls(yoy)+'">'+pf(yoy)+'</td>'+
        '<td class="'+(gpPct!=null?(gpPct<0?'neg':''):'')+'">'+pf(gpPct)+'</td>'+
        '<td class="'+(npPct!=null?(npPct<0?'neg':''):'')+'">'+pf(npPct)+'</td>'+
        '<td>'+(o.del!=null?nf(o.del):'—')+'</td><td>'+(o.partners!=null?nf(o.partners):'—')+'</td><td>'+nf(o.skus)+'</td></tr>';`);

/* partners into fyRollup */
c=c.replace("Object.keys(out).forEach(function(fy){var o=out[fy];o.skus=Object.keys(o.skus).length;o.del=(del[fy]||{}).deliveries||null;});",
"Object.keys(out).forEach(function(fy){var o=out[fy];o.skus=Object.keys(o.skus).length;o.del=(del[fy]||{}).deliveries||null;o.partners=(del[fy]||{}).partners||null;});");

fs.writeFileSync('client.frag.html',c);console.log('PL wired into direction');
