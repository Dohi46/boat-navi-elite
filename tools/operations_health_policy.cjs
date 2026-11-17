'use strict';
// Pure status policy for scheduled GitHub Actions runs.
function workflowStatus({id,date,today,hour,matching}){
 const success=matching.find(r=>r.status==='completed'&&r.conclusion==='success');
 const latest=matching[0]||null;
 const grace=!latest&&date===today&&['research','quality','dailyMonitor'].includes(id)&&hour<3;
 const latestFailed=latest?.status==='completed'&&latest.conclusion!=='success';
 return {status:latestFailed?'alert':success?'ok':grace||latest?.status==='in_progress'||latest?.status==='queued'?'pending':'alert',success,latest};
}
function shadowStatus({date,expectedDate,valid,legacy,invalid}){
 if(date!==expectedDate||invalid>0)return 'alert';
 if(valid>0)return 'ok';
 return legacy>0?'pending':'alert';
}
module.exports={workflowStatus,shadowStatus};
