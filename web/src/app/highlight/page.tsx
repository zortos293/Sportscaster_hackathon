import { HighlightFeed } from "@/components/sportcast/HighlightFeed";
import { SportcastFooter } from "@/components/sportcast/SportcastFooter";
import { SportcastHeader } from "@/components/sportcast/SportcastHeader";

export default function HighlightPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-on-surface font-body-md">
      <SportcastHeader activeNav="highlight" />
      <HighlightFeed />
      <SportcastFooter />
    </div>
  );
}
