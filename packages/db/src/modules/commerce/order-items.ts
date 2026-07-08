import type { ColumnType, Insertable, Selectable, Updateable } from 'kysely';
import type { Nullable } from '../../core/column-types';

export interface OrderItemsTable {
    id: string;
    order_id: string;
    type: 'service' | 'part';
    description: string;
    quantity: number;
    unit: Nullable<string>; // e.g. "pc", "set", "L", "hrs"
    unit_price: number; // centavos
    total: number; // centavos
    inventory_item_id: Nullable<string>; // set when a part is picked from inventory
    completed: ColumnType<number, number | undefined, number>; // 1 = done by mechanic
}

export type OrderItem = Selectable<OrderItemsTable>;
export type NewOrderItem = Insertable<OrderItemsTable>;
export type OrderItemUpdate = Updateable<OrderItemsTable>;
