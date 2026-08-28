import { TOPIC_COLORS } from "@/lib/velora/constants";
import { useI18n } from "@/lib/velora/i18n";

export function TopicChip({ topic }: { topic: string }) {
  const { topicLabel } = useI18n();
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] ${TOPIC_COLORS[topic] ?? TOPIC_COLORS.general}`}>
      {topicLabel(topic)}
    </span>
  );
}
