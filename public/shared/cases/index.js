// Case registry. To add a case: create caseNN-name.js with the same shape
// as case01-heist.js and add it to this list. Nothing else needs to change.
import heist from './case01-heist.js';
import will from './case02-will.js';
import insider from './case03-insider.js';
import vanish from './case04-vanish.js';
import decision from './case05-decision.js';
import witness from './case06-witness.js';

export const CASES = [heist, will, insider, vanish, decision, witness];
export const getCase = (id) => CASES.find((c) => c.id === id) || null;
