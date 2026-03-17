import type { Metadata } from "next";
import "@tldraw/tldraw/tldraw.css";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Whiteboard Web",
  description: "Collaborative whiteboard MVP",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
