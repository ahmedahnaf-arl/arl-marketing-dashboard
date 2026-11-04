const fs=require('fs');const d=JSON.parse(fs.readFileSync('data/delivery_fy.json','utf8')).rows;
console.log(d.map(r=>'FY'+r.fy+': '+r.deliveries+' deliveries, '+r.partners+' partners').join('\n'));
