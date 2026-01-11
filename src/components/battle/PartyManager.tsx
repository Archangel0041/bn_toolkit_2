import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, Edit2 } from "lucide-react";
import type { Party } from "@/types/battleSimulator";

interface PartyManagerProps {
  parties: Party[];
  selectedPartyId: string | null;
  onSelectParty: (id: string | null) => void;
  onCreateParty: (name: string) => void;
  onDeleteParty: (id: string) => void;
  onRenameParty: (name: string) => void;
}

export function PartyManager({
  parties,
  selectedPartyId,
  onSelectParty,
  onCreateParty,
  onDeleteParty,
  onRenameParty,
}: PartyManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const selectedParty = parties.find(p => p.id === selectedPartyId);

  const handleCreate = () => {
    if (newName.trim()) {
      onCreateParty(newName.trim());
      setNewName("");
      setIsCreateOpen(false);
    }
  };

  const handleRename = () => {
    if (newName.trim()) {
      onRenameParty(newName.trim());
      setNewName("");
      setIsRenameOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        value={selectedPartyId || ""}
        onValueChange={(val) => onSelectParty(val || null)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select a party..." />
        </SelectTrigger>
        <SelectContent>
          {parties.map(party => (
            <SelectItem key={party.id} value={party.id}>
              {party.name} ({party.units.length} units)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            New Party
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Party</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Party name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <DialogFooter>
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedParty && (
        <>
          <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1"
                onClick={() => setNewName(selectedParty.name)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rename Party</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="New name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
              <DialogFooter>
                <Button onClick={handleRename} disabled={!newName.trim()}>
                  Rename
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Party</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{selectedParty.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDeleteParty(selectedParty.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
