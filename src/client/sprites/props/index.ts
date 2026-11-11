// Sprite family `props`: furniture, wall and kitchen props, each in its own file
// so that phases 7 and 8 can work in parallel. DOM-free.
import type { Family } from '../types.js';
import { SPRITES as FURNITURE } from './furniture.js';
import { SPRITES as KITCHEN } from './kitchen.js';
import { SPRITES as WALL } from './wall.js';

/** The `props` family; preview sheet `var/sprites/props.png`. */
export const propsFamily: Family = { name: 'props', sprites: [...FURNITURE, ...WALL, ...KITCHEN] };
