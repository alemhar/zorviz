import {
    Driver,
    DatabaseConnection,
    QueryResult,
    CompiledQuery,
    Dialect,
    SqliteAdapter,
    SqliteIntrospector,
    SqliteQueryCompiler,
} from 'kysely';
import { invoke } from '@tauri-apps/api/core';
import type { Database } from '@zorviz/db';

/**
 * Tauri SQLite Driver for Kysely
 * Bridges Kysely queries to Tauri's execute_sql command
 */
class TauriSqliteDriver implements Driver {
    async init(): Promise<void> {
        // No initialization needed - Tauri handles the connection
    }

    async acquireConnection(): Promise<DatabaseConnection> {
        return new TauriSqliteConnection();
    }

    async beginTransaction(connection: DatabaseConnection): Promise<void> {
        await connection.executeQuery({ sql: 'BEGIN', parameters: [] } as CompiledQuery);
    }

    async commitTransaction(connection: DatabaseConnection): Promise<void> {
        await connection.executeQuery({ sql: 'COMMIT', parameters: [] } as CompiledQuery);
    }

    async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
        await connection.executeQuery({ sql: 'ROLLBACK', parameters: [] } as CompiledQuery);
    }

    async releaseConnection(): Promise<void> {
        // No-op - Tauri manages the connection pool
    }

    async destroy(): Promise<void> {
        // No-op
    }
}

class TauriSqliteConnection implements DatabaseConnection {
    async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
        const { sql, parameters } = compiledQuery;

        try {
            const result = await invoke<unknown[]>('execute_sql', {
                sql,
                params: parameters as unknown[],
            });

            return {
                rows: result as R[],
            };
        } catch (error) {
            console.error('SQL Error:', error);
            throw error;
        }
    }

    async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
        throw new Error('Streaming not supported in Tauri SQLite');
    }
}

/**
 * Kysely Dialect for Tauri SQLite
 */
export class TauriSqliteDialect implements Dialect {
    createDriver(): Driver {
        return new TauriSqliteDriver();
    }

    createQueryCompiler(): SqliteQueryCompiler {
        return new SqliteQueryCompiler();
    }

    createAdapter(): SqliteAdapter {
        return new SqliteAdapter();
    }

    createIntrospector(db: any): SqliteIntrospector {
        return new SqliteIntrospector(db);
    }
}
