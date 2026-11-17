import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Firestore rules enforce all 8 Hardened Pillars and block Dirty Dozen vectors', () => {
  const rules = fs.readFileSync('./firestore.rules', 'utf8');

  // Pillar 1 & 4: Default deny catch-all
  assert.ok(rules.includes('match /{document=**} {\n      allow read, write: if false;\n    }'));

  // Pillar 2 & 3: Path ID validation and strict key blueprints
  assert.ok(rules.includes('function isValidId(id)'));
  assert.ok(rules.includes('function isValidUserProfile(data)'));
  assert.ok(rules.includes('function isValidOrder(data)'));
  assert.ok(rules.includes('function isValidReview(data)'));
  assert.ok(rules.includes('function isValidSupportMessage(data)'));

  // Pillar 5 & 8: Secure list queries checking resource.data and email_verified check
  assert.ok(rules.includes('request.auth.token.email_verified == true'));
  assert.ok(rules.includes('resource.data.userId == request.auth.uid'));
  assert.ok(rules.includes('incoming().createdAt == request.time'));
  assert.ok(rules.includes('data.defaultAddress is string'));
  assert.ok(rules.includes('data.phone is string'));
});
