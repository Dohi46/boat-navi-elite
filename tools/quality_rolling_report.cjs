// BOAT NEXUS offline QA + rolling virtual performance; no network and no production writes.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const dir=process.argv[2]||'data/auto';
const names=fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort():[];
const errors=[],warnings=[],days=[],seen=new Set();
const num=v=>typeof v==='number'&&Number.isFinite(v);
const cutoff=r=>Date.parse(String(r.cutoff||'').replace(' ','T')+'+09:00');
for(const name of names){
 const doc=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
 const day={date:name.slice(0,10),races:0,settled:0,eligible:0,stake:0,payout:0,hits:0,excluded:0};
 if(doc.date!==day.date)errors.push({date:day.date,reason:'date mismatch'});
 for(const r of doc.races||[]){
  day.races++;
  const id=day.date+'/'+r.venue+'/'+r.race;
  if(seen.has(id))errors.push({id,reason:'duplicate race'});seen.add(id);
  if(!Number.isInteger(Number(r.venue))||Number(r.venue)<1||Number(r.venue)>24||!Number.isInteger(Number(r.race))||Number(r.race)<1||Number(r.race)>12)errors.push({id,reason:'invalid venue or race'});
  const pre=r.predictionPhase==='before'&&Number.isFinite(Date.parse(r.capturedAt))&&Number.isFinite(cutoff(r))&&Date.parse(r.capturedAt)<cutoff(r);
  if(!pre)warnings.push({id,reason:'prediction not proven pre-cutoff'});
  const picks=Array.isArray(r.picks)?r.picks:[];
  if(!picks.length)warnings.push({id,reason:'no predictions'});
  if(picks.some(p=>!/^([1-6])-([1-6])-([1-6])$/.test(String(p.pick))||new Set(String(p.pick).split('-')).size!==3||!num(p.stake)||p.stake<=0))errors.push({id,reason:'invalid prediction combination or stake'});
  if(!r.result){day.excluded++;continue;}
  day.settled++;
  if(!Array.isArray(r.result.picks)||!Array.isArray(r.result.winningCombinations)){warnings.push({id,reason:'incomplete settlement'});day.excluded++;continue;}
  const resultPicks=r.result.picks;
  if(resultPicks.some(p=>!num(p.stake)||p.stake<0||!num(p.payout)||p.payout<0||typeof p.hit!=='boolean')){errors.push({id,reason:'invalid settlement numbers'});day.excluded++;continue;}
  if(resultPicks.length!==picks.length||resultPicks.some((p,i)=>p.pick!==picks[i]?.pick||p.stake!==picks[i]?.stake)){errors.push({id,reason:'settled picks differ from saved predictions'});day.excluded++;continue;}
  const stake=resultPicks.reduce((s,p)=>s+p.stake,0),payout=resultPicks.reduce((s,p)=>s+p.payout,0);
  if(num(r.result.stake)&&r.result.stake!==stake||num(r.result.payout)&&r.result.payout!==payout)errors.push({id,reason:'settlement totals inconsistent'});
  if(!pre){day.excluded++;continue;}
  day.eligible++;day.stake+=stake;day.payout+=payout;day.hits+=resultPicks.filter(p=>p.hit).length;
 }
 days.push(day);
}
const windows={};
for(const n of [7,30,90]){
 const selected=days.slice(-n),agg=selected.reduce((a,d)=>{for(const k of ['races','settled','eligible','stake','payout','hits','excluded'])a[k]+=d[k];return a},{races:0,settled:0,eligible:0,stake:0,payout:0,hits:0,excluded:0});
 windows[n+'d']={...agg,days:selected.length,roiPercent:agg.stake?Number((100*agg.payout/agg.stake).toFixed(2)):null,profit:agg.payout-agg.stake,periodStart:selected[0]?.date||null,periodEnd:selected.at(-1)?.date||null};
}
const report={schema:'boat-nexus-quality-rolling-v1',generatedAt:new Date().toISOString(),source:'existing data/auto files only',files:names.length,checks:{errors:errors.length,warnings:warnings.length},errors:errors.slice(0,100),warnings:warnings.slice(0,100),windows,days:days.map(d=>({...d,roiPercent:d.stake?Number((100*d.payout/d.stake).toFixed(2)):null,profit:d.payout-d.stake})),note:'Virtual v13 picks, not real bets. Windows are latest available dated files, not necessarily consecutive calendar days. No profitability guarantee.'};
console.log(JSON.stringify(report,null,2));
if(!names.length)process.exitCode=2;
