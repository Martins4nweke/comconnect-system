import { useEffect, useState } from "react";
import { View } from "react-native";
import { AppProvider, useAppContext } from "./src/context/AppContext";
import type { NavigationState, ScreenName } from "./src/navigation/simpleNavigator";
import { LoginScreen } from "./src/screens/LoginScreen";
import { LoadingScreen } from "./src/screens/LoadingScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import MessagesScreen from "./src/screens/MessagesScreen";
import { MessageDetailScreen } from "./src/screens/MessageDetailScreen";
import { EducationScreen } from "./src/screens/EducationScreen";
import { QuestionnairesScreen } from "./src/screens/QuestionnairesScreen";
import { ConsentScreen } from "./src/screens/ConsentScreen";
import { HealthCheckinsScreen } from "./src/screens/HealthCheckinsScreen";
import { AppointmentsScreen } from "./src/screens/AppointmentsScreen";
import { ReferralsScreen } from "./src/screens/ReferralsScreen";
import { HelpScreen } from "./src/screens/HelpScreen";
import { ChatScreen } from "./src/screens/ChatScreen";
import { SyncStatusScreen } from "./src/screens/SyncStatusScreen";
import { AppButton } from "./src/components/AppButton";
import { useRegisterPushToken } from "./src/hooks/useRegisterPushToken";
import { theme } from "./src/theme";

function WithBackHome({
  children,
  onBackHome,
}: {
  children: React.ReactNode;
  onBackHome: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.softBg }}>
      <View style={{ flex: 1 }}>{children}</View>

      <View
        style={{
          paddingHorizontal: 14,
          paddingBottom: 14,
          paddingTop: 8,
          backgroundColor: theme.softBg,
        }}
      >
        <View style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
          <AppButton label="Back home" variant="secondary" onPress={onBackHome} />
        </View>
      </View>
    </View>
  );
}

function AppInner() {
  const { hydrated, token } = useAppContext();
  useRegisterPushToken();

  const [nav, setNav] = useState<NavigationState>({ screen: "login" });

  useEffect(() => {
    if (!hydrated) return;

    setNav((current) => {
      if (token && current.screen === "login") return { screen: "home" };
      if (!token) return { screen: "login" };
      return current;
    });
  }, [hydrated, token]);

  function navigate(screen: ScreenName, params?: Record<string, unknown>) {
    setNav({ screen, params });
  }

  function backHome() {
    navigate("home");
  }

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (!token || nav.screen === "login") {
    return <LoginScreen onLoggedIn={() => navigate("home")} />;
  }

  if (nav.screen === "home") {
    return <HomeScreen navigate={navigate} onLogout={() => navigate("login")} />;
  }

  if (nav.screen === "messages") {
  return (
    <WithBackHome onBackHome={backHome}>
      <MessagesScreen
        openMessage={(messageId) =>
          navigate("messageDetail", { messageId })
        }
      />
    </WithBackHome>
  );
}

  if (nav.screen === "messageDetail") {
    const messageId = String(nav.params?.messageId ?? "");

    return (
      <WithBackHome onBackHome={backHome}>
        <MessageDetailScreen messageId={messageId} />
      </WithBackHome>
    );
  }

  if (nav.screen === "education") {
    return (
      <WithBackHome onBackHome={backHome}>
        <EducationScreen />
      </WithBackHome>
    );
  }

  if (nav.screen === "questionnaires") {
    return (
      <WithBackHome onBackHome={backHome}>
        <QuestionnairesScreen />
      </WithBackHome>
    );
  }

  if (nav.screen === "consent") {
    return (
      <WithBackHome onBackHome={backHome}>
        <ConsentScreen />
      </WithBackHome>
    );
  }

  if (nav.screen === "health") {
    return (
      <WithBackHome onBackHome={backHome}>
        <HealthCheckinsScreen />
      </WithBackHome>
    );
  }

  if (nav.screen === "appointments") {
    return (
      <WithBackHome onBackHome={backHome}>
        <AppointmentsScreen />
      </WithBackHome>
    );
  }

  if (nav.screen === "referrals") {
    return (
      <WithBackHome onBackHome={backHome}>
        <ReferralsScreen />
      </WithBackHome>
    );
  }

  if (nav.screen === "help") {
    return (
      <WithBackHome onBackHome={backHome}>
        <HelpScreen />
      </WithBackHome>
    );
  }

  if (nav.screen === "chat") {
    return (
      <WithBackHome onBackHome={backHome}>
        <ChatScreen />
      </WithBackHome>
    );
  }

  if (nav.screen === "sync") {
    return (
      <WithBackHome onBackHome={backHome}>
        <SyncStatusScreen />
      </WithBackHome>
    );
  }

  return <HomeScreen navigate={navigate} onLogout={() => navigate("login")} />;
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}