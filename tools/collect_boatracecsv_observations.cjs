#!/usr/bin/env node
'use strict';
// Experimental, read-only BoatraceCSV ingestion. Never modifies production picks.
// A published CSV row is only eligible when BOTH its source acquisition time
// and our observation time are strictly before the local race cutoff.
const fs=require('node:fs'),path=require('node:path');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const [yyyy,mm,dd]=date.split('-');
const root='https://boatracecsv.github.io/data/previews/';
const predictionFile=path.resolve(__dirname,'../data/auto/'+date+'.json');
function csvRows(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
  else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}
  else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(quoted)throw Error('Unterminated CSV quote');
 if(row.length||cell){row.push(cell.replace(/\r$/,''));rows.push(row);}
 if(rows[0]?.[0])rows[0][0]=rows[0][0].replace(/^\uFEFF/,'');
 return rows;
}
function cutoff(s){const m=String(s||'').match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)$/);return m?Date.parse(m[1]+'T'+m[2]+'+09:00'):NaN;}
async function main(){
 if(!fs.existsSync(predictionFile)){console.log('CSV_STATUS=no_predictions date='+date);return;}
 const doc=JSON.parse(fs.readFileSync(predictionFile,'utf8'));
 const races=new Map((doc.races||[]).map(r=>[date.replace(/-/g,'')+String(r.venue).padStart(2,'0')+String(r.race).padStart(2,'0'),r]));
 const outFile=path.resolve(__dirname,'../data/external/boatracecsv/'+date+'.json');
 let saved=fs.existsSync(outFile)?JSON.parse(fs.readFileSync(outFile,'utf8')):{date,schema:'boatracecsv-observation-v1',sources:{}};
 if(saved.date!==date||saved.schema!=='boatracecsv-observation-v1'||!saved.sources||typeof saved.sources!=='object')throw Error('Invalid saved external schema');
 let added=0;
 for(const kind of ['sui','od3']){
  const url=root+kind+'/'+yyyy+'/'+mm+'/'+dd+'.csv';
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{'cache-control':'no-cache'}});
   if(!response.ok)throw Error('HTTP '+response.status);
   const body=await response.text(),observedAt=new Date().toISOString(),rows=csvRows(body);
   const header=rows.shift()||[];
   for(const required of ['レースコード','取得日時'])if(!header.includes(required))throw Error('Missing column '+required);
   const codeIndex=header.indexOf('レースコード'),timeIndex=header.indexOf('取得日時');
   const eligible=[];let invalid=0,late=0,notMatched=0;
   for(const values of rows){
    const code=values[codeIndex],r=races.get(code);
    if(!r){notMatched++;continue;}
    const sourceAt=Date.parse(values[timeIndex]),deadline=cutoff(r.cutoff);
    if(!Number.isFinite(sourceAt)||!Number.isFinite(deadline)||values.length!==header.length){invalid++;continue;}
    if(sourceAt>=deadline||Date.parse(observedAt)>=deadline){late++;continue;}
    eligible.push({raceCode:code,sourceAcquiredAt:values[timeIndex],observedAt,values});
   }
   if(!saved.sources[kind])saved.sources[kind]={url,header,rows:[]};
   const source=saved.sources[kind];
   if(JSON.stringify(source.header)!==JSON.stringify(header))throw Error('Schema changed for '+kind);
   const existing=new Set(source.rows.map(r=>r.raceCode+'|'+r.sourceAcquiredAt));
   for(const row of eligible){const key=row.raceCode+'|'+row.sourceAcquiredAt;if(!existing.has(key)){source.rows.push(row);existing.add(key);added++;}}
   console.log('CSV_SOURCE='+kind+' rows='+rows.length+' eligible='+eligible.length+' late='+late+' invalid='+invalid+' unmatched='+notMatched);
  }catch(e){console.warn('CSV_SOURCE='+kind+' unavailable: '+e.message);}
 }
 if(added){fs.mkdirSync(path.dirname(outFile),{recursive:true});fs.writeFileSync(outFile,JSON.stringify(saved,null,2)+'\n');}
 console.log('CSV_STATUS='+(added?'saved':'no_new_valid_pre_cutoff_rows')+' added='+added+' date='+date);
 console.log('CSV_NOTE=Raw external observations only. Odds are not calibrated or used in production or ROI.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
