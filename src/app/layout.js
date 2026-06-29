import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

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
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
