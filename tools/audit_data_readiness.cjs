// Offline source/feature inventory for BOAT NEXUS. Never fetches an API or changes production.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const roots=[{name:'daily-predictions',dir:'data/auto'},{name:'extra-features',dir:'data/features'}];
const groups={
 racer:['national_win_rate','local_win_rate','national_top_2_percent','national_top_3_percent','local_top_2_percent','local_top_3_percent','motor_top_2_percent','motor_top_3_percent','boat_top_2_percent','boat_top_3_percent','average_start_timing','flying_count','late_count','course_win_rate','recent_results'],
 preview:['wind_speed','wind_direction_number','wave_height','air_temperature','water_temperature','weather_number'],
 previewRacer:['course_number','exhibition_time','start_timing','tilt_adjustment']
};
const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const report={schema:'boat-nexus-data-readiness-v1',note:'Offline snapshot inventory, not source availability or model accuracy.',sources:{},features:{},missingPriorities:[]};
for(const [group,keys] of Object.entries(groups))for(const k of keys)report.features[group+'.'+k]={observed:0,nonNull:0,rows:0};
for(const root of roots){
 const files=fs.existsSync(root.dir)?fs.readdirSync(root.dir).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort():[];
 let races=0,settled=0;
 for(const file of files){
  const doc=JSON.parse(fs.readFileSync(path.join(root.dir,file),'utf8'));
  for(const r of doc.races||[]){
   races++;if(r.result?.winningCombinations?.length)settled++;
   const count=(group,values)=>{for(const k of groups[group]){const o=report.features[group+'.'+k];o.rows++;if(values&&Object.hasOwn(values,k)){o.observed++;if(valid(values[k]))o.nonNull++;}}};
   if(root.name==='daily-predictions'){
    for(let lane=1;lane<=6;lane++)count('racer',r.features?.[String(lane)]);
   }else{
    count('preview',r.previewFields);
    for(let lane=1;lane<=6;lane++){
     count('racer',r.lanes?.[String(lane)]?.racer);
     count('previewRacer',r.lanes?.[String(lane)]?.preview);
    }
   }
  }
 }
 report.sources[root.name]={files:files.length,races,settledRaces:settled,dates:files.map(x=>x.slice(0,10))};
}
report.missingPriorities=Object.entries(report.features).filter(([,v])=>v.nonNull===0).map(([name])=>name);
console.log(JSON.stringify(report,null,2));
