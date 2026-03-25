import { extendTheme, theme as baseTheme } from "@chakra-ui/react";

// Custom theme aligning with IBM-style brutalist monochrome + signal red
export const theme = extendTheme({
  colors: {
    black: "#000000",
    white: "#FFFFFF",
    red: {
      50: "#ffeaea",
      100: "#ffbdbd",
      200: "#ff9e9e",
      300: "#ff7f7f",
      400: "#ff4f4f",
      500: "#ff3333", // signal red
      600: "#e52828",
      700: "#cc1e1e",
      800: "#b21414",
      900: "#990a0a",
    },
  },
  fonts: {
    heading: `'IBM Plex Sans', ${baseTheme.fonts?.heading}`,
    body: `'IBM Plex Sans', ${baseTheme.fonts?.body}`,
    mono: `'IBM Plex Mono', ${baseTheme.fonts?.mono}`,
  },
  styles: {
    global: {
      "html, body": {
        bg: "white",
        color: "black",
        lineHeight: "1.45",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      },
      a: {
        color: "red.500",
        _hover: { textDecoration: "underline" },
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        rounded: "sm",
        fontWeight: "500",
        letterSpacing: "tight",
      },
      variants: {
        solid: {
          bg: "black",
          color: "white",
          _hover: { bg: "red.500" },
          _active: { bg: "red.600" },
        },
        outline: {
          border: "2px solid",
          borderColor: "black",
          color: "black",
          _hover: { bg: "black", color: "white" },
          _active: { bg: "red.500", borderColor: "red.500", color: "white" },
        },
      },
    },
  },
});
