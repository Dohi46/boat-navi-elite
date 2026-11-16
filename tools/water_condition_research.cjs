// BOAT NEXUS water-condition research model (experimental; not used by v13).
// Pure functions, zero network requests, no prediction/betting recommendations.
'use strict';
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
function classifyConditions(preview,venueProfile){
 const p=preview||{},v=venueProfile||{};
 const speed=finite(p.wind_speed),wave=finite(p.wave_height);
 const direction=finite(p.wind_direction_number);
 const temperature=finite(p.air_temperature),water=finite(p.water_temperature);
 const warnings=[],missing=[];
 if(speed===null)missing.push('wind_speed');
 if(direction===null)missing.push('wind_direction_number');
 if(wave===null)missing.push('wave_height');
 if(!v.windOrientation)warnings.push('風向コードと水面軸の対応未検証：向かい風・追い風は判定しない');
 if(v.knowledgeStatus!=='verified')warnings.push('競艇場別の特徴は未検証');
 const windBand=speed===null?'unknown':speed<3?'low':speed<6?'moderate':'strong';
 const waveBand=wave===null?'unknown':wave<3?'low':wave<6?'moderate':'high';
 // Wind thresholds are exploratory bins only, not proven race-outcome effects.
 return {status:missing.length?'incomplete':'descriptive-only',windSpeed:speed,windDirectionCode:direction,waveHeight:wave,airTemperature:temperature,waterTemperature:water,windBand,waveBand,headwindOrTailwind:'unknown',venue:Number(v.venue)||null,missing,warnings,modelVersion:'water-research-v1'};
}
function summarizeSnapshot(snapshot,profiles){
 const byVenue=new Map((profiles?.profiles||profiles||[]).map(p=>[Number(p.venue),p]));
 const rows=(snapshot?.races||[]).map(r=>({venue:r.venue,race:r.race,cutoff:r.cutoff,condition:classifyConditions(r.previewFields,byVenue.get(Number(r.venue)))}));
 return {date:snapshot?.date||null,races:rows.length,withWind:rows.filter(r=>r.condition.windSpeed!==null).length,withWave:rows.filter(r=>r.condition.waveHeight!==null).length,rows};
}
module.exports={classifyConditions,summarizeSnapshot};
if(require.main===module){
 const fs=require('node:fs'),[,,snapshotPath,profilesPath]=process.argv;
 if(!snapshotPath||!profilesPath){console.error('Usage: node tools/water_condition_research.cjs data/features/YYYY-MM-DD.json research/venue-profiles.json');process.exitCode=2;}
 else {
  const result=summarizeSnapshot(JSON.parse(fs.readFileSync(snapshotPath,'utf8')),JSON.parse(fs.readFileSync(profilesPath,'utf8')));
  console.log(JSON.stringify({date:result.date,races:result.races,withWind:result.withWind,withWave:result.withWave,coveragePercent:result.races?Math.round(100*result.withWind/result.races):0},null,2));
 }
}
