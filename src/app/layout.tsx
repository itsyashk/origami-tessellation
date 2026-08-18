import type { Metadata, Viewport } from "next";
import { Nunito, Caveat } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Origami — crease pattern studio",
  description:
    "Design origami crease patterns and tessellations with live mathematical analysis.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // the canvas provides its own pinch zoom
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} ${caveat.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
