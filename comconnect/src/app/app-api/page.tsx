"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";
import { userCan } from "@/lib/comconnect-core/permissions";

export const dynamic = "force-dynamic";

type CurrentContext = {
  user?: {
    email?: string | null;
    id?: string | null;
  };
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  organisation_membership_status?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  project_role?: string | null;
  allowed_projects?: any[];
  onboarding_required?: boolean;
  access_pending?: boolean;
  dev_fallback?: boolean;
};

const apiModules = [
  {
    title: "Participant API",
    description:
      "Read and create participants, manage participant identifiers, and connect participant records to organisation projects.",
    status: "Ready",
  },
  {
    title: "Message API",
    description:
      "Accept app, push, SMS, WhatsApp and voice message requests through controlled ComConnect workflows.",
    status: "Ready",
  },
  {
    title: "Schedule API",
    description:
      "Create scheduled communication tasks while respecting project rules, quiet time and guarded sending.",
    status: "Ready",
  },
  {
    title: "Delivery Logs API",
    description:
      "Read delivery events for app messages, push notifications, SMS, WhatsApp and voice calls.",
    status: "Ready",
  },
  {
    title: "Replies API",
    description:
      "Read participant help requests and reply-like records from supported ComConnect workflows.",
    status: "Ready",
  },
  {
    title: "Webhook API",
    description:
      "Manage and test delivery, reply, failed-message and billing events sent to approved webhook endpoints.",
    status: "Ready",
  },
];

const externalEndpoints = [
  {
    method: "GET",
    path: "/api/external/me",
    scope: "participants:read",
    status: "Ready",
    purpose: "Test whether an external API key is valid.",
    safety:
      "Read-only authentication test. Does not touch participants, messages, wallet or providers.",
  },
  {
    method: "GET",
    path: "/api/external/participants",
    scope: "participants:read",
    status: "Ready",
    purpose: "Read participants within the API key organisation/project scope.",
    safety:
      "Read-only. Supports limit, offset, search and project scoping. Does not send messages.",
  },
  {
    method: "POST",
    path: "/api/external/participants",
    scope: "participants:write",
    status: "Ready",
    purpose: "Create a participant in an authorised organisation/project.",
    safety:
      "Creates participant records only. Does not send messages or touch wallet/provider routes.",
  },
  {
    method: "POST",
    path: "/api/external/messages/send",
    scope: "messages:write",
    status: "Ready",
    purpose: "Accept app, push, SMS, WhatsApp or voice message requests.",
    safety:
      "App is published to app messages. Push is queued. SMS, voice and WhatsApp are queued as guarded communication schedules.",
  },
  {
    method: "POST",
    path: "/api/external/schedules",
    scope: "schedules:write",
    status: "Ready",
    purpose: "Create scheduled communication for authorised participants.",
    safety:
      "Creates schedule rows only. Existing ComConnect sender handles actual sending, billing, wallet checks and delivery logs.",
  },
  {
    method: "GET",
    path: "/api/external/delivery-logs",
    scope: "delivery_logs:read",
    status: "Ready",
    purpose: "Read delivery outcomes for app, push, SMS, WhatsApp and voice.",
    safety:
      "Read-only. Organisation/project scoped. Does not trigger sending or wallet deduction.",
  },
  {
    method: "GET",
    path: "/api/external/replies",
    scope: "replies:read",
    status: "Ready",
    purpose: "Read participant help requests and reply-like records.",
    safety:
      "Read-only. Currently returns records from help_requests under the API key organisation/project scope.",
  },
  {
    method: "POST",
    path: "/api/external/webhooks/test",
    scope: "webhooks:write",
    status: "Ready",
    purpose: "Send a harmless test event to a configured webhook endpoint.",
    safety:
      "Sends only a test webhook payload. Does not send participant messages or deduct wallet.",
  },
];

const rules = [
  "API access is organisation-scoped and may also be project-scoped.",
  "API keys are controlled by plan, role, permission and key scope.",
  "API keys must never bypass subscription, wallet or paid-channel billing rules.",
  "Only in-app app messages are treated as non-wallet messages.",
  "Push, SMS, voice calls and WhatsApp are controlled channels and must be guarded.",
  "SMS, voice calls and WhatsApp require an active wallet and enabled channel.",
  "Subscription gives access to ComConnect dashboard and Participant app.",
  "Trial access supports platform and Participant app testing only.",
  "External SMS, voice and WhatsApp sending enters the existing schedule/sender flow, not direct provider calls.",
];

