#!/usr/bin/env node
'use strict';
// Offline page wiring regression; no network or production data required.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
const section=html.match(/<section id="analysis" class="page">([\s\S]*?)<\/section>/)?.[1];
assert.ok(section,'AI LAB section exists');
assert.ok(section.indexOf('id="dailyAutoPanel"')<section.indexOf('PREDICTION ENGINE'),'Daily predictions precede analysis');
assert.ok(section.includes('<details class="card lab-experiments">'),'Experimental section collapsible');
assert.ok(section.includes('id="selectiveLabPanel"'),'Experimental controls preserved');
for(const id of ['goDailyPredictions','dailyAutoPanel','dailyAutoLoad','aiVenue','aiRace','runAnalysis','buildTickets','runWaveTrial','runV14Trial','selectiveLoad']){
 assert.match(html,new RegExp('id="'+id+'"'),'Missing element '+id);
}
assert.match(js,/getElementById\("goDailyPredictions"\)\?\.addEventListener\("click"/,'Homepage shortcut wired');
assert.match(js,/dataset\.raceChangeBound==="true"/,'Selector event deduplication present');
assert.match(html,/app\.js\?v=mobile-lab-stability-20261117b/,'Updated JS cache key present');
console.log('PASS: mobile homepage shortcut, AI LAB structure, preserved controls, selector guard and cache key');
