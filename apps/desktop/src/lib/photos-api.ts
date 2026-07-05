// Client for job-ticket photos + note threads (BACK-2-011, single-path HTTP API).
import { api, API_BASE } from "./api";

export interface PhotoNote {
    id: string;
    photo_id: string;
    author: string | null;
    note: string;
    created_at: number;
}

export interface Photo {
    id: string;
    order_id: string;
    path: string;
    created_by: string | null;
    created_at: number;
    notes: PhotoNote[];
}

export function photoUrl(photoId: string): string {
    return `${API_BASE}/api/photos/${photoId}`;
}

export function listPhotos(orderId: string): Promise<Photo[]> {
    return api.get<Photo[]>(`/api/orders/${orderId}/photos`);
}

export function uploadPhoto(orderId: string, dataBase64: string, ext = "jpg"): Promise<Photo> {
    return api.post<Photo>(`/api/orders/${orderId}/photos`, { data: dataBase64, ext });
}

export function addPhotoNote(photoId: string, note: string): Promise<PhotoNote> {
    return api.post<PhotoNote>(`/api/photos/${photoId}/notes`, { note });
}

export function deletePhoto(photoId: string): Promise<{ ok: boolean }> {
    return api.del<{ ok: boolean }>(`/api/photos/${photoId}`);
}

// Downscale a picked image to a JPEG data URL (longest edge <= maxEdge). Keeps the shop
// PC lean and LAN uploads fast; plenty sharp for repair documentation. Falls back to the
// original data URL if canvas processing fails.
export function downscaleImage(file: File, maxEdge = 1600, quality = 0.82): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("read failed"));
        reader.onload = () => {
            const src = reader.result as string;
            const img = new Image();
            img.onerror = () => resolve(src); // fall back to original
            img.onload = () => {
                try {
                    const { width, height } = img;
                    const scale = Math.min(1, maxEdge / Math.max(width, height));
                    const w = Math.round(width * scale);
                    const h = Math.round(height * scale);
                    const canvas = document.createElement("canvas");
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return resolve(src);
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL("image/jpeg", quality));
                } catch {
                    resolve(src);
                }
            };
            img.src = src;
        };
        reader.readAsDataURL(file);
    });
}
