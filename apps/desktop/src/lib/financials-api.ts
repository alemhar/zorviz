import { api } from "./api";

// BACK-3-010/011: expenses log + cash-drawer sessions.

export interface Expense {
    id: string;
    category: string; // 'parts' | 'salary' | 'utilities' | 'rent' | 'misc'
    amount: number; // centavos
    note: string | null;
    paid_from_drawer: number; // 1 = cash out of the drawer
    author: string | null;
    voided: number;
    voided_by: string | null;
    created_at: number;
    updated_at: number;
}

export const EXPENSE_CATEGORIES = [
    { key: "parts", label: "Parts purchase" },
    { key: "salary", label: "Salary / wages" },
    { key: "utilities", label: "Utilities" },
    { key: "rent", label: "Rent" },
    { key: "misc", label: "Miscellaneous" },
] as const;

export function listExpenses(): Promise<Expense[]> {
    return api.get<Expense[]>("/api/expenses");
}

export function createExpense(input: {
    category: string;
    amount: number; // centavos
    note?: string | null;
    paid_from_drawer: boolean;
}): Promise<Expense> {
    return api.post<Expense>("/api/expenses", input);
}

export function voidExpense(id: string): Promise<Expense> {
    return api.post<Expense>(`/api/expenses/${id}/void`);
}

export interface DrawerSession {
    id: string;
    opening_float: number; // centavos
    expected_cash: number | null;
    counted_cash: number | null;
    over_short: number | null; // negative = short
    opened_by: string | null;
    closed_by: string | null;
    opened_at: number;
    closed_at: number | null;
    created_at: number;
    updated_at: number;
}

export function drawerStatus(): Promise<{ open: DrawerSession | null; last_closed: DrawerSession | null }> {
    return api.get("/api/drawer");
}

export function openDrawer(openingFloat: number): Promise<DrawerSession> {
    return api.post<DrawerSession>("/api/drawer/open", { opening_float: openingFloat });
}

export function closeDrawer(countedCash: number): Promise<DrawerSession> {
    return api.post<DrawerSession>("/api/drawer/close", { counted_cash: countedCash });
}
