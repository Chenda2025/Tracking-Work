import type { Metadata, Viewport } from "next";
import { Battambang, Moul, Noto_Sans_Khmer } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const notoKhmer = Noto_Sans_Khmer({
  variable: "--font-body",
  subsets: ["khmer"],
  weight: ["400", "500", "600", "700"],
});

const moul = Moul({
  variable: "--font-moul",
  subsets: ["khmer"],
  weight: "400",
});

const battambang = Battambang({
  variable: "--font-battambang",
  subsets: ["khmer"],
  weight: ["400", "700"],
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
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
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
