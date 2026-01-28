/**
 * Share Dialog - Export formations/parties as QR code or shareable code
 */

import { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Copy, Check, QrCode, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { 
  encodeParty, 
  decodeParty, 
  copyToClipboard,
} from "@/lib/formationCodec";
import type { PartyUnit } from "@/types/battleSimulator";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: PartyUnit[];
  partyName?: string;
  onImport?: (units: PartyUnit[], name: string) => void;
}

export function ShareDialog({ 
  open, 
  onOpenChange, 
  units, 
  partyName,
  onImport,
}: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");

  const shareCode = useMemo(() => {
    if (units.length === 0) return "";
    return encodeParty(units, partyName);
  }, [units, partyName]);

  const handleCopy = async () => {
    const success = await copyToClipboard(shareCode);
    if (success) {
      setCopied(true);
      toast.success("Code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Failed to copy");
    }
  };

  const handleImport = () => {
    if (!importCode.trim()) {
      toast.error("Please enter a share code");
      return;
    }

    const result = decodeParty(importCode.trim());
    if (result) {
      onImport?.(result.units, result.name);
      toast.success(`Imported: ${result.name} (${result.units.length} units)`);
      setImportCode("");
      onOpenChange(false);
    } else {
      toast.error("Invalid share code");
    }
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById("share-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL("image/png");
      
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${partyName || "party"}_qr.png`;
      a.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Formation</DialogTitle>
          <DialogDescription>
            Share your formation with others or import a shared formation.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "export" | "import")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="gap-1">
              <QrCode className="h-4 w-4" />
              Export
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1">
              <Upload className="h-4 w-4" />
              Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            {units.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No units to share. Add units to your formation first.
              </p>
            ) : (
              <>
                {/* QR Code */}
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <QRCodeSVG
                    id="share-qr-code"
                    value={shareCode}
                    size={200}
                    level="M"
                    includeMargin
                  />
                </div>

                <div className="flex justify-center">
                  <Button variant="outline" size="sm" onClick={handleDownloadQR} className="gap-1">
                    <Download className="h-4 w-4" />
                    Download QR
                  </Button>
                </div>

                {/* Share Code */}
                <div className="space-y-2">
                  <Label>Share Code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={shareCode}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {units.length} units · {partyName || "Unnamed Formation"}
                  </p>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <div className="space-y-2">
              <Label>Paste Share Code</Label>
              <Textarea
                placeholder="Paste a share code here..."
                value={importCode}
                onChange={(e) => setImportCode(e.target.value)}
                className="font-mono text-xs min-h-[100px]"
              />
            </div>

            <Button 
              onClick={handleImport} 
              disabled={!importCode.trim()}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Formation
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
