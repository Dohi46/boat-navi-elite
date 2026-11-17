#!/usr/bin/env node
'use strict';
// Offline audit regression. Never modifies production data.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'boat-settlement-test-'));
try{
 const tools=path.join(root,'tools'),auto=path.join(root,'data','auto');fs.mkdirSync(tools,{recursive:true});fs.mkdirSync(auto,{recursive:true});
 fs.copyFileSync(path.join(__dirname,'audit_prediction_health.cjs'),path.join(tools,'audit_prediction_health.cjs'));
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const r={venue:1,race:1,raceDate:date,cutoff:date+' 23:59:59',capturedAt:new Date(Date.parse(date+'T00:00:00+09:00')-60000).toISOString(),picks:[{pick:'1-2-3',stake:200},{pick:'1-3-2',stake:100}],result:{winningCombinations:[{combination:'1-2-3',amount:1250}],stake:300,payout:2500,hits:1,picks:[{pick:'1-2-3',stake:200,hit:true,payout:2500},{pick:'1-3-2',stake:100,hit:false,payout:0}]}};
 const file=path.join(auto,date+'.json');
 const run=()=>cp.spawnSync(process.execPath,[path.join(tools,'audit_prediction_health.cjs')],{encoding:'utf8'});
 fs.writeFileSync(file,JSON.stringify({date,races:[r]}));let result=run();
 assert.equal(result.status,0,result.stderr);assert.ok(result.stdout.includes('ERROR: 0件'),result.stdout);
 r.result.payout=0;fs.writeFileSync(file,JSON.stringify({date,races:[r]}));result=run();
 assert.equal(result.status,1,result.stdout);assert.ok(result.stdout.includes('Settlement amount/hit mismatch'),result.stdout);
 delete r.result;fs.writeFileSync(file,JSON.stringify({date,races:[r]}));result=run();
 assert.equal(result.status,0,result.stdout);assert.ok(result.stdout.includes('結果待ち: 1R'),result.stdout);
 console.log('PASS: correct settlement accepted, corrupted payout rejected, pending race not treated as loss');
}finally{fs.rmSync(root,{recursive:true,force:true});}
