// Aggregate GitHub Actions health. No production writes.
'use strict';
const fs=require('node:fs');
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
  const success=matching.find(r=>r.status==='completed'&&r.conclusion==='success');
  const latest=matching[0]||null;
  // GitHub scheduled jobs can start late. Missing today's 00:45 JST monitor
  // is pending at the 01:30 JST health check, not proof of failure.
  // A completed failed run still alerts; other missing workflows retain alerts.
  const awaitingMonitor=c.id==='dailyMonitor'&&c.date===today&&!latest;
  checksOut.push({...c,status:success?'ok':awaitingMonitor||latest?.status==='in_progress'||latest?.status==='queued'?'pending':'alert',runId:success?.id||latest?.id||null,conclusion:success?.conclusion||latest?.conclusion||null,runCount:matching.length});
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
 const shadowStatus=shadow?.date!==yesterday||invalid>0?'alert':valid.length>0?'ok':legacy>0?'pending':'alert';
 const shadowCheck={id:'shadowSelection',date:yesterday,status:shadowStatus,locks:shadowRows.length,preRegistered:valid.length,legacy,invalid};
 const all=[...checksOut,snapshotCheck,shadowCheck];
 const report={schema:'boat-nexus-operations-health-v1',checkedAt:new Date().toISOString(),todayJst:today,yesterdayJst:yesterday,status:all.every(c=>c.status==='ok')?'ok':all.some(c=>c.status==='alert')?'alert':'pending',checks:all,note:'Checks scheduled/manual runs by JST creation date, not completion date. Push runs are excluded. A missing same-day daily monitor is pending because GitHub schedules can be delayed; completed failures still alert. Shadow pre-registration is monitored separately from production baseline health. No automatic repair.'};
 fs.mkdirSync('data/research',{recursive:true});
 fs.writeFileSync('data/research/operations-health-latest.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 for(const c of all)if(c.status!=='ok')console.log('::warning::'+c.id+' '+c.status+' ('+c.date+')');
 if(report.status==='alert')process.exitCode=1;
}
main().catch(e=>{console.error('::error::'+e.message);process.exitCode=1;});
