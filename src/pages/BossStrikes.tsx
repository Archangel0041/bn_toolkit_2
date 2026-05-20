import { BossStrikeLookup } from "@/components/bossStrikes/BossStrikeLookup";

export default function BossStrikes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Boss Strike Events</h1>
        <p className="text-muted-foreground">
          View boss strike tiers, rewards, encounters, and guild weight scaling.
        </p>
      </div>
      <BossStrikeLookup />
    </div>
  );
}
