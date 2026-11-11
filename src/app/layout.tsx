import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter, Share_Tech_Mono } from "next/font/google";
import { cn } from "@/utils/utils";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { getServerLocale } from "@/lib/i18n/server-preference";

const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body" });
const headingFont = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-heading",
});

const SITE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

const SITE_TITLE = process.env.NEXT_PUBLIC_APP_TITLE?.trim() || "Tokyo Highway Dodge";
const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION?.trim() ||
  "A webcam-controlled car dodging game using fist gestures.";

export const metadata: Metadata = {
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d0e12",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLocale = await getServerLocale();

  return (
    <html
      lang={initialLocale}
      suppressHydrationWarning
      className={cn("h-full antialiased", bodyFont.variable, headingFont.variable)}
    >
      <body className="min-h-svh bg-[var(--background)] text-[var(--foreground)]">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
