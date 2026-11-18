import multer from 'multer';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { env } from '../config/env.js';

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const profileUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, done) => { fs.mkdir(env.uploadDir, { recursive: true }).then(() => done(null, env.uploadDir), error => done(error as Error, env.uploadDir)); },
    filename: (_req, file, done) => { const ext = file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype === 'image/png' ? 'png' : 'webp'; done(null, `avatar-${Date.now()}-${randomUUID()}.${ext}`); },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, done) => done(null, imageTypes.has(file.mimetype)),
});
