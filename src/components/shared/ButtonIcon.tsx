import type { LucideIcon } from "lucide-react";

export function ButtonIcon({
  icon: Icon,
  size = 16,
}: {
  icon: LucideIcon;
  size?: number;
}) {
  return <Icon aria-hidden="true" size={size} strokeWidth={2.25} />;
}
