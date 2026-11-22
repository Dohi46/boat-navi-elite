// Read-only regression check: race-level hit rate must not count winning tickets.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '../data/auto/2026-11-19.json');
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.equal(doc.date, '2026-11-19');
assert.ok(Array.isArray(doc.races) && doc.races.length > 0);
const ids = new Set();
let settled = 0, hitRaces = 0, hitTickets = 0;
for (const r of doc.races) {
  const id = String(r.venue) + ':' + String(r.race);
  assert.ok(!ids.has(id), 'duplicate race ' + id);
  ids.add(id);
  const winners = r.result?.winningCombinations;
  if (!Array.isArray(winners) || !winners.length) continue;
  settled++;
  const winning = new Set(winners.map(x => x.combination));
  const hits = (r.picks || []).filter(p => winning.has(p.pick)).length;
  hitTickets += hits;
  if (hits > 0) hitRaces++;
}
assert.ok(hitRaces <= settled);
assert.ok(hitRaces <= hitTickets);
console.log(JSON.stringify({date:doc.date,predictedRaces:doc.races.length,settledRaces:settled,unresolvedRaces:doc.races.length-settled,hitRaces,hitTickets,raceHitRate:settled?hitRaces/settled:null}));
