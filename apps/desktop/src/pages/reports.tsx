import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@zorviz/ui";
import { ArrowLeft, FileBarChart, ChevronRight } from "lucide-react";
import { REPORT_META, type ReportKey } from "./report-view";

// BACK-3-018: Reports index — each card opens the on-screen preview page,
// where the period is picked and the PDF is exported.
const ORDER: ReportKey[] = ["pnl", "vat", "senior", "mechanics", "payables", "receivables"];

export default function ReportsPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background">
            <header className="px-4 py-3 bg-card shadow-sm flex items-center gap-3">
                <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-lg hover:bg-muted" aria-label="Back to dashboard">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <FileBarChart className="w-5 h-5 text-primary" />
                <h1 className="text-lg font-bold">Reports</h1>
            </header>

            <main className="p-4 max-w-md mx-auto space-y-3">
                {ORDER.map((key) => {
                    const meta = REPORT_META[key];
                    return (
                        <Card key={key} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50" onClick={() => navigate(`/reports/${key}`)}>
                            <CardContent className="p-4 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-medium">{meta.title}</div>
                                    <div className="text-sm text-muted-foreground">{meta.desc}</div>
                                </div>
                                <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    );
                })}
            </main>
        </div>
    );
}
