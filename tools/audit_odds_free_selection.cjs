#!/usr/bin/env node
'use strict';
// Read-only experimental odds-free selectivity analysis; no retroactive picks.
// A pre-cutoff shadow prediction is mandatory. Thresholds are hypotheses,
// NOT trained or optimized on past outcomes. No ROI/EV claim is made.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../data');
const files=fs.existsSync(path.join(root,'auto'))?fs.readdirSync(path.join(root,'auto')).filter(x=>/^\d{4}-\d\d-\d\d\.json$/.test(x)).sort():[];
const strength=f=>{
 if(!f)return null;
 const keys=['national_win_rate','local_win_rate','motor_top_2_percent','average_start_timing'];
 if(keys.some(k=>!Number.isFinite(Number(f[k]))||f[k]===null||f[k]===undefined))return null;
 const [n,l,m,st]=keys.map(k=>Number(f[k]));
 if(n<0||n>10||l<0||l>10||m<0||m>100||st<0||st>1)return null;
 return .28*n+.12*l+.018*m-2*st;
};
const lane=[2.25,.85,.48,.15,-.35,-.8];
const validPick=p=>typeof p?.pick==='string'&&/^[1-6]-[1-6]-[1-6]$/.test(p.pick)&&new Set(p.pick.split('-')).size===3&&Number(p.stake)>0;
const stats=()=>({eligible:0,skipped:0,settled:0,unsettled:0,hits:0,stake:0,payout:0});
const all=stats(),selected=stats(),warnings=[];
for(const file of files){
 const base=JSON.parse(fs.readFileSync(path.join(root,'auto',file),'utf8'));
 const shadowFile=path.join(root,'shadow',file);
 if(!fs.existsSync(shadowFile))continue;
 const shadow=JSON.parse(fs.readFileSync(shadowFile,'utf8'));
 for(const r of base.races||[]){
  const candidate=shadow.races?.[r.venue+'-'+r.race];
  if(!candidate)continue;
  const locked=Date.parse(candidate.lockedAt),source=Date.parse(candidate.sourceCapturedAt);
  const cutoff=Date.parse(String(r.cutoff).replace(' ','T')+'+09:00');
  if(!Number.isFinite(locked)||!Number.isFinite(source)||!Number.isFinite(cutoff)||source>locked||locked>=cutoff||candidate.oddsUsed!==false||!Array.isArray(candidate.picks)||!candidate.picks.every(validPick)){warnings.push('Invalid shadow '+file+' '+r.venue+'-'+r.race);continue;}
  // Only count decisions actually registered at prediction time. Old shadow
  // predictions lacking selection are excluded, never classified retrospectively.
  const selection=candidate.selection;
  if(selection?.schema!=='odds-free-selection-v1'||selection.rule!=='lane-adjusted-strength-margin-gte-0.75'||!['select','skip'].includes(selection.decision)||selection.lockedAt!==candidate.lockedAt||selection.oddsUsed!==false||!Number.isFinite(selection.margin))continue;
  const accept=selection.decision==='select';
  all.eligible++;if(accept)selected.eligible++;else selected.skipped++;
  const winners=r.result?.winningCombinations;
  if(!Array.isArray(winners)||!winners.length){all.unsettled++;if(accept)selected.unsettled++;continue;}
  const payouts=new Map(winners.map(x=>[x.combination,Number(x.amount)||0]));
  for(const s of accept?[all,selected]:[all]){
   s.settled++;
   for(const p of candidate.picks){const stake=Number(p.stake),pay=payouts.get(p.pick)||0;s.stake+=stake;if(pay>0){s.hits++;s.payout+=Math.round(stake*pay/100);}}
  }
 }
}
function finish(s){return {...s,roiPct:s.stake?+(100*s.payout/s.stake).toFixed(2):null,hitPerRacePct:s.settled?+(100*s.hits/s.settled).toFixed(2):null};}
console.log(JSON.stringify({schema:'odds-free-selection-audit-v1',rule:'Top two lane-adjusted feature strength margin >= 0.75',ruleStatus:'FORWARD-LOCKED EXPERIMENTAL UNVALIDATED; fixed heuristic, not optimized',all:finish(all),selected:finish(selected),warnings,warning:'Only decisions locked before cutoff are evaluated; older shadow races without registered selection are excluded. No statistical advantage established. No real-money recommendation.'},null,2));
