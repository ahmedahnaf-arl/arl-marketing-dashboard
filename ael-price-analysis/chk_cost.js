const fs=require('fs');
const j=JSON.parse(fs.readFileSync('C:/Users/Hp/.local/share/opencode/tool-output/tool_1a5b8f266001485gDZUf03zLLi','utf8'));
const rows=j.rows||[];
console.log('rows',rows.length,'count',j.count);
const withCost=rows.filter(r=>+r.numAverageRate>0);
console.log('with numAverageRate>0:',withCost.length);
console.log('sample:',withCost.slice(0,5).map(r=>r.strItemCode+' | '+r.strItemName+' | avg='+r.numAverageRate+' stdPur='+r.numStdPurchaseRate+' stdProd='+r.numStdProductionRate).join('\n'));
const cats={}; withCost.forEach(r=>{cats[r.strItemCategoryName]=(cats[r.strItemCategoryName]||0)+1;});
console.log('categories:',Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,12).map(x=>x[0]+':'+x[1]).join(', '));
