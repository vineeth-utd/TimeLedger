import { Geist } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/lib/themeScript";
import Nav from "@/components/Nav";
import AssistantWidget from "@/components/assistant/AssistantWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "TimeLedger",
  description: "Personal time tracking",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${geistSans.variable} min-h-full bg-background text-foreground font-sans`}>
        <Nav />
        <main>{children}</main>
        <AssistantWidget />
      </body>
    </html>
  );
}
