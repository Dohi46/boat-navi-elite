// Offline alert gate for the already-generated research report.
// Never fetches data, edits files, or contacts a notification endpoint.
'use strict';
const fs=require('node:fs');
const file=process.argv[2]||'data/research/quality-rolling-latest.json';
if(!fs.existsSync(file)){console.error('::error::Quality report is missing');process.exit(1);}
let d;try{d=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){console.error('::error::Invalid quality report JSON: '+e.message);process.exit(1);}
const problems=[];
if(d.schema!=='boat-nexus-quality-rolling-v1')problems.push('Unexpected report schema');
if(!Number.isInteger(d.files)||d.files<1)problems.push('No stored daily snapshots');
if(!d.checks||!Number.isInteger(d.checks.errors)||!Number.isInteger(d.checks.warnings))problems.push('Invalid QA counters');
if(d.checks?.errors>0)problems.push(d.checks.errors+' integrity error(s)');
if(d.checks?.warnings>0)console.warn('::warning::'+d.checks.warnings+' data-quality warning(s) — review excluded races');
if(!d.windows?.['7d']?.eligible)problems.push('No eligible settled pre-cutoff races');
for(const [key,w] of Object.entries(d.windows||{}))if(w.stake<0||w.payout<0||w.eligible>w.races)problems.push('Invalid '+key+' aggregate');
for(const p of problems)console.error('::error::'+p);
console.log('Data quality gate: '+(problems.length?'FAIL':'PASS')+'; source files='+d.files);
if(problems.length)process.exitCode=1;
