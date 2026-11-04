const fs=require('fs');let c=fs.readFileSync('client.frag.html','utf8');
c=c.replace("document.getElementById('riskNote').innerHTML='<b>Why this is not a P&amp;L loss list.</b> AEL posts no COGS: 0 of 234,781 delivery lines carry a cost, and the item master average rate implies every top SKU sells below cost (e.g. Atta 1 kg ৳64.3 cost vs ৳53 realised), which is not credible. Rather than publish a fake gross margin, this block screens <b>price realisation</b> — the gap between the price actually transacted and the price the business declared. '+risk.length+' SKUs fail that screen.';",
"document.getElementById('riskNote').innerHTML='<b>Why this is not a SKU P&amp;L.</b> The GL does carry cost of goods sold (account 4810001) and the BU-level margin is shown above, but no SKU-level cost is posted anywhere in the ERP (delivery-row COGS is zero on every line; the item-master rate is not credible). A per-SKU loss list would therefore be invented. This block instead screens <b>price realisation</b> — the gap between the price actually transacted and the price the business declared. '+risk.length+' SKUs fail that screen.';");

/* financing action row */
c=c.replace("      ['Low','Hold recovery review monthly against the ৳'",
`      ['High','Escalate the financing cost: it is the largest single drag on profit','Interest/financial expense exceeds gross profit at BU level (see Decision 4 and the FY table)','CFO / Treasury'],
      ['Low','Hold recovery review monthly against the ৳'`);
fs.writeFileSync('client.frag.html',c);console.log('risk note + finance action');
