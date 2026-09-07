import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const notoKhmer = localFont({
  src: [{ path: "../fonts/NotoSansKhmer.ttf", weight: "100 900", style: "normal" }],
  variable: "--font-body",
  display: "swap",
});

const moul = localFont({
  src: [{ path: "../fonts/Moul-Regular.ttf", weight: "400", style: "normal" }],
  variable: "--font-moul",
  display: "swap",
});

const battambang = localFont({
  src: [
    { path: "../fonts/Battambang-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/Battambang-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-battambang",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ថេរ — ប្រព័ន្ធតាមដានផ្ទាល់ខ្លួន",
  description:
    "តាមដានសកម្មភាពប្រចាំថ្ងៃ ចំណូល និងចំណាយ និងគោលដៅគ្រួសារក្នុងប្រព័ន្ធតែមួយ។",
  applicationName: "ថេរ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ថេរ",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/apple-touch-icon.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b6557" },
    { media: "(prefers-color-scheme: dark)", color: "#0b6557" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="km"
      className={`${notoKhmer.variable} ${moul.variable} ${battambang.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
