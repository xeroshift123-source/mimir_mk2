'use strict';
const { TARGETS, POLICY_HASH } = require('./nikkeScoreAdapter');
const ELEMENTS = { fire: '작열', water: '수냉', wind: '풍압', electric: '전격', iron: '철갑' };

// Unowned targets contribute zero; failed, missing or stale owned results do not
// become artificially low account totals. Sum damage before converting to score.
function elementDamageTotals(snapshot, commander) {
  if (!snapshot || !['complete', 'partial'].includes(snapshot.status)
    || snapshot.syncId !== commander?.scoreSyncId || !Array.isArray(commander.characters)) return {};
  const owned = new Set((commander.characters || []).map(c => c.name_code));
  const totals = {};
  for (const element of Object.keys(ELEMENTS)) {
    let sum = 0, valid = true;
    for (const [key, target] of TARGETS) {
      if (target.weakness !== element || !owned.has(target.nameCode)) continue;
      const r = snapshot.results?.[key];
      if (r?.status !== 'complete' || r.policyHash !== POLICY_HASH
        || !Number.isSafeInteger(r.damage) || r.damage < 0) { valid = false; break; }
      sum += r.damage;
    }
    if (valid && Number.isSafeInteger(sum)) totals[element] = sum;
  }
  return totals;
}

module.exports = { ELEMENTS, elementDamageTotals };
