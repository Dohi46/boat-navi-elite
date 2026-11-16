// One-day GitHub-side test: published pre-cutoff trifecta odds only.
// No changes to v13, predictions, or browser records.
const fs=require('node:fs');
const date=process.env.TEST_DATE||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid date');
const url='https://boatracecsv.github.io/data/previews/od3/'+date.replace(/-/g,'/')+'.csv';
function cells(line){const out=[];let val='',quote=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quote&&line[i+1]==='"'){val+='"';i++;}else quote=!quote;}else if(c===','&&!quote){out.push(val);val='';}else val+=c;}out.push(val);return out;}
async function main(){
 console.log('Fetching:',url);
 const res=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{'user-agent':'BOAT-NEXUS-odds-validation/1.0'}});
 console.log('HTTP:',res.status,'Content-Type:',res.headers.get('content-type'));
 if(!res.ok)throw Error('Source returned HTTP '+res.status);
 const csv=(await res.text()).replace(/^\uFEFF/,'');
 const lines=csv.split(/\r?\n/).filter(Boolean);
 if(lines.length<2)throw Error('CSV has no data rows');
 const header=cells(lines[0]);
 const required=['レース日','レース場','レース回','取得日時'];
 if(required.some(k=>!header.includes(k)))throw Error('Missing columns: '+required.filter(k=>!header.includes(k)).join(','));
 const picks=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a!==b&&a!==c&&b!==c)picks.push(a+'-'+b+'-'+c);
 if(picks.some(p=>!header.includes('3連単_'+p)))throw Error('Missing one or more of 120 trifecta columns');
 const index=Object.fromEntries(header.map((h,i)=>[h,i]));
 const races=[];
 for(const line of lines.slice(1)){
  const row=cells(line);if(row[index['レース日']]!==date)continue;
  const venue=Number(row[index['レース場']]),race=Number(row[index['レース回']].replace(/R$/i,''));
  const capturedAt=row[index['取得日時']];
  if(!Number.isInteger(venue)||venue<1||venue>24||!Number.isInteger(race)||race<1||race>12||!Number.isFinite(Date.parse(capturedAt)))continue;
  const odds={};
  for(const pick of picks){const raw=row[index['3連単_'+pick]],n=Number(raw);if(raw!==''&&Number.isFinite(n)&&n>0)odds[pick]=n;}
  if(!Object.keys(odds).length)continue;
  races.push({venue,race,capturedAt,odds});
 }
 if(!races.length)throw Error('No valid odds rows for '+date);
 const out={date,source:'BoatraceCSV od3',sourceUrl:url,kind:'pre-cutoff-snapshot-not-final',races};
 fs.mkdirSync('data/odds',{recursive:true});
 const path='data/odds/'+date+'.json';
 fs.writeFileSync(path,JSON.stringify(out,null,2)+'\n');
 console.log('Saved',path,'races:',races.length,'first:',races[0].venue+'-'+races[0].race,'combinations:',Object.keys(races[0].odds).length);
}
main().catch(e=>{console.error('ODDS TEST FAILED:',e.message);process.exitCode=1;});
