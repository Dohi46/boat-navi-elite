#!/usr/bin/env node
'use strict';
// Experimental shadow only. NOT a calibrated probability or expected-value model.
// Locks independent picks before cutoff, without changing the production AI.
const fs=require('node:fs'),path=require('node:path');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const base=path.resolve(__dirname,'../data/auto/'+date+'.json');
if(!fs.existsSync(base)){console.log('No predictions today');process.exit(0);}
const doc=JSON.parse(fs.readFileSync(base,'utf8'));
const dest=path.resolve(__dirname,'../data/shadow/'+date+'.json');
const prior=fs.existsSync(dest)?JSON.parse(fs.readFileSync(dest,'utf8')):{date,schema:'shadow-v1',model:'feature-ranking-v0-experimental',races:{}};
if(prior.date!==date||prior.schema!=='shadow-v1'||prior.model!=='feature-ranking-v0-experimental')throw Error('Unexpected shadow schema');
const combos=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a!==b&&a!==c&&b!==c)combos.push([a,b,c]);
function cutoff(s){return typeof s==='string'&&/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(s)?Date.parse(s.replace(' ','T')+'+09:00'):NaN;}
function strength(f){
 if(!f||typeof f!=='object')return null;
 const keys=['national_win_rate','local_win_rate','motor_top_2_percent','average_start_timing'];
 if(keys.some(k=>f[k]===null||f[k]===undefined||!Number.isFinite(Number(f[k]))))return null;
 const n=Number(f.national_win_rate),l=Number(f.local_win_rate),m=Number(f.motor_top_2_percent),st=Number(f.average_start_timing);
 if(n<0||n>10||l<0||l>10||m<0||m>100||st<0||st>1)return null;
 return .28*n+.12*l+.018*m-2*st;
}
let stored=0,skipped=0;
for(const r of doc.races||[]){
 const now=new Date().toISOString(),t=Date.parse(now),limit=cutoff(r.cutoff);
 if(r.raceDate!==date||!Number.isFinite(limit)||t>=limit||Date.parse(r.capturedAt)>t){skipped++;continue;}
 const key=r.venue+'-'+r.race;if(prior.races[key])continue;
 const s=Array.from({length:6},(_,i)=>strength(r.features?.[String(i+1)]));
 if(s.some(x=>x===null)){skipped++;continue;}
 // Structural lane advantage is a prior, not a mandated quota or a guaranteed win.
 const lane=[2.25,.85,.48,.15,-.35,-.8];
 const ranked=combos.map(([a,b,c])=>({pick:a+'-'+b+'-'+c,score:1.35*(s[a-1]+lane[a-1])+.75*(s[b-1]+lane[b-1])+.4*(s[c-1]+lane[c-1])})).sort((x,y)=>y.score-x.score);
 // No fabricated EV or calibrated probability. Shadow tickets use fixed 100-yen stakes.
 const picks=ranked.slice(0,5).map(x=>({pick:x.pick,stake:100}));
 prior.races[key]={strategy:'ev-shadow',model:prior.model,lockedAt:now,picks,decision:'rank-only-test',oddsUsed:false,calibrated:false};
 stored++;
}
if(stored){fs.mkdirSync(path.dirname(dest),{recursive:true});const temp=dest+'.tmp';fs.writeFileSync(temp,JSON.stringify(prior,null,2)+'\n');fs.renameSync(temp,dest);}
console.log(JSON.stringify({date,stored,skipped,total:Object.keys(prior.races).length,notice:'Experimental feature ranking only. No calibrated probabilities, EV, or guaranteed profit.'}));
