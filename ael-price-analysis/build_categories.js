const fs=require('fs');
const csv=fs.readFileSync('data/categories_raw.csv','utf8').replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
const rows=[];
for(let i=1;i<csv.length;i++){
  const line=csv[i];
  const m=line.match(/^"?([^"]*?)"?,(.+)$/); if(!m) continue;
  const name=m[1].trim(), cat=m[2].trim().replace(/^"|"$/g,'');
  if(!name||!cat) continue;
  rows.push({name,cat});
}
const norm=s=>s.toLowerCase().replace(/\s+/g,' ').replace(/[\u2013\u2014]/g,'-').trim();
const byCode={}, byName={};
for(const r of rows){
  const cm=[...r.name.matchAll(/\[(\d+)\]/g)];
  if(cm.length) byCode[cm[cm.length-1][1]]=r.cat;
  byName[norm(r.name)]=r.cat;
  byName[norm(r.name.replace(/\s*\[\d+\]/g,''))]=r.cat;
}
const P=JSON.parse(fs.readFileSync('data/panel_full.json','utf8').replace(/^\uFEFF/,''));
const names={}; for(const r of P.rows){ if(r.n) names[r.c]=r.n; }
const codes=Object.keys(names);

const RULES=[
 [/banglamoti|bashmoti|basmoti|food godown|guti shorna|guti|hybrid|kalijeera|kalijera|kataribhog|katarivog|swarna|brri|paddy|dhan|sorting rice|resorting|atop sorting/, 'Rice'],
 [/pickle/, 'Pickle'],
 [/biscuit|biscuts|noodles|cake|chanachur|chips|wafer|\bbar\b|\bmoa\b|rusk|cookie/, 'Snacks'],
 [/\bgur\b|misri|molasses/, 'Sweets'],
 [/bay leaf|cinamon|cinnamon|isabgol|sabu dana|cardamom|clove|chilli|coriander|cumin|garam|kala jeera|saffron|black pepper|white pepper|fenugreek|methi|ajwain|radura/, 'Masala'],
 [/\bflour\b/, 'Maida'],
 [/scrap|unusable/, 'Scrap'],
 [/\bbag\b|jute|ppw|pet jar|\bdrum\b|tarpaulin|\bpoly\b|polythene|label|sticker|\btape\b|wrapper|\bpouch\b|\bjar\b|\blid\b|\bcap\b|\bbox\b|fly board|gummy|gumy|hessain|hessian|\broll\b|\bfilm\b|\bthread\b|\bneedle\b|\bglue\b|\bink\b/, 'Packaging'],
 [/wastage|\bempty\b/, 'Wastage'],
 [/coffee/, 'Tea'],
 [/toast|cracker|nimki|monakka|cookie|rusk|snack/, 'Snacks'],
 [/drink|juice|litchi|lychee|sherbet|syrup drink/, 'Beverage'],
 [/soup/, 'Soup'],
 [/beson|besan/, 'Lentil'],
 [/ghee/, 'Ghee'],
 [/supari|bettel|betel/, 'Betel'],
 [/curry powder|curry/, 'Masala'],
 [/date syrup|honey|jaggery/, 'Sweets'],
 [/bokhara|prune|raisin|almond|cashew|pista/, 'Fruit'],
 [/tokma|basil/, 'Seed'],
 [/musterd/, 'Mustard Oil'],
 [/rice/, 'Rice'],
 [/turmeric|black paper|black pepper/, 'Masala'],
 [/haleem|kheer|chotpoti|panipuri|chutney|muri|murali|birui|halwa|payesh/, 'Snacks'],
 [/chia/, 'Seed'],
 [/garlic|onion|\bmango\b|boroi|vegetable|potato/, 'Vegetable'],
 [/balam|binni|balam/, 'Rice'],
 [/stone/, 'Non-trade'],
 [/isub gul|isabgol/, 'Herbs'],
 [/\bchili\b|chilli/, 'Masala'],
 [/fried pea|penut|peanut|falooda|pitha|khichuri|jhal muri/, 'Snacks'],
 [/kala vuna|cardamon|panch phoron|tetul|tamarind/, 'Masala'],
 [/chana|chickpea/, 'Lentil'],
 [/kalonji|bean seed/, 'Seed'],
 [/chirota|yashtimadhu/, 'Herbs'],
 [/saline|lighter|soap|purification tablet|detergent|toothpaste/, 'Non-food'],
 [/freight|charge|service/, 'Service'],
 [/silky bran/, 'Silky Bran'],
 [/\bbran\b/, 'Bran'],
 [/chinigura|miniket|katari|jirashail|zirashail|najir|nazir|basmati|basmoti|paijam|atash|kalo machhi|tamri|khud|kuchi|chita|kajol|tulsimala|jamai|shiddho|shiddo|\brice\b|chira|flatten/, 'Rice'],
 [/brown atta|\batta\b/, 'Atta'],
 [/\bmaida\b/, 'Maida'],
 [/\bsuji\b|semolina/, 'Suji'],
 [/lentil|chickpea|chick pea|yellow pea|nipper|\bdal\b|bogor|basan|motor/, 'Lentil'],
 [/\bwheat\b/, 'Wheat'],
 [/canola/, 'Canola'],
 [/mustard oil|mustard\s*-\s*yellow/, 'Mustard Oil'],
 [/soyabean|soybean|soya/, 'Soybean Oil'],
 [/palm olein|palm oil/, 'Palm Oil'],
 [/oil cake/, 'Oil Cake'],
 [/\bsalt\b/, 'Salt'],
 [/\btea\b/, 'Tea'],
 [/masala/, 'Masala'],
 [/semai|vermicelli/, 'Semai'],
 [/sugar/, 'Sugar'],
 [/husk/, 'Husk'],
 [/dust/, 'Dust'],
 [/puffed rice/, 'Puffed Rice'],
 [/mustard seed|\bseed\b/, 'Seed'],
 [/carton|cartoon|ppw bag|gummy|gumy|poly|wastage bag|fly board/, 'Carton'],
 [/\bdates\b/, 'Fruit'],
 [/\bcone\b/, 'Cone']
];

const out={}; const method={};
for(const c of codes){
  const n=names[c];
  if(byCode[c]){ out[c]=byCode[c]; method[c]='code'; continue; }
  if(byName[norm(n)]){ out[c]=byName[norm(n)]; method[c]='name'; continue; }
  const base=norm(n).replace(/\s*\[[^\]]*\]/g,'');
  if(byName[base]){ out[c]=byName[base]; method[c]='name'; continue; }
  let hit=null;
  for(const [re,cat] of RULES){ if(re.test(base)){ hit=cat; break; } }
  if(hit){ out[c]=hit; method[c]='rule'; } else { out[c]=null; method[c]='none'; }
}
fs.writeFileSync('data/categories.json',JSON.stringify({map:out,method,sourceRows:rows.length},null,0));
const counts={}, mc={};
for(const c of codes){ const k=out[c]||'(unmatched)'; counts[k]=(counts[k]||0)+1; mc[method[c]]=(mc[method[c]]||0)+1; }
console.log('sheet rows',rows.length,'SKUs',codes.length);
console.log('method',JSON.stringify(mc));
console.log('categories:');
Object.entries(counts).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log('  '+k+': '+v));
const un=codes.filter(c=>!out[c]);
console.log('\nUNMATCHED',un.length);
un.slice(0,40).forEach(c=>console.log('  '+c+'  '+names[c]));
