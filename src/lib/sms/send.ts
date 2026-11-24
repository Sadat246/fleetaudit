import 'server-only';

export interface SendResult {
  status: 'sent' | 'test' | 'failed';
  detail?: string;
  providerId?: string;
  /** The driver replied STOP earlier, so the carrier refused the text. */
  optedOut?: boolean;
}

/**
 * "live" once all three Twilio settings are present; until then "test", where
 * nothing is sent and the message is only logged.
 */
export function smsMode(): 'live' | 'test' {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID } = process.env;
  return TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_MESSAGING_SERVICE_SID ? 'live' : 'test';
}

/** Twilio's error for a number that replied STOP. */
const TWILIO_UNSUBSCRIBED = 21610;

export async function sendSms(to: string, body: string): Promise<SendResult> {
  if (smsMode() === 'test') {
    console.info(`[sms test mode] to ${to}: ${body}`);
    return { status: 'test', detail: 'Test mode: Twilio is not set up yet, so nothing was sent.' };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, Body: body, MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID! }),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; code?: number; message?: string };
    if (!res.ok) {
      return {
        status: 'failed',
        detail: json.message ?? `Twilio returned ${res.status}`,
        optedOut: json.code === TWILIO_UNSUBSCRIBED,
      };
    }
    return { status: 'sent', providerId: json.sid };
  } catch (err) {
    return { status: 'failed', detail: err instanceof Error ? err.message : 'Network error' };
  }
}
