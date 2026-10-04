import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "API-Eval — AI-Powered API Contract & Reliability Evaluator",
  description:
    "Detect contract violations, reliability issues, and hidden API risks before they reach production.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
