const test = require("node:test");
const assert = require("node:assert/strict");
global.window = global;
require("../src/progression.js");
const progression = global.AITRPG_PROGRESSION;

test("LP requirement grows by 50 for each current level", () => {
  assert.equal(progression.requiredLp(1), 50);
  assert.equal(progression.requiredLp(2), 100);
  assert.equal(progression.requiredLp(3), 150);
  assert.equal(progression.requiredLp(10), 500);
  assert.equal(progression.requiredLp(10000), 500000);
});

test("50 LP advances level 1 to 2 and awards one stat point", () => {
  const c = { level: 1, lp: 0, nextLp: 50, statPoints: 0 };
  const result = progression.applyLp(c, 50);
  assert.equal(result.level, 2);
  assert.equal(result.remaining, 0);
  assert.equal(c.nextLp, 100);
  assert.equal(c.statPoints, 1);
});

test("surplus LP carries forward across multiple levels", () => {
  const c = { level: 1, lp: 0, nextLp: 50, statPoints: 0 };
  const result = progression.applyLp(c, 175);
  assert.equal(result.level, 3);
  assert.equal(result.remaining, 25);
  assert.equal(c.nextLp, 150);
  assert.equal(c.statPoints, 2);
});

test("level cap is 10000 and dead characters do not gain LP", () => {
  const capped = { level: 10000, lp: 0, nextLp: 500000, statPoints: 0 };
  const capResult = progression.applyLp(capped, 100);
  assert.equal(capResult.level, 10000);
  assert.equal(capped.lp, 100);
  const dead = { level: 4, lp: 2, nextLp: 200, statPoints: 0, dead: true };
  progression.applyLp(dead, 500);
  assert.equal(dead.level, 4);
  assert.equal(dead.lp, 2);
});
