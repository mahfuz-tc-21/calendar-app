import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { PrivateSpaceProvider } from "@/context/PrivateSpaceContext";
import { AutoUpdateProvider } from "@/components/AutoUpdateProvider";
import { ThemeProvider } from "@/context/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Calendar",
  description: "A secure, privacy-focused calendar and messaging app.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'system';
                  if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ToastProvider>
          <AuthProvider>
            <PrivateSpaceProvider>
              <ThemeProvider>
                <AutoUpdateProvider>
                  {children}
                </AutoUpdateProvider>
              </ThemeProvider>
            </PrivateSpaceProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
