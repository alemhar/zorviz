"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

type ColorTheme =
    | "zinc"
    | "red"
    | "orange"
    | "yellow"
    | "green"
    | "blue"
    | "purple"
    | "pink"
    | "brown"
    | "white"
    | "black"

interface ThemeColorContextType {
    color: ColorTheme
    setColor: (color: ColorTheme) => void
}

const ThemeColorContext = React.createContext<ThemeColorContextType>({
    color: "zinc",
    setColor: () => null,
})

export function useThemeColor() {
    return React.useContext(ThemeColorContext)
}

const COLOR_KEY = "zorviz.color"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
    // Persist the color choice per device (BACK-2-029) — it previously reset every restart.
    const [color, setColor] = React.useState<ColorTheme>(() => {
        try {
            return (localStorage.getItem(COLOR_KEY) as ColorTheme) || "zinc"
        } catch {
            return "zinc"
        }
    })

    // Inject data-theme attribute to body or root
    React.useEffect(() => {
        const root = document.documentElement
        // Remove all previous theme data attributes if needed, but here we replace value
        root.setAttribute("data-theme", color)
        try {
            localStorage.setItem(COLOR_KEY, color)
        } catch { /* storage unavailable */ }
    }, [color])

    return (
        <ThemeColorContext.Provider value={{ color, setColor }}>
            <NextThemesProvider {...props}>
                {children}
            </NextThemesProvider>
        </ThemeColorContext.Provider>
    )
}
