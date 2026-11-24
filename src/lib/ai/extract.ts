import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { DOC_TYPES, type IsoDate } from '@/lib/engine';

// What we ask Claude to read off a document photo. These are only
// suggestions: a person confirms them, and the rules engine decides compliance.
export const Extraction = z.object({
  type: z.enum(DOC_TYPES).describe('Which DQ document this is.'),
  driverName: z.string().nullable().describe('Driver full name as "First Last".'),
  licenseNumber: z.string().nullable().describe("Driver's license / CDL number."),
  licenseState: z.string().nullable().describe('Two-letter state that issued the license.'),
  issued: z.string().nullable().describe(
    'YYYY-MM-DD. Medical certificate: exam date. CDL: issue date. Annual review: review date. ' +
      'MVR: report date. Clearinghouse: query date. Application: date signed.',
  ),
  expires: z.string().nullable().describe('YYYY-MM-DD expiration date, if the document has one.'),
  cdlClass: z.string().nullable().describe('License class letter (A, B or C).'),
  endorsements: z.array(z.string()).describe('Endorsement letters, e.g. ["H","N","T"]. Empty if none.'),
  restrictions: z.array(z.string()).describe('Restriction codes. Empty if none.'),
  examiner: z.string().nullable().describe("Medical examiner's printed name."),
  nrcme: z.string().nullable().describe('National Registry number exactly as written (digits only).'),
  waivers: z.array(z.string()).describe('Waivers, exemptions or SPE certificates noted. Empty if none.'),
  sigDriver: z.boolean().describe("The driver's signature is present."),
  sigReviewer: z.boolean().describe(
    'Medical certificate: the examiner signed. Annual review: the reviewer signed. Otherwise true.',
  ),
  notes: z.array(z.string()).describe(
    'Short notes on anything unreadable, ambiguous or wrong-looking. Empty if nothing.',
  ),
});
export type Extraction = z.infer<typeof Extraction>;

const SYSTEM = `You read photos of driver qualification (DQ) file documents for US trucking companies (49 CFR Part 391).
Extract exactly what is written on the document. Never guess or fill in a value that is not visible: use null, or an empty list.
Write every date as YYYY-MM-DD (US documents write dates as MM/DD/YYYY).
A signature counts only if there is handwriting on the signature line; a printed name is not a signature.
Ignore watermarks such as "SPECIMEN" or "COPY".
If a value is hard to read, give your best reading and say so in notes.`;

const client = new Anthropic();

export class ExtractionError extends Error {}

/** Reads one document photo (JPEG bytes) and returns the fields Claude found. */
export async function extractDocument(jpeg: ArrayBuffer, today: IsoDate): Promise<Extraction> {
  const response = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'medium', format: betaZodOutputFormat(Extraction) },
    // If the model declines, the API retries on a fallback model in the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from(jpeg).toString('base64') } },
          { type: 'text', text: `Today is ${today}. Extract the fields from this document.` },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new ExtractionError('The AI declined to read this document.');
  if (response.stop_reason === 'max_tokens') throw new ExtractionError('The AI ran out of room before finishing.');
  if (!response.parsed_output) throw new ExtractionError("The AI's answer didn't have the expected fields.");
  return response.parsed_output;
}
