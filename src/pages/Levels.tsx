import LevelsView from "@/components/levels/LevelsView";
import { Seo } from "@/components/Seo";

export default function Levels() {
  return (
    <>
      <Seo
        title="Levels & Rewards"
        description="Track Battle Nations account level rewards, population caps, building unlocks, and progression milestones across every level tier."
        path="/levels"
      />
      <LevelsView />
    </>
  );
}
