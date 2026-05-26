import { useNavigate } from "react-router-dom";
import {
  Users,
  Map as MapIcon,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import logoPurrface from "@/assets/logo-vogels-lab.jpg";
import { AdSense } from "@/components/ads/AdSense";
import { Seo } from "@/components/Seo";

const SECTIONS = [
  {
    title: "Units",
    description: "Browse battle units, abilities, stats, and unlock requirements.",
    icon: Users,
    to: "/units",
    color: "bg-primary/10 text-primary",
  },
  {
    title: "Missions",
    description: "Explore mission trees, objectives, and rewards.",
    icon: MapIcon,
    to: "/missions",
    color: "bg-green-500/10 text-green-600",
  },
  {
    title: "Levels",
    description: "Track level rewards, population caps, and unlocks.",
    icon: TrendingUp,
    to: "/levels",
    color: "bg-purple-500/10 text-purple-600",
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      <Seo
        title="Vogels Laboratory — Battle Nations Toolkit"
        description="Browse Battle Nations units, abilities, missions, and levels. Plan parties, simulate battles, and explore the full game database in one toolkit."
        path="/"
      />
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 pt-12 pb-6 text-center">
        <div className="mb-6">
          <img
            src={logoPurrface}
            alt=""
            className="h-20 w-20 mx-auto rounded-xl object-cover shadow-lg"
          />
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
          Vogels Laboratory
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl">
          Your companion reference for battle units, encounters, missions, and progression.
        </p>
      </section>

      {/* Feature cards */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Card
                key={section.to}
                className="cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => navigate(section.to)}
              >
                <CardContent className="p-6 flex items-start gap-4">
                  <div
                    className={`shrink-0 rounded-lg p-3 ${section.color}`}
                  >
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
        <AdSense />
      </section>
    </div>
  );
}
