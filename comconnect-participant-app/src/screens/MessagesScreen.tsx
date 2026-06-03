import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { useAppContext } from "../context/AppContext";

function pickMessages(app: any) {
  const cache = app.cache as any;

  const fromContext = Array.isArray(app.messages) ? app.messages : [];

  const fromCacheMessages = Array.isArray(cache?.messages)
    ? cache.messages
    : [];

  const fromDataMessages = Array.isArray(cache?.data?.messages)
    ? cache.data.messages
    : [];

  if (fromContext.length > 0) return fromContext;
  if (fromCacheMessages.length > 0) return fromCacheMessages;
  if (fromDataMessages.length > 0) return fromDataMessages;

  return [];
}

function getMessageId(message: any) {
  return String(message.id ?? message.message_id ?? "");
}

export default function MessagesScreen({
  openMessage,
}: {
  openMessage?: (messageId: string) => void;
}) {
  const app = useAppContext();
  const messages = pickMessages(app);

  return (
    <Screen
  title="Messages"
  subtitle="Read and reply only."
>
      <Card
        title="Message sync check"
        subtitle={`Messages found: ${messages.length}`}
      />

      {messages.length === 0 ? (
        <Card
          title="No messages yet"
          subtitle="Pull sync to check for new messages."
        />
      ) : (
        messages.map((message: any, index: number) => {
          const messageId = getMessageId(message);

          return (
            <Card
              key={messageId || index}
              title={message.title ?? message.topic ?? "Message"}
              subtitle={
                message.body ??
                message.content ??
                message.text ??
                "Open to view message details."
              }
              tag={
  message.channel ??
  message.category ??
  "message"
}
              onPress={
                openMessage && messageId
                  ? () => openMessage(messageId)
                  : undefined
              }
            />
          );
        })
      )}
    </Screen>
  );
}