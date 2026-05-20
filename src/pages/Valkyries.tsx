import { useNavigate } from "react-router-dom";
import { Crosshair, Trophy, Users, Map as MapIcon, TrendingUp, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import logoPurrface from "@/assets/logo-vogels-lab.jpg";

const SECTIONS = [
  {
    title: "Units",
    description: "Browse and inspect unit stats, abilities, and tags.",
    icon: Users,
    to: "/units",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    title: "Missions",
    description: "Explore mission stages and enemy formations.",
    icon: MapIcon,
    to: "/missions",
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    title: "Levels",
    description: "View leveling costs and unit experience curves.",
    icon: TrendingUp,
    to: "/levels",
    color: "bg-violet-500/10 text-violet-600",
  },
  {
    title: "Encounters",
    description: "Simulate encounters and explore battle outcomes.",
    icon: Crosshair,
    to: "/encounters",
    color: "bg-red-500/10 text-red-600",
  },
  {
    title: "Boss Strikes",
    description: "Plan and review boss strike formations.",
    icon: Trophy,
    to: "/boss-strikes",
    color: "bg-amber-500/10 text-amber-600",
  },
];

export default function Valkyries() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      <section className="flex flex-col items-center justify-center px-4 pt-12 pb-6 text-center">
        <div className="mb-6">
          <img
            src={logoPurrface}
            alt=""
            className="h-20 w-20 mx-auto rounded-xl object-cover shadow-lg"
          />
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
          Valkyries
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl">
          Protected battle tools for encounters and boss strikes.
        </p>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Card
                key={section.to}
                className="cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => navigate(section.to)}
              >
                <CardContent className="p-6 flex items-start gap-4">
                  <div className={`shrink-0 rounded-lg p-3 ${section.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                      {section.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
