#!/usr/bin/env node
'use strict';
// Read-only research. Never modifies predictions or places bets.
// Usage: node research/evaluate-skip.cjs data/auto/2026-11-15.json ...
const fs=require('node:fs');
const path=require('node:path');
const files=process.argv.slice(2);
if(!files.length){console.error('Usage: node research/evaluate-skip.cjs data/auto/YYYY-MM-DD.json ...');process.exit(2)}
const rows=[];
for(const file of files){
 const doc=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(doc.date)||!Array.isArray(doc.races))throw Error('Invalid day file: '+file);
 for(const r of doc.races){
  const picks=Array.isArray(r.picks)?r.picks:[];
  const winners=r.result?.winningCombinations;
  if(!Array.isArray(winners)||!winners.length)continue; // Pending is not a loss
  if(!picks.length||!picks.every(p=>Number.isFinite(Number(p.stake))&&Number(p.stake)>0))continue;
  const stake=picks.reduce((a,p)=>a+Number(p.stake),0);
  const pay=new Map(winners.map(w=>[w.combination,Number(w.amount)]));
  const payout=picks.reduce((a,p)=>a+(pay.has(p.pick)?Math.round(pay.get(p.pick)*Number(p.stake)/100):0),0);
  const probs=picks.map(p=>Number(p.probability));
  const confidence=probs.every(Number.isFinite)?Math.max(...probs):null;
  rows.push({date:doc.date,venue:r.venue,race:r.race,stake,payout,confidence});
 }
}
rows.sort((a,b)=>a.date.localeCompare(b.date)||a.venue-b.venue||a.race-b.race);
const days=[...new Set(rows.map(r=>r.date))];
const stats=arr=>{const stake=arr.reduce((s,r)=>s+r.stake,0),payout=arr.reduce((s,r)=>s+r.payout,0);return {races:arr.length,stake,payout,net:payout-stake,roiPercent:stake?+(payout/stake*100).toFixed(2):null}};
const baseline=stats(rows);
const folds=[];
for(let i=2;i<days.length;i++){
 const train=rows.filter(r=>r.date<days[i]&&r.confidence!==null);
 const test=rows.filter(r=>r.date===days[i]);
 if(!train.length||!test.length)continue;
 // Predeclare simple training-only rule: keep upper half by top-pick probability.
 // No odds are present, so confidence is NOT an estimated positive EV.
 const sorted=train.map(r=>r.confidence).sort((a,b)=>a-b);
 const threshold=sorted[Math.floor(sorted.length/2)];
 const selected=test.filter(r=>r.confidence!==null&&r.confidence>=threshold);
 folds.push({testDate:days[i],trainingDays:days.slice(0,i),threshold,baseline:stats(test),selected:stats(selected),skipped:test.length-selected.length});
}
const out={method:'expanding-window, train-only median top-pick probability, illustrative not deployable',days,baseline,folds,notes:['Only settled races included; current day may be partial.','No market odds available; confidence is not expected value.','Selection is exploratory; do not deploy or claim profitability from these folds.']};
console.log(JSON.stringify(out,null,2));
