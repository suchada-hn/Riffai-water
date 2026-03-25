import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { ChakraProvider } from "@chakra-ui/react";
import { theme } from "@/theme";
import AlertCenter from "@/components/alerts/AlertCenter";
import "./globals.css";

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
    <html lang="th">
      <body className="font-sans">
        <ChakraProvider theme={theme}>
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
        </ChakraProvider>
      </body>
    </html>
  );
}
