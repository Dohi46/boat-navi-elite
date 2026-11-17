// Prospective, pinned-rule evaluation. Never edits production predictions.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {evaluate}=require('./ai_safety_ranking.cjs');
const policy=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/research/forward-policy-v1.json'),'utf8'));
const dir=process.argv[2]||'data/auto';
const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)&&n.slice(0,10)>=policy.effectiveDate).sort():[];
const daily=files.map(f=>{
 const doc=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
 const result=evaluate([doc]);
 return {date:f.slice(0,10),quality:result.quality,selected:result.strategies.selected,skipped:result.strategies.skipped,baseline:result.strategies.baseline};
});
const docs=files.map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
const total=evaluate(docs);
const selected=total.strategies.selected,skipped=total.strategies.skipped,baseline=total.strategies.baseline;
if(selected.races+skipped.races!==baseline.races||selected.stake+skipped.stake!==baseline.stake||selected.payout+skipped.payout!==baseline.payout)throw Error('Selected/skipped partition mismatch');
console.log(JSON.stringify({schema:'boat-nexus-forward-validation-v1',policy,filesAnalyzed:files.length,daysWithEligibleRaces:daily.filter(d=>d.baseline.races>0).length,quality:total.quality,selected,skipped,baseline,daily,readiness:{minimumCalendarDays:30,observedCalendarDays:files.length,readyForReview:files.length>=30},note:'Virtual picks, not actual wagers. Future dates only; historical exploratory data excluded. Rules must remain pinned for prospective validity. Do not infer profitability from small samples.'},null,2));
