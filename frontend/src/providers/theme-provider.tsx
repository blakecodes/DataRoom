import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};

interface ThemeProviderProps {
    children: ReactNode;
    darkModeClass?: string;
    defaultTheme?: Theme;
    storageKey?: string;
}

function getSystemTheme(): ResolvedTheme {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: Theme): ResolvedTheme {
    return theme === "system" ? getSystemTheme() : theme;
}

function readStoredTheme(storageKey: string, defaultTheme: Theme): Theme {
    if (typeof window === "undefined") return defaultTheme;

    const savedTheme = localStorage.getItem(storageKey);
    if (savedTheme === "light" || savedTheme === "dark") {
        return savedTheme;
    }

    return defaultTheme;
}

export const ThemeProvider = ({
    children,
    defaultTheme = "system",
    storageKey = "theme",
    darkModeClass = "dark-mode",
}: ThemeProviderProps) => {
    const [theme, setTheme] = useState<Theme>(() => readStoredTheme(storageKey, defaultTheme));
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(readStoredTheme(storageKey, defaultTheme)));

    useEffect(() => {
        const applyTheme = () => {
            const root = window.document.documentElement;
            const effective = resolveTheme(theme);

            root.classList.toggle(darkModeClass, effective === "dark");
            root.style.colorScheme = effective;

            if (theme === "system") {
                localStorage.removeItem(storageKey);
            } else {
                localStorage.setItem(storageKey, theme);
            }

            setResolvedTheme(effective);
        };

        applyTheme();

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => {
            if (theme === "system") {
                applyTheme();
            }
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [theme, darkModeClass, storageKey]);

    return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
};
