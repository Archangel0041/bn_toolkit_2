import { useState, useEffect, useCallback } from "react";
import type { Party, PartyUnit } from "@/types/battleSimulator";
import { 
  getParties, 
  saveParty, 
  deleteParty, 
  createNewParty, 
  addUnitToParty, 
  removeUnitFromParty,
  updateUnitRank 
} from "@/lib/partyStorage";
import { 
  fetchPartiesFromCloud, 
  savePartyToCloud, 
  deletePartyFromCloud 
} from "@/lib/cloudPartyStorage";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useParties() {
  const { user } = useAuth();
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = !!user;

  // Fetch parties from cloud or local storage
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      fetchPartiesFromCloud()
        .then(setParties)
        .catch((err) => {
          console.error("Failed to fetch cloud parties:", err);
          toast.error("Failed to load parties from cloud");
        })
        .finally(() => setIsLoading(false));
    } else {
      setParties(getParties());
    }
  }, [isAuthenticated]);

  const selectedParty = parties.find(p => p.id === selectedPartyId) || null;

  const refreshParties = useCallback(async () => {
    if (isAuthenticated) {
      try {
        const cloudParties = await fetchPartiesFromCloud();
        setParties(cloudParties);
      } catch (err) {
        console.error("Failed to refresh cloud parties:", err);
      }
    } else {
      setParties(getParties());
    }
  }, [isAuthenticated]);

  const createParty = useCallback(async (name: string) => {
    const newParty = createNewParty(name);
    
    if (isAuthenticated && user) {
      try {
        await savePartyToCloud(newParty, user.id);
        await refreshParties();
      } catch (err) {
        console.error("Failed to create cloud party:", err);
        toast.error("Failed to save party to cloud");
      }
    } else {
      saveParty(newParty);
      setParties(getParties());
    }
    
    setSelectedPartyId(newParty.id);
    return newParty;
  }, [isAuthenticated, user, refreshParties]);

  const updateParty = useCallback(async (party: Party) => {
    if (isAuthenticated && user) {
      try {
        await savePartyToCloud(party, user.id);
        await refreshParties();
      } catch (err) {
        console.error("Failed to update cloud party:", err);
        toast.error("Failed to save party to cloud");
      }
    } else {
      saveParty(party);
      setParties(getParties());
    }
  }, [isAuthenticated, user, refreshParties]);

  const removeParty = useCallback(async (partyId: string) => {
    if (isAuthenticated) {
      try {
        await deletePartyFromCloud(partyId);
        await refreshParties();
      } catch (err) {
        console.error("Failed to delete cloud party:", err);
        toast.error("Failed to delete party from cloud");
      }
    } else {
      deleteParty(partyId);
      setParties(getParties());
    }
    
    if (selectedPartyId === partyId) {
      setSelectedPartyId(null);
    }
  }, [isAuthenticated, selectedPartyId, refreshParties]);

  const addUnit = useCallback(async (unit: PartyUnit) => {
    if (!selectedParty) return;
    const updated = addUnitToParty(selectedParty, unit);
    
    if (isAuthenticated && user) {
      try {
        await savePartyToCloud(updated, user.id);
        await refreshParties();
      } catch (err) {
        console.error("Failed to add unit to cloud party:", err);
        toast.error("Failed to save party to cloud");
      }
    } else {
      saveParty(updated);
      setParties(getParties());
    }
  }, [selectedParty, isAuthenticated, user, refreshParties]);

  const removeUnit = useCallback(async (gridId: number) => {
    if (!selectedParty) return;
    const updated = removeUnitFromParty(selectedParty, gridId);
    
    if (isAuthenticated && user) {
      try {
        await savePartyToCloud(updated, user.id);
        await refreshParties();
      } catch (err) {
        console.error("Failed to remove unit from cloud party:", err);
        toast.error("Failed to save party to cloud");
      }
    } else {
      saveParty(updated);
      setParties(getParties());
    }
  }, [selectedParty, isAuthenticated, user, refreshParties]);

  const setUnitRank = useCallback(async (gridId: number, rank: number) => {
    if (!selectedParty) return;
    const updated = updateUnitRank(selectedParty, gridId, rank);
    
    if (isAuthenticated && user) {
      try {
        await savePartyToCloud(updated, user.id);
        await refreshParties();
      } catch (err) {
        console.error("Failed to update unit rank in cloud party:", err);
        toast.error("Failed to save party to cloud");
      }
    } else {
      saveParty(updated);
      setParties(getParties());
    }
  }, [selectedParty, isAuthenticated, user, refreshParties]);

  const renameParty = useCallback(async (name: string) => {
    if (!selectedParty) return;
    const updated = { ...selectedParty, name, updatedAt: Date.now() };
    
    if (isAuthenticated && user) {
      try {
        await savePartyToCloud(updated, user.id);
        await refreshParties();
      } catch (err) {
        console.error("Failed to rename cloud party:", err);
        toast.error("Failed to save party to cloud");
      }
    } else {
      saveParty(updated);
      setParties(getParties());
    }
  }, [selectedParty, isAuthenticated, user, refreshParties]);

  return {
    parties,
    selectedParty,
    selectedPartyId,
    setSelectedPartyId,
    createParty,
    updateParty,
    removeParty,
    addUnit,
    removeUnit,
    setUnitRank,
    renameParty,
    isLoading,
  };
}
