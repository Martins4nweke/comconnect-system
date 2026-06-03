import crypto from "crypto";

const TOKEN_PREFIX = "ccpa";

function getSecret() {
  const secret = process.env.PARTICIPANT_APP_TOKEN_SECRET;
  if (!secret) {
    throw new Error("Missing PARTICIPANT_APP_TOKEN_SECRET");
  }
  return secret;
}

export function createParticipantSessionToken() {
  // Use hex instead of base64url so the token parts never contain underscores.
  const random = crypto.randomBytes(32).toString("hex");
  const issuedAt = Date.now().toString(36);

  const unsigned = `${TOKEN_PREFIX}_${issuedAt}_${random}`;

  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(unsigned)
    .digest("hex");

  return `${unsigned}_${signature}`;
}

export function hashParticipantSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function verifyParticipantSessionTokenShape(token: string) {
  const parts = token.split("_");

  if (parts.length !== 4) return false;
  if (parts[0] !== TOKEN_PREFIX) return false;

  const issuedAt = parts[1];
  const random = parts[2];
  const suppliedSignature = parts[3];

  if (!issuedAt || !random || !suppliedSignature) return false;

  // Hex random should be 64 characters from 32 bytes.
  if (!/^[a-f0-9]{64}$/i.test(random)) return false;

  // HMAC SHA-256 hex signature should be 64 characters.
  if (!/^[a-f0-9]{64}$/i.test(suppliedSignature)) return false;

  const unsigned = `${TOKEN_PREFIX}_${issuedAt}_${random}`;

  const expectedSignature = crypto
    .createHmac("sha256", getSecret())
    .update(unsigned)
    .digest("hex");

  const suppliedBuffer = Buffer.from(suppliedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (suppliedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}