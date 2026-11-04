const fs=require('fs');
const j=JSON.parse(fs.readFileSync('C:/Users/Hp/.local/share/opencode/tool-output/tool_1a5b8f266001485gDZUf03zLLi','utf8'));
const r=j.rows[0]||{};
console.log('keys:',Object.keys(r).join(','));
console.log('first row:',JSON.stringify(r));
console.log('types:',Object.entries(r).map(([k,v])=>k+'='+typeof v).join(', '));
