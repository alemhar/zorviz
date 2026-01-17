import { ThemeProvider, ThemeSwitcher, Button } from "@zorviz/ui";
import "@zorviz/ui/src/styles.css";

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="min-h-screen bg-background text-foreground p-8 flex flex-col items-center justify-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Zorviz Desktop</h1>
          <p className="text-muted-foreground">Hybrid Repair Shop System</p>
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
