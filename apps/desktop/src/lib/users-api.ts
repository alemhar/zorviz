import { api } from "./api";
import type { UserRole } from "@zorviz/db";

export interface StaffUser {
    id: string;
    name: string;
    username: string;
    role: UserRole;
    is_active?: number;
}

export function listUsers(role?: string): Promise<StaffUser[]> {
    return api.get<StaffUser[]>(`/api/users${role ? `?role=${encodeURIComponent(role)}` : ""}`);
}

export function listAllUsers(): Promise<StaffUser[]> {
    return api.get<StaffUser[]>("/api/users?all=1");
}

export function createUser(input: {
    name: string;
    username: string;
    role: string;
    pin: string;
}): Promise<StaffUser> {
    return api.post<StaffUser>("/api/users", input);
}

export function updateUser(
    id: string,
    input: { name?: string; role?: string; is_active?: number; pin?: string }
): Promise<StaffUser> {
    return api.put<StaffUser>(`/api/users/${id}`, input);
}
