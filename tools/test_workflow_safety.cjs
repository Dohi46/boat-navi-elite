#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const daily=fs.readFileSync('.github/workflows/daily-predictions.yml','utf8');
const settle=fs.readFileSync('.github/workflows/settle-predictions.yml','utf8');
function step(yaml,name){
 const marker='      - name: '+name+'\n';
 const start=yaml.indexOf(marker);
 assert(start>=0,'Missing workflow step: '+name);
 const next=yaml.indexOf('\n      - name: ',start+marker.length);
 return yaml.slice(start,next<0?undefined:next);
}
const baseline=step(daily,'Publish verified production baseline before experimental steps');
const shadow=step(daily,'Publish experimental shadow snapshots');
assert(daily.indexOf('      - name: Publish verified production baseline')<daily.indexOf('      - name: Test pre-cutoff shadow locking'));
assert.match(baseline,/git add -- "data\/auto\/\$today\.json"/);
assert.match(shadow,/if: steps\.shadow_validation\.outcome == 'success'/);
assert.match(shadow,/git add -- "data\/shadow\/\$today\.json"/);
const settled=step(settle,'Commit settled results');
const intraday=step(settle,'Publish validated pre-cutoff shadow locks');
assert(settle.indexOf('      - name: Match predictions')<settle.indexOf('      - name: Commit settled results'));
assert(settle.indexOf('      - name: Commit settled results')<settle.indexOf('      - name: Validate experimental collector scripts'),'Settle production before experimental collectors');
assert.doesNotMatch(settled,/git add (?:-- )?data\/shadow\//);
assert.match(intraday,/if: steps\.shadow_validation\.outcome == 'success'/);
assert.match(intraday,/Concurrent update changed a published shadow lock/);
assert.match(intraday,/git stash push --include-untracked/,'Experimental observations must not block rebase');
assert.match(step(settle,'Report actual saved data'),/continue-on-error: true/);
console.log('PASS: baseline-first, validated shadow-only, and independent reporting');
