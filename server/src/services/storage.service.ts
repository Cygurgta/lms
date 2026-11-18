import path from 'node:path'; import fs from 'node:fs/promises'; import { env } from '../config/env.js';
export interface StorageProvider { save(file: Express.Multer.File): Promise<{ url: string; name: string; mimeType: string; size: number }>; }
class LocalStorage implements StorageProvider { async save(file: Express.Multer.File) { await fs.mkdir(env.uploadDir, { recursive: true }); return { url: `/uploads/${file.filename}`, name: file.originalname, mimeType: file.mimetype, size: file.size }; } }
export const storage: StorageProvider = new LocalStorage(); // Replace with Cloudinary/S3/Supabase adapter without changing controllers.
