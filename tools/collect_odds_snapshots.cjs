#!/usr/bin/env node
'use strict';
// Read-only odds collector. Never alters predictions, results, or the website.
// A fetch timestamp is an OBSERVATION time, not the upstream quote's publication time.
const fs=require('node:fs'),path=require('node:path');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const compact=date.replace(/-/g,'');
const base=path.resolve(__dirname,'../data/auto');
const predictionFile=path.join(base,date+'.json');
if(!fs.existsSync(predictionFile)){console.log('No predictions for '+date);process.exit(0);}
const prediction=JSON.parse(fs.readFileSync(predictionFile,'utf8'));
const endpoints=[
 'https://lamrongol.github.io/BoatraceOdds/v3/'+compact.slice(0,4)+'/'+compact+'.json',
 'https://lamrongol.github.io/BoatraceOdds/v3/today.json'
];
const combinations=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a!==b&&a!==c&&b!==c)combinations.push(a+'-'+b+'-'+c);
function parseCutoff(s){if(typeof s!=='string')return NaN;const m=s.match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)$/);return m?Date.parse(m[1]+'T'+m[2]+'+09:00'):NaN;}
async function main(){
 let source=null,data=null,observedAt=null;
 for(const url of endpoints){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'cache-control':'no-cache'}});
   if(!response.ok)throw Error('HTTP '+response.status);
   const body=await response.json();
   if(!Array.isArray(body?.odds)||!body.odds.length)throw Error('No odds');
   if(body.odds.some(x=>x.date!==date))throw Error('Mixed or wrong date');
   data=body.odds;source=url;observedAt=new Date().toISOString();break;
  }catch(e){console.warn('Odds source unavailable:',url,e.message);}
 }
 if(!data){console.log('No valid odds source; no snapshot written');return;}
 const outdir=path.resolve(__dirname,'../data/odds');fs.mkdirSync(outdir,{recursive:true});
 const dest=path.join(outdir,date+'.json');
 const existing=fs.existsSync(dest)?JSON.parse(fs.readFileSync(dest,'utf8')):{date,schema:'odds-observation-v1',races:{}};
 if(existing.date!==date||existing.schema!=='odds-observation-v1'||!existing.races||typeof existing.races!=='object')throw Error('Unexpected existing snapshot schema');
 let stored=0,skipped=0;
 const indexed=new Map(),duplicates=new Set();
 for(const x of data){
  const venue=Number(x.stadium_number),race=Number(x.number);
  if(!Number.isInteger(venue)||venue<1||venue>24||!Number.isInteger(race)||race<1||race>12)continue;
  const key=venue+'-'+race;
  if(indexed.has(key)||duplicates.has(key)){console.warn('Duplicate source race; excluding:',key);duplicates.add(key);indexed.set(key,null);continue;}
  indexed.set(key,x);
 }
 for(const r of prediction.races||[]){
  const cutoffMs=parseCutoff(r.cutoff),nowMs=Date.parse(observedAt);
  // Never record odds as usable pre-race if captured after cutoff. A source may be stale;
  // its unknown publication time is explicitly NOT inferred from observation time.
  if(!Number.isFinite(cutoffMs)||r.raceDate!==date||nowMs>=cutoffMs){skipped++;continue;}
  const key=Number(r.venue)+'-'+Number(r.race),item=indexed.get(key);
  if(!item||item.date!==date||!item.trifecta_odds)continue;
  const flat={};
  for(const combo of combinations){
   const [a,b,c]=combo.split('-'),raw=item.trifecta_odds?.[a]?.[b]?.[c];
   if(raw===null||raw===undefined||raw==='')continue;
   const value=Number(raw);
   if(Number.isFinite(value)&&value>=1&&value<=1000000)flat[combo]=value;
  }
  if(Object.keys(flat).length!==120)continue;
  const previous=existing.races[key];
  // Preserve first observed pre-cutoff odds per race, avoiding retrospective overwrite.
  if(previous)continue;
  existing.races[key]={venue:Number(r.venue),race:Number(r.race),cutoff:r.cutoff,observedAt,source,sourcePublishedAt:null,sourceFreshnessVerified:false,odds:flat};
  stored++;
 }
 if(stored){const temp=dest+'.tmp';fs.writeFileSync(temp,JSON.stringify(existing,null,2)+'\n');fs.renameSync(temp,dest);}
 console.log(JSON.stringify({date,stored,skipped,previouslyStored:Object.keys(existing.races).length-stored,source,notice:'Observation timestamp only; upstream quote freshness unverified. Do not treat as exact prediction-time odds.'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
