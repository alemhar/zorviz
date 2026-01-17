import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { Wifi } from "lucide-react";

export function ServerStatus() {
    const [serverUrl, setServerUrl] = useState<string | null>(null);

    useEffect(() => {
        invoke<string | null>("get_server_url").then((url) => {
            if (url) setServerUrl(url);
        });
    }, []);

    if (!serverUrl) return null;

    return (
        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-xs font-medium border border-green-500/20">
            <Wifi className="w-3 h-3" />
            <span>LAN Online: {serverUrl}</span>
        </div>
    );
}
