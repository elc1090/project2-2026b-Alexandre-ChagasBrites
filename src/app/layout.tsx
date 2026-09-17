import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";

const font = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400"
});

export const metadata: Metadata = {
  title: "Pixel Shmup",
  description: "Multiplayer Game with Firebase Realtime Database",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${font.variable}`}>
      <body>{children}</body>
    </html>
  );
}
