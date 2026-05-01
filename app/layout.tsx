import type { Metadata } from "next";
import { AppNavigation } from "./components/AppNavigation";
import { FocusMusicProvider } from "./components/FocusMusicProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PanicBoard",
  description: "Last-minute deadline?"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <FocusMusicProvider>
          <AppNavigation />
          {children}
        </FocusMusicProvider>
      </body>
    </html>
  );
}
