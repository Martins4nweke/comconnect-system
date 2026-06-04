import { useEffect, useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { AppButton } from "../components/AppButton";
import { useAppContext } from "../context/AppContext";
import type { ScreenName } from "../navigation/simpleNavigator";
import { clearSession } from "../storage/localStore";
import { logoutParticipant } from "../api/participantAppApi";
import { pullFromComConnect, pushOfflineQueue } from "../sync/syncService";

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getCacheArray(cache: any, key: string) {
  const direct = asArray(cache?.[key]);
  const nestedData = asArray(cache?.data?.[key]);
  const researchCare = asArray(cache?.research_care?.[key]);
  const nestedResearchCare = asArray(cache?.data?.research_care?.[key]);

  return [
    ...direct,
    ...nestedData,
    ...researchCare,
    ...nestedResearchCare,
  ];
}

function uniqueById(items: any[], getId: (item: any) => string) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const id = getId(item);

    if (!id) return true;
    if (seen.has(id)) return false;

    seen.add(id);
    return true;
  });
}

function getMessageId(message: any) {
  return String(message.id ?? message.message_id ?? "");
}

function getEducationId(item: any) {
  const education = item.education_items ?? item;

  return String(
    item.education_item_id ??
      education.id ??
      item.id ??
      ""
  );
}

function getQuestionnaireId(item: any) {
  const questionnaire = item.questionnaires ?? item;

  return String(
    item.questionnaire_id ??
      questionnaire.id ??
      item.id ??
      ""
  );
}

function getAppointmentId(item: any) {
  return String(item.id ?? item.appointment_id ?? "");
}

function getReferralId(item: any) {
  return String(item.id ?? item.referral_id ?? "");
}

function hasMessageEvent(
  message: any,
  messageEvents: any[],
  acceptedEvents: string[]
) {
  const messageId = getMessageId(message);

  if (!messageId) return false;

  return messageEvents.some((event) => {
    const eventMessageId = String(
      event.message_id ?? event.payload?.message_id ?? ""
    );

    const eventType = String(
      event.event_type ?? event.payload?.event_type ?? ""
    );

    return (
      eventMessageId === messageId &&
      acceptedEvents.includes(eventType)
    );
  });
}

function hasMessageReply(message: any, replies: any[]) {
  const messageId = getMessageId(message);

  if (!messageId) return false;

  return replies.some((reply) => {
    const replyMessageId = String(
      reply.message_id ?? reply.payload?.message_id ?? ""
    );

    return replyMessageId === messageId;
  });
}

function isUnreadMessage(
  message: any,
  messageEvents: any[],
  replies: any[]
) {
  if (
    message.opened_at ||
    message.read_at ||
    message.seen_at ||
    message.replied_at ||
    message.participant_replied_at
  ) {
    return false;
  }

  if (
    message.status === "read" ||
    message.status === "opened" ||
    message.status === "seen" ||
    message.status === "replied" ||
    message.status === "reply_pending_sync"
  ) {
    return false;
  }

  if (
    hasMessageEvent(message, messageEvents, [
      "opened",
      "read",
      "seen",
      "replied",
    ])
  ) {
    return false;
  }

  if (hasMessageReply(message, replies)) {
    return false;
  }

  return true;
}

function hasEducationProgress(item: any, progressItems: any[]) {
  const educationId = getEducationId(item);

  if (!educationId) return false;

  return progressItems.some((progress) => {
    const progressEducationId = String(
      progress.education_item_id ??
        progress.payload?.education_item_id ??
        ""
    );

    const status = String(
      progress.progress_status ??
        progress.status ??
        progress.payload?.progress_status ??
        ""
    );

    return (
      progressEducationId === educationId &&
      (
        status === "completed" ||
        status === "completed_pending_sync" ||
        Boolean(progress.completed_at)
      )
    );
  });
}

function isPendingEducation(item: any, progressItems: any[]) {
  const education = item.education_items ?? item;

  if (
    item.completed_at ||
    education.completed_at ||
    item.progress_status === "completed" ||
    item.progress_status === "completed_pending_sync" ||
    education.progress_status === "completed" ||
    education.progress_status === "completed_pending_sync" ||
    item.status === "completed" ||
    item.status === "completed_pending_sync" ||
    education.status === "completed" ||
    education.status === "completed_pending_sync"
  ) {
    return false;
  }

  if (hasEducationProgress(item, progressItems)) {
    return false;
  }

  return true;
}

function hasQuestionnaireResponse(item: any, responses: any[]) {
  const questionnaireId = getQuestionnaireId(item);

  if (!questionnaireId) return false;

  return responses.some((response) => {
    const responseQuestionnaireId = String(
      response.questionnaire_id ??
        response.payload?.questionnaire_id ??
        ""
    );

    const status = String(
      response.status ??
        response.response_status ??
        response.payload?.status ??
        ""
    );

    return (
      responseQuestionnaireId === questionnaireId &&
      (
        status === "submitted" ||
        status === "completed" ||
        status === "submitted_pending_sync" ||
        Boolean(response.submitted_at) ||
        Boolean(response.completed_at)
      )
    );
  });
}

