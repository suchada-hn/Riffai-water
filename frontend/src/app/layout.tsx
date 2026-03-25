import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import AlertCenter from "@/components/alerts/AlertCenter";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "RIFFAI — AI-Powered Water Management System",
  description:
    "Advanced satellite imagery analysis and remote sensing for intelligent water resource management",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={cn("font-sans", geist.variable)}>
      <body className="font-sans">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#212529",
              color: "#ffffff",
              border: "1px solid #343a40",
              borderRadius: "2px",
              fontWeight: "500",
            },
            success: {
              iconTheme: {
                primary: "#212529",
                secondary: "#ffffff",
              },
            },
            error: {
              iconTheme: {
                primary: "#212529",
                secondary: "#ffffff",
              },
            },
          }}
        />
        <AlertCenter />
        {children}
      </body>
    </html>
  );
}
