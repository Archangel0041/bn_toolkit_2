import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUnitById } from "@/lib/units";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Heart, Zap, Shield, Target, Eye, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Compare() {
  const { id1, id2 } = useParams<{ id1: string; id2: string }>();
  const { t } = useLanguage();

  const unit1 = getUnitById(parseInt(id1 || "0"));
  const unit2 = getUnitById(parseInt(id2 || "0"));

  if (!unit1 || !unit2) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Units Not Found</h1>
          <p className="text-muted-foreground mb-6">One or both units do not exist.</p>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Units
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  const stats1 = unit1.statsConfig?.stats[0];
  const stats2 = unit2.statsConfig?.stats[0];

  const compareStats = [
    { label: "HP", key: "hp", icon: Heart, iconClass: "text-destructive" },
    { label: "Power", key: "power", icon: Zap, iconClass: "text-yellow-500" },
    { label: "PV", key: "pv", icon: Shield, iconClass: "text-blue-500" },
    { label: "Accuracy", key: "accuracy", icon: Target, iconClass: "" },
    { label: "Defense", key: "defense", icon: Shield, iconClass: "" },
    { label: "Dodge", key: "dodge", icon: Eye, iconClass: "" },
    { label: "Bravery", key: "bravery", icon: null, iconClass: "" },
    { label: "Critical", key: "critical", icon: null, iconClass: "" },
  ];

  const getCompareIndicator = (val1: number | undefined, val2: number | undefined) => {
    if (val1 === undefined || val2 === undefined) return null;
    if (val1 > val2) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (val1 < val2) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Compare Units</h1>
            <p className="text-muted-foreground">Side-by-side comparison of stats</p>
          </div>
        </div>

        {/* Unit Headers */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t(unit1.identity.name)}</CardTitle>
              <p className="text-sm text-muted-foreground">ID: {unit1.id}</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">Side {unit1.identity.side}</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t(unit2.identity.name)}</CardTitle>
              <p className="text-sm text-muted-foreground">ID: {unit2.id}</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">Side {unit2.identity.side}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Stats Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {compareStats.map(({ label, key, icon: Icon, iconClass }) => {
                const val1 = stats1?.[key as keyof typeof stats1] as number | undefined;
                const val2 = stats2?.[key as keyof typeof stats2] as number | undefined;
                
                return (
                  <div key={key} className="grid grid-cols-5 items-center py-2 border-b last:border-0">
                    <div className={cn(
                      "flex items-center gap-2 font-medium",
                      val1 !== undefined && val2 !== undefined && val1 > val2 && "text-green-600 dark:text-green-400"
                    )}>
                      {getCompareIndicator(val1, val2)}
                      <span>{val1 ?? "-"}</span>
                    </div>
                    <div className="col-span-3 flex items-center justify-center gap-2 text-center">
                      {Icon && <Icon className={cn("h-4 w-4", iconClass)} />}
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                    <div className={cn(
                      "flex items-center justify-end gap-2 font-medium",
                      val1 !== undefined && val2 !== undefined && val2 > val1 && "text-green-600 dark:text-green-400"
                    )}>
                      <span>{val2 ?? "-"}</span>
                      {getCompareIndicator(val2, val1)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Damage Mods Comparison */}
        {(stats1?.damage_mods || stats2?.damage_mods) && (
          <Card>
            <CardHeader>
              <CardTitle>Damage Resistance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {["cold", "crushing", "explosive", "fire", "piercing"].map((elem) => {
                  const val1 = stats1?.damage_mods?.[elem as keyof typeof stats1.damage_mods];
                  const val2 = stats2?.damage_mods?.[elem as keyof typeof stats2.damage_mods];
                  
                  return (
                    <div key={elem} className="grid grid-cols-5 items-center py-2 border-b last:border-0">
                      <div className={cn(
                        "font-medium",
                        val1 !== undefined && val2 !== undefined && val1 < val2 && "text-green-600 dark:text-green-400"
                      )}>
                        {val1 !== undefined ? `${(val1 * 100).toFixed(0)}%` : "-"}
                      </div>
                      <div className="col-span-3 text-center text-muted-foreground capitalize">
                        {elem}
                      </div>
                      <div className={cn(
                        "text-right font-medium",
                        val1 !== undefined && val2 !== undefined && val2 < val1 && "text-green-600 dark:text-green-400"
                      )}>
                        {val2 !== undefined ? `${(val2 * 100).toFixed(0)}%` : "-"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <div className="flex justify-center gap-4">
          <Button asChild variant="outline">
            <Link to={`/unit/${unit1.id}`}>View {t(unit1.identity.short_name)} Details</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/unit/${unit2.id}`}>View {t(unit2.identity.short_name)} Details</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
