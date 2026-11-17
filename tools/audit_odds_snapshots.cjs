#!/usr/bin/env node
'use strict';
// Read-only quality audit. Observed-at timestamps are not upstream publication timestamps.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../data/odds');
const files=fs.existsSync(root)?fs.readdirSync(root).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort():[];
const combos=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a!==b&&a!==c&&b!==c)combos.push(a+'-'+b+'-'+c);
const failures=[],summary=[];let total=0;
for(const file of files){
 let doc;
 try{doc=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));}catch(e){failures.push({file,error:'Unreadable JSON: '+e.message});continue;}
 if(doc.date!==file.slice(0,10)||doc.schema!=='odds-observation-v1'||!doc.races||typeof doc.races!=='object'){failures.push({file,error:'Invalid header'});continue;}
 let valid=0;
 for(const [key,r] of Object.entries(doc.races)){
  total++;
  const reasons=[];
  if(key!==r.venue+'-'+r.race||!Number.isInteger(r.venue)||r.venue<1||r.venue>24||!Number.isInteger(r.race)||r.race<1||r.race>12)reasons.push('invalid race identity');
  const cutoff=typeof r.cutoff==='string'&&/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(r.cutoff)?Date.parse(r.cutoff.replace(' ','T')+'+09:00'):NaN;
  const observed=Date.parse(r.observedAt);
  if(!Number.isFinite(cutoff)||!Number.isFinite(observed)||observed>=cutoff)reasons.push('not observed before cutoff');
  if(!r.source||r.sourceFreshnessVerified!==false||r.sourcePublishedAt!==null)reasons.push('unknown source freshness must be explicit');
  if(!r.odds||Object.keys(r.odds).length!==120||combos.some(c=>!Number.isFinite(r.odds?.[c])||r.odds[c]<1||r.odds[c]>1000000))reasons.push('invalid 120 odds');
  if(reasons.length)failures.push({file,race:key,reasons});else valid++;
 }
 summary.push({date:doc.date,stored:Object.keys(doc.races).length,structurallyValid:valid,usableForPrecisePredictionTimeEV:0});
}
const report={generatedAt:new Date().toISOString(),files:files.length,observations:total,failures,summary,limitations:['Upstream odds publication time is not verified.','Structural validity does not establish contemporaneous, tradable odds.','Do not calculate historical prediction-time EV from these observations without freshness evidence.']};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(failures.length)process.exitCode=1;
