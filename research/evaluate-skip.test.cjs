'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'skip-test-'));
try{
 const files=[];
 for(let d=1;d<=4;d++){
  const date='2026-11-'+String(d).padStart(2,'0');
  const races=[{venue:1,race:1,picks:[{pick:'1-2-3',stake:100,probability:d%2?.02:.01}],result:{winningCombinations:[{combination:d%2?'1-2-3':'2-1-3',amount:200}]}},{venue:1,race:2,picks:[{pick:'1-2-3',stake:100,probability:.03}],result:null}];
  const file=path.join(dir,date+'.json');fs.writeFileSync(file,JSON.stringify({date,races}));files.push(file);
 }
 const r=cp.spawnSync(process.execPath,[path.join(__dirname,'evaluate-skip.cjs'),...files],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
 const data=JSON.parse(r.stdout);
 assert.equal(data.baseline.races,4);
 assert.equal(data.baseline.stake,400);
 assert.equal(data.baseline.payout,400);
 assert.equal(data.folds.length,2);
 assert.equal(data.folds[0].testDate,'2026-11-03');
 assert.equal(data.folds[1].testDate,'2026-11-04');
 console.log('PASS: pending excluded, stakes/payouts, walk-forward folds');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