const testingRequirements = [
  {
    title: "App message test",
    requirement:
      "The participant must exist in ComConnect and must log into the Participant App. The API sends using participant_id or participant_code.",
    note:
      "This is the cheapest and safest test because it publishes to app_messages and does not use wallet-funded channels.",
  },
  {
    title: "SMS, WhatsApp and voice test",
    requirement:
      "The participant must exist in ComConnect and must have a valid phone_number on their participant record.",
    note:
      "The API does not send to random phone numbers. It queues the message for guarded ComConnect sending using the registered participant.",
  },
  {
    title: "Push notification test",
    requirement:
      "The participant must exist, install/login to the Participant App, and have a registered device/push token.",
    note:
      "Push is treated as a controlled channel. The external API queues it; it does not directly call Expo from the route.",
  },
  {
    title: "No raw phone-number-only sending",
    requirement:
      "External API message sending requires participant_id or participant_code.",
    note:
      "This protects consent, project scoping, audit logs, delivery history and billing controls.",
  },
];

const examples = [
  {
    title: "Authentication header",
    code: `Authorization: Bearer cc_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
  },
  {
    title: "Test API key",
    code: `GET /api/external/me`,
  },
  {
    title: "Create test participant first",
    code: `POST /api/external/participants
{
  "project_id": "project-uuid",
  "participant_code": "TEST_001",
  "phone_number": "+27720000000",
  "first_name": "Test",
  "last_name": "User",
  "preferred_language": "en"
}`,
  },
  {
    title: "Read participants",
    code: `GET /api/external/participants?limit=10&offset=0`,
  },
  {
    title: "JSON app message test",
    code: `POST /api/external/messages/send
{
  "project_id": "project-uuid",
  "participant_code": "TEST_001",
  "requested_channel": "app",
  "send_now": true,
  "message_code": "EXT_APP_001",
  "message_title": "App message test",
  "message_body": "This message will appear inside the participant app.",
  "priority": "normal"
}`,
  },
  {
    title: "JSON SMS test",
    code: `POST /api/external/messages/send
{
  "project_id": "project-uuid",
  "participant_code": "TEST_001",
  "requested_channel": "sms",
  "send_now": true,
  "message_code": "EXT_SMS_001",
  "message_title": "SMS test",
  "message_body": "This SMS is queued for guarded ComConnect sending.",
  "priority": "normal",
  "respect_quiet_time": true
}`,
  },
  {
    title: "JSON WhatsApp test",
    code: `POST /api/external/messages/send
{
  "project_id": "project-uuid",
  "participant_code": "TEST_001",
  "requested_channel": "whatsapp",
  "send_now": true,
  "message_code": "EXT_WA_001",
  "message_title": "WhatsApp test",
  "message_body": "This WhatsApp message is queued for guarded ComConnect sending.",
  "priority": "normal",
  "respect_quiet_time": true
}`,
  },
  {
    title: "JSON voice test",
    code: `POST /api/external/messages/send
{
  "project_id": "project-uuid",
  "participant_code": "TEST_001",
  "requested_channel": "voice",
  "send_now": true,
  "message_code": "EXT_VOICE_001",
  "message_title": "Voice test",
  "message_body": "This voice call is queued for guarded ComConnect sending.",
  "priority": "normal",
  "respect_quiet_time": true
}`,
  },
  {
    title: "Node.js example",
    code: `const response = await fetch("https://your-comconnect-domain.com/api/external/messages/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer cc_live_your_api_key"
  },
  body: JSON.stringify({
    project_id: "project-uuid",
    participant_code: "TEST_001",
    requested_channel: "app",
    send_now: true,
    message_title: "App message test",
    message_body: "This message will appear inside the participant app.",
    priority: "normal"
  })
});

const result = await response.json();
console.log(result);`,
  },
  {
    title: "PowerShell example",
    code: `$API_KEY = "cc_live_your_api_key"

