#!/usr/bin/env node
'use strict';
// Read-only forward comparison scaffold. No retroactive strategy fitting.
// Only settled races and saved prediction-time selections enter baseline metrics.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../data');
const auto=path.join(root,'auto'),shadow=path.join(root,'shadow');
const files=fs.existsSync(auto)?fs.readdirSync(auto).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort():[];
const candidateNames=['v13-baseline','feature-shadow'];
const byStrategy=Object.fromEntries(candidateNames.map(x=>[x,{races:0,picks:0,hits:0,stake:0,payout:0,headCounts:Object.fromEntries('123456'.split('').map(n=>[n,0])),skips:0}]));
const warnings=[];let settledRaces=0,unsettledRaces=0;
const validPick=x=>typeof x?.pick==='string'&&/^[1-6]-[1-6]-[1-6]$/.test(x.pick)&&new Set(x.pick.split('-')).size===3&&Number.isFinite(Number(x.stake))&&Number(x.stake)>0;
function evaluate(target,picks,winners){target.races++;if(!picks.length)target.skips++;for(const p of picks){if(!validPick(p)){warnings.push('Invalid pick omitted');continue;}const stake=Number(p.stake),payout=winners.get(p.pick)||0;target.picks++;target.stake+=stake;target.headCounts[p.pick[0]]++;if(payout){target.hits++;target.payout+=Math.round(stake*payout/100);}}}
for(const file of files){
 const doc=JSON.parse(fs.readFileSync(path.join(auto,file),'utf8'));
 let shadows=null;const sp=path.join(shadow,file);
 if(fs.existsSync(sp)){try{shadows=JSON.parse(fs.readFileSync(sp,'utf8'));}catch(e){warnings.push('Unreadable shadow '+file);}}
 for(const race of doc.races||[]){
  const results=race.result?.winningCombinations;
  if(!Array.isArray(results)||!results.length){unsettledRaces++;continue;}
  const winners=new Map(results.filter(x=>validPick({pick:x.combination,stake:100})&&Number.isFinite(Number(x.amount))&&Number(x.amount)>0).map(x=>[x.combination,Number(x.amount)]));
  if(!winners.size){warnings.push('No valid winning combination '+file+' '+race.venue+'-'+race.race);continue;}
  settledRaces++;
  evaluate(byStrategy['v13-baseline'],race.picks||[],winners);
  const key=race.venue+'-'+race.race;
  const candidate=shadows?.races?.[key];
  // Shadow decisions must have been locked before the race cutoff and carry a source timestamp.
  // A missing shadow record is NOT a skip: do not distort comparison by treating it as zero stake.
  if(!candidate)continue;
  const stamp=Date.parse(candidate.lockedAt);
  const cutoff=typeof race.cutoff==='string'?Date.parse(race.cutoff.replace(' ','T')+'+09:00'):NaN;
  if(!Number.isFinite(stamp)||!Number.isFinite(cutoff)||stamp>=cutoff||candidate.strategy!=='feature-shadow'||!Array.isArray(candidate.picks)){warnings.push('Unverifiable shadow decision '+file+' '+key);continue;}
  evaluate(byStrategy['feature-shadow'],candidate.picks,winners);
 }
}
function finish(x){return {...x,profit:x.payout-x.stake,roiPct:x.stake?+(100*x.payout/x.stake).toFixed(2):null,hitRatePct:x.picks?+(100*x.hits/x.picks).toFixed(2):null};}
const result={generatedAt:new Date().toISOString(),settledRaces,unsettledRaces,strategies:Object.fromEntries(Object.entries(byStrategy).map(([k,v])=>[k,finish(v)])),warnings,comparisonValid:false,reason:'Strategies must be evaluated on exactly the same settled race cohort with forward-locked decisions; no EV shadow strategy has been approved or deployed.',policy:'No forced non-1 heads; head distribution is an observed metric, never a target. Missing shadow records are not skips.'};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
