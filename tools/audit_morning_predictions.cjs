#!/usr/bin/env node
'use strict';
// Read-only audit of stored morning v13 predictions. No UI, prediction or stake changes.
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../data/auto');
const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort():[];
const bins=[{name:'<1%',lo:0,hi:.01},{name:'1-1.25%',lo:.01,hi:.0125},{name:'1.25-1.5%',lo:.0125,hi:.015},{name:'1.5-2%',lo:.015,hi:.02},{name:'>=2%',lo:.02,hi:Infinity}];
const rows=[],excluded=[];
for(const file of files){
 const doc=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
 for(const r of doc.races||[]){
  const payouts=r.result?.winningCombinations;
  if(!Array.isArray(payouts)||!payouts.length){excluded.push({date:doc.date,venue:r.venue,race:r.race,reason:'unsettled'});continue;}
  const winning=new Map(payouts.filter(x=>/^([1-6]-){2}[1-6]$/.test(x.combination)&&Number.isFinite(Number(x.amount))&&Number(x.amount)>0).map(x=>[x.combination,Number(x.amount)]));
  if(!winning.size){excluded.push({date:doc.date,venue:r.venue,race:r.race,reason:'invalid payout'});continue;}
  for(const p of r.picks||[]){
   const stake=Number(p.stake),prob=Number(p.probability);
   if(!/^([1-6]-){2}[1-6]$/.test(p.pick)||!Number.isFinite(stake)||stake<=0){continue;}
   const hit=winning.has(p.pick),returned=hit?Math.round(stake*winning.get(p.pick)/100):0;
   rows.push({date:doc.date,venue:r.venue,race:r.race,pick:p.pick,head:p.pick[0],stake,returned,hit,prob:Number.isFinite(prob)&&prob>=0&&prob<=1?prob:null});
  }
 }
}
function stats(xs){
 const stake=xs.reduce((s,x)=>s+x.stake,0),payout=xs.reduce((s,x)=>s+x.returned,0),hits=xs.filter(x=>x.hit).length;
 const valid=xs.filter(x=>x.prob!==null);
 return {picks:xs.length,hits,hitRatePct:xs.length?+(hits/xs.length*100).toFixed(2):null,stake,payout,profit:payout-stake,roiPct:stake?+(payout/stake*100).toFixed(2):null,meanModelPct:valid.length?+(valid.reduce((s,x)=>s+x.prob,0)/valid.length*100).toFixed(3):null,modelCount:valid.length};
}
const byHead=Object.fromEntries('123456'.split('').map(h=>[h,stats(rows.filter(x=>x.head===h))]));
const byDate=Object.fromEntries([...new Set(rows.map(x=>x.date))].map(d=>[d,stats(rows.filter(x=>x.date===d))]));
const calibration=bins.map(b=>({band:b.name,...stats(rows.filter(x=>x.prob!==null&&x.prob>=b.lo&&x.prob<b.hi))}));
const report={method:'Stored selected top-five picks only. Model probabilities are uncalibrated relative scores; not verified win probabilities. No pre-race odds snapshots in stored picks. Never treat final payout as pre-race odds.',generatedAt:new Date().toISOString(),settledRaces:new Set(rows.map(x=>x.date+'|'+x.venue+'|'+x.race)).size,excludedRaces:excluded.length,overall:stats(rows),byDate,byHead,selectedPickCalibrationDiagnostic:calibration,limitations:['Selection bias: calibration bins only include chosen picks, not all 120 combinations.','Results and final payouts cannot reconstruct available odds at prediction time.','Historical optimization must be evaluated on separate future races.']};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
