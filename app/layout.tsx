import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MSTR mNAV Project Dashboard",
  description: "Daily mNAV dashboard for Strategy (MSTR) with data-prep scripts, CSV upload, and LLM analysis.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
