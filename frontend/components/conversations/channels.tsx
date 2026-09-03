"use client";
import { createLucideIcon, Globe, Layers, MessageCircle, PhoneCall, Send, type LucideIcon } from "lucide-react";
import { titleCase } from "@/lib/utils";

// lucide-react 1.x dropped brand icons; recreate the two we need with the same stroke style.
export const InstagramIcon = createLucideIcon("Instagram", [
  ["rect", { width: "20", height: "20", x: "2", y: "2", rx: "5", ry: "5", key: "ig-rect" }],
  ["path", { d: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z", key: "ig-circle" }],
  ["line", { x1: "17.5", x2: "17.51", y1: "6.5", y2: "6.5", key: "ig-dot" }],
]);
export const FacebookIcon = createLucideIcon("Facebook", [["path", { d: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z", key: "fb" }]]);

export type Channel = "all" | "website" | "whatsapp" | "instagram" | "facebook" | "telegram" | "voice";

export const CHANNELS: { value: Channel; label: string; icon: LucideIcon }[] = [
  { value: "all", label: "All", icon: Layers },
  { value: "website", label: "Website", icon: Globe },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "instagram", label: "Instagram", icon: InstagramIcon },
  { value: "facebook", label: "Facebook", icon: FacebookIcon },
  { value: "telegram", label: "Telegram", icon: Send },
  { value: "voice", label: "Voice", icon: PhoneCall },
];

export function channelMeta(value: string) {
  return CHANNELS.find((c) => c.value === value) ?? { value: value as Channel, label: titleCase(value), icon: Layers };
}
