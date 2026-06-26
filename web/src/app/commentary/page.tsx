import { CommentaryPlayer } from "@/components/sportcast/CommentaryPlayer";
import { SportcastHeader } from "@/components/sportcast/SportcastHeader";

export default function CommentaryPage() {
  return (
    <div className="overflow-x-hidden bg-background text-on-background">
      <SportcastHeader activeNav="live" dark />
      <CommentaryPlayer />
    </div>
  );
}
