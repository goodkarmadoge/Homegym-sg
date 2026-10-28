import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = (name) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');
const ci = workflow('ci.yml');

test('CI listens for the actual nightly sync workflow name', () => {
  const name = workflow('sync-sheet.yml').match(/^name: (.+)$/m)?.[1];
  const listeners = ci.match(/^  workflow_run:\n\s+workflows: \[(.+)\]/m)?.[1];
  assert.ok(name && listeners, 'both workflows must declare their handoff');
  assert.ok(listeners.includes(`'${name}'`) || listeners.includes(`"${name}"`),
    `CI must listen for ${name}; a GITHUB_TOKEN push cannot trigger it instead`);
});

test('Pages only deploys main, and a workflow_run must have succeeded on main', () => {
  const expression = ci.match(/^  pages:[\s\S]*?^    if: >-\n((?:^      .*\n)+)/m)?.[1];
  assert.ok(expression, 'could not find the Pages deployment guard');
  // GitHub expressions use the same boolean/equality operators as JavaScript
  // here. Evaluate the real guard, not a second hand-written copy of its logic.
  const deploys = new Function('github', `return (${expression});`);
  const event = (event_name, ref = 'refs/heads/main', conclusion = 'success', head_branch = 'main') =>
    ({ event_name, ref, event: { workflow_run: { conclusion, head_branch } } });

  assert.equal(deploys(event('push')), true);
  assert.equal(deploys(event('workflow_dispatch')), true);
  assert.equal(deploys(event('pull_request')), false);
  assert.equal(deploys(event('push', 'refs/heads/preview')), false);
  assert.equal(deploys(event('workflow_dispatch', 'refs/heads/preview')), false);
  assert.equal(deploys(event('workflow_run')), true);
  for (const conclusion of ['failure', 'cancelled', 'action_required', 'skipped', null]) {
    assert.equal(deploys(event('workflow_run', 'refs/heads/main', conclusion)), false, conclusion);
  }
  assert.equal(deploys(event('workflow_run', 'refs/heads/main', 'success', 'preview')), false);
});
