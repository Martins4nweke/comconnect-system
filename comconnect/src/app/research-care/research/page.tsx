import { PageShell } from "@/components/comconnect-ui/PageShell";
import { SharpHero } from "@/components/comconnect-ui/SharpHero";
import { BackToParent } from "@/components/comconnect-ui/BackToParent";
import { Breadcrumbs } from "@/components/comconnect-ui/Breadcrumbs";
import { ModuleNavigationRail } from "@/components/comconnect-ui/ModuleNavigationRail";
import { moduleGroups } from "@/lib/comconnect-ui/theme";

export default function ResearchModulesPage() {
  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Research + Care", href: "/research-care" }, { label: "Research" }]} />
      <BackToParent href="/research-care" label="Back to Research + Care" />
      <SharpHero
        eyebrow="Research modules"
        title="Deliver interventions and collect research data"
        subtitle="Manage education, questionnaires, consent and research-ready participant records."
      />
      <ModuleNavigationRail title="Research cards" parentHref="/research-care/research" cards={moduleGroups.research} />
    </PageShell>
  );
}