function isPendingQuestionnaire(item: any, responses: any[]) {
  const questionnaire = item.questionnaires ?? item;

  if (
    item.completed_at ||
    item.submitted_at ||
    item.response_status ||
    questionnaire.completed_at ||
    questionnaire.submitted_at ||
    questionnaire.response_status ||
    item.status === "submitted" ||
    item.status === "completed" ||
    item.status === "submitted_pending_sync" ||
    questionnaire.status === "submitted" ||
    questionnaire.status === "completed" ||
    questionnaire.status === "submitted_pending_sync"
  ) {
    return false;
  }

  if (hasQuestionnaireResponse(item, responses)) {
    return false;
  }

  return true;
}

function isPendingAppointment(item: any) {
  if (
    item.participant_response ||
    item.response ||
    item.responded_at ||
    item.response_status
  ) {
    return false;
  }

  return ![
    "confirmed",
    "declined",
    "cancelled",
    "completed",
    "reschedule_requested",
    "confirmed_pending_sync",
    "declined_pending_sync",
    "reschedule_requested_pending_sync",
  ].includes(String(item.status ?? ""));
}

function isPendingReferral(item: any) {
  const hasResponse =
    Boolean(item.responded_at) ||
    Boolean(item.participant_responded_at) ||
    Boolean(item.response_status) ||
    Boolean(item.participant_response_status);

  const closedStatuses = [
    "viewed",
    "contacted",
    "attended",
    "needs_help",
    "viewed_pending_sync",
    "contacted_pending_sync",
    "attended_pending_sync",
    "needs_help_pending_sync",
    "closed",
    "completed",
    "cancelled",
  ];

  return (
    !hasResponse &&
    !closedStatuses.includes(String(item.status ?? "")) &&
    (
      item.status === "open" ||
      item.status === "new" ||
      item.status === "pending" ||
      item.status === "active" ||
      !item.status
    )
  );
}

function isUnreadChat(item: any) {
  if (
    item.sender_type === "participant" ||
    item.direction === "outbound" ||
    item.from_participant === true
  ) {
    return false;
  }

  return (
    !item.read_at &&
    !item.seen_at &&
    item.status !== "read" &&
    item.status !== "seen"
  );
}

function highlightForCard(
  screen: ScreenName,
  counts: {
    unreadMessages: number;
    pendingEducation: number;
    pendingQuestionnaires: number;
    pendingAppointments: number;
    pendingReferrals: number;
    unreadChat: number;
  }
) {
  if (screen === "messages" && counts.unreadMessages > 0) {
    return {
      highlight: true,
      highlightText: `${counts.unreadMessages} NEW`,
    };
  }

  if (screen === "education" && counts.pendingEducation > 0) {
    return {
      highlight: true,
      highlightText: `${counts.pendingEducation} NEW`,
    };
  }

  if (screen === "questionnaires" && counts.pendingQuestionnaires > 0) {
    return {
      highlight: true,
      highlightText:
        counts.pendingQuestionnaires > 1
          ? `${counts.pendingQuestionnaires} PENDING`
          : "PENDING",
    };
  }

  if (screen === "appointments" && counts.pendingAppointments > 0) {
    return {
      highlight: true,
      highlightText:
        counts.pendingAppointments > 1
          ? `${counts.pendingAppointments} ACTION`
          : "ACTION",
    };
  }

  if (screen === "referrals" && counts.pendingReferrals > 0) {
    return {
      highlight: true,
      highlightText:
        counts.pendingReferrals > 1
          ? `${counts.pendingReferrals} ACTION`
          : "ACTION",
    };
  }

  if (screen === "chat" && counts.unreadChat > 0) {
    return {
      highlight: true,
      highlightText: `${counts.unreadChat} NEW`,
    };
  }

  return {
    highlight: false,
    highlightText: null,
  };
}

