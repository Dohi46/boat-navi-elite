// Aggregate GitHub Actions health. No production writes.
'use strict';
const fs=require('node:fs');
const {workflowStatus,shadowStatus}=require('./operations_health_policy.cjs');
const jst=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const today=jst(new Date());
const yesterday=jst(new Date(Date.now()-86400000));
const checks=[
 {id:'collection',workflow:'daily-predictions.yml',date:yesterday},
 {id:'settlement',workflow:'settle-predictions.yml',date:yesterday},
 {id:'research',workflow:'ai-ranking-research.yml',date:today},
 {id:'quality',workflow:'quality-rolling-report.yml',date:today},
 {id:'dailyMonitor',workflow:'daily-quality-monitor.yml',date:today}
];
async function main(){
 const repo=process.env.GITHUB_REPOSITORY;
 const token=process.env.GITHUB_TOKEN;
 if(!repo||!token)throw Error('GITHUB_REPOSITORY and GITHUB_TOKEN required');
 const [owner,name]=repo.split('/');
 const checksOut=[];
 for(const c of checks){
  const url='https://api.github.com/repos/'+owner+'/'+name+'/actions/workflows/'+c.workflow+'/runs?per_page=100';
  const res=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!res.ok)throw Error(c.workflow+' GitHub API '+res.status);
  const payload=await res.json();
  const matching=(payload.workflow_runs||[]).filter(r=>['schedule','workflow_dispatch'].includes(r.event)&&jst(new Date(r.created_at))===c.date);
  const jstHour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
  const {status,success,latest}=workflowStatus({id:c.id,date:c.date,today,hour:jstHour,matching});
  const pushSuccess=(payload.workflow_runs||[]).find(r=>r.event==='push'&&r.status==='completed'&&r.conclusion==='success');
  checksOut.push({...c,status,runId:success?.id||latest?.id||null,conclusion:success?.conclusion||latest?.conclusion||null,runCount:matching.length,lastPushSuccessAt:pushSuccess?.created_at||null,lastPushSuccessRunId:pushSuccess?.id||null});
 }
 const snapshot='data/auto/'+yesterday+'.json';
 let data=null;
 if(fs.existsSync(snapshot)){try{data=JSON.parse(fs.readFileSync(snapshot,'utf8'));}catch(e){data=null;}}
 const races=Array.isArray(data?.races)?data.races:[];
 const unsettled=races.filter(r=>!r.result).length;
 const snapshotCheck={id:'snapshot',date:yesterday,status:data?.date===yesterday&&races.length&&unsettled===0?'ok':'alert',races:races.length,unsettled};
 const shadowPath='data/shadow/'+yesterday+'.json';
 let shadow=null;
 if(fs.existsSync(shadowPath)){try{shadow=JSON.parse(fs.readFileSync(shadowPath,'utf8'));}catch(e){shadow=null;}}
 const shadowRows=shadow?.races&&!Array.isArray(shadow.races)&&typeof shadow.races==='object'?Object.values(shadow.races):[];
 const valid=shadowRows.filter(s=>{
  const x=s.selection;
  return x?.schema==='odds-free-selection-v1'&&x.rule==='lane-adjusted-strength-margin-gte-0.75'&&x.oddsUsed===false&&s.oddsUsed===false&&x.lockedAt===s.lockedAt&&typeof x.margin==='number'&&Number.isFinite(x.margin)&&x.decision===(x.margin>=0.75?'select':'skip');
 });
 const legacy=shadowRows.filter(s=>!s.selection).length;
 const invalid=shadowRows.filter(s=>s.selection).length-valid.length;
 // Historical immutable locks without a selection field are not corrupt data.
 // Report their migration status as pending, while malformed new-format decisions alert.
 const selectionStatus=shadowStatus({date:shadow?.date,expectedDate:yesterday,valid:valid.length,legacy,invalid});
 const shadowCheck={id:'shadowSelection',date:yesterday,status:selectionStatus,locks:shadowRows.length,preRegistered:valid.length,legacy,invalid};
 const all=[...checksOut,snapshotCheck,shadowCheck];
 const report={schema:'boat-nexus-operations-health-v1',checkedAt:new Date().toISOString(),todayJst:today,yesterdayJst:yesterday,status:all.every(c=>c.status==='ok')?'ok':all.some(c=>c.status==='alert')?'alert':'pending',checks:all,note:'Checks scheduled/manual runs by JST creation date, not completion date. Push runs are excluded from scheduled-run status, but latest successful push execution is reported separately. Missing same-day research, quality and daily monitor runs are pending before 03:00 JST, then alert; completed failures alert immediately. Shadow pre-registration is monitored separately from production baseline health. No automatic repair.'};
 fs.mkdirSync('data/research',{recursive:true});
 fs.writeFileSync('data/research/operations-health-latest.json',JSON.stringify(report,null,2)+'\n');
 if(process.env.GITHUB_STEP_SUMMARY){
  const counts={ok:all.filter(x=>x.status==='ok').length,pending:all.filter(x=>x.status==='pending').length,alert:all.filter(x=>x.status==='alert').length};
  const lines=['## BOAT NEXUS operations health','**Overall: '+report.status.toUpperCase()+'** ('+today+' JST)','OK '+counts.ok+' / PENDING '+counts.pending+' / ALERT '+counts.alert,'','| Check | Date (JST) | Status | Details |','| --- | --- | --- | --- |'];
  for(const x of all){
   const detail=x.id==='snapshot'?x.races+' races, '+x.unsettled+' unsettled':x.id==='shadowSelection'?x.locks+' locks, '+x.preRegistered+' registered, '+x.legacy+' legacy, '+x.invalid+' invalid':x.runCount+' scheduled/manual runs'+(x.lastPushSuccessAt?', last push success '+x.lastPushSuccessAt:'');
   lines.push('| '+x.id+' | '+x.date+' | '+x.status.toUpperCase()+' | '+detail+' |');
  }
  lines.push('','A green workflow run means the monitor completed without critical alerts; PENDING checks may still remain.');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
 }
 console.log(JSON.stringify(report,null,2));
 for(const c of all)if(c.status!=='ok')console.log('::warning::'+c.id+' '+c.status+' ('+c.date+')');
 if(report.status==='alert')process.exitCode=1;
}
main().catch(e=>{console.error('::error::'+e.message);process.exitCode=1;});
