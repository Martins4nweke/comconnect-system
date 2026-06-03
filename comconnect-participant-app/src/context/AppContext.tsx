import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ParticipantConfig, SyncCache } from "../types";
import {
  getConfig,
  getSessionToken,
  getSyncCache,
  getLowDataMode,
  saveConfig,
  setLowDataMode as persistLowDataMode,
} from "../storage/localStore";
import { getMe } from "../api/participantAppApi";

type AnyRecord = Record<string, any>;

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;

  if (
    value &&
    typeof value === "object" &&
    Object.keys(value as Record<string, unknown>).length > 0
  ) {
    return [value];
  }

  return [];
}

type AppContextValue = {
  hydrated: boolean;
  token: string | null;
  config: ParticipantConfig | null;
  cache: SyncCache | null;
  lowDataMode: boolean;
  connectionStatus: "unchecked" | "online" | "offline" | "session_invalid";
  setToken: (token: string | null) => void;
  setConfig: (config: ParticipantConfig | null) => void;
  setCache: (cache: SyncCache | null) => void;
  setLowDataMode: (enabled: boolean) => Promise<void>;
  enabledModules: Set<string>;

  messages: any[];
  messageReplies: any[];
  messageEvents: any[];
  researchCare: AnyRecord;
  educationAssignments: any[];
  educationProgress: any[];
  questionnaireAssignments: any[];
  questionnaireResponses: any[];
  consentForms: any[];
  participantConsents: any[];
  observationTypes: any[];
  healthObservations: any[];
  appointments: any[];
  appointmentResponses: any[];
  referrals: any[];
  helpRequests: any[];
  chatThreads: any[];
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [config, setConfig] = useState<ParticipantConfig | null>(null);
  const [cache, setCache] = useState<SyncCache | null>(null);
  const [lowDataMode, setLowDataModeState] = useState(true);
  const [connectionStatus, setConnectionStatus] =
    useState<AppContextValue["connectionStatus"]>("unchecked");

  useEffect(() => {
    async function load() {
      try {
        const [storedToken, storedConfig, storedCache, lowData] = await Promise.all([
          getSessionToken(),
          getConfig(),
          getSyncCache(),
          getLowDataMode(),
        ]);

        setToken(storedToken);
        setConfig(storedConfig);
        setCache(storedCache);
        setLowDataModeState(lowData);

        if (storedToken) {
          try {
            const freshConfig = await getMe();
            await saveConfig(freshConfig);
            setConfig(freshConfig);
            setConnectionStatus("online");
          } catch (error: any) {
            const message = String(error?.message ?? "").toLowerCase();

            if (
              message.includes("session") ||
              message.includes("401") ||
              message.includes("unauthorized")
            ) {
              setConnectionStatus("session_invalid");
            } else {
              setConnectionStatus("offline");
            }
          }
        }
      } finally {
        setHydrated(true);
      }
    }

    load();
  }, []);

  const enabledModules = useMemo(() => {
    return new Set((config?.modules ?? []).filter((m) => m.enabled).map((m) => m.module_code));
  }, [config]);

  const syncedData = useMemo(() => {
    const anyCache = cache as any;
    return (anyCache?.data ?? anyCache ?? {}) as AnyRecord;
  }, [cache]);

  const researchCare = useMemo(() => {
    return (syncedData.research_care ?? {}) as AnyRecord;
  }, [syncedData]);

  async function setLowDataMode(enabled: boolean) {
    setLowDataModeState(enabled);
    await persistLowDataMode(enabled);
  }

  return (
    <AppContext.Provider
      value={{
        hydrated,
        token,
        config,
        cache,
        lowDataMode,
        connectionStatus,
        setToken,
        setConfig,
        setCache,
        setLowDataMode,
        enabledModules,

        messages: asArray(syncedData.messages),
        messageReplies: asArray(syncedData.message_replies),
        messageEvents: asArray(syncedData.message_events),

        researchCare,

        educationAssignments: asArray(
          researchCare.education_assignments?.length
            ? researchCare.education_assignments
            : syncedData.education_items
        ),

        educationProgress: asArray(
          researchCare.education_progress
        ),

        questionnaireAssignments: asArray(
          researchCare.questionnaire_assignments?.length
            ? researchCare.questionnaire_assignments
            : syncedData.questionnaires
        ),

        questionnaireResponses: asArray(
          researchCare.questionnaire_responses
        ),

        consentForms: asArray(
          researchCare.consent_forms?.length
            ? researchCare.consent_forms
            : syncedData.consent_forms
        ),

        participantConsents: asArray(
          researchCare.participant_consents
        ),

        observationTypes: asArray(
          researchCare.observation_types?.length
            ? researchCare.observation_types
            : syncedData.observation_types
        ),

        healthObservations: asArray(
          researchCare.health_observations
        ),

        appointments: asArray(
          researchCare.appointments?.length
            ? researchCare.appointments
            : syncedData.appointments
        ),

        appointmentResponses: asArray(
          researchCare.appointment_responses
        ),

        referrals: asArray(
          researchCare.referrals?.length
            ? researchCare.referrals
            : syncedData.referrals
        ),

        helpRequests: asArray(
          researchCare.help_requests
        ),

        chatThreads: asArray(
          researchCare.chat_threads?.length
            ? researchCare.chat_threads
            : syncedData.chat_updates
        ),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useAppContext must be used inside AppProvider");
  return value;
}