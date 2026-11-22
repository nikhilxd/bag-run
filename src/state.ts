import { loadSave, writeSave, type SaveData } from './systems/save';

export const state: { save: SaveData } = { save: loadSave() };
export function persist(): void { writeSave(state.save); }
export function replaceSave(s: SaveData): void { state.save = s; persist(); }