export function HomeScreen({
  navigate,
  onLogout,
}: {
  navigate: (screen: ScreenName) => void;
  onLogout: () => void;
}) {
  const {
    config,
    cache,
    enabledModules,
    lowDataMode,
    setLowDataMode,
    setToken,
    setConfig,
    setCache,
    connectionStatus,
  } = useAppContext();

  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function autoSync() {
      setSyncing(true);

      try {
        await pushOfflineQueue();

        const newCache = await pullFromComConnect();

        if (cancelled) return;

        setCache(newCache);

        if (newCache.config) {
          setConfig(newCache.config);
        }
      } catch {
        // Keep background sync silent for normal participants.
      } finally {
        if (!cancelled) {
          setSyncing(false);
        }
      }
    }

    autoSync();

    return () => {
      cancelled = true;
    };
  }, [setCache, setConfig]);


  async function logout() {
  Alert.alert(
    "Logout?",
    "You will need to login again if you continue.",
    [
      {
        text: "Stay logged in",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logoutParticipant();
          } catch {}

          await clearSession();
          setToken(null);
          setConfig(null);
          setCache(null);
          onLogout();
        },
      },
    ]
  );
}

  const messages = uniqueById(
    getCacheArray(cache, "messages"),
    getMessageId
  );

  const messageReplies = getCacheArray(cache, "message_replies");
  const messageEvents = getCacheArray(cache, "message_events");

  const educationItems = uniqueById(
    getCacheArray(cache, "education_items"),
    getEducationId
  );

  const educationProgress = [
    ...getCacheArray(cache, "education_progress"),
    ...getCacheArray(cache, "education_progress_items"),
  ];

  const questionnaires = uniqueById(
    getCacheArray(cache, "questionnaires"),
    getQuestionnaireId
  );

  const questionnaireResponses = [
    ...getCacheArray(cache, "questionnaire_responses"),
    ...getCacheArray(cache, "responses"),
  ];

  const appointments = uniqueById(
    getCacheArray(cache, "appointments"),
    getAppointmentId
  );

  const referrals = uniqueById(
    getCacheArray(cache, "referrals"),
    getReferralId
  );

  const chatUpdates = [
    ...getCacheArray(cache, "chat_updates"),
    ...getCacheArray(cache, "chat_messages"),
  ];

  const counts = {
    unreadMessages: messages.filter((message) =>
      isUnreadMessage(message, messageEvents, messageReplies)
    ).length,

    pendingEducation: educationItems.filter((item) =>
      isPendingEducation(item, educationProgress)
    ).length,

    pendingQuestionnaires: questionnaires.filter((item) =>
      isPendingQuestionnaire(item, questionnaireResponses)
    ).length,

    pendingAppointments: appointments.filter(isPendingAppointment).length,
    pendingReferrals: referrals.filter(isPendingReferral).length,
    unreadChat: chatUpdates.filter(isUnreadChat).length,
  };

  const cards = [
    {
      module: "app_messaging",
      title: "Messages",
      subtitle: "Read and reply only.",
      screen: "messages" as ScreenName,
    },
    {
      module: "education",
      title: "Education",
      subtitle: "Text, audio and video lessons.",
      screen: "education" as ScreenName,
    },
    {
      module: "questionnaires",
      title: "Questionnaires",
      subtitle: "Complete assigned forms.",
      screen: "questionnaires" as ScreenName,
    },
    {
      module: "consent",
      title: "Consent",
      subtitle: "Review consent forms.",
      screen: "consent" as ScreenName,
    },
    {
      module: "health_checkins",
      title: "Health Check-ins",
      subtitle: "Submit project check-ins.",
      screen: "health" as ScreenName,
    },
    {
      module: "appointments",
      title: "Appointments",
      subtitle: "Confirm or reschedule.",
      screen: "appointments" as ScreenName,
    },
    {
      module: "referrals",
      title: "Referrals",
      subtitle: "View referral follow-up.",
      screen: "referrals" as ScreenName,
    },
    {
      module: "help_requests",
      title: "Ask for Help",
      subtitle: "Send a help request.",
      screen: "help" as ScreenName,
    },
    {
      module: "chat",
      title: "Chat",
      subtitle: "Message the team.",
      screen: "chat" as ScreenName,
    },
  ];

  const displayName = config?.participant?.display_name;
  const firstName = displayName ? String(displayName).split(" ")[0] : "";

  return (
    <Screen
      title={firstName ? `Hello, ${firstName}` : "Hello"}
      subtitle={config?.project?.name ?? "ComConnect participant app"}
    >
      <View
        style={{
          backgroundColor: "white",
          borderWidth: 1.5,
          borderColor: "#171717",
          borderRadius: 18,
          padding: 12,
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            fontWeight: "900",
            fontSize: 14,
            color: "#171717",
          }}
        >
          Connection: {connectionStatus.replaceAll("_", " ")}
        </Text>

        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontWeight: "900",
              fontSize: 14,
              color: "#171717",
            }}
          >
            Low data mode
          </Text>

          <Switch value={lowDataMode} onValueChange={setLowDataMode} />
        </View>
      </View>

      {cards
        .filter((card) => enabledModules.has(card.module))
        .map((card) => {
          const highlight = highlightForCard(card.screen, counts);

          return (
            <Card
              key={card.screen}
              title={card.title}
              subtitle={card.subtitle}
              highlight={highlight.highlight}
              highlightText={highlight.highlightText}
              onPress={() => navigate(card.screen)}
            />
          );
        })}

      <AppButton label="Logout" variant="secondary" onPress={logout} />
    </Screen>
  );
}