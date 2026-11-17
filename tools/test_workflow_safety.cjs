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
assert.match(shadow,/Immutable published shadow lock differs/,'Daily shadow publishing must preserve remote locks');
assert.match(shadow,/git rebase origin\/main[\s\S]*?verify_immutable[\s\S]*?git push origin/,'Daily shadow retry must recheck locks');
const settled=step(settle,'Commit settled results');
const intraday=step(settle,'Publish validated pre-cutoff shadow locks');
assert(settle.indexOf('      - name: Match predictions')<settle.indexOf('      - name: Commit settled results'));
assert(settle.indexOf('      - name: Commit settled results')<settle.indexOf('      - name: Validate experimental collector scripts'),'Settle production before experimental collectors');
assert.doesNotMatch(settled,/git add (?:-- )?data\/shadow\//);
assert.match(intraday,/if: steps\.shadow_validation\.outcome == 'success'/);
assert.match(intraday,/Concurrent update changed a published shadow lock/);
assert.match(intraday,/git stash push --include-untracked/,'Experimental observations must not block rebase');
const observations=step(settle,'Publish experimental observations independently');
assert(settle.indexOf('      - name: Publish validated pre-cutoff shadow locks')<settle.indexOf('      - name: Publish experimental observations independently'),'Publish locked predictions before observations');
assert.match(observations,/git stash pop/,'Restore stashed observations');
assert.match(observations,/git restore -- "data\/shadow\/\$today\.json"/,'Discard invalid uncommitted tracked shadow before observation rebase');
assert.match(observations,/git ls-files --error-unmatch/,'Discard invalid untracked shadow before observation rebase');
assert.ok(observations.includes('data/odds/$day.json'),'Publish collected odds');
assert.ok(observations.includes('data/external/boatracecsv/$today.json'),'Publish collected external CSV');
assert.match(observations,/continue-on-error: true/,'Observation failures must not invalidate settlement');
assert.match(step(settle,'Report actual saved data'),/continue-on-error: true/);
console.log('PASS: baseline-first, validated shadow-only, and independent reporting');
