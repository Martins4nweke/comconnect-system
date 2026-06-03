import { PageShell } from "@/components/comconnect-ui/PageShell";
import { SharpHero } from "@/components/comconnect-ui/SharpHero";
import { BackToParent } from "@/components/comconnect-ui/BackToParent";
import { Breadcrumbs } from "@/components/comconnect-ui/Breadcrumbs";
import { ModuleNavigationRail } from "@/components/comconnect-ui/ModuleNavigationRail";
import { moduleGroups } from "@/lib/comconnect-ui/theme";

export default function CommunicationOperationsPage() {
  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Research + Care", href: "/research-care" }, { label: "Communication Operations" }]} />
      <BackToParent href="/research-care" label="Back to Research + Care" />
      <SharpHero
        eyebrow="App → SMS → Voice"
        title="Manage communication fallback operations"
        subtitle="Push alerts, fallback rules and voice tasks remain project-aware and optional by configuration."
      />
      <ModuleNavigationRail title="Operations cards" parentHref="/communication-operations" cards={moduleGroups.operations} />
    </PageShell>
  );
}
