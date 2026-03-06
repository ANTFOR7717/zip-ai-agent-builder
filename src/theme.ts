import { setTheme, type ThemeColors } from "mastracode/tui";

/**
 * Applies the custom theme for Zip Agent Builder using Mastra's TUI existing API.
 */
export function createTheme() {
    setTheme({
        accent: "#5572DA",
        border: "#3b4d9c",
        borderAccent: "#5572DA",
        borderMuted: "#2c3a78",
        success: "#10b981",
        error: "#ef4444",
        warning: "#f59e0b",
        muted: "#6b7280",
        dim: "#4b5563",
        text: "#f8fafc",
        thinkingText: "#cbd5e1",
        userMessageBg: "#1e293b",
        userMessageText: "#f8fafc",
        systemReminderBg: "#334155",
        toolPendingBg: "#1e293b",
        toolSuccessBg: "#166534",
        toolErrorBg: "#7f1d1d",
        toolBorderPending: "#5572DA",
        toolBorderSuccess: "#5572DA",
        toolBorderError: "#ef4444",
        toolTitle: "#5572DA",
        toolOutput: "#f8fafc",
        selectedBg: "#334155",
        overlayBg: "#111827",
        errorBg: "#7f1d1d",
        path: "#60a5fa",
        number: "#7dd3fc",
        function: "#93c5fd"
    } as ThemeColors);
}
