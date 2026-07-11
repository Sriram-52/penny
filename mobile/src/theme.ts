import { useColorScheme } from "react-native";

export interface Theme {
  bg: string;
  card: string;
  inputBg: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentPressed: string;
  onAccent: string;
  danger: string;
  warn: string;
  credit: string;
  ripple: string;
}

const light: Theme = {
  bg: "#FAF7F2",
  card: "#FFFFFF",
  inputBg: "#FFFFFF",
  text: "#26190E",
  muted: "#7A6A58",
  border: "rgba(38, 25, 14, 0.10)",
  accent: "#B4602F",
  accentPressed: "#9A4F24",
  onAccent: "#FFFFFF",
  danger: "#B3402E",
  warn: "#C77D1D",
  credit: "#3E8E5A",
  ripple: "rgba(38, 25, 14, 0.08)",
};

const dark: Theme = {
  bg: "#171310",
  card: "#221B15",
  inputBg: "#2A221B",
  text: "#F4EDE4",
  muted: "#A79482",
  border: "rgba(244, 237, 228, 0.10)",
  accent: "#DF8A50",
  accentPressed: "#C4753F",
  onAccent: "#2A1608",
  danger: "#E06B57",
  warn: "#E0A249",
  credit: "#63B981",
  ripple: "rgba(244, 237, 228, 0.10)",
};

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
