import { create } from "zustand";

// BACK-2-025: dyslexia-friendly reading mode. Per-device (like the theme), persisted to
// localStorage, applied as a `.dyslexic` class on <html>. The font + spacing overrides live
// in dyslexia.css. Off by default; toggling back restores the standard look exactly.
const KEY = "zorviz.dyslexic";

function apply(on: boolean): void {
    if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dyslexic", on);
    }
}

const initial = typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1";
apply(initial); // apply immediately on first import so there's no flash on load

interface DyslexiaState {
    enabled: boolean;
    setEnabled: (v: boolean) => void;
}

export const useDyslexiaStore = create<DyslexiaState>((set) => ({
    enabled: initial,
    setEnabled: (v) => {
        try {
            localStorage.setItem(KEY, v ? "1" : "0");
        } catch { /* private mode / storage unavailable */ }
        apply(v);
        set({ enabled: v });
    },
}));
