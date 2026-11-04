const fs=require('fs');let b=fs.readFileSync('build.js','utf8');
b=b.replace('const ZONES = readJson(path.join(ROOT,"data","zones.json"), {rows:[]}).rows;',
'const ZONES = readJson(path.join(ROOT,"data","zones.json"), {rows:[]}).rows;\nconst PLM = readJson(path.join(ROOT,"data","pl_monthly.json"), {rows:[]}).rows;');
b=b.replace('  zones: ZONES,','  zones: ZONES,\n  plMonthly: PLM,');

// Direction table: add GP%/NP%
b=b.replace('<th>Fiscal year</th><th>Revenue</th><th>YoY</th><th>Deliveries</th><th>Active SKUs</th>',
'<th>Fiscal year</th><th>Revenue</th><th>YoY</th><th>GP %</th><th>NP %</th><th>Deliveries</th><th>Partners</th><th>SKUs</th>');

// Decision: add financial chart container + 4th card slot
b=b.replace('<div class="grid g3" id="decCards"></div>',
'<div class="grid g3" id="decCards"></div>\n    <div class="grid g2" style="margin-top:12px"><div><h3 style="font-size:12.5px;margin:0 0 6px">Margin vs financing cost, by fiscal year</h3><div id="cFin"></div></div><div id="decFinNote"></div></div>');

// 7P block before </section> of dec
b=b.replace('<div class="scroll" style="margin-top:12px"><table id="tRec">',
`<div class="card" style="margin-top:12px">
      <h3>06 · 7P marketing mix — each lever with its measured evidence</h3>
      <div class="hint">Product, Price, Place, Promotion, People, Process, Physical evidence — every line carries the number behind it from the current view.</div>
      <div class="grid g2" id="p7"></div>
    </div>
    <div class="scroll" style="margin-top:12px"><table id="tRec">`);
fs.writeFileSync('build.js',b);console.log('markup updated');
