import type { Party, PartyUnit } from "@/types/battleSimulator";

const STORAGE_KEY = "battle_nations_parties";

export function getParties(): Party[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveParty(party: Party): void {
  const parties = getParties();
  const existingIndex = parties.findIndex(p => p.id === party.id);
  
  if (existingIndex >= 0) {
    parties[existingIndex] = { ...party, updatedAt: Date.now() };
  } else {
    parties.push({ ...party, createdAt: Date.now(), updatedAt: Date.now() });
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parties));
}

export function deleteParty(partyId: string): void {
  const parties = getParties().filter(p => p.id !== partyId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parties));
}

export function createNewParty(name: string): Party {
  return {
    id: crypto.randomUUID(),
    name,
    units: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function addUnitToParty(party: Party, unit: PartyUnit): Party {
  return {
    ...party,
    units: [...party.units.filter(u => u.gridId !== unit.gridId), unit],
    updatedAt: Date.now(),
  };
}

export function removeUnitFromParty(party: Party, gridId: number): Party {
  return {
    ...party,
    units: party.units.filter(u => u.gridId !== gridId),
    updatedAt: Date.now(),
  };
}

export function updateUnitRank(party: Party, gridId: number, rank: number): Party {
  return {
    ...party,
    units: party.units.map(u => u.gridId === gridId ? { ...u, rank } : u),
    updatedAt: Date.now(),
  };
}
