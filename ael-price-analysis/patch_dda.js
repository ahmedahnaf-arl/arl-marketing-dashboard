const fs=require('fs');let b=fs.readFileSync('build.js','utf8');
// zones cap
let p=fs.readFileSync('refresh.py','utf8');
p=p.replace("SELECT h.strTransportZoneName AS zone, COUNT(DISTINCT h.intDeliveryId) AS dels,","SELECT TOP 40 h.strTransportZoneName AS zone, COUNT(DISTINCT h.intDeliveryId) AS dels,");
fs.writeFileSync('refresh.py',p);

// load new data
b=b.replace('const COMPB = readJson(path.join(ROOT,"data","competitor_bench.json"), {rows:[]}).rows;',
`const COMPB = readJson(path.join(ROOT,"data","competitor_bench.json"), {rows:[]}).rows;
const DELFY = readJson(path.join(ROOT,"data","delivery_fy.json"), {rows:[]}).rows;
const ZONES = readJson(path.join(ROOT,"data","zones.json"), {rows:[]}).rows;`);
b=b.replace('  compBench: COMPB,','  compBench: COMPB,\n  delFy: DELFY,\n  zones: ZONES,');

// replace the decision section
const start=b.indexOf('<section id="dec">');
const end=b.indexOf('<section id="mt">');
if(start<0||end<0){console.log('section markers missing');process.exit(1);}
const sec = `<section id="dec">
  <div class="guide">
    <div><div class="gl">What this answers</div><p>Where the business is heading, what has to be decided, what to do now, which SKUs are at risk, and how to recover the revenue gap — in that order.</p></div>
    <div><div class="gl">How to read it</div><p>Five blocks, each pairing a plain-language summary with a proof table and a chart. Fiscal years are <b>July–June</b>; FY27 is the year that started July 2026. Every block is recomputed from the period / channel / category filters at the top.</p></div>
    <div><div class="gl">Source &amp; a caveat</div><p>Orders (net revenue), deliveries and zones from the ERP; declared DP/TP/MRP from the price grid; elasticity from monthly price–volume. <b>COGS is not posted for AEL</b> (0 of 234,781 delivery lines carry a cost), so margin-based “loss-making” screening is replaced by price-realisation risk — stated where it applies.</p></div>
  </div>
  <div class="note-box" id="ddaHead" style="margin-bottom:12px"></div>

  <div class="card" style="margin-top:12px">
    <h3>01 · Direction — where the business is heading</h3>
    <div class="hint">Monthly net revenue with fiscal-year boundaries. The table proves the trajectory; the SMART box states what it means.</div>
    <div id="cDir"></div>
    <div class="grid g2" style="margin-top:12px">
      <div><table id="tFy"><thead><tr><th>Fiscal year</th><th>Revenue</th><th>YoY</th><th>Deliveries</th><th>Active SKUs</th></tr></thead><tbody></tbody></table></div>
      <div id="smartDir"></div>
    </div>
  </div>

  <div class="card" style="margin-top:12px">
    <h3>02 · Decision — what has to be decided</h3>
    <div class="hint">Three decisions the data supports. Each card carries the number behind it.</div>
    <div class="grid g3" id="decCards"></div>
    <div id="cDec" style="margin-top:14px"></div>
    <div class="scroll" style="margin-top:12px"><table id="tDec"><thead><tr>
      <th>SKU</th><th>Category</th><th>Revenue</th><th>FY27 vs FY26</th><th>Realized vs TP</th><th>β</th><th>Read</th>
    </tr></thead><tbody></tbody></table></div>
  </div>

  <div class="card" style="margin-top:12px">
    <h3>03 · Action — what to do now</h3>
    <div class="hint">Prioritised moves, each with the evidence that justifies it.</div>
    <div class="scroll"><table id="tAct"><thead><tr><th>#</th><th>Priority</th><th>Action</th><th>Evidence</th><th>Owner</th></tr></thead><tbody></tbody></table></div>
  </div>

  <div class="card" style="margin-top:12px">
    <h3>04 · At-risk SKUs — price realisation</h3>
    <div class="hint">SKUs trading materially below their declared trade price, and SKUs losing both price and volume. This is a realisation-risk screen, not a P&amp;L loss screen.</div>
    <div id="cRisk"></div>
    <div class="scroll" style="margin-top:12px"><table id="tRisk"><thead><tr>
      <th>SKU</th><th>Category</th><th>Revenue</th><th>Realized</th><th>Declared TP</th><th>Gap</th><th>Price Δ</th><th>Volume Δ</th><th>Direction</th><th>Action</th>
    </tr></thead><tbody></tbody></table></div>
    <div class="note-box warn" id="riskNote" style="margin-top:12px"></div>
  </div>

  <div class="card" style="margin-top:12px">
    <h3>05 · Loss recovery plan</h3>
    <div class="hint">Same months, year on year, with the gap split by category and a SMART recovery plan.</div>
    <div id="cRec"></div>
    <div class="grid g2" style="margin-top:12px">
      <div><h3 style="font-size:12.5px;margin:0 0 6px">Where the gap came from</h3><div id="recDrivers"></div></div>
      <div><h3 style="font-size:12.5px;margin:0 0 6px">Recovery plan — SMART</h3><div id="recPlan"></div></div>
    </div>
    <div class="scroll" style="margin-top:12px"><table id="tRec"><thead><tr><th>Month</th><th>This FY</th><th>Last FY</th><th>Gap</th><th>Gap %</th></tr></thead><tbody></tbody></table></div>
  </div>
</section>

`;
b=b.slice(0,start)+sec+b.slice(end);
fs.writeFileSync('build.js',b);console.log('DDA section replaced');
