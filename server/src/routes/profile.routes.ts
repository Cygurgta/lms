import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { prisma } from '../utils/prisma.js';
import { ok, fail } from '../utils/http.js';
import { profileUpload } from '../middleware/profile-upload.js';
import { storage } from '../services/storage.service.js';
import { authorize } from '../middleware/auth.js';

const router = Router();
const routeId = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || '' : value || '';
const profilePatch = z.object({ firstName: z.string().trim().min(1).max(80).optional(), lastName: z.string().trim().min(1).max(80).optional(), phone: z.string().trim().max(32).nullable().optional(), bio: z.string().trim().max(500).nullable().optional(), themePreference: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional() }).strict();
const profileSelect = { id: true, email: true, role: true, status: true, createdAt: true, profile: true, learner: { include: { programme: true, currentYear: true, currentSemester: true, enrollments: { orderBy: { enrolledAt: 'desc' as const }, take: 1, select: { status: true } }, courseEnrollments: { where: { status: 'ACTIVE' as const }, include: { course: { select: { id: true, code: true, title: true } } } } } }, lecturer: { include: { courses: { where: { active: true }, select: { id: true, code: true, title: true } } } } };

router.get('/', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: profileSelect });
  if (!user) return fail(res, 'Profile not found', 'NOT_FOUND', 404);
  ok(res, user);
});

router.patch('/', async (req, res, next) => {
  try {
    const input = profilePatch.parse(req.body);
    const { themePreference, ...profileData } = input;
    const profile = await prisma.profile.upsert({ where: { userId: req.auth!.userId }, create: { userId: req.auth!.userId, firstName: profileData.firstName || 'Member', lastName: profileData.lastName || '', ...profileData }, update: profileData });
    if (themePreference) await prisma.profile.update({ where: { userId: req.auth!.userId }, data: { themePreference } });
    const updated = themePreference ? await prisma.profile.findUniqueOrThrow({ where: { userId: req.auth!.userId } }) : profile;
    ok(res, updated);
  } catch (error) { next(error); }
});

router.get('/avatar/:filename', async (req, res) => {
  const filename = req.params.filename;
  if (!/^avatar-\d+-[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(filename) || path.basename(filename) !== filename) return fail(res, 'Image not found', 'NOT_FOUND', 404);
  res.sendFile(path.resolve(env.uploadDir, filename), error => { if (error && !res.headersSent) fail(res, 'Image not found', 'NOT_FOUND', 404); });
});

router.post('/avatar', profileUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return fail(res, 'Choose a JPG, PNG, or WebP image up to 5 MB', 'INVALID_IMAGE', 422);
    const bytes = await fs.readFile(req.file.path);
    const valid = (req.file.mimetype === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      || (req.file.mimetype === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      || (req.file.mimetype === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
    if (!valid) { await fs.unlink(req.file.path); return fail(res, 'The uploaded file is not a valid supported image', 'INVALID_IMAGE', 422); }
    const stored = await storage.save(req.file);
    const avatarUrl = stored.url.startsWith('http') ? stored.url : `/api/profile/avatar/${path.basename(stored.url)}`;
    const previous = await prisma.profile.findUnique({ where: { userId: req.auth!.userId }, select: { avatarUrl: true } });
    const profile = await prisma.profile.upsert({ where: { userId: req.auth!.userId }, create: { userId: req.auth!.userId, firstName: 'Member', lastName: '', avatarUrl }, update: { avatarUrl } });
    if (previous?.avatarUrl) await storage.remove?.(previous.avatarUrl);
    ok(res, profile, 201);
  } catch (error) { next(error); }
});

router.delete('/avatar', async (req, res) => {
  const previous = await prisma.profile.findUnique({ where: { userId: req.auth!.userId }, select: { avatarUrl: true } });
  const profile = await prisma.profile.update({ where: { userId: req.auth!.userId }, data: { avatarUrl: null } });
  if (previous?.avatarUrl) await storage.remove?.(previous.avatarUrl);
  ok(res, profile);
});

router.get('/people/:id', async (req, res) => {
  const person = await prisma.user.findUnique({ where: { id: routeId(req.params.id) }, select: { id: true, role: true, createdAt: true, status: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true, bio: true } }, lecturer: { select: { staffNo: true, courses: { where: { active: true }, select: { code: true, title: true } } } }, learner: { select: { programme: { select: { name: true } }, courseEnrollments: { where: { status: 'ACTIVE' }, select: { course: { select: { code: true, title: true } } } } } } } });
  if (!person || person.status !== 'ACTIVE') return fail(res, 'Profile not found', 'NOT_FOUND', 404);
  const { status: _status, ...publicPerson } = person;
  ok(res, publicPerson);
});

router.get('/admin/users', authorize(Role.ADMIN), async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
  const users = await prisma.user.findMany({ where: search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { profile: { is: { firstName: { contains: search, mode: 'insensitive' } } } }, { profile: { is: { lastName: { contains: search, mode: 'insensitive' } } } }, { learner: { is: { registrationNo: { contains: search, mode: 'insensitive' } } } }] } : {}, orderBy: [{ role: 'asc' }, { email: 'asc' }], take: 100, select: { id: true, email: true, role: true, status: true, createdAt: true, profile: { select: { firstName: true, lastName: true, phone: true, avatarUrl: true } }, learner: { select: { registrationNo: true } } } });
  ok(res, users);
});

router.get('/admin/users/:id', authorize(Role.ADMIN), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: routeId(req.params.id) }, select: { id: true, email: true, role: true, status: true, createdAt: true, profile: true, learner: { select: { registrationNo: true, programme: { select: { name: true } }, currentYear: { select: { name: true } }, currentSemester: { select: { name: true } }, enrollments: { orderBy: { enrolledAt: 'desc' }, take: 1, select: { status: true } }, courseEnrollments: { where: { status: 'ACTIVE' }, select: { course: { select: { id: true, code: true, title: true } } } } } }, lecturer: { select: { staffNo: true, courses: { where: { active: true }, select: { id: true, code: true, title: true } } } } } });
  if (!user) return fail(res, 'User not found', 'NOT_FOUND', 404);
  ok(res, user);
});

router.patch('/admin/users/:id', authorize(Role.ADMIN), async (req, res, next) => {
  try {
    const input = profilePatch.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: routeId(req.params.id) }, select: { id: true } });
    if (!user) return fail(res, 'User not found', 'NOT_FOUND', 404);
    const { themePreference, ...profileData } = input;
    const profile = await prisma.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, firstName: profileData.firstName || 'Member', lastName: profileData.lastName || '', ...profileData }, update: profileData });
    const updated = themePreference ? await prisma.profile.update({ where: { userId: user.id }, data: { themePreference } }) : profile;
    ok(res, updated);
  } catch (error) { next(error); }
});

export default router;
