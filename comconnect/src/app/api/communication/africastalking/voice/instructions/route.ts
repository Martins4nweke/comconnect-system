export async function POST() {
  const text =
    "Hello. This is a ComConnect reminder. Please open your ComConnect app, or wait for a research assistant to contact you. Goodbye.";

  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${text}</Say></Response>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
