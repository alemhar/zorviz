"use client"

import { useThemeColor } from "./theme-provider"
import { Button } from "./ui/button"
import { cn } from "../lib/utils"
import { useTheme } from "next-themes"

// Each swatch previews ITS OWN theme color (BACK-2-029) — fixed values mirroring the
// [data-theme] --primary tokens in styles.css, independent of the active theme. (The old
// version painted every swatch with the live --primary and used runtime-built Tailwind
// classes that the compiler purged.)
const SWATCHES: Record<string, string> = {
  zinc: "hsl(240 5.9% 10%)",
  red: "hsl(0 72% 51%)",
  orange: "hsl(24 94% 53%)",
  yellow: "hsl(47 95% 56%)",
  green: "hsl(142 76% 36%)",
  blue: "hsl(221 83% 53%)",
  purple: "hsl(262 83% 58%)",
  pink: "hsl(320 70% 50%)",
  brown: "hsl(24 45% 40%)",
}

// Light/Dark plus two dyslexia-friendly tinted light modes (BACK-2-029): warm cream and a
// soft blue reduce glare/visual stress (Irlen-style). Token classes live in styles.css.
const MODES: { value: string; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "cream", label: "Tint Cream" },
  { value: "tint-blue", label: "Tint Blue" },
]

export function ThemeSwitcher() {
  const { color, setColor } = useThemeColor()
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-card text-card-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">Mode</h3>
        {MODES.map((m) => (
          <Button
            key={m.value}
            variant={theme === m.value ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme(m.value)}
          >
            {m.label}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Color Theme</h3>
        <div className="flex flex-wrap gap-2">
          {Object.keys(SWATCHES).map((c) => (
            <button
              key={c}
              type="button"
              className={cn(
                "w-8 h-8 rounded-full transition-shadow",
                color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-card"
              )}
              style={{ backgroundColor: SWATCHES[c] }}
              onClick={() => setColor(c as never)}
              title={c}
              aria-label={`${c} color theme`}
              aria-pressed={color === c}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
