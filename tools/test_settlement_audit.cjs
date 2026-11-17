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
 const file=path.join(auto,date+'.json'),shadowDir=path.join(root,'data','shadow');fs.mkdirSync(shadowDir,{recursive:true});
 const shadowFile=path.join(shadowDir,date+'.json');
 const run=()=>cp.spawnSync(process.execPath,[path.join(tools,'audit_prediction_health.cjs')],{encoding:'utf8'});
 fs.writeFileSync(file,JSON.stringify({date,races:[r]}));let result=run();
 assert.equal(result.status,0,result.stderr);assert.ok(result.stdout.includes('ERROR: 0件'),result.stdout);assert.ok(result.stdout.includes('結果確定: 1R (的中 1R / 不的中 0R)'),result.stdout);
 r.result.payout=0;fs.writeFileSync(file,JSON.stringify({date,races:[r]}));result=run();
 assert.equal(result.status,1,result.stdout);assert.ok(result.stdout.includes('Settlement amount/hit mismatch'),result.stdout);
 // A confirmed losing race is settled, but must not be counted as a hit.
 r.result={winningCombinations:[{combination:'2-1-3',amount:980}],stake:300,payout:0,hits:0,picks:[{pick:'1-2-3',stake:200,hit:false,payout:0},{pick:'1-3-2',stake:100,hit:false,payout:0}]};
 fs.writeFileSync(file,JSON.stringify({date,races:[r]}));result=run();
 assert.equal(result.status,0,result.stdout);assert.ok(result.stdout.includes('結果確定: 1R (的中 0R / 不的中 1R)'),result.stdout);
 delete r.result;fs.writeFileSync(file,JSON.stringify({date,races:[r]}));result=run();
 assert.equal(result.status,0,result.stdout);assert.ok(result.stdout.includes('結果待ち: 1R'),result.stdout);assert.ok(result.stdout.includes('結果確定: 0R (的中 0R / 不的中 0R)'),result.stdout);
 // Legacy shadow locks must remain excluded from pre-registered selection counts.
 const lock=new Date(Date.parse(date+'T00:00:00+09:00')+60000).toISOString();
 const shadowRace={strategy:'feature-shadow',model:'feature-ranking-v0-experimental',lockedAt:lock,sourceCapturedAt:r.capturedAt,picks:[{pick:'1-2-3',stake:100}],decision:'rank-only-test',oddsUsed:false,calibrated:false};
 const writeShadow=()=>fs.writeFileSync(shadowFile,JSON.stringify({date,schema:'shadow-v1',model:'feature-ranking-v0-experimental',races:{'1-1':shadowRace}}));
 writeShadow();result=run();
 assert.equal(result.status,0,result.stdout);assert.ok(result.stdout.includes('旧形式（選別検証対象外）: 1R'),result.stdout);
 assert.ok(result.stdout.includes('事前登録済み: 0R'),result.stdout);
 // New pre-cutoff selection is counted, and corrupt selection is rejected.
 shadowRace.selection={schema:'odds-free-selection-v1',rule:'lane-adjusted-strength-margin-gte-0.75',margin:0.8,decision:'select',lockedAt:lock,oddsUsed:false};
 writeShadow();result=run();
 assert.equal(result.status,0,result.stdout);assert.ok(result.stdout.includes('事前登録済み: 1R (選択 1R / 見送り 0R)'),result.stdout);
 // Threshold boundary: exactly 0.75 selects; below 0.75 skips.
 shadowRace.selection.margin=0.75;
 writeShadow();result=run();
 assert.equal(result.status,0,result.stdout);assert.ok(result.stdout.includes('選択 1R / 見送り 0R'),result.stdout);
 shadowRace.selection.margin=0.749999;
 shadowRace.selection.decision='skip';
 writeShadow();result=run();
 assert.equal(result.status,0,result.stdout);assert.ok(result.stdout.includes('選択 0R / 見送り 1R'),result.stdout);
 shadowRace.selection.margin=0.8;
  shadowRace.selection.decision='skip';
 writeShadow();result=run();
 assert.equal(result.status,1,result.stdout);assert.ok(result.stdout.includes('Invalid pre-registered selection'),result.stdout);
 shadowRace.selection.decision='select';
 shadowRace.selection.rule='unrecognized-rule';
 writeShadow();result=run();
 assert.equal(result.status,1,result.stdout);assert.ok(result.stdout.includes('Invalid pre-registered selection'),result.stdout);
 shadowRace.selection.rule='lane-adjusted-strength-margin-gte-0.75';
 shadowRace.selection.margin='0.8';
 writeShadow();result=run();
 assert.equal(result.status,1,result.stdout);assert.ok(result.stdout.includes('Invalid pre-registered selection'),result.stdout);
 shadowRace.selection.margin=0.8;
  shadowRace.selection.lockedAt=new Date(Date.parse(date+'T23:59:59+09:00')+1000).toISOString();
 writeShadow();result=run();
 assert.equal(result.status,1,result.stdout);assert.ok(result.stdout.includes('Invalid pre-registered selection'),result.stdout);
  console.log('PASS: winning and losing settlements accepted, corrupted payout rejected, pending not treated as loss, legacy excluded, valid selection counted, late and inconsistent selections rejected');
}finally{fs.rmSync(root,{recursive:true,force:true});}
