import { HighlightFeed } from "@/components/sportcast/HighlightFeed";
import { SportcastFooter } from "@/components/sportcast/SportcastFooter";
import { SportcastHeader } from "@/components/sportcast/SportcastHeader";
import { fetchHighlights } from "@/lib/sportcast/highlights-server";

export default async function HighlightPage() {
  const highlights = await fetchHighlights();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-on-surface font-body-md">
      <SportcastHeader activeNav="highlight" dark />
      <HighlightFeed highlights={highlights} />
      <SportcastFooter />
    </div>
  );
}
