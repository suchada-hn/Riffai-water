"use client";
import { ChakraProvider } from "@chakra-ui/react";
import { theme } from "@/theme";
import { Toaster } from "react-hot-toast";
import AlertCenter from "@/components/alerts/AlertCenter";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