$body = @{
  project_id = "project-uuid"
  participant_code = "TEST_001"
  requested_channel = "app"
  send_now = $true
  message_title = "App message test"
  message_body = "This message will appear inside the participant app."
  priority = "normal"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod \`
  -Uri "https://your-comconnect-domain.com/api/external/messages/send" \`
  -Method POST \`
  -Headers @{
    Authorization = "Bearer $API_KEY"
    "Content-Type" = "application/json"
  } \`
  -Body $body`,
  },
];

function AccessMessage({
  title,
  message,
  href,
  linkText,
}: {
  title: string;
  message: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0A5278]">
        Access check
      </p>
      <h2 className="mt-3 text-2xl font-black text-[#06324A]">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[#536271]">
        {message}
      </p>

      {href && linkText ? (
        <Link
          href={href}
          className="mt-5 inline-flex rounded-full bg-[#0A5278] px-5 py-3 text-sm font-black text-white hover:bg-[#063E5E]"
        >
          {linkText}
        </Link>
      ) : null}
    </div>
  );
}

function statusClass(status: string) {
  if (status.toLowerCase() === "ready") {
    return "rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700";
  }

  if (status.toLowerCase().includes("partly")) {
    return "rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700";
  }

  return "rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700";
}

function methodClass(method: string) {
  if (method === "GET") {
    return "rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700";
  }

  return "rounded-full bg-[#EAF2F8] px-3 py-1 text-xs font-black text-[#0A5278]";
}

