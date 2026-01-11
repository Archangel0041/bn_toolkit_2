import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uploadMultipleImages, listUploadedImages } from "@/lib/unitImages";
import { uploadMultipleAbilityImages, listUploadedAbilityImages } from "@/lib/abilityImages";
import { uploadMultipleDamageImages, listUploadedDamageImages } from "@/lib/damageImages";
import { uploadMultipleStatusImages, listUploadedStatusImages } from "@/lib/statusEffects";
import { 
  uploadMultipleResourceIcons, 
  uploadMultipleEventRewardIcons, 
  uploadMultipleMenuBackgrounds,
  uploadMultipleEncounterIcons,
  uploadMultipleMissionIcons,
  listResourceIcons,
  listEventRewardIcons,
  listMenuBackgrounds,
  listEncounterIcons,
  listMissionIcons
} from "@/lib/resourceImages";
import { Upload, CheckCircle, XCircle, FolderOpen, Users, Swords, Shield, Zap, Coins, Gift, Image, Map, Target, FileJson, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type UploadType = "units" | "abilities" | "damage" | "status" | "resources" | "eventRewards" | "menuBackgrounds" | "encounters" | "missions";

const UPLOAD_CONFIG: Record<UploadType, { 
  fn: (files: FileList, onProgress?: (current: number, total: number, fileName: string) => void) => Promise<{ success: number; failed: number; errors: string[] }>;
  listFn: () => Promise<string[]>;
  label: string;
}> = {
  units: { fn: uploadMultipleImages, listFn: listUploadedImages, label: "unit" },
  abilities: { fn: uploadMultipleAbilityImages, listFn: listUploadedAbilityImages, label: "ability" },
  damage: { fn: uploadMultipleDamageImages, listFn: listUploadedDamageImages, label: "damage" },
  status: { fn: uploadMultipleStatusImages, listFn: listUploadedStatusImages, label: "status" },
  resources: { fn: uploadMultipleResourceIcons, listFn: listResourceIcons, label: "resource" },
  eventRewards: { fn: uploadMultipleEventRewardIcons, listFn: listEventRewardIcons, label: "event reward" },
  menuBackgrounds: { fn: uploadMultipleMenuBackgrounds, listFn: listMenuBackgrounds, label: "menu background" },
  encounters: { fn: uploadMultipleEncounterIcons, listFn: listEncounterIcons, label: "encounter" },
  missions: { fn: uploadMultipleMissionIcons, listFn: listMissionIcons, label: "mission" },
};

export default function UploadImages() {
  const { user, canUpload, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, fileName: "" });
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [uploadedCount, setUploadedCount] = useState<Record<UploadType, number | null>>({ 
    units: null, abilities: null, damage: null, status: null, 
    resources: null, eventRewards: null, menuBackgrounds: null,
    encounters: null, missions: null
  });
  const [activeTab, setActiveTab] = useState<UploadType>("units");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Show access denied for users without upload permission
  if (!authLoading && user && !canUpload) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You don't have upload permissions. Please contact an admin to request access.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate('/')}>
              Back to Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>Authentication Required</AlertTitle>
            <AlertDescription>
              Please sign in with an account that has upload permissions.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setResults(null);
    setProgress({ current: 0, total: files.length, fileName: "" });

    const config = UPLOAD_CONFIG[activeTab];
    const uploadResults = await config.fn(files, (current, total, fileName) => {
      setProgress({ current, total, fileName });
    });

    setResults(uploadResults);
    setIsUploading(false);

    if (uploadResults.success > 0) {
      toast({
        title: "Upload Complete",
        description: `Successfully uploaded ${uploadResults.success} ${config.label} images.`,
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const checkUploadedImages = async (type: UploadType) => {
    const images = await UPLOAD_CONFIG[type].listFn();
    setUploadedCount(prev => ({ ...prev, [type]: images.length }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Upload Images</h1>
            <p className="text-muted-foreground">
              Upload unit, ability, damage, status, resource, and event images.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">Back to Units</Link>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as UploadType); setResults(null); }}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="units" className="gap-2">
              <Users className="h-4 w-4" />
              Units
            </TabsTrigger>
            <TabsTrigger value="abilities" className="gap-2">
              <Swords className="h-4 w-4" />
              Abilities
            </TabsTrigger>
            <TabsTrigger value="damage" className="gap-2">
              <Shield className="h-4 w-4" />
              Damage
            </TabsTrigger>
            <TabsTrigger value="status" className="gap-2">
              <Zap className="h-4 w-4" />
              Status
            </TabsTrigger>
            <TabsTrigger value="resources" className="gap-2">
              <Coins className="h-4 w-4" />
              Resources
            </TabsTrigger>
            <TabsTrigger value="eventRewards" className="gap-2">
              <Gift className="h-4 w-4" />
              Event Rewards
            </TabsTrigger>
            <TabsTrigger value="menuBackgrounds" className="gap-2">
              <Image className="h-4 w-4" />
              Backgrounds
            </TabsTrigger>
            <TabsTrigger value="encounters" className="gap-2">
              <Map className="h-4 w-4" />
              Encounters
            </TabsTrigger>
            <TabsTrigger value="missions" className="gap-2">
              <Target className="h-4 w-4" />
              Missions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="units" className="space-y-6">
            <UploadCard
              title="Unit Image Upload"
              description={<>File names should match unit icon names (e.g., <code className="bg-muted px-1 rounded">air_ancient_fragment_icon.png</code>).</>}
              fileInputRef={fileInputRef}
              isUploading={isUploading}
              onUpload={handleFileSelect}
              onCheckCount={() => checkUploadedImages("units")}
              count={uploadedCount.units}
              countLabel="unit images"
              progress={progress}
              results={results}
            />
          </TabsContent>

          <TabsContent value="abilities" className="space-y-6">
            <UploadCard
              title="Ability Icon Upload"
              description={<>File names should match ability icon names (e.g., <code className="bg-muted px-1 rounded">ancient_lasershot_icon.png</code>).</>}
              fileInputRef={fileInputRef}
              isUploading={isUploading}
              onUpload={handleFileSelect}
              onCheckCount={() => checkUploadedImages("abilities")}
              count={uploadedCount.abilities}
              countLabel="ability icons"
              progress={progress}
              results={results}
            />
          </TabsContent>

          <TabsContent value="damage" className="space-y-6">
            <UploadCard
              title="Damage Icon Upload"
              description={<>File names should match damage type names (e.g., <code className="bg-muted px-1 rounded">damage_bullet.png</code>).</>}
              fileInputRef={fileInputRef}
              isUploading={isUploading}
              onUpload={handleFileSelect}
              onCheckCount={() => checkUploadedImages("damage")}
              count={uploadedCount.damage}
              countLabel="damage icons"
              progress={progress}
              results={results}
            />
          </TabsContent>

          <TabsContent value="status" className="space-y-6">
            <UploadCard
              title="Status Effect Icon Upload"
              description={<>File names should match status effect ui_icon names (e.g., <code className="bg-muted px-1 rounded">bn_icon_poison.png</code>).</>}
              fileInputRef={fileInputRef}
              isUploading={isUploading}
              onUpload={handleFileSelect}
              onCheckCount={() => checkUploadedImages("status")}
              count={uploadedCount.status}
              countLabel="status icons"
              progress={progress}
              results={results}
            />
          </TabsContent>

          <TabsContent value="resources" className="space-y-6">
            <UploadCard
              title="Resource Icon Upload"
              description={<>File names should use format <code className="bg-muted px-1 rounded">resource_lumber.png</code>, <code className="bg-muted px-1 rounded">resource_concrete.png</code>, etc.</>}
              fileInputRef={fileInputRef}
              isUploading={isUploading}
              onUpload={handleFileSelect}
              onCheckCount={() => checkUploadedImages("resources")}
              count={uploadedCount.resources}
              countLabel="resource icons"
              progress={progress}
              results={results}
            />
          </TabsContent>

          <TabsContent value="eventRewards" className="space-y-6">
            <UploadCard
              title="Event Reward Icon Upload"
              description={<>File names should match reward_image values (e.g., <code className="bg-muted px-1 rounded">event_reward_concrete.png</code>, <code className="bg-muted px-1 rounded">event_reward_gears.png</code>).</>}
              fileInputRef={fileInputRef}
              isUploading={isUploading}
              onUpload={handleFileSelect}
              onCheckCount={() => checkUploadedImages("eventRewards")}
              count={uploadedCount.eventRewards}
              countLabel="event reward icons"
              progress={progress}
              results={results}
            />
          </TabsContent>

          <TabsContent value="menuBackgrounds" className="space-y-6">
            <UploadCard
              title="Menu Background Upload"
              description={<>File names should match menu_bg values from boss strikes (e.g., <code className="bg-muted px-1 rounded">boss_strike_mad_scientist_1136x640.png</code>).</>}
              fileInputRef={fileInputRef}
              isUploading={isUploading}
              onUpload={handleFileSelect}
              onCheckCount={() => checkUploadedImages("menuBackgrounds")}
              count={uploadedCount.menuBackgrounds}
              countLabel="menu backgrounds"
              progress={progress}
              results={results}
            />
          </TabsContent>

          <TabsContent value="encounters" className="space-y-6">
            <UploadCard
              title="Encounter Icon Upload"
              description={<>File names should match encounter icon values (e.g., <code className="bg-muted px-1 rounded">encounter_icon_name.png</code>).</>}
              fileInputRef={fileInputRef}
              isUploading={isUploading}
              onUpload={handleFileSelect}
              onCheckCount={() => checkUploadedImages("encounters")}
              count={uploadedCount.encounters}
              countLabel="encounter icons"
              progress={progress}
              results={results}
            />
          </TabsContent>

          <TabsContent value="missions" className="space-y-6">
            <UploadCard
              title="Mission Icon Upload"
              description={<>File names should match mission_icon values from boss strikes (e.g., <code className="bg-muted px-1 rounded">npc_silverwolves_scientist_boss_mission.png</code>).</>}
              fileInputRef={fileInputRef}
              isUploading={isUploading}
              onUpload={handleFileSelect}
              onCheckCount={() => checkUploadedImages("missions")}
              count={uploadedCount.missions}
              countLabel="mission icons"
              progress={progress}
              results={results}
            />
          </TabsContent>
        </Tabs>

        <Separator className="my-8" />

        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold">JSON Config Files</h2>
            <p className="text-muted-foreground">
              Upload JSON configuration files to update game data. Files will be downloaded for manual placement in src/data/.
            </p>
          </div>
          
          <JsonConfigSection />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Naming Conventions</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <div className="grid md:grid-cols-4 gap-6">
              <div>
                <h4 className="font-medium mb-2">Unit Images</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li><code>air_ancient_fragment_icon.png</code></li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Ability Icons</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li><code>ancient_lasershot_icon.png</code></li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Menu Backgrounds</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li><code>boss_strike_mad_scientist_1136x640.png</code></li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Mission Icons</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li><code>npc_silverwolves_scientist_boss_mission.png</code></li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

const JSON_CONFIG_FILES = [
  { name: "battle_units.json", description: "Unit definitions and stats" },
  { name: "battle_abilities.json", description: "Ability definitions" },
  { name: "battle_encounters.json", description: "Encounter definitions" },
  { name: "boss_strike_config.json", description: "Boss strike configuration" },
  { name: "battle_config.json", description: "Battle configuration" },
  { name: "status_effects.json", description: "Status effect definitions" },
  { name: "status_effect_families.json", description: "Status effect families" },
  { name: "GameText_en.json", description: "English localization" },
  { name: "GameText_Shared_Data.json", description: "Shared text keys" },
];

function JsonConfigSection() {
  const [jsonFiles, setJsonFiles] = useState<Record<string, { content: string; parsed: boolean }>>({});
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleJsonSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: Record<string, { content: string; parsed: boolean }> = {};
    
    for (const file of Array.from(files)) {
      try {
        const content = await file.text();
        JSON.parse(content); // Validate JSON
        newFiles[file.name] = { content, parsed: true };
      } catch {
        newFiles[file.name] = { content: "", parsed: false };
        toast({
          title: "Invalid JSON",
          description: `${file.name} is not valid JSON`,
          variant: "destructive",
        });
      }
    }

    setJsonFiles(prev => ({ ...prev, ...newFiles }));
    
    const validCount = Object.values(newFiles).filter(f => f.parsed).length;
    if (validCount > 0) {
      toast({
        title: "Files Loaded",
        description: `${validCount} JSON file(s) loaded successfully. Copy content to src/data/ folder.`,
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-5 w-5" />
          JSON Config Upload
        </CardTitle>
        <CardDescription>
          Upload JSON files to validate and preview. Download validated files to place in <code className="bg-muted px-1 rounded">src/data/</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          multiple
          onChange={handleJsonSelect}
          className="hidden"
        />
        
        <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
          <Upload className="h-4 w-4" />
          Select JSON Files
        </Button>

        {Object.keys(jsonFiles).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Loaded Files:</p>
            <div className="grid gap-2">
              {Object.entries(jsonFiles).map(([filename, { parsed, content }]) => (
                <div key={filename} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    {parsed ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm font-mono">{filename}</span>
                  </div>
                  {parsed && (
                    <Button size="sm" variant="outline" onClick={() => downloadFile(filename, content)}>
                      Download
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-2">Expected Config Files:</p>
          <div className="grid md:grid-cols-3 gap-2 text-sm text-muted-foreground">
            {JSON_CONFIG_FILES.map(({ name, description }) => (
              <div key={name} className="flex flex-col">
                <code className="text-xs bg-muted px-1 rounded">{name}</code>
                <span className="text-xs">{description}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface UploadCardProps {
  title: string;
  description: React.ReactNode;
  fileInputRef: React.RefObject<HTMLInputElement>;
  isUploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCheckCount: () => void;
  count: number | null;
  countLabel: string;
  progress: { current: number; total: number; fileName: string };
  results: { success: number; failed: number; errors: string[] } | null;
}

function UploadCard({ title, description, fileInputRef, isUploading, onUpload, onCheckCount, count, countLabel, progress, results }: UploadCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onUpload}
          className="hidden"
        />
        
        <div className="flex gap-4">
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="gap-2">
            <Upload className="h-4 w-4" />
            {isUploading ? "Uploading..." : "Select Images"}
          </Button>
          
          <Button variant="outline" onClick={onCheckCount} className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Check Count
          </Button>
        </div>

        {count !== null && (
          <p className="text-sm text-muted-foreground">Currently {count} {countLabel} uploaded.</p>
        )}

        <UploadProgress isUploading={isUploading} progress={progress} results={results} />
      </CardContent>
    </Card>
  );
}

function UploadProgress({ 
  isUploading, 
  progress, 
  results 
}: { 
  isUploading: boolean; 
  progress: { current: number; total: number; fileName: string }; 
  results: { success: number; failed: number; errors: string[] } | null;
}) {
  return (
    <>
      {isUploading && (
        <div className="space-y-2">
          <Progress value={(progress.current / progress.total) * 100} />
          <p className="text-sm text-muted-foreground">
            Uploading {progress.current} of {progress.total}: {progress.fileName}
          </p>
        </div>
      )}

      {results && (
        <div className="space-y-3 pt-4 border-t">
          <div className="flex gap-6">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">{results.success} succeeded</span>
            </div>
            {results.failed > 0 && (
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">{results.failed} failed</span>
              </div>
            )}
          </div>

          {results.errors.length > 0 && (
            <div className="bg-destructive/10 rounded-lg p-3">
              <p className="font-medium text-destructive mb-2">Errors:</p>
              <ul className="text-sm text-destructive space-y-1">
                {results.errors.slice(0, 10).map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
                {results.errors.length > 10 && (
                  <li>...and {results.errors.length - 10} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
