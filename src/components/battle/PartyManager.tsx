import { useState, forwardRef } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2, Edit2, Save, Upload, Download, Share2, X } from "lucide-react";
import { ShareDialog } from "./ShareDialog";
import { toast } from "sonner";
import type { Party, PartyUnit } from "@/types/battleSimulator";

interface PartyManagerProps {
  parties: Party[];
  selectedPartyId: string | null;
  onSelectParty: (id: string | null) => void;
  onCreateParty: (name: string) => Promise<Party | null>;
  onDeleteParty: (id: string) => void;
  onRenameParty: (name: string) => void;
  onUpdateParty?: (party: Party) => void;
  onLoadParty?: () => void;
  currentUnits?: PartyUnit[];
  onImportUnits?: (units: PartyUnit[], name: string) => void;
}

export const PartyManager = forwardRef<HTMLDivElement, PartyManagerProps>(function PartyManager({
  parties,
  selectedPartyId,
  onSelectParty,
  onCreateParty,
  onDeleteParty,
  onRenameParty,
  onUpdateParty,
  onLoadParty,
  currentUnits = [],
  onImportUnits,
}, ref) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const selectedParty = parties.find(p => p.id === selectedPartyId);

  const handleSaveNew = async () => {
    const name = prompt("Enter party name:");
    if (name?.trim()) {
      const newParty = await onCreateParty(name.trim());
      if (newParty && onUpdateParty && currentUnits.length > 0) {
        onUpdateParty({
          ...newParty,
          units: [...currentUnits],
        });
      }
      if (newParty) {
        toast.success(`Created party: ${name.trim()}`);
      }
    }
  };

  const handleSave = () => {
    if (selectedParty && onUpdateParty) {
      onUpdateParty({
        ...selectedParty,
        units: [...currentUnits],
      });
      toast.success(`Updated: ${selectedParty.name}`);
    } else {
      handleSaveNew();
    }
  };

  const handleRename = () => {
    if (newName.trim()) {
      onRenameParty(newName.trim());
      setNewName("");
      setIsRenameOpen(false);
    }
  };

  const handleImport = (units: PartyUnit[], name: string) => {
    onImportUnits?.(units, name);
  };

  return (
    <div ref={ref} className="flex items-center gap-1.5 flex-wrap">
      {/* Party selector */}
      <Select
        value={selectedPartyId || ""}
        onValueChange={(val) => onSelectParty(val || null)}
      >
        <SelectTrigger className="w-40 h-8 text-xs">
          <SelectValue placeholder="Select party..." />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          {parties.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              No saved parties
            </div>
          ) : (
            parties.map(party => (
              <SelectItem key={party.id} value={party.id}>
                {party.name} ({party.units.length})
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Load button */}
      {selectedParty && onLoadParty && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={onLoadParty}>
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Load party</TooltipContent>
        </Tooltip>
      )}

      {/* Save/Update button */}
      {onUpdateParty && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8"
              onClick={handleSave}
              disabled={currentUnits.length === 0}
            >
              <Save className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {selectedParty ? `Save to "${selectedParty.name}"` : "Save as new party"}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Save as New button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={handleSaveNew}
            disabled={currentUnits.length === 0}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Save as new party</TooltipContent>
      </Tooltip>

      {/* Share button */}
      {onImportUnits && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setIsShareOpen(true)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share / Import</TooltipContent>
        </Tooltip>
      )}

      {/* Party actions when selected */}
      {selectedParty && (
        <>
          {/* Rename */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setNewName(selectedParty.name);
                  setIsRenameOpen(true);
                }}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rename party</TooltipContent>
          </Tooltip>

          {/* Delete */}
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Delete party</TooltipContent>
            </Tooltip>
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

      {/* Clear button */}
      {currentUnits.length > 0 && onImportUnits && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => onImportUnits([], "")}
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear formation</TooltipContent>
        </Tooltip>
      )}

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
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

      {/* Share Dialog */}
      <ShareDialog
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        units={currentUnits}
        partyName={selectedParty?.name}
        onImport={handleImport}
      />
    </div>
  );
});

PartyManager.displayName = "PartyManager";
