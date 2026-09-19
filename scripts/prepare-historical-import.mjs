import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync(new URL('../data/historical-sessions.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
const columns={id:'id',name:'name',pointsForWin:'points_for_win',pointsForLoss:'points_for_loss',startingPoints:'starting_points',finalPoints:'final_points',stayLoss:'stay_loss',stayWin:'stay_win',switchLoss:'switch_loss',switchWin:'switch_win',status:'status',source:'source',startingPointsSource:'starting_points_source'};
const quote=v=>typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const sql='-- Historical import only. Safe to rerun: existing rows are preserved.\n'+source.sessions.map(s=>'INSERT OR IGNORE INTO sessions ('+Object.values(columns).join(', ')+') VALUES ('+Object.keys(columns).map(k=>quote(s[k])).join(', ')+');').join('\n')+'\n';
fs.writeFileSync(new URL('../worker/seed-historical.sql',import.meta.url),sql);
console.log('Generated '+source.sessions.length+' historical database rows.');
