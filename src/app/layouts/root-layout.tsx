import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "./auth-context";
import type React from "react";
// Added import for React

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "SportLine",
  description: "Your one-stop shop for sport tools",
};

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
