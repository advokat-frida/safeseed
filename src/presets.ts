import type { FieldSchema } from "./generate.js";

export type SchemaPresetId =
  | "crm-contacts"
  | "marketing-attribution"
  | "hashed-audience"
  | "uk-contacts";

export interface SchemaPreset {
  id: SchemaPresetId;
  label: string;
  description: string;
  schema: readonly FieldSchema[];
}

/** Small, editable starting schemas for common sales and marketing fixture jobs. */
export const SCHEMA_PRESETS: readonly SchemaPreset[] = [
  {
    id: "crm-contacts",
    label: "CRM contacts",
    description: "Contact and account IDs, names, email, and a North American phone.",
    schema: [
      { name: "contact_id", type: "opaqueId" },
      { name: "first_name", type: "firstName" },
      { name: "last_name", type: "lastName" },
      { name: "email", type: "email" },
      { name: "phone", type: "phone" },
      { name: "account_id", type: "opaqueId" },
    ],
  },
  {
    id: "marketing-attribution",
    label: "Marketing attribution",
    description: "Event, cookie, campaign, landing URL, and hashed match keys.",
    schema: [
      { name: "event_id", type: "opaqueId" },
      { name: "cookie_id", type: "opaqueId" },
      { name: "campaign_id", type: "opaqueId" },
      { name: "landing_page_url", type: "marketingUrl" },
      { name: "email_sha256", type: "sha256Email" },
      { name: "phone_sha256", type: "sha256Phone" },
    ],
  },
  {
    id: "hashed-audience",
    label: "Hashed audience",
    description: "Audience and campaign IDs plus catalog-derived email and phone digests.",
    schema: [
      { name: "audience_member_id", type: "opaqueId" },
      { name: "email_sha256", type: "sha256Email" },
      { name: "phone_sha256", type: "sha256Phone" },
      { name: "campaign_id", type: "opaqueId" },
    ],
  },
  {
    id: "uk-contacts",
    label: "UK contacts",
    description: "Lead and account IDs, an obvious test name, reserved email, and an Ofcom drama mobile.",
    schema: [
      { name: "lead_id", type: "opaqueId" },
      { name: "full_name", type: "fullName" },
      { name: "email", type: "email" },
      { name: "phone_uk", type: "ukPhone" },
      { name: "account_id", type: "opaqueId" },
    ],
  },
] as const;

export function getSchemaPreset(id: string): SchemaPreset {
  const preset = SCHEMA_PRESETS.find((candidate) => candidate.id === id);
  if (preset === undefined) {
    throw new Error(`unknown schema preset "${id}"; expected one of: ${SCHEMA_PRESETS.map((p) => p.id).join(", ")}`);
  }
  return preset;
}

export function schemaFromPreset(id: string): FieldSchema[] {
  return getSchemaPreset(id).schema.map((field) => ({ ...field }));
}
