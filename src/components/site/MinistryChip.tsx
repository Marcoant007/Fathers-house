import Link from "next/link";
import { cn } from "cn";
import { MinistryIcon } from "@/components/site/MinistryIcon";

const VARIANTS = ["bg-ink text-paper", "bg-accent text-on-accent", "bg-sand text-ink"];

export function MinistryChip({
  name,
  slug,
  icon,
  index,
}: {
  name: string;
  slug: string;
  icon?: string | null;
  index: number;
}) {
  return (
    <Link
      href={`/ministerios#${slug}`}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full py-[18px] pr-7 pl-6 text-[17px] font-extrabold",
        VARIANTS[index % VARIANTS.length]
      )}
    >
      <MinistryIcon ministry={{ name, icon }} size={20} className="shrink-0" />
      {name}
    </Link>
  );
}
