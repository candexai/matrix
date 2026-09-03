export const INTEGRATION_DESCRIPTIONS: Record<string, string> = {
  zoho: "Sync your Leads module both ways: pull leads into My Leads and write collected answers back to empty fields.",
  hubspot: "Sync contacts and deals from HubSpot CRM into My Leads.",
  salesforce: "Pull Salesforce leads and push call outcomes back to Salesforce.",
  pipedrive: "Import Pipedrive persons and deals for outbound calling.",
  elevenlabs: "Conversational voice agents, outbound calling, batch calls and phone numbers.",
  twilio: "Bring your own Twilio numbers for outbound and inbound calls.",
  website: "Embed a chat and voice widget on your website.",
  whatsapp: "Let agents reply to leads on WhatsApp Business.",
  instagram: "Handle Instagram DMs with an AI agent.",
  facebook: "Reply to Messenger conversations with an AI agent.",
  telegram: "Run a Telegram bot backed by your voice agent’s brain.",
  email: "Send follow-up emails after calls and reply to inbound mail.",
  "google-calendar": "Let agents book meetings straight into Google Calendar.",
  calendly: "Offer Calendly booking links during calls.",
  slack: "Post call summaries and lead updates to Slack channels.",
};

export const CATEGORY_LABELS: Record<string, string> = {
  crm: "CRM",
  voice: "Voice",
  channels: "Channels",
  productivity: "Productivity",
};

export const CATEGORY_ORDER = ["crm", "voice", "channels", "productivity"] as const;
export type Category = (typeof CATEGORY_ORDER)[number];
