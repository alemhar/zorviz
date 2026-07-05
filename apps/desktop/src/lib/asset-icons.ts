// Shared icon set for asset types (BACK-1-006). Icon keys are stored on asset_types.icon
// and resolved to a lucide component for display in settings, the create form, and detail.
import {
    Car,
    Smartphone,
    Package,
    Wrench,
    Laptop,
    Bike,
    Wind,
    Plug,
    Watch,
    Tv,
    type LucideIcon,
} from "lucide-react";

export const ASSET_ICONS: Record<string, LucideIcon> = {
    car: Car,
    smartphone: Smartphone,
    package: Package,
    wrench: Wrench,
    laptop: Laptop,
    bike: Bike,
    wind: Wind,
    plug: Plug,
    watch: Watch,
    tv: Tv,
};

export const ASSET_ICON_KEYS = Object.keys(ASSET_ICONS);

export function iconFor(key?: string | null): LucideIcon {
    return (key && ASSET_ICONS[key]) || Package;
}
