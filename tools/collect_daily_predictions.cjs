// BOAT NEXUS unattended v13 pre-race snapshot collector (no browser/localStorage writes).
const fs=require('node:fs'),path=require('node:path');
const URL='https://boatraceopenapi.github.io/api/v1/today.json';
const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'});
const date=fmt.format(new Date()),now=Date.now();
const metric=(x,k)=>{const v=x?.[k];if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
const clamp=n=>Math.max(0,Math.min(1,n));
function score(r){
 const rows=[],base=[.17,.09,.04,0,-.04,-.08];
 for(let n=1;n<=6;n++){
  const x=r.racers?.[n]||{},p=r.preview?.racers?.[n]||{};
  const f=[[metric(x,'national_win_rate'),.24,v=>clamp(v/9)],[metric(x,'local_win_rate'),.18,v=>clamp(v/9)],[metric(x,'motor_top_2_percent'),.20,v=>clamp(v/70)],[metric(x,'average_start_timing'),.14,v=>clamp((.30-v)/.25)],[metric(p,'exhibition_time'),.14,v=>clamp((7.4-v)/1)],[metric(x,'local_top_3_percent'),.10,v=>clamp(v/85)]];
  const valid=f.filter(([v])=>v!==null&&v>0),total=valid.reduce((a,[,w])=>a+w,0);
  rows.push({n,score:(total?valid.reduce((a,[v,w,fn])=>a+w*fn(v),0)/total:.5)+base[n-1],parts:valid.length});
 }
 return rows.sort((a,b)=>b.score-a.score);
}
function cutoff(r){
 const raw=String(r.closed_at||'');
 if(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw)){
  const s=raw.replace(' ','T');return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(s)?s:s+'+09:00');
 }
 if(/^\d\d:\d\d/.test(raw))return Date.parse(date+'T'+raw.slice(0,5)+':00+09:00');
 return NaN;
}
function tickets(r){
 const ranked=score(r);if(ranked.every(x=>x.parts===0))return null;
 const all=[];
 for(const a of ranked)for(const b of ranked)for(const c of ranked){
  if(a.n===b.n||a.n===c.n||b.n===c.n)continue;
  const raw=Math.exp(3.5*(a.score*.53+b.score*.30+c.score*.17)+.16*(a.n===1));
  all.push({pick:[a.n,b.n,c.n].join('-'),raw});
 }
 const sum=all.reduce((n,x)=>n+x.raw,0);
 // Morning collector intentionally does not use changing odds; v13 probability ranking only.
 return all.map(x=>({pick:x.pick,probability:x.raw/sum})).sort((a,b)=>b.probability-a.probability).slice(0,5);
}
async function main(){
 const res=await fetch(URL,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(30000)});
 if(!res.ok)throw Error('Source HTTP '+res.status);
 const data=await res.json();if(!data?.programs?.stadiums)throw Error('Invalid source data');
 const file=path.join('data','auto',date+'.json');fs.mkdirSync(path.dirname(file),{recursive:true});
 const existing=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{date,engine:'v13-reference-no-odds',createdAt:new Date().toISOString(),races:[],skipped:[]};
 const seen=new Set(existing.races.map(x=>x.venue+'-'+x.race));
 for(const [venue,stadium] of Object.entries(data.programs.stadiums)){
  for(const [race,r] of Object.entries(stadium.races||{})){
   const key=venue+'-'+race;if(seen.has(key))continue;
   const close=cutoff(r);
   if(!Number.isFinite(close)||close<=now){existing.skipped.push({venue,race,reason:Number.isFinite(close)?'already_closed':'cutoff_unknown'});continue;}
   if(r.date&&r.date!==date){existing.skipped.push({venue,race,reason:'date_mismatch'});continue;}
   const picks=tickets(r);
   if(!picks){existing.skipped.push({venue,race,reason:'missing_racer_data'});continue;}
   const count=[1,2,3,4,5,6].filter(n=>metric(r.preview?.racers?.[n],'exhibition_time')!==null).length;
   existing.races.push({venue:Number(venue),race:Number(race),raceDate:date,cutoff:r.closed_at,capturedAt:new Date().toISOString(),predictionPhase:count===6?'after':count===0?'before':'partial',exhibitionCount:count,picks:picks.map(x=>({...x,stake:100})),result:null});
   seen.add(key);
  }
 }
 existing.lastRunAt=new Date().toISOString();
 existing.races.sort((a,b)=>a.venue-b.venue||a.race-b.race);
 fs.writeFileSync(file,JSON.stringify(existing,null,2)+'\n');
 console.log('Saved',file,'races',existing.races.length,'skipped',existing.skipped.length);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
