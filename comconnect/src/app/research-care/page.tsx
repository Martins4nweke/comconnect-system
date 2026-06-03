import { PageShell } from "@/components/comconnect-ui/PageShell";
import { SharpHero } from "@/components/comconnect-ui/SharpHero";
import { ModuleNavigationRail } from "@/components/comconnect-ui/ModuleNavigationRail";
import { moduleGroups } from "@/lib/comconnect-ui/theme";

export default function ResearchCarePage() {
  return (
    <PageShell>
      <SharpHero
        eyebrow="Research + Care"
        title="One workspace for participant engagement and follow-up"
        subtitle="Research and care modules work hand in hand: education, questionnaires, consent, check-ins, appointments, referrals and help requests."
        actionHref="/participants"
        actionLabel="Open participants"
      />

      <ModuleNavigationRail
        title="Research modules"
        parentHref="/research-care"
        cards={moduleGroups.research}
      />

      <ModuleNavigationRail
        title="Care modules"
        parentHref="/research-care"
        cards={moduleGroups.care}
      />

      <ModuleNavigationRail
        title="Communication operations"
        parentHref="/research-care"
        cards={moduleGroups.operations}
      />
    </PageShell>
  );
}
