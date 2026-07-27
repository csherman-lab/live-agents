#!/usr/bin/env node
/**
 * Verify Wave 1–3 polish assets are present and correctly structured.
 * Exit 0 on success; print FAIL details and exit 1 otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function parseGlbJson(filePath) {
  const buf = fs.readFileSync(filePath);
  const magic = buf.toString('utf8', 0, 4);
  if (magic !== 'glTF') throw new Error(`${filePath}: bad magic ${magic}`);
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const chunkLen = buf.readUInt32LE(offset);
    const chunkType = buf.toString('utf8', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + chunkLen);
    offset += 8 + chunkLen;
    if (chunkType === 'JSON') {
      return JSON.parse(data.toString('utf8').replace(/\0+$/, ''));
    }
  }
  throw new Error(`${filePath}: no JSON chunk`);
}

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

const characterPath = path.join(root, 'public/models/character.glb');
const officePath = path.join(root, 'public/models/office.glb');
assert(fs.existsSync(characterPath), 'character.glb missing');
assert(fs.existsSync(officePath), 'office.glb missing');

const character = parseGlbJson(characterPath);
const charMeshes = new Set((character.meshes || []).map((m) => m.name));
for (const name of [
  'body',
  'eyes',
  'mouth',
  'cap',
  'headphones',
  'beanie',
  'glasses',
  'lanyard',
  'backpack',
  'scarf',
]) {
  assert(charMeshes.has(name), `character.glb missing mesh "${name}" (have: ${[...charMeshes].join(', ')})`);
}

const animNames = new Set((character.animations || []).map((a) => a.name));
for (const name of ['Idle', 'Walk', 'Sit', 'Sit_Idle', 'Sit_Work', 'Talk', 'Listen']) {
  assert(animNames.has(name), `character.glb missing animation "${name}"`);
}

const office = parseGlbJson(officePath);
const officeNodes = new Set((office.nodes || []).map((n) => n.name).filter(Boolean));
for (const name of [
  'static-work-desk.001',
  'static-work-chair.000',
  'static-sofa',
  'static-cafe-table',
  'colored-border',
  'navMesh',
  'poi-sit_work-1',
  'poi-sit_idle-1',
]) {
  assert(officeNodes.has(name), `office.glb missing node "${name}"`);
}

const characterSrc = fs.readFileSync(path.join(root, 'src/simulation/entities/CharacterManager.ts'), 'utf8');
assert(characterSrc.includes('character.glb?v=252'), 'CharacterManager cache bust should be ?v=252');
assert(characterSrc.includes('SPECIALIST_ACCESSORIES = [1, 3, 4, 5, 6, 7]'), 'SPECIALIST_ACCESSORIES incomplete');

const worldSrc = fs.readFileSync(path.join(root, 'src/simulation/world/WorldManager.ts'), 'utf8');
assert(worldSrc.includes('office.glb?v=161'), 'WorldManager cache bust should be ?v=161');
assert(worldSrc.includes('isLoungeChair') || worldSrc.includes('lounge'), 'lounge chair material split missing');

const constantsSrc = fs.readFileSync(path.join(root, 'src/simulation/constants.ts'), 'utf8');
assert(constantsSrc.includes('AGENT_SEPARATION_WANDER_CLEARANCE = 1.65'), 'wander clearance not 1.65');
assert(constantsSrc.includes('SELECTION_RING_PULSE_SPEED'), 'selection ring pulse constants missing');

const ringPath = path.join(root, 'src/simulation/entities/SelectionRing.ts');
assert(fs.existsSync(ringPath), 'SelectionRing.ts missing');
const ringSrc = fs.readFileSync(ringPath, 'utf8');
assert(ringSrc.includes('export class SelectionRing'), 'SelectionRing class missing');
assert(ringSrc.includes('export class HoverRing'), 'HoverRing class missing');

const agentsSrc = fs.readFileSync(path.join(root, 'src/data/agents.ts'), 'utf8');
assert((agentsSrc.match(/accessory:\s*\d+/g) || []).length >= 10, 'expected explicit accessory fields on specialists');

if (failures.length) {
  console.error('VERIFY FAIL:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}

console.log('VERIFY OK: polish assets + wiring intact');
console.log(`  character meshes: ${[...charMeshes].sort().join(', ')}`);
console.log(`  office nodes: ${officeNodes.size}`);
console.log(`  character.glb bytes: ${fs.statSync(characterPath).size}`);
console.log(`  office.glb bytes: ${fs.statSync(officePath).size}`);
