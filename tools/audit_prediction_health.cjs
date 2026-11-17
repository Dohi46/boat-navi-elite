#!/usr/bin/env node
'use strict';
// Read-only audit. Errors: corrupt or unverifiable saved predictions.
// Warnings: missing optional data and results still pending after a grace period.
const fs=require('node:fs'),path=require('node:path');
const now=Date.now(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const issues=[],counts={baseline:0,shadow:0,preRegistered:0,selected:0,skipped:0,legacy:0,settled:0,pending:0,overdue:0};
const validPick=p=>p&&typeof p.pick==='string'&&/^[1-6]-[1-6]-[1-6]$/.test(p.pick)&&new Set(p.pick.split('-')).size===3&&Number.isFinite(Number(p.stake))&&Number(p.stake)>0;
const cutoff=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(s)?Date.parse(s.replace(' ','T')+'+09:00'):NaN;
const note=(severity,message)=>issues.push({severity,message});
const read=(folder,date)=>{const p=path.join(__dirname,'..','data',folder,date+'.json');if(!fs.existsSync(p))return null;try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){note('ERROR',folder+'/'+date+' invalid JSON: '+e.message);return null;}};
const baseline=read('auto',today),shadow=read('shadow',today);
const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
if(!baseline){note(hour>=10?'WARNING':'INFO','Today baseline file missing (check morning collection schedule)');}
else if(!Array.isArray(baseline.races)){note('ERROR','Baseline races must be an array');}
else{
 counts.baseline=baseline.races.length;
 const indexed=new Map();
 for(const r of baseline.races){
  const key=r.venue+'-'+r.race,limit=cutoff(r.cutoff),captured=Date.parse(r.capturedAt);
  if(indexed.has(key))note('ERROR','Duplicate baseline race '+key);
  indexed.set(key,r);
  if(r.raceDate!==today||!Number.isFinite(limit)||!Number.isFinite(captured)||captured>=limit)note('ERROR','Invalid date or pre-cutoff baseline timestamp '+key);
  if(!Array.isArray(r.picks)||r.picks.some(p=>!validPick(p))||new Set((r.picks||[]).map(p=>p.pick)).size!==(r.picks||[]).length)note('ERROR','Invalid or duplicate baseline picks '+key);
  if(r.result?.winningCombinations?.length)counts.settled++;
  else{counts.pending++;if(Number.isFinite(limit)&&now>limit+90*60000){counts.overdue++;}}
 }
 if(shadow){
  if(shadow.date!==today||!shadow.races||Array.isArray(shadow.races)||typeof shadow.races!=='object')note('ERROR','Invalid shadow schema');
  else for(const [key,s] of Object.entries(shadow.races)){
   counts.shadow++;
   const r=indexed.get(key),limit=r?cutoff(r.cutoff):NaN,locked=Date.parse(s.lockedAt),source=Date.parse(s.sourceCapturedAt);
   if(!r||!Number.isFinite(limit)||!Number.isFinite(locked)||!Number.isFinite(source)||source>locked||locked>=limit||!Array.isArray(s.picks)||s.picks.some(p=>!validPick(p))||new Set((s.picks||[]).map(p=>p.pick)).size!==s.picks.length)note('ERROR','Invalid shadow prediction '+key);
   if(s.selection){
    const sel=s.selection,decision=sel.decision;
    if(sel.schema!=='odds-free-selection-v1'||!['select','skip'].includes(decision)||sel.oddsUsed!==false||s.oddsUsed!==false||sel.lockedAt!==s.lockedAt||!Number.isFinite(Number(sel.margin))||!Number.isFinite(Date.parse(sel.lockedAt))||Date.parse(sel.lockedAt)>=limit)note('ERROR','Invalid pre-registered selection '+key);
    else{counts.preRegistered++;if(decision==='select')counts.selected++;else counts.skipped++;}
   }else counts.legacy++;

  }
 }
 if(counts.overdue)note('WARNING',counts.overdue+' results still pending >90 min after cutoff (may be source delay)');
 if(hour>=12&&counts.preRegistered===0)note('WARNING','No odds-free pre-registered selections today; inspect morning collection and cutoff-time workflow logs (legacy shadows do not count)');
}
const lines=['### BOAT NEXUS 保存データ監査 ('+today+' JST)','- 現行AI保存: '+counts.baseline+'R','- 試験AI保存: '+counts.shadow+'R','- 事前登録済み: '+counts.preRegistered+'R (選択 '+counts.selected+'R / 見送り '+counts.skipped+'R)','- 旧形式（選別検証対象外）: '+counts.legacy+'R','- 結果確定: '+counts.settled+'R','- 結果待ち: '+counts.pending+'R','- 締切90分超の結果待ち: '+counts.overdue+'R','- ERROR: '+issues.filter(x=>x.severity==='ERROR').length+'件 / WARNING: '+issues.filter(x=>x.severity==='WARNING').length+'件',...issues.slice(0,20).map(x=>'- ['+x.severity+'] '+x.message)];
const out=lines.join('\n')+'\n';console.log(out);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,out);
if(issues.some(x=>x.severity==='ERROR'))process.exitCode=1;
