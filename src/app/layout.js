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
      <body className={`${geistSans.variable} min-h-full bg-gray-50 text-gray-900 font-sans`}>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
