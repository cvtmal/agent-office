import { describe, expect, it } from 'vitest';
import { PALETTE } from '../render/palette.js';
import { POSE_FRAMES } from '../sprites/characters/compose.js';
import { spriteById } from '../sprites/registry.js';
import { ART_COLOURS, CHEER_FRAME_NAMES, HEAD_FRAME, LIFE_IDS, WALK_FRAME_NAMES } from './art-ids.js';

const poses: readonly string[] = POSE_FRAMES;
const lifeIds = Object.values(LIFE_IDS).flat();
const colours = Object.values(ART_COLOURS).flat();

describe('art ids (the art seam contract)', () => {
  it.each([...WALK_FRAME_NAMES, HEAD_FRAME, ...CHEER_FRAME_NAMES])('pose frame %s is in POSE_FRAMES', (name) => {
    expect(poses).toContain(name);
  });

  it('names every life overlay sprite', () => {
    expect(lifeIds).toHaveLength(13);
  });

  it.each(lifeIds)('life sprite %s resolves in the sprite registry', (id) => {
    expect(spriteById(id)).toBeDefined();
  });

  it.each(colours)('colour %s is a palette name', (name) => {
    expect(PALETTE[name]).toBeDefined();
  });
});
