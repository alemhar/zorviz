import type { OrderStatus } from "@zorviz/db";

const STYLES: Record<OrderStatus, { label: string; cls: string }> = {
    triage: { label: "Triage", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    estimate: { label: "Estimate", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    approved: { label: "Approved", cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
    in_progress: { label: "In Progress", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    done: { label: "Done", cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
    paid: { label: "Paid", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
    const s = STYLES[status] ?? STYLES.triage;
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
            {s.label}
        </span>
    );
}
