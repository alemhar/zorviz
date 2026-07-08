import type { ColumnType } from 'kysely';

/**
 * A nullable column that is also optional on insert/update (may be omitted).
 * Select => T | null, Insert => T | null | undefined, Update => T | null.
 */
export type Nullable<T> = ColumnType<T | null, T | null | undefined, T | null>;

// Conventions shared by every table below:
// - MONEY columns are INTEGER minor units (centavos) — never decimals. Format for display with
//   the helpers in @zorviz/core (formatMoney).
// - TIMESTAMP columns are INTEGER milliseconds (Date.now()).
