// Settle GitHub-stored predictions from the unofficial Boatrace Open API.
// Never changes browser localStorage or rewrites original picks.
const fs=require('node:fs'),path=require('node:path');
const dir=path.join('data','auto');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const maxDays=14;
function age(date){return Math.round((Date.parse(today+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000);}
function validPayouts(r){
 const payouts=r?.result?.payouts?.trifecta;
 if(!Array.isArray(payouts)||!payouts.length)return null;
 const parsed=payouts.map(p=>({combination:String(p.combination||''),amount:Number(p.amount)}));
 return parsed.every(p=>/^[1-6]-[1-6]-[1-6]$/.test(p.combination)&&new Set(p.combination.split('-')).size===3&&Number.isInteger(p.amount)&&p.amount>0)?parsed:null;
}
async function getResults(date){
 const compact=date.replace(/-/g,'');
 const url='https://boatraceopenapi.github.io/api/v1/'+compact.slice(0,4)+'/'+compact+'.json';
 const res=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'cache-control':'no-cache'}});
 if(!res.ok)throw Error('HTTP '+res.status);
 const json=await res.json();
 if(!json?.programs?.stadiums)throw Error('Unexpected results data');
 return json;
}
async function main(){
 if(!fs.existsSync(dir)){console.log('No predictions yet');return;}
 const files=fs.readdirSync(dir).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
 for(const filename of files){
  const date=filename.slice(0,10),days=age(date);
  if(days<0||days>maxDays)continue;
  const file=path.join(dir,filename),doc=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(doc.races)||!doc.races.some(r=>!r.result))continue;
  let data;
  try{data=await getResults(date);}catch(e){console.warn(date,'not available:',e.message);continue;}
  let settled=0;
  for(const r of doc.races){
   if(r.result)continue;
   const race=data.programs.stadiums?.[String(r.venue)]?.races?.[String(r.race)];
   if(!race||race.date!==date)continue;
   const payouts=validPayouts(race);
   if(!payouts)continue; // Do not call a missing result a loss.
   const paid=new Map(payouts.map(p=>[p.combination,p.amount]));
   const picks=(r.picks||[]).map(p=>{
    const hit=paid.has(p.pick);
    return {pick:p.pick,stake:Number(p.stake)||0,hit,payout:hit?Math.round(paid.get(p.pick)*(Number(p.stake)||0)/100):0};
   });
   const stake=picks.reduce((a,p)=>a+p.stake,0),returned=picks.reduce((a,p)=>a+p.payout,0);
   r.result={source:'boatraceopenapi-unofficial',checkedAt:new Date().toISOString(),winningCombinations:payouts,stake,payout:returned,hits:picks.filter(p=>p.hit).length,picks};
   settled++;
  }
  // Do not rewrite a pending snapshot every 30 minutes when no result changed.
  // Keep its last meaningful settlement timestamp and avoid needless Git conflicts.
  if(settled===0&&doc.settlement){console.log(date,'no new results; snapshot unchanged');continue;}
  const done=doc.races.filter(r=>r.result),stake=done.reduce((a,r)=>a+r.result.stake,0),payout=done.reduce((a,r)=>a+r.result.payout,0);
  const totalPicks=done.reduce((a,r)=>a+r.result.picks.length,0),hits=done.reduce((a,r)=>a+r.result.hits,0);
  doc.settlement={checkedAt:new Date().toISOString(),settledRaces:done.length,pendingRaces:doc.races.length-done.length,settledPicks:totalPicks,hitPicks:hits,hitRatePercent:totalPicks?Number((100*hits/totalPicks).toFixed(2)):null,stake,payout,returnRatePercent:stake?Number((100*payout/stake).toFixed(2)):null};
  fs.writeFileSync(file,JSON.stringify(doc,null,2)+'\n');
  console.log(date,'newly settled',settled,'settled',done.length,'pending',doc.settlement.pendingRaces,'hit rate',doc.settlement.hitRatePercent,'return',doc.settlement.returnRatePercent);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
