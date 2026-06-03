export function participantDisplayName(participant: any) {
  const metadata = participant?.metadata ?? {};

  const fullName = `${participant?.first_name ?? ""} ${
    participant?.last_name ?? ""
  }`.trim();

  return (
    metadata.display_name ||
    fullName ||
    participant?.participant_code ||
    "Participant"
  );
}

export function personaliseMessage(text: string, participant: any) {
  const safeText = String(text ?? "");
  const metadata = participant?.metadata ?? {};
  const name = participantDisplayName(participant);
  const firstName = participant?.first_name || name.split(" ")[0] || "";
  const lastName = participant?.last_name || "";

  return safeText
    .replaceAll("{{name}}", name)
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{last_name}}", lastName)
    .replaceAll("{{participant_code}}", participant?.participant_code ?? "")
    .replaceAll("{{phone_number}}", participant?.phone_number ?? "")
    .replaceAll("{{preferred_channel}}", metadata.preferred_channel ?? "app")
    .replaceAll("{{preferred_language}}", participant?.preferred_language ?? "en")
    .replaceAll("{{language}}", participant?.preferred_language ?? "en");
}