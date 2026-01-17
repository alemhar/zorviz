import { ThemeProvider, ThemeSwitcher, Button } from "@zorviz/ui";
import "@zorviz/ui/src/styles.css";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";

function App() {
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  useEffect(() => {
    invoke<string | null>("get_server_url").then((url) => {
      if (url) setServerUrl(url);
    });
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="min-h-screen bg-background text-foreground p-8 flex flex-col items-center justify-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Zorviz Desktop</h1>
          <p className="text-muted-foreground">Hybrid Repair Shop System</p>
          {serverUrl && (
            <div className="mt-2 p-2 bg-green-500/10 text-green-600 rounded-md font-mono text-sm border border-green-500/20">
              LAN Server Online: {serverUrl}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <Button>Create Job Order</Button>
          <Button variant="secondary">View Inventory</Button>
          <Button variant="outline">Settings</Button>
        </div>

        <div className="p-6 border rounded-xl bg-card">
          <ThemeSwitcher />
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
