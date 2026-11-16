// Offline BOAT NEXUS research coverage audit. No network, no production writes.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(process.cwd(),'data/features');
const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort():[];
const keys=['wind_speed','wind_direction_number','wave_height','air_temperature','water_temperature','weather_number'];
const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const result={files:files.length,races:0,byField:Object.fromEntries(keys.map(k=>[k,0])),byVenue:{},byDate:{}};
for(const file of files){
 const doc=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
 const daily={races:0,byField:Object.fromEntries(keys.map(k=>[k,0]))};
 for(const race of doc.races||[]){
  result.races++;daily.races++;
  const id=String(race.venue).padStart(2,'0');
  const venue=result.byVenue[id]||(result.byVenue[id]={races:0,byField:Object.fromEntries(keys.map(k=>[k,0]))});
  venue.races++;
  for(const key of keys)if(valid(race.previewFields?.[key])){result.byField[key]++;daily.byField[key]++;venue.byField[key]++;}
 }
 result.byDate[doc.date||file.replace('.json','')]=daily;
}
console.log(JSON.stringify(result,null,2));
if(!files.length)console.error('No stored feature snapshots found; did not fetch data.');
