import MissionsView from "@/components/missions/MissionsView";
import { Seo } from "@/components/Seo";

export default function Missions() {
  return (
    <>
      <Seo
        title="Missions Planner"
        description="Explore Battle Nations mission trees, objectives, prerequisites, and rewards. Plan construction and job timelines to clear quests efficiently."
        path="/missions"
      />
      <MissionsView />
    </>
  );
}
