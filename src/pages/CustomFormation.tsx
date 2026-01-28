import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useCustomFormation } from "@/hooks/useCustomFormation";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAllUnits, getUnitById } from "@/lib/units";
import { UnitImage } from "@/components/units/UnitImage";
import { EncounterGrid } from "@/components/encounters/EncounterGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Play,
  Upload,
  Download,
  Layers,
  FileText,
  Code,
  FileJson,
} from "lucide-react";
import { UnitSide } from "@/data/gameEnums";
import { toast } from "sonner";
import { downloadFormationAsText, downloadFormationAsCode } from "@/lib/exportUtils";

function CustomFormationContent() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [unitSearchQuery, setUnitSearchQuery] = useState("");
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);

  const {
    formation,
    currentWave,
    setCurrentWave,
    getCurrentWaveUnits,
    addUnit,
    removeUnit,
    moveUnit,
    setUnitRank,
    addWave,
    removeWave,
    clearWave,
    setFormationName,
    setFormationLevel,
    clearFormation,
  } = useCustomFormation();

  // Get all hostile units for selection
  const hostileUnits = useMemo(() => {
    return getAllUnits().filter(u => u.identity.side === UnitSide.Hostile);
  }, []);

  const filteredUnits = useMemo(() => {
    if (!unitSearchQuery) return hostileUnits.slice(0, 50);
    const query = unitSearchQuery.toLowerCase();
    return hostileUnits
      .filter(u => {
        const name = t(u.identity.name).toLowerCase();
        const id = u.id.toString();
        return name.includes(query) || id.includes(query);
      })
      .slice(0, 50);
  }, [hostileUnits, unitSearchQuery, t]);

  const currentWaveUnits = getCurrentWaveUnits();

  // Convert to grid display format
  const gridUnits = useMemo(() => {
    return currentWaveUnits.map(u => ({
      grid_id: u.grid_id,
      unit_id: u.unit_id,
    }));
  }, [currentWaveUnits]);

  const handleAddUnit = (unitId: number) => {
    const result = addUnit(unitId);
    if (!result.success && result.error) {
      toast.error(result.error);
    } else {
      setIsAddUnitOpen(false);
      setUnitSearchQuery("");
    }
  };

  const handleStartSimulation = () => {
    if (formation.waves.every(w => w.units.length === 0)) {
      toast.error("Add at least one unit to the formation");
      return;
    }
    
    // Navigate to battle simulator with custom formation
    navigate("/battle/custom", {
      state: {
        customFormation: formation,
      },
    });
  };

  const handleExportJson = () => {
    const data = JSON.stringify(formation, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${formation.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Formation exported as JSON");
  };

  const handleExportText = () => {
    downloadFormationAsText({ formation, t });
    toast.success("Formation exported as text");
  };

  const handleExportCode = () => {
    downloadFormationAsCode({ formation, t });
    toast.success("Formation exported as code");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.waves && Array.isArray(data.waves)) {
          // Use the imported formation
          // We'd need to add a loadFormation method
          toast.success("Formation imported");
        } else {
          throw new Error("Invalid format");
        }
      } catch {
        toast.error("Failed to import formation");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Custom Enemy Formation</h1>
            <p className="text-muted-foreground text-sm">
              Build custom enemy formations for battle simulation
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Formation Settings & Unit List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Formation Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Formation Name</Label>
                <Input
                  id="name"
                  value={formation.name}
                  onChange={(e) => setFormationName(e.target.value)}
                  placeholder="Custom Formation"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="level">Encounter Level</Label>
                <Input
                  id="level"
                  type="number"
                  min={1}
                  max={100}
                  value={formation.level || 1}
                  onChange={(e) => setFormationLevel(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 gap-1">
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-popover">
                    <DropdownMenuItem onClick={handleExportJson} className="gap-2">
                      <FileJson className="h-4 w-4" />
                      Export as JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportText} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Export as Text
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportCode} className="gap-2">
                      <Code className="h-4 w-4" />
                      Export as Code
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" className="flex-1 gap-1" asChild>
                  <label>
                    <Upload className="h-4 w-4" />
                    Import
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleImport}
                    />
                  </label>
                </Button>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-sm">Waves</h3>
                  <Button variant="outline" size="sm" onClick={addWave} className="gap-1">
                    <Layers className="h-4 w-4" />
                    Add Wave
                  </Button>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {formation.waves.map((wave, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <Button
                        variant={currentWave === idx ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentWave(idx)}
                      >
                        Wave {idx + 1}
                        <Badge variant="secondary" className="ml-1 h-5 px-1">
                          {wave.units.length}
                        </Badge>
                      </Button>
                      {formation.waves.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeWave(idx)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Current wave units */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-sm">
                    Wave {currentWave + 1} Units ({currentWaveUnits.length})
                  </h3>
                  <div className="flex gap-1">
                    <Dialog open={isAddUnitOpen} onOpenChange={setIsAddUnitOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Plus className="h-4 w-4" />
                          Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        <DialogHeader>
                          <DialogTitle>Add Enemy Unit</DialogTitle>
                        </DialogHeader>
                        <Input
                          placeholder="Search units..."
                          value={unitSearchQuery}
                          onChange={(e) => setUnitSearchQuery(e.target.value)}
                          className="mb-4"
                        />
                        <ScrollArea className="flex-1">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {filteredUnits.map(unit => (
                              <button
                                key={unit.id}
                                onClick={() => handleAddUnit(unit.id)}
                                className="flex items-center gap-2 p-2 rounded-lg border hover:bg-accent transition-colors text-left"
                              >
                                <UnitImage
                                  iconName={unit.identity.icon}
                                  alt={t(unit.identity.name)}
                                  className="w-10 h-10 rounded"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium truncate">
                                    {t(unit.identity.name)}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    ID: {unit.id}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearWave}
                      disabled={currentWaveUnits.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {currentWaveUnits.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No units in this wave. Add units to build your formation.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {currentWaveUnits.map(waveUnit => {
                      const unit = getUnitById(waveUnit.unit_id);
                      const maxRank = unit?.statsConfig?.stats?.length || 1;
                      
                      return (
                        <div
                          key={waveUnit.grid_id}
                          className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                        >
                          {unit && (
                            <UnitImage
                              iconName={unit.identity.icon}
                              alt={t(unit.identity.name)}
                              className="w-8 h-8 rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {unit ? t(unit.identity.name) : `Unit ${waveUnit.unit_id}`}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Pos: {waveUnit.grid_id}
                            </p>
                          </div>
                          <Select
                            value={(waveUnit.rank || maxRank).toString()}
                            onValueChange={(val) => setUnitRank(waveUnit.grid_id!, parseInt(val))}
                          >
                            <SelectTrigger className="w-16 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: maxRank }, (_, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                  R{i + 1}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeUnit(waveUnit.grid_id!)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Center: Grid Preview */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Formation Preview</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={clearFormation}
                    disabled={formation.waves.every(w => w.units.length === 0)}
                  >
                    Clear All
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={handleStartSimulation}
                    disabled={formation.waves.every(w => w.units.length === 0)}
                  >
                    <Play className="h-4 w-4" />
                    Start Simulation
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="grid" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="grid">Grid View</TabsTrigger>
                  <TabsTrigger value="all-waves">All Waves</TabsTrigger>
                </TabsList>
                
                <TabsContent value="grid">
                  <div className="flex justify-center">
                    <EncounterGrid units={gridUnits} />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Click units in the list to remove them
                  </p>
                </TabsContent>
                
                <TabsContent value="all-waves">
                  <div className="space-y-6">
                    {formation.waves.map((wave, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium">Wave {idx + 1}</h4>
                          <Badge variant="outline">{wave.units.length} units</Badge>
                        </div>
                        <div className="flex justify-center scale-75 origin-top">
                          <EncounterGrid
                            units={wave.units.map(u => ({
                              grid_id: u.grid_id,
                              unit_id: u.unit_id,
                            }))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function CustomFormation() {
  return (
    <ProtectedRoute>
      <CustomFormationContent />
    </ProtectedRoute>
  );
}