import { Globe, Mail, Send } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small, self-contained brand marks (no external images). Each renders a 40×40 tile. */
export function BrandIcon({ id, className }: { id: string; className?: string }) {
  const Icon = ICONS[id] ?? GenericIcon;
  return <Icon className={cn("size-10 shrink-0", className)} />;
}

type IconProps = { className?: string };

const tile = "flex items-center justify-center rounded-lg";

function ZohoIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "border border-border bg-white", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect x="5" y="6" width="22" height="5" rx="1.5" fill="#E42527" />
        <path d="M26 11 L11 21 H6 L21 11 Z" fill="#226DB4" />
        <rect x="5" y="21" width="22" height="5" rx="1.5" fill="#089949" />
        <circle cx="25.5" cy="23.5" r="2.5" fill="#F9B21D" />
      </svg>
    </div>
  );
}

function HubspotIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "bg-[#FF7A59]", className)}>
      <svg viewBox="0 0 32 32" className="size-6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
        <circle cx="19" cy="18" r="5.5" />
        <path d="M19 12.5V7.5" />
        <circle cx="19" cy="6" r="1.8" fill="#fff" stroke="none" />
        <path d="M14 15 8 10" />
        <circle cx="7" cy="9" r="1.8" fill="#fff" stroke="none" />
        <path d="M15.5 22 11 26.5" />
        <circle cx="10" cy="27.5" r="1.8" fill="#fff" stroke="none" />
      </svg>
    </div>
  );
}

function SalesforceIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "bg-[#00A1E0]", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <path d="M13 11a5 5 0 0 1 8.5-1.3A4.5 4.5 0 0 1 28 13.5 4.5 4.5 0 0 1 23.5 18H10a4 4 0 0 1-.6-8 4.5 4.5 0 0 1 3.6 1z" fill="#fff" />
      </svg>
    </div>
  );
}

function PipedriveIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "bg-[#017737] font-heading text-[22px] leading-none text-white", className)}>
      <span className="-mt-0.5">p</span>
    </div>
  );
}

function ElevenLabsIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "bg-black dark:bg-white", className)}>
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <rect x="9" y="7" width="4.5" height="18" rx="1" className="fill-white dark:fill-black" />
        <rect x="18.5" y="7" width="4.5" height="18" rx="1" className="fill-white dark:fill-black" />
      </svg>
    </div>
  );
}

function TwilioIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "bg-[#F22F46]", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <circle cx="16" cy="16" r="11" fill="none" stroke="#fff" strokeWidth="2.2" />
        <circle cx="12.5" cy="12.5" r="2.2" fill="#fff" />
        <circle cx="19.5" cy="12.5" r="2.2" fill="#fff" />
        <circle cx="12.5" cy="19.5" r="2.2" fill="#fff" />
        <circle cx="19.5" cy="19.5" r="2.2" fill="#fff" />
      </svg>
    </div>
  );
}

function WebsiteIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "bg-slate-700", className)}>
      <Globe className="size-5 text-white" strokeWidth={1.8} />
    </div>
  );
}

function WhatsappIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "bg-[#25D366]", className)}>
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <path d="M16 5a11 11 0 0 0-9.4 16.7L5 27l5.5-1.5A11 11 0 1 0 16 5z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M12 11.5c0 4.5 4 8.5 8.5 8.5l1.5-2-2.5-1.5-1.2 1.2a6 6 0 0 1-3.5-3.5l1.2-1.2L14.5 10z" fill="#fff" />
      </svg>
    </div>
  );
}

function InstagramIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "bg-[linear-gradient(135deg,#F9CE34_0%,#EE2A7B_50%,#6228D7_100%)]", className)}>
      <svg viewBox="0 0 32 32" className="size-6" fill="none" stroke="#fff" strokeWidth="2.2" aria-hidden>
        <rect x="7" y="7" width="18" height="18" rx="5" />
        <circle cx="16" cy="16" r="4.2" />
        <circle cx="21.5" cy="10.5" r="1.2" fill="#fff" stroke="none" />
      </svg>
    </div>
  );
}

function FacebookIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "bg-[#1877F2]", className)}>
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <path d="M18.5 27v-8.5h3l.5-3.8h-3.5v-2.4c0-1.1.3-1.9 1.9-1.9H22V7.1c-.4 0-1.6-.2-3-.2-3 0-5 1.8-5 5.2v2.6h-3.3v3.8H14V27z" fill="#fff" />
      </svg>
    </div>
  );
}

function TelegramIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "bg-[#29A9EB]", className)}>
      <Send className="-ml-0.5 size-5 text-white" strokeWidth={2} />
    </div>
  );
}

function EmailIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "bg-zinc-600", className)}>
      <Mail className="size-5 text-white" strokeWidth={1.8} />
    </div>
  );
}

function GoogleCalendarIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "border border-border bg-white", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect x="6" y="6" width="20" height="20" rx="3" fill="#fff" stroke="#4285F4" strokeWidth="2" />
        <rect x="6" y="6" width="20" height="6" rx="2" fill="#4285F4" />
        <rect x="6" y="20" width="6" height="6" fill="#34A853" />
        <rect x="20" y="20" width="6" height="6" fill="#FBBC05" />
        <rect x="6" y="12" width="6" height="8" fill="#EA4335" opacity=".85" />
        <text x="16" y="21.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#4285F4" fontFamily="ui-sans-serif, system-ui">
          31
        </text>
      </svg>
    </div>
  );
}

function CalendlyIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "bg-[#006BFF]", className)}>
      <svg viewBox="0 0 32 32" className="size-6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
        <path d="M22.5 11.5A8 8 0 1 0 22.5 20.5" />
        <path d="M19 13.5a4 4 0 1 0 0 5" />
      </svg>
    </div>
  );
}

function SlackIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "border border-border bg-white", className)}>
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <rect x="6" y="13.5" width="14" height="5" rx="2.5" fill="#36C5F0" />
        <rect x="13.5" y="6" width="5" height="14" rx="2.5" fill="#2EB67D" />
        <rect x="12" y="13.5" width="14" height="5" rx="2.5" fill="#ECB22E" />
        <rect x="13.5" y="12" width="5" height="14" rx="2.5" fill="#E01E5A" />
      </svg>
    </div>
  );
}

function GenericIcon({ className }: IconProps) {
  return (
    <div className={cn(tile, "bg-muted", className)}>
      <Globe className="size-5 text-muted-foreground" strokeWidth={1.8} />
    </div>
  );
}

const ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  zoho: ZohoIcon,
  hubspot: HubspotIcon,
  salesforce: SalesforceIcon,
  pipedrive: PipedriveIcon,
  elevenlabs: ElevenLabsIcon,
  twilio: TwilioIcon,
  website: WebsiteIcon,
  whatsapp: WhatsappIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  telegram: TelegramIcon,
  email: EmailIcon,
  "google-calendar": GoogleCalendarIcon,
  calendly: CalendlyIcon,
  slack: SlackIcon,
};
