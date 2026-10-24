import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin", "vietnamese"] });
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "Twogether — Our Little World", template: "%s · Twogether" },
  description: "Two hearts. One adventure. Learn English together in your own cozy shared home.",
  applicationName: "Twogether",
  appleWebApp: { capable: true, title: "TWOGETHER", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#fde4ee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} ${fredoka.variable} h-full antialiased`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
