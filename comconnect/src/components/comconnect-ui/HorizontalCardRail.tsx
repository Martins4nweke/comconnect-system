import { CompactActionCard } from "./CompactActionCard";

export type RailCard = {
  title: string;
  href: string;
  description?: string;
  tag?: string;
};

export function HorizontalCardRail({
  cards,
  parentHref,
}: {
  cards: RailCard[];
  parentHref?: string;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto rounded-[2rem] bg-white/60 p-2">
      {cards.map((card) => (
        <CompactActionCard
          key={card.href}
          title={card.title}
          description={card.description}
          href={card.href}
          tag={card.tag}
          parentHref={parentHref}
        />
      ))}
    </div>
  );
}
