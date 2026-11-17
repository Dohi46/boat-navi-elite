#!/usr/bin/env node
'use strict';
// Offline regression checks; no production data writes and no network.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'boat-shadow-test-'));
try{
 const tools=path.join(root,'tools'),auto=path.join(root,'data/auto'),shadow=path.join(root,'data/shadow');
 fs.mkdirSync(tools,{recursive:true});fs.mkdirSync(auto,{recursive:true});
 fs.copyFileSync(path.join(__dirname,'generate_shadow_predictions.cjs'),path.join(tools,'generate_shadow_predictions.cjs'));
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const fmt=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(d).replace(' ',' ');
 const features=Object.fromEntries(Array.from({length:6},(_,i)=>[String(i+1),{national_win_rate:5,local_win_rate:5,motor_top_2_percent:40,average_start_timing:0.15}]));
 const now=Date.now();
 const race=(race,cutoff,extra={})=>({venue:1,race,raceDate:date,cutoff:fmt(new Date(cutoff)),capturedAt:new Date(now-120000).toISOString(),features,...extra});
 const rows=[race(1,now+7200000),race(2,now-7200000),race(3,now+7200000,{features:{...features,'6':{...features['6'],national_win_rate:null}}})];
 fs.writeFileSync(path.join(auto,date+'.json'),JSON.stringify({date,races:rows}));
 const run=()=>{const p=cp.spawnSync(process.execPath,[path.join(tools,'generate_shadow_predictions.cjs')],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);};
 const first=run();
 assert.equal(first.stored,1);assert.equal(first.reasons.runAfterCutoff,1);assert.equal(first.reasons.missingOrInvalidFeatures,1);
 const file=path.join(shadow,date+'.json'),saved=JSON.parse(fs.readFileSync(file,'utf8'));
 const s=saved.races['1-1'];
 assert.equal(s.oddsUsed,false);assert.equal(s.selection.schema,'odds-free-selection-v1');
 assert.ok(['select','skip'].includes(s.selection.decision));assert.ok(Date.parse(s.lockedAt)<Date.parse(rows[0].cutoff.replace(' ','T')+'+09:00'));
 assert.equal(Object.keys(saved.races).length,1);
 const original=fs.readFileSync(file,'utf8');const second=run();
 assert.equal(second.stored,0);assert.equal(fs.readFileSync(file,'utf8'),original,'Existing locks must never be overwritten');
 console.log('PASS: pre-cutoff lock, expired race excluded, missing feature excluded, odds-free decision, immutable rerun');
}finally{fs.rmSync(root,{recursive:true,force:true});}
