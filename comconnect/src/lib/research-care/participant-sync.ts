import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ParticipantAppSessionContext } from "@/lib/participant-app/types";

export async function getParticipantGroupIds(context: ParticipantAppSessionContext) {
  const { data, error } = await supabaseAdmin
    .from("participant_group_memberships")
    .select("group_id")
    .eq("participant_id", context.participant_id)
    .eq("project_id", context.project_id);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.group_id);
}

export async function getParticipantResearchCarePayload(
  context: ParticipantAppSessionContext,
  lastSyncedAt?: string | null
) {
  const groupIds = await getParticipantGroupIds(context);

  const assignmentOr = [
    `participant_id.eq.${context.participant_id}`,
    ...(groupIds.length > 0 ? [`group_id.in.(${groupIds.join(",")})`] : []),
  ].join(",");

  let educationAssignmentsQuery = supabaseAdmin
    .from("education_assignments")
    .select("*, education_items(*, education_versions(*))")
    .eq("project_id", context.project_id)
    .eq("status", "active")
    .or(assignmentOr);

  let questionnaireAssignmentsQuery = supabaseAdmin
    .from("questionnaire_assignments")
    .select("*, questionnaires(*, questionnaire_questions(*))")
    .eq("project_id", context.project_id)
    .eq("status", "active")
    .or(assignmentOr);

  if (lastSyncedAt) {
    educationAssignmentsQuery = educationAssignmentsQuery.gte("assigned_at", lastSyncedAt);
    questionnaireAssignmentsQuery = questionnaireAssignmentsQuery.gte("assigned_at", lastSyncedAt);
  }

  const [
    educationAssignments,
    educationProgress,
    questionnaireAssignments,
    questionnaireResponses,
    consentForms,
    participantConsents,
    observationTypes,
    healthObservations,
    appointments,
    appointmentResponses,
    referrals,
    helpRequests,
    chatThreads,
  ] = await Promise.all([
    educationAssignmentsQuery,
    supabaseAdmin
      .from("education_progress")
      .select("*")
      .eq("participant_id", context.participant_id)
      .eq("project_id", context.project_id),
    questionnaireAssignmentsQuery,
    supabaseAdmin
      .from("questionnaire_responses")
      .select("*")
      .eq("participant_id", context.participant_id)
      .eq("project_id", context.project_id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("consent_forms")
      .select("*, consent_versions(*)")
      .eq("project_id", context.project_id)
      .eq("status", "published"),
    supabaseAdmin
      .from("participant_consents")
      .select("*")
      .eq("participant_id", context.participant_id)
      .eq("project_id", context.project_id),
    supabaseAdmin
      .from("project_observation_types")
      .select("*")
      .eq("project_id", context.project_id)
      .eq("status", "active"),
    supabaseAdmin
      .from("health_observations")
      .select("*")
      .eq("participant_id", context.participant_id)
      .eq("project_id", context.project_id)
      .order("submitted_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("appointments")
      .select("*")
      .eq("participant_id", context.participant_id)
      .eq("project_id", context.project_id)
      .order("start_at", { ascending: true })
      .limit(100),
    supabaseAdmin
      .from("appointment_responses")
      .select("*")
      .eq("participant_id", context.participant_id)
      .eq("project_id", context.project_id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("referrals")
      .select("*, referral_followups(*), referral_notes(*)")
      .eq("participant_id", context.participant_id)
      .eq("project_id", context.project_id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("help_requests")
      .select("*")
      .eq("participant_id", context.participant_id)
      .eq("project_id", context.project_id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("chat_threads")
      .select("*, chat_messages(*)")
      .eq("participant_id", context.participant_id)
      .eq("project_id", context.project_id)
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  const errors = [
    educationAssignments.error,
    educationProgress.error,
    questionnaireAssignments.error,
    questionnaireResponses.error,
    consentForms.error,
    participantConsents.error,
    observationTypes.error,
    healthObservations.error,
    appointments.error,
    appointmentResponses.error,
    referrals.error,
    helpRequests.error,
    chatThreads.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(errors.map((e: any) => e.message).join("; "));
  }

  return {
    participant_group_ids: groupIds,
    education_assignments: educationAssignments.data ?? [],
    education_progress: educationProgress.data ?? [],
    questionnaire_assignments: questionnaireAssignments.data ?? [],
    questionnaire_responses: questionnaireResponses.data ?? [],
    consent_forms: consentForms.data ?? [],
    participant_consents: participantConsents.data ?? [],
    observation_types: observationTypes.data ?? [],
    health_observations: healthObservations.data ?? [],
    appointments: appointments.data ?? [],
    appointment_responses: appointmentResponses.data ?? [],
    referrals: referrals.data ?? [],
    help_requests: helpRequests.data ?? [],
    chat_threads: chatThreads.data ?? [],
    last_synced_at: lastSyncedAt ?? null,
  };
}
