// Diagnostic only: inspect historical CSV availability without changing predictions.
const dates=['2026-11-15','2026-11-01','2026-10-15','2026-09-15','2026-05-03'];
const bases=['https://boatracecsv.github.io/data/previews/od3/','https://raw.githubusercontent.com/BoatraceCSV/boatracecsv.github.io/main/data/previews/od3/'];
(async()=>{
 let found=0;
 for(const date of dates){
  for(const base of bases){
   const url=base+date.replace(/-/g,'/')+'.csv';
   try{
    const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
    const contentType=response.headers.get('content-type')||'';
    const text=response.ok?await response.text():'';
    const plausible=response.ok&&text.includes('3連単_1-2-3')&&text.includes('レース日');
    console.log(JSON.stringify({date,source:base.includes('raw.githubusercontent')?'github-raw':'github-pages',status:response.status,contentType,bytes:text.length,validHeader:plausible}));
    if(plausible)found++;
   }catch(e){console.log(JSON.stringify({date,source:base,error:e.message}));}
  }
 }
 console.log('Valid CSV endpoints:',found,'(diagnostic; no data saved)');
})().catch(e=>{console.error(e);process.exitCode=1;});
