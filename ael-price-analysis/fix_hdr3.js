const fs=require('fs');let b=fs.readFileSync('build.js','utf8');
b=b.replace('<th>FY27 vs FY26</th>','<th>Revenue FY27 vs FY26</th>');
fs.writeFileSync('build.js',b);console.log('header relabelled');
