import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkedIn Outreach CRM",
  description: "Track every cofounder from first connection through follow-up and reply.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Spline+Sans:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
