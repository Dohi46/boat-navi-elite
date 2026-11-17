// Daily operational monitor. Reports fresh issues separately from historical QA warnings.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const folder=process.argv[2]||'data/auto';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const yesterday=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10);
const target=process.env.BOAT_MONITOR_DATE||yesterday;
const problems=[],warnings=[];
const file=path.join(folder,target+'.json');
let doc=null;
if(!fs.existsSync(file))problems.push('Missing snapshot for '+target);
else {
 try{doc=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){problems.push('Invalid JSON for '+target+': '+e.message);}
}
const counters={races:0,settled:0,unsettled:0,preCutoff:0,cutoffInvalid:0,duplicate:0,invalidPicks:0,skipped:0};
if(doc){
 if(doc.date!==target)problems.push('Snapshot date mismatch');
 const seen=new Set();
 const races=Array.isArray(doc.races)?doc.races:[];
 counters.races=races.length;
 counters.skipped=Array.isArray(doc.skipped)?doc.skipped.length:0;
 if(!races.length)problems.push('No collected races for '+target);
 for(const r of races){
  const id=String(r.venue)+'/'+String(r.race);
  if(seen.has(id))counters.duplicate++;
  seen.add(id);
  const cutoff=Date.parse(String(r.cutoff||'').replace(' ','T')+'+09:00');
  const captured=Date.parse(r.capturedAt);
  if(!Number.isFinite(cutoff)||!Number.isFinite(captured))counters.cutoffInvalid++;
  else if(r.predictionPhase==='before'&&captured<cutoff)counters.preCutoff++;
  else counters.cutoffInvalid++;
  if(!Array.isArray(r.picks)||!r.picks.length||r.picks.some(p=>!/^([1-6])-([1-6])-([1-6])$/.test(String(p.pick))||new Set(String(p.pick).split('-')).size!==3||!Number.isFinite(p.stake)||p.stake<=0))counters.invalidPicks++;
  if(r.result)counters.settled++;else counters.unsettled++;
 }
 if(counters.duplicate)problems.push(counters.duplicate+' duplicate races');
 if(counters.invalidPicks)problems.push(counters.invalidPicks+' races with invalid picks');
 if(counters.unsettled)problems.push(counters.unsettled+' unsettled races');
 if(counters.cutoffInvalid)warnings.push(counters.cutoffInvalid+' races not proven pre-cutoff (historical tags may require review)');
 if(counters.skipped)warnings.push(counters.skipped+' skipped entries in collection snapshot');
}
const report={schema:'boat-nexus-operational-monitor-v1',date:target,generatedAt:new Date().toISOString(),status:problems.length?'alert':warnings.length?'review':'ok',counters,problems,warnings,note:'Checks stored snapshots only. Missing races cannot be inferred from collected race count alone; skipped entries and workflow failures require review.'};
console.log(JSON.stringify(report,null,2));
for(const p of problems)console.error('::error::'+p);
for(const w of warnings)console.warn('::warning::'+w);
if(problems.length)process.exitCode=1;
