import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

function getClient() {
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }
  return twilio(accountSid, authToken);
}

export async function sendSms(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!fromNumber) {
    return { success: false, error: "TWILIO_PHONE_NUMBER not set" };
  }

  try {
    const client = getClient();
    const message = await client.messages.create({
      body,
      from: fromNumber,
      to,
    });
    return { success: true, sid: message.sid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown Twilio error";
    return { success: false, error: msg };
  }
}
