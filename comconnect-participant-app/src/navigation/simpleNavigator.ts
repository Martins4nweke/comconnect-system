export type ScreenName =
  | "login"
  | "home"
  | "messages"
  | "messageDetail"
  | "education"
  | "questionnaires"
  | "consent"
  | "health"
  | "appointments"
  | "referrals"
  | "help"
  | "chat"
  | "sync";

export type NavigationState = {
  screen: ScreenName;
  params?: Record<string, unknown>;
};
