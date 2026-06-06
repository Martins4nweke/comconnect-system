import { HorizontalCardRail, type RailCard } from "./HorizontalCardRail";

export function ModuleNavigationRail({
  title,
  cards,
  parentHref,
}: {
  title: string;
  cards: RailCard[];
  parentHref?: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-[#171717]">{title}</h2>
      </div>

      <HorizontalCardRail cards={cards} parentHref={parentHref} />
    </section>
  );
}