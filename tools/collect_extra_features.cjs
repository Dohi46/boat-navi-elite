// BOAT NEXUS experimental data inventory. Does not modify v13 or data/auto.
// Only records actual fields supplied by the public API; no fabricated values.
const fs=require('node:fs');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const endpoint='https://boatraceopenapi.github.io/api/v1/today.json';
const fields={
 racer:['course_win_rate','course_top_2_percent','course_top_3_percent','recent_win_rate','recent_top_2_percent','recent_results','recent_races','winning_methods','escape_rate','makuri_rate','sashi_rate','motor_top_2_percent','national_win_rate','local_win_rate','average_start_timing'],
 race:['weather','wind_direction','wind_speed','wave_height','water_temperature','air_temperature','course','entry_course','closed_at'],
 preview:['weather','wind_direction','wind_speed','wave_height','water_temperature','air_temperature','entry_course','exhibition_time','start_timing']
};
function available(obj,names){const out={};if(!obj||typeof obj!=='object')return out;for(const key of names){const value=obj[key];if(value!==undefined&&value!==null&&value!=='')out[key]=value;}return out;}
async function main(){
 const response=await fetch(endpoint,{signal:AbortSignal.timeout(30000),headers:{'cache-control':'no-cache'}});
 if(!response.ok)throw Error('Source HTTP '+response.status);
 const source=await response.json(),stadiums=source?.programs?.stadiums;
 if(!stadiums||typeof stadiums!=='object')throw Error('Invalid source schema');
 const output={date,source:endpoint,capturedAt:new Date().toISOString(),schema:'experimental-feature-inventory-v1',races:[],coverage:{},observedKeys:{race:[],racer:[],preview:[],previewRacer:[]}};
 const observed={race:new Set(),racer:new Set(),preview:new Set(),previewRacer:new Set()};
 const coverage={};let racers=0;
 for(const [venue,stadium] of Object.entries(stadiums))for(const [raceNo,race] of Object.entries(stadium?.races||{})){
  if(race.date&&race.date!==date)continue;
  Object.keys(race||{}).forEach(k=>observed.race.add(k));
  Object.keys(race.preview||{}).forEach(k=>observed.preview.add(k));
  const extra=available(race,fields.race),preview=available(race.preview,fields.preview),lanes={};
  for(let lane=1;lane<=6;lane++){
   const racer=race.racers?.[lane],pre=race.preview?.racers?.[lane];
   if(racer){racers++;Object.keys(racer).forEach(k=>observed.racer.add(k));}
   if(pre)Object.keys(pre).forEach(k=>observed.previewRacer.add(k));
   const a=available(racer,fields.racer),b=available(pre,fields.preview);
   if(Object.keys(a).length||Object.keys(b).length)lanes[lane]={racer:a,preview:b};
   for(const key of Object.keys(a))coverage['racer.'+key]=(coverage['racer.'+key]||0)+1;
   for(const key of Object.keys(b))coverage['previewRacer.'+key]=(coverage['previewRacer.'+key]||0)+1;
  }
  for(const key of Object.keys(extra))coverage['race.'+key]=(coverage['race.'+key]||0)+1;
  for(const key of Object.keys(preview))coverage['preview.'+key]=(coverage['preview.'+key]||0)+1;
  output.races.push({venue:Number(venue),race:Number(raceNo),raceDate:date,cutoff:race.closed_at||null,raceFields:extra,previewFields:preview,lanes});
 }
 for(const [kind,set] of Object.entries(observed))output.observedKeys[kind]=[...set].sort();
 output.coverage={raceCount:output.races.length,racerCount:racers,fieldCounts:coverage};
 if(!output.races.length)throw Error('No races returned for '+date);
 fs.mkdirSync('data/features',{recursive:true});
 const target='data/features/'+date+'.json';
 fs.writeFileSync(target,JSON.stringify(output,null,2)+'\n');
 console.log('Saved',target,'races',output.races.length,'racer rows',racers);
 console.log('Available extra field counts:',JSON.stringify(coverage));
 console.log('Observed API keys:',JSON.stringify(output.observedKeys));
}
main().catch(e=>{console.error('FEATURE COLLECTION FAILED:',e.message);process.exitCode=1;});
