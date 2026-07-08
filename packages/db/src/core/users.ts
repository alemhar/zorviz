import type { ColumnType, Insertable, Selectable, Updateable } from 'kysely';
import type { Nullable } from './column-types';

// 'owner' is the business owner (highest privilege; primary user of the future online/remote
// dashboard). 'admin' is the on-site shop administrator. See D22.
export type UserRole = 'owner' | 'admin' | 'advisor' | 'mechanic';

export interface UsersTable {
    id: string;
    name: string;
    username: string;
    pin_hash: string;
    pin_salt: string;
    role: UserRole;
    email: Nullable<string>;
    is_active: ColumnType<number, number | undefined, number>; // 1 = active, 0 = deactivated
    created_at: number;
    updated_at: number;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;
