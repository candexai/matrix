import type { Metadata } from "next";
import { Ancizar_Serif, Cactus_Classical_Serif } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/lib/query";
import { APP_FULL_NAME, CANDEX_LOGO_SRC } from "@/lib/brand";

const ancizar = Ancizar_Serif({ subsets: ["latin"], variable: "--font-ancizar", display: "swap" });
const cactus = Cactus_Classical_Serif({ weight: "400", subsets: ["latin"], variable: "--font-cactus", display: "swap" });

export const metadata: Metadata = {
  title: { default: APP_FULL_NAME, template: `%s · ${APP_FULL_NAME}` },
  description: "Voice agents, CRM leads and conversations in one workspace.",
  icons: { icon: CANDEX_LOGO_SRC, apple: CANDEX_LOGO_SRC },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`light ${ancizar.variable} ${cactus.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(d?'dark':'light');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-svh antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
