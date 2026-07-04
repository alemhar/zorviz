import { api } from "./api";

export interface BackupInfo {
    name: string;
    size: number;
    modified: number;
}

export function listBackups(): Promise<{ dir: string; backups: BackupInfo[] }> {
    return api.get<{ dir: string; backups: BackupInfo[] }>("/api/backups");
}

export function backupNow(): Promise<{ name: string }> {
    return api.post<{ name: string }>("/api/backup");
}

export function restoreBackup(filename: string): Promise<{ restart_required: boolean }> {
    return api.post<{ restart_required: boolean }>("/api/restore", { filename });
}

export function setBackupDir(dir: string): Promise<{ ok: boolean }> {
    return api.post<{ ok: boolean }>("/api/backup-dir", { dir });
}
