#!/usr/bin/env node
'use strict';
// Exercise the real settlement script offline with a deterministic API response.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'boat-settlement-execution-'));
try{
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const dir=path.join(root,'data','auto');fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,date+'.json');
 const doc={date,races:[{venue:1,race:1,raceDate:date,picks:[{pick:'1-2-3',stake:200},{pick:'1-3-2',stake:100}]}]};
 fs.writeFileSync(file,JSON.stringify(doc,null,2)+'\n');
 const preload=path.join(root,'mock-fetch.cjs');
 fs.writeFileSync(preload,`global.fetch=async()=>({ok:true,json:async()=>({programs:{stadiums:{'1':{races:{'1':{date:'${date}',result:{payouts:{trifecta:[{combination:'1-2-3',amount:1250}]}}}}}}}}})});\n`);
 const script=path.resolve(__dirname,'settle_daily_predictions.cjs');
 const run=()=>cp.spawnSync(process.execPath,['--require',preload,script],{cwd:root,encoding:'utf8'});
 let result=run();assert.equal(result.status,0,result.stderr);
 let saved=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.equal(saved.races[0].result.payout,2500);
 assert.equal(saved.races[0].result.hits,1);
 assert.equal(saved.settlement.pendingRaces,0);
 const first=fs.readFileSync(file,'utf8');
 result=run();assert.equal(result.status,0,result.stderr);
 assert.equal(fs.readFileSync(file,'utf8'),first,'A repeated settlement must preserve exact bytes');
 // A pending race with an existing summary must not be rewritten when API has no result.
 saved.races.push({venue:1,race:2,raceDate:date,picks:[{pick:'2-1-3',stake:100}]});
 saved.settlement.pendingRaces=1;
 fs.writeFileSync(file,JSON.stringify(saved,null,2)+'\n');
 const pending=fs.readFileSync(file,'utf8');
 result=run();assert.equal(result.status,0,result.stderr);
 assert.equal(fs.readFileSync(file,'utf8'),pending,'No new result must not rewrite a pending snapshot');
 assert.match(result.stdout,/no new results; snapshot unchanged/);
 console.log('PASS: real settlement payout, repeat idempotence, and pending snapshot immutability');
}finally{fs.rmSync(root,{recursive:true,force:true});}
