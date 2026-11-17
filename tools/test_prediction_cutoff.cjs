// Offline regression tests for prediction cutoff and exhibition-phase separation.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'boat-cutoff-'));
const jstParts=(d)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
try {
  const fixedNow=new Date('2026-11-16T01:00:00.000Z');
  const future=new Date(fixedNow.getTime()+10*60*1000);
  const past=new Date(fixedNow.getTime()-10*60*1000);
  const f=jstParts(future),p=jstParts(past);
  const date=[f.year,f.month,f.day].join('-');
  const isoJst=(v)=>[v.year,v.month,v.day].join('-')+' '+v.hour+':'+v.minute+':00';
  const racers=Object.fromEntries(Array.from({length:6},(_,i)=>[i+1,{national_win_rate:5,local_win_rate:5,motor_top_2_percent:40,average_start_timing:0.16,local_top_3_percent:45}]));
  const preview={racers:Object.fromEntries(Array.from({length:6},(_,i)=>[i+1,{exhibition_time:6.8}]))};
  const fixture={programs:{stadiums:{'1':{races:{'1':{date,closed_at:isoJst(f),racers,preview},'2':{date,closed_at:isoJst(p),racers,preview}}}}}};
  const preload=path.join(temp,'mock-fetch.cjs');
  const mockSource = 'const RealDate=Date;const fixed='+fixedNow.getTime()+';global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};global.fetch=async()=>({ok:true,json:async()=>'+JSON.stringify(fixture)+'});\n';
  fs.writeFileSync(preload,mockSource);
  const run=spawnSync(process.execPath,['--require',preload,path.join(root,'tools/collect_daily_predictions.cjs')],{cwd:temp,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr||run.stdout);
  const doc=JSON.parse(fs.readFileSync(path.join(temp,'data/auto',date+'.json'),'utf8'));
  assert.equal(doc.races.length,1,'Only future-cutoff race should be saved');
  const race=doc.races[0];
  assert.equal(race.predictionPhase,'before');
  assert.equal(race.exhibitionPhase,'after','All six exhibition times should not imply post-cutoff');
  assert.equal(race.exhibitionCount,6);
  assert.ok(Date.parse(race.capturedAt)<Date.parse(race.cutoff.replace(' ','T')+'+09:00'));
  assert.ok(doc.skipped.some(x=>Number(x.race)===2&&x.reason==='already_closed'));
  // Historical snapshots remain immutable and still fail conservative QA if tagged after.
  const historical={...race,predictionPhase:'after',result:{picks:race.picks.map(x=>({pick:x.pick,stake:x.stake,hit:false,payout:0})),winningCombinations:[{combination:'6-5-4',amount:1000}],stake:500,payout:0}};
  const qaDir=path.join(temp,'qa');fs.mkdirSync(qaDir);
  fs.writeFileSync(path.join(qaDir,date+'.json'),JSON.stringify({date,races:[historical]}));
  const qa=spawnSync(process.execPath,[path.join(root,'tools/quality_rolling_report.cjs'),qaDir],{encoding:'utf8'});
  assert.equal(qa.status,0,qa.stderr);
  const report=JSON.parse(qa.stdout);
  assert.equal(report.checks.warnings,1);
  assert.equal(report.days[0].eligible,0);
  assert.equal(report.days[0].excluded,1);
  console.log('PASS: cutoff guard, exhibition separation, historical QA exclusion');
} finally {fs.rmSync(temp,{recursive:true,force:true});}
