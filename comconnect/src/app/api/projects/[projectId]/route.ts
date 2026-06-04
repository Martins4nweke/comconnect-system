import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

type ProjectSettings = {
  modules: {
    core_communication: boolean;
    research: boolean;
    care: boolean;
    api: boolean;
  };
  research: {
    education_library: boolean;
    questionnaires: boolean;
    consent_forms: boolean;
    media_library: boolean;
  };
  care: {
    health_checkins: boolean;
    appointments: boolean;
    referrals: boolean;
    help_requests: boolean;
  };
  channels: {
    app: boolean;
    push: boolean;
    sms: boolean;
    whatsapp: boolean;
    voice: boolean;
  };
  fallback: {
    enabled: boolean;
    order: string[];
  };
};

const defaultSettings: ProjectSettings = {
  modules: {
    core_communication: true,
    research: true,
    care: true,
    api: false,
  },
  research: {
    education_library: true,
    questionnaires: true,
    consent_forms: true,
    media_library: true,
  },
  care: {
    health_checkins: true,
    appointments: true,
    referrals: true,
    help_requests: true,
  },
  channels: {
    app: true,
    push: true,
    sms: true,
    whatsapp: false,
    voice: true,
  },
  fallback: {
    enabled: true,
    order: ["app", "push", "sms", "voice"],
  },
};

const allowedStatuses = new Set(["active", "paused", "archived"]);
const allowedFallbackChannels = new Set(["app", "push", "sms", "whatsapp", "voice"]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseProjectCode(value: unknown) {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function normaliseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function normaliseFallbackOrder(value: unknown) {
  if (!Array.isArray(value)) return defaultSettings.fallback.order;

  const cleaned = value
    .map((item) => cleanText(item).toLowerCase())
    .filter((item) => allowedFallbackChannels.has(item));

  return Array.from(new Set(cleaned)).length > 0
    ? Array.from(new Set(cleaned))
    : defaultSettings.fallback.order;
}

function normaliseSettings(value: any): ProjectSettings {
  const incoming = value ?? {};

  return {
    modules: {
      core_communication: normaliseBoolean(
        incoming?.modules?.core_communication,
        defaultSettings.modules.core_communication
      ),
      research: normaliseBoolean(
        incoming?.modules?.research,
        defaultSettings.modules.research
      ),
      care: normaliseBoolean(
        incoming?.modules?.care,
        defaultSettings.modules.care
      ),
      api: normaliseBoolean(
        incoming?.modules?.api,
        defaultSettings.modules.api
      ),
    },

    research: {
      education_library: normaliseBoolean(
        incoming?.research?.education_library,
        defaultSettings.research.education_library
      ),
      questionnaires: normaliseBoolean(
        incoming?.research?.questionnaires,
        defaultSettings.research.questionnaires
      ),
      consent_forms: normaliseBoolean(
        incoming?.research?.consent_forms,
        defaultSettings.research.consent_forms
      ),
      media_library: normaliseBoolean(
        incoming?.research?.media_library,
        defaultSettings.research.media_library
      ),
    },

    care: {
      health_checkins: normaliseBoolean(
        incoming?.care?.health_checkins,
        defaultSettings.care.health_checkins
      ),
      appointments: normaliseBoolean(
        incoming?.care?.appointments,
        defaultSettings.care.appointments
      ),
      referrals: normaliseBoolean(
        incoming?.care?.referrals,
        defaultSettings.care.referrals
      ),
      help_requests: normaliseBoolean(
        incoming?.care?.help_requests,
        defaultSettings.care.help_requests
      ),
    },

    channels: {
      app: normaliseBoolean(
        incoming?.channels?.app,
        defaultSettings.channels.app
      ),
      push: normaliseBoolean(
        incoming?.channels?.push,
        defaultSettings.channels.push
      ),
      sms: normaliseBoolean(
        incoming?.channels?.sms,
        defaultSettings.channels.sms
      ),
      whatsapp: normaliseBoolean(
        incoming?.channels?.whatsapp,
        defaultSettings.channels.whatsapp
      ),
      voice: normaliseBoolean(
        incoming?.channels?.voice,
        defaultSettings.channels.voice
      ),
    },

    fallback: {
      enabled: normaliseBoolean(
        incoming?.fallback?.enabled,
        defaultSettings.fallback.enabled
      ),
      order: normaliseFallbackOrder(incoming?.fallback?.order),
    },
  };
}

function withNormalisedProject(project: any) {
  if (!project) return project;

  return {
    ...project,
    settings: normaliseSettings(project.settings),
  };
}

async function getProject(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  if (!projectId) return fail("Project ID is required", 400);

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) return fail(error.message, 500);
  if (!data) return fail("Project not found", 404);

  return ok(withNormalisedProject(data));
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const body = await req.json().catch(() => null);

  if (!projectId) return fail("Project ID is required", 400);
  if (!body) return fail("Invalid project update payload", 400);

  const existingProject = await getProject(projectId);

  if (!existingProject) {
    return fail("Project not found", 404);
  }

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (body?.name !== undefined) {
    const name = cleanText(body.name);
    if (!name) return fail("Project name cannot be empty", 400);
    updatePayload.name = name;
  }

  if (body?.project_code !== undefined) {
    const projectCode = normaliseProjectCode(body.project_code);

    if (!projectCode) {
      return fail("Project code cannot be empty", 400);
    }

    const { data: duplicateProject, error: duplicateError } =
      await supabaseAdmin
        .from("projects")
        .select("id")
        .eq("organisation_id", existingProject.organisation_id)
        .eq("project_code", projectCode)
        .neq("id", projectId)
        .maybeSingle();

    if (duplicateError) return fail(duplicateError.message, 500);

    if (duplicateProject) {
      return fail(
        "Another project with this project_code already exists in this organisation",
        409
      );
    }

    updatePayload.project_code = projectCode;
  }

  if (body?.description !== undefined) {
    updatePayload.description = cleanText(body.description) || null;
  }

  if (body?.status !== undefined) {
    const status = cleanText(body.status).toLowerCase() || "active";

    if (!allowedStatuses.has(status)) {
      return fail("Invalid project status. Use active, paused, or archived.", 400);
    }

    updatePayload.status = status;
  }

  if (body?.default_language !== undefined) {
    updatePayload.default_language = cleanText(body.default_language) || "en";
  }

  if (body?.app_access_enabled !== undefined) {
    updatePayload.app_access_enabled = Boolean(body.app_access_enabled);
  }

  if (body?.settings !== undefined) {
    updatePayload.settings = normaliseSettings(body.settings);
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .update(updatePayload)
    .eq("id", projectId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  return ok(withNormalisedProject(data));
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  if (!projectId) return fail("Project ID is required", 400);

  const existingProject = await getProject(projectId);

  if (!existingProject) {
    return fail("Project not found", 404);
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  return ok({
    archived: true,
    project: withNormalisedProject(data),
  });
}