import { PageShell } from "@/components/comconnect-ui/PageShell";
import { SharpHero } from "@/components/comconnect-ui/SharpHero";
import { BackToParent } from "@/components/comconnect-ui/BackToParent";
import { Breadcrumbs } from "@/components/comconnect-ui/Breadcrumbs";
import { ModuleNavigationRail } from "@/components/comconnect-ui/ModuleNavigationRail";
import { moduleGroups } from "@/lib/comconnect-ui/theme";

export default function CareModulesPage() {
  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Research + Care", href: "/research-care" }, { label: "Care" }]} />
      <BackToParent href="/research-care" label="Back to Research + Care" />
      <SharpHero
        eyebrow="Care modules"
        title="Follow up participants and manage care workflows"
        subtitle="Track check-ins, appointments, referrals, help requests and staff communication."
      />
      <ModuleNavigationRail title="Care cards" parentHref="/research-care/care" cards={moduleGroups.care} />
    </PageShell>
  );
}
