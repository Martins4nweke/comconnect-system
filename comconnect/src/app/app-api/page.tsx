import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function count(table: string) {
  const { count } = await supabaseAdmin.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function AppApiPage() {
  const [
    sessions,
    devices,
    syncEvents,
    messages,
    pushQueue,
    smsLogs,
    voiceTasks,
    deliveryEvents,
  ] = await Promise.all([
    count("participant_app_sessions"),
    count("participant_devices"),
    count("sync_events"),
    count("app_messages"),
    count("push_notification_queue"),
    count("sms_logs"),
    count("voice_call_tasks"),
    count("communication_delivery_events"),
  ]);

  const cards = [
    { label: "App sessions", value: sessions },
    { label: "Registered devices", value: devices },
    { label: "Sync events", value: syncEvents },
    { label: "App messages", value: messages },
    { label: "Push queue", value: pushQueue },
    { label: "SMS logs", value: smsLogs },
    { label: "Voice tasks", value: voiceTasks },
    { label: "Delivery events", value: deliveryEvents },
  ];

  const endpoints = [
    "POST /api/participant-app/login",
    "POST /api/participant-app/devices/push-token",
    "POST /api/participant-app/sync/pull",
    "POST /api/participant-app/sync/push",
    "POST /api/communication/queue-push",
    "POST /api/communication/send-due",
    "GET /api/communication/health",
  ];

  return (
    <main className="min-h-screen bg-[#EEF3FB] p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section>
          <div className="mb-4 inline-flex items-center rounded-[1.5rem] bg-[#171717] px-5 py-3 text-sm font-black text-[#FF5C1A] shadow-sm">
            Participant App API
            <span className="mx-4 h-6 w-[2px] bg-white/70" />
            <span className="font-semibold text-white">Push + SMS + Voice ready</span>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-black md:text-6xl">
            App API Console
          </h1>
          <p className="mt-3 max-w-3xl text-base font-medium text-slate-600">
            Monitor participant app API usage, device registration, sync, push queue, SMS fallback and voice tasks.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-[1.5rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
              <p className="text-sm font-bold text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-black text-[#171717]">{card.value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-[1.5rem] border-2 border-[#171717] bg-white p-5 shadow-[4px_4px_0_#171717]">
          <h2 className="text-xl font-black text-[#171717]">Delivery endpoints</h2>
          <div className="mt-4 grid gap-2">
            {endpoints.map((endpoint) => (
              <code key={endpoint} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800">
                {endpoint}
              </code>
            ))}
          </div>

          <div className="mt-5 flex gap-3">
            <Link href="/api/communication/health" className="rounded-xl bg-[#FF5C1A] px-4 py-2 text-sm font-black text-black">
              Communication health
            </Link>
            <Link href="/push-queue" className="rounded-xl border-2 border-[#171717] px-4 py-2 text-sm font-black text-[#171717]">
              Push queue
            </Link>
            <Link href="/voice-tasks" className="rounded-xl border-2 border-[#171717] px-4 py-2 text-sm font-black text-[#171717]">
              Voice tasks
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
