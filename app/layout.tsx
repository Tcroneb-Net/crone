import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hostify AI Agent",
  description: "AI website/project generator with OpenRouter, project preview, zip export, and Supabase publishing."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