export default function AppApiPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [error, setError] = useState("");

  const canViewApiConsole = useMemo(() => {
    return userCan({
      organisationRole: context?.organisation_role ?? null,
      projectRole: context?.project_role ?? null,
      permission: "api:read",
    });
  }, [context?.organisation_role, context?.project_role]);

  async function loadContext() {
    setContextLoading(true);
    setError("");

    try {
      const response = await fetch("/api/context/current", {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error ?? "Failed to load organisation/project context."
        );
      }

      setContext(json.data as CurrentContext);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load Developer API access.");
    } finally {
      setContextLoading(false);
    }
  }

  useEffect(() => {
    loadContext();
  }, []);

  const organisationName =
    context?.organisation_name ?? "ComConnect Organisation";
  const projectName = context?.active_project_name ?? "Developer API";
  const organisationRole = context?.organisation_role ?? "viewer";
  const projectRole = context?.project_role ?? "viewer";

  let guardedContent = null;

  if (contextLoading) {
    guardedContent = (
      <div className="rounded-[2rem] bg-white p-8 text-center text-sm font-black text-[#536271] shadow-sm">
        Loading Developer API access...
      </div>
    );
  } else if (error) {
    guardedContent = (
      <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
        {error}
      </div>
    );
  } else if (context?.onboarding_required || !context?.organisation_id) {
    guardedContent = (
      <AccessMessage
        title="No active organisation"
        message="This account is not linked to an active organisation. Developer API access can only be viewed after organisation access is active."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else if (context?.access_pending) {
    guardedContent = (
      <AccessMessage
        title="Organisation access pending"
        message="Your organisation access is still pending. Developer API access will become available after your membership is active."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else if (!canViewApiConsole) {
    guardedContent = (
      <AccessMessage
        title="You do not have Developer API permission"
        message="Only users with API read permission can view the Developer API console. Ask an organisation admin or developer admin to update your access."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else {
    guardedContent = (
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] bg-[#032A3D] p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#28A9E0]">
            Developer API
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                ComConnect External API Console
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/80">
                Manage secure organisation API access for participants,
                messages, schedules, delivery logs, replies and webhook testing.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Current stage
              </p>
              <p className="mt-2 text-xl font-black text-white">
                External API routes ready
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white/70">
                Authentication, participants, schedules, delivery logs, replies,
                webhook testing and message acceptance routes are working.
                Paid/controlled channels remain queued through ComConnect
                safeguards.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {apiModules.map((module) => (
            <div
              key={module.title}
              className="rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-black text-[#06324A]">
                  {module.title}
                </h2>
                <span className={statusClass(module.status)}>
                  {module.status}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#536271]">
                {module.description}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                External endpoints
              </p>
              <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                API reference and implementation status
              </h2>
            </div>

            <Link
              href="/api-keys"
              className="rounded-full bg-[#0A5278] px-5 py-3 text-sm font-black text-white hover:bg-[#063E5E]"
            >
              Manage API keys
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-xs font-black uppercase tracking-[0.16em] text-[#536271]">
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Endpoint</th>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Purpose</th>
                  <th className="px-3 py-2">Safety rule</th>
                </tr>
              </thead>

              <tbody>
                {externalEndpoints.map((endpoint) => (
                  <tr key={`${endpoint.method}-${endpoint.path}`}>
                    <td className="rounded-l-2xl border-y border-l border-[#C9D8E4] bg-white px-3 py-3">
                      <span className={methodClass(endpoint.method)}>
                        {endpoint.method}
                      </span>
                    </td>
                    <td className="border-y border-[#C9D8E4] bg-white px-3 py-3">
                      <code className="text-xs font-black text-[#06324A]">
                        {endpoint.path}
                      </code>
                    </td>
                    <td className="border-y border-[#C9D8E4] bg-white px-3 py-3">
                      <code className="text-xs font-bold text-[#536271]">
                        {endpoint.scope}
                      </code>
                    </td>
                    <td className="border-y border-[#C9D8E4] bg-white px-3 py-3">
                      <span className={statusClass(endpoint.status)}>
                        {endpoint.status}
                      </span>
                    </td>
                    <td className="border-y border-[#C9D8E4] bg-white px-3 py-3 font-semibold leading-6 text-[#536271]">
                      {endpoint.purpose}
                    </td>
                    <td className="rounded-r-2xl border-y border-r border-[#C9D8E4] bg-white px-3 py-3 font-semibold leading-6 text-[#536271]">
                      {endpoint.safety}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
    Testing requirements
  </p>
  <h2 className="mt-3 text-2xl font-black text-[#06324A]">
    Messages are sent to registered participants
  </h2>
  <p className="mt-3 max-w-4xl text-sm font-bold leading-6 text-[#536271]">
    ComConnect external API does not support raw phone-number-only sending in
    this version. Create or select a registered participant first, then send
    using participant_code or participant_id. This keeps consent, project
    scoping, delivery logs, wallet checks and audit trails intact.
  </p>

  <div className="mt-5 grid gap-3 md:grid-cols-2">
    {testingRequirements.map((item) => (
      <div
        key={item.title}
        className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-4"
      >
        <h3 className="text-sm font-black text-[#06324A]">
          {item.title}
        </h3>
        <p className="mt-2 text-xs font-bold leading-5 text-[#536271]">
          {item.requirement}
        </p>
        <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-bold leading-5 text-[#0A5278]">
          {item.note}
        </p>
      </div>
    ))}
  </div>
</section>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              Billing and wallet rules
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#06324A]">
              API access will not bypass paid-channel controls
            </h2>

            <div className="mt-5 grid gap-3">
              {rules.map((rule) => (
                <div
                  key={rule}
                  className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] px-4 py-3 text-sm font-bold text-[#06324A]"
                >
                  {rule}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              API examples
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#06324A]">
              How to call the API
            </h2>

            <div className="mt-5 space-y-3">
              {examples.map((example) => (
                <div
                  key={example.title}
                  className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-4"
                >
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0A5278]">
                    {example.title}
                  </p>
                  <code className="mt-2 block whitespace-pre-wrap break-words rounded-xl bg-white px-3 py-2 text-xs font-black text-[#06324A]">
                    {example.code}
                  </code>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3">
              <Link
                href="/api-keys"
                className="block rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
              >
                API Keys
              </Link>
              <Link
                href="/webhooks"
                className="block rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
              >
                Webhooks
              </Link>
              <Link
                href="/api-usage"
                className="block rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
              >
                API Usage
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
            Implementation status
          </p>
          <p className="mt-3 text-sm font-bold leading-6 text-emerald-800">
            External API authentication, participant read/create, delivery log
            read, replies read, webhook testing, schedule creation and message
            acceptance are implemented. App messages are published to the
            participant app. Push is queued. SMS, voice and WhatsApp are
            accepted into controlled ComConnect schedules so billing, wallet,
            provider delivery, retries and logs remain under the existing
            guarded sender flow.
          </p>
        </section>
      </div>
    );
  }

  return (
    <VerticalAppShell
      organisationName={organisationName}
      projectName={projectName}
      organisationRole={organisationRole}
      projectRole={projectRole}
    >
      <main className="min-h-screen bg-[#EAF2F8] px-4 py-5 text-[#06324A]">
        {guardedContent}
      </main>
    </VerticalAppShell>
  );
}