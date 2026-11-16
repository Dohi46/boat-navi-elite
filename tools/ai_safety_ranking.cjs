// BOAT NEXUS offline experimental safety and model comparison.
// Reads existing data/auto snapshots only. Never modifies v13, RECORD or saved predictions.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const isNum=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const before=r=>r.predictionPhase==='before'&&r.capturedAt&&r.cutoff&&Number.isFinite(Date.parse(r.capturedAt))&&Date.parse(r.capturedAt)<Date.parse(String(r.cutoff).replace(' ','T')+'+09:00');
function safety(r){
 const reasons=[];
 if(!before(r))reasons.push('締切前に保存された予想と確認できない');
 if(!Array.isArray(r.picks)||r.picks.length===0)reasons.push('買い目データがない');
 const f=r.features||{};
 if([1,2,3,4,5,6].some(n=>!isNum(f[n]?.national_win_rate)||Number(f[n].national_win_rate)<=0))reasons.push('6艇の全国勝率が不足');
 const water=r.previewFields||{};
 const weatherComplete=isNum(water.wind_speed)&&isNum(water.wind_direction_number)&&isNum(water.wave_height);
 return {status:reasons.length?'hold':'research-only',reasons,weatherComplete,weatherNote:weatherComplete?'水面値は存在（有効性未検証）':'水面情報不足：風による補正を行わない'};
}
function category(r){
 const f=r.features||{},rates=[1,2,3,4,5,6].map(n=>Number(f[n]?.national_win_rate));
 const inner=rates[0],challenger=Math.max(...rates.slice(1,4));
 const motor=[2,3,4].some(n=>Number(f[n]?.motor_top_2_percent)>=40);
 const competitive=challenger>=inner+0.5;
 const outerStrong=[4,5,6].some(n=>rates[n-1]>=Math.max(4.5,inner-0.5)&&Number(f[n]?.motor_top_2_percent)>=35);
 const long=outerStrong&&inner<5;
 return long?'long':competitive||motor?'medium':'none';
}
const strategies={
 baseline:()=>true,
 favorite:r=>Array.isArray(r.picks)&&r.picks.some(p=>String(p.pick).startsWith('1-')),
 medium:r=>category(r)==='medium',
 long:r=>category(r)==='long',
 selected:r=>category(r)!=='none'
};
function evaluate(docs){
 const totals=Object.fromEntries(Object.keys(strategies).map(k=>[k,{races:0,stake:0,payout:0,hits:0}]));
 const quality={total:0,eligible:0,held:0,weatherComplete:0,unsettled:0};
 for(const doc of docs)for(const r of doc.races||[]){
  quality.total++;
  const safe=safety(r);
  if(safe.status==='hold'){quality.held++;continue;}
  if(safe.weatherComplete)quality.weatherComplete++;
  if(!r.result||!Array.isArray(r.result.picks)||!Array.isArray(r.result.winningCombinations)){quality.unsettled++;continue;}
  quality.eligible++;
  for(const [name,choose] of Object.entries(strategies)){
   if(!choose(r))continue;
   const bets=r.result.picks;
   const stake=bets.reduce((n,p)=>n+(Number(p.stake)||0),0),payout=bets.reduce((n,p)=>n+(Number(p.payout)||0),0);
   if(stake<=0)continue;
   const t=totals[name];t.races++;t.stake+=stake;t.payout+=payout;t.hits+=bets.filter(p=>p.hit===true).length;
  }
 }
 return {schema:'experimental-ai-ranking-v1',disclaimer:'Hypothetical v13 picks, no actual betting. Favorite means races with at least one 1-first pick, not a separate trained AI. All groups use the same v13 picks. Strategy rules have not been independently validated.',quality,strategies:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,{...v,roiPercent:v.stake?Number((100*v.payout/v.stake).toFixed(2)):null}]))};
}
if(require.main===module){
 const folder=process.argv[2]||'data/auto';
 const files=fs.existsSync(folder)?fs.readdirSync(folder).filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort():[];
 const docs=files.map(f=>JSON.parse(fs.readFileSync(path.join(folder,f),'utf8')));
 console.log(JSON.stringify({...evaluate(docs),filesAnalyzed:files.length},null,2));
}
module.exports={safety,category,evaluate};
