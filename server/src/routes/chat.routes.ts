import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { fail, ok } from '../utils/http.js';
import { publishToConversation, subscribe } from '../services/chat-events.js';
import { profileUpload } from '../middleware/profile-upload.js';
import { storage } from '../services/storage.service.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
const id = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || '' : value || '';
const messageInput = z.object({ body: z.string().trim().min(1).max(4000) });
const groupInput = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(500).optional().nullable(), participantIds: z.array(z.string()).max(49).default([]) });
const memberInput = z.object({ userId: z.string().min(1) });
const editWindowMs = 15 * 60 * 1000;
const recentSends = new Map<string, number[]>();

async function ensureCommunity(userId: string) {
  const room = await prisma.conversation.upsert({ where: { slug: 'rhyme-community' }, update: {}, create: { slug: 'rhyme-community', kind: 'COMMUNITY', name: 'Rhyme Community', description: 'A shared space for the Rhyme Training Institute community.', creatorId: userId } });
  const users = await prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
  await prisma.conversationMember.createMany({ data: users.map(user => ({ conversationId: room.id, userId: user.id, role: user.id === room.creatorId ? 'OWNER' as const : 'MEMBER' as const })), skipDuplicates: true });
  return room;
}

async function getMembership(conversationId: string, userId: string) {
  return prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
}

router.get('/stream', async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'ready' })}\n\n`);
  const remove = subscribe(req.auth!.userId, res);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
  req.on('close', () => { clearInterval(heartbeat); remove(); res.end(); });
});

router.get('/rooms', async (req, res) => {
  await ensureCommunity(req.auth!.userId);
  const rooms = await prisma.conversation.findMany({ where: { OR: [{ kind: 'COMMUNITY' }, { members: { some: { userId: req.auth!.userId } } }] }, include: { members: { where: { userId: req.auth!.userId }, select: { role: true, lastReadAt: true } }, _count: { select: { members: true } }, messages: { take: 1, orderBy: { createdAt: 'desc' }, include: { sender: { select: { profile: { select: { firstName: true, lastName: true, avatarUrl: true } }, role: true } } } } }, orderBy: { updatedAt: 'desc' } });
  const data = await Promise.all(rooms.map(async room => {
    const lastReadAt = room.members[0]?.lastReadAt;
    const unread = await prisma.chatMessage.count({ where: { conversationId: room.id, senderId: { not: req.auth!.userId }, ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}) } });
    return { id: room.id, kind: room.kind, name: room.name, description: room.description, imageUrl: room.imageUrl, updatedAt: room.updatedAt, memberCount: room._count.members, role: room.members[0]?.role || 'MEMBER', unread, lastMessage: room.messages[0] || null };
  }));
  ok(res, data);
});

router.post('/groups', async (req, res, next) => {
  try {
    const input = groupInput.parse(req.body);
    const participantIds = [...new Set(input.participantIds)].filter(userId => userId !== req.auth!.userId);
    const activeCount = await prisma.user.count({ where: { id: { in: participantIds }, status: 'ACTIVE' } });
    if (activeCount !== participantIds.length) return fail(res, 'One or more selected participants are unavailable', 'INVALID_PARTICIPANTS', 422);
    const conversation = await prisma.conversation.create({ data: { kind: 'GROUP', name: input.name, description: input.description || null, creatorId: req.auth!.userId, members: { create: [{ userId: req.auth!.userId, role: 'OWNER' }, ...participantIds.map(userId => ({ userId, role: 'MEMBER' as const }))] } }, include: { members: true } });
    if (participantIds.length) await prisma.notification.createMany({ data: participantIds.map(userId => ({ userId, conversationId: conversation.id, title: 'Added to a discussion group', body: `You were added to ${conversation.name}.` })) });
    await publishToConversation(conversation.id, { type: 'room', action: 'created' });
    ok(res, { id: conversation.id, name: conversation.name, kind: conversation.kind }, 201);
  } catch (error) { next(error); }
});

router.get('/people', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
  const people = await prisma.user.findMany({ where: { status: 'ACTIVE', id: { not: req.auth!.userId }, ...(search ? { OR: [{ email: { contains: search, mode: 'insensitive' as const } }, { profile: { is: { firstName: { contains: search, mode: 'insensitive' as const } } } }, { profile: { is: { lastName: { contains: search, mode: 'insensitive' as const } } } }] } : {}) }, take: 30, orderBy: { email: 'asc' }, select: { id: true, role: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } });
  ok(res, people);
});

router.get('/rooms/:roomId/messages', async (req, res) => {
  const roomId = id(req.params.roomId);
  const room = await prisma.conversation.findUnique({ where: { id: roomId }, select: { id: true, kind: true } });
  if (!room || (room.kind !== 'COMMUNITY' && !await getMembership(roomId, req.auth!.userId))) return fail(res, 'Conversation not found', 'NOT_FOUND', 404);
  const take = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
  const before = typeof req.query.before === 'string' ? new Date(req.query.before) : undefined;
  if (before && Number.isNaN(before.getTime())) return fail(res, 'Invalid message cursor', 'INVALID_CURSOR', 422);
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const [rows, membership] = await Promise.all([
    prisma.chatMessage.findMany({ where: { conversationId: roomId, ...(before ? { createdAt: { lt: before } } : {}), ...(search ? { body: { contains: search, mode: 'insensitive' } } : {}) }, take: take + 1, orderBy: { createdAt: 'desc' }, include: { sender: { select: { id: true, role: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } } } }),
    getMembership(roomId, req.auth!.userId),
  ]);
  if (!before && membership) await prisma.conversationMember.update({ where: { id: membership.id }, data: { lastReadAt: new Date() } });
  const hasMore = rows.length > take;
  const messages = rows.slice(0, take).reverse();
  ok(res, { messages, hasMore, nextCursor: hasMore ? messages[0]?.createdAt : null });
});

router.post('/rooms/:roomId/messages', async (req, res, next) => {
  try {
    const roomId = id(req.params.roomId);
    const input = messageInput.parse(req.body);
    const room = await prisma.conversation.findUnique({ where: { id: roomId }, select: { id: true, kind: true } });
    if (!room || (room.kind !== 'COMMUNITY' && !await getMembership(roomId, req.auth!.userId))) return fail(res, 'Conversation not found', 'NOT_FOUND', 404);
    const now = Date.now();
    const recent = (recentSends.get(req.auth!.userId) || []).filter(timestamp => now - timestamp < 60000);
    if (recent.length >= 20) return fail(res, 'You are sending messages too quickly. Try again shortly.', 'MESSAGE_RATE_LIMIT', 429);
    recent.push(now); recentSends.set(req.auth!.userId, recent);
    const [message, members] = await prisma.$transaction([
      prisma.chatMessage.create({ data: { conversationId: roomId, senderId: req.auth!.userId, body: input.body }, include: { sender: { select: { id: true, role: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } } } }),
      prisma.conversation.update({ where: { id: roomId }, data: { updatedAt: new Date() }, select: { members: { select: { userId: true } } } }),
    ]);
    const recipientIds = room.kind === 'COMMUNITY' ? (await prisma.user.findMany({ where: { status: 'ACTIVE', id: { not: req.auth!.userId } }, select: { id: true } })).map(user => user.id) : members.members.map(member => member.userId).filter(userId => userId !== req.auth!.userId);
    if (recipientIds.length) await prisma.notification.createMany({ data: recipientIds.map(userId => ({ userId, conversationId: roomId, title: `New message in ${room.kind === 'COMMUNITY' ? 'Rhyme Community' : 'a group'}`, body: room.kind === 'COMMUNITY' ? `${message.sender.profile?.firstName || 'A member'} posted in Rhyme Community.` : 'There is a new message in one of your groups.' })) });
    await publishToConversation(roomId, { type: 'message', message });
    ok(res, message, 201);
  } catch (error) { next(error); }
});

router.patch('/messages/:messageId', async (req, res, next) => {
  try {
    const { body } = messageInput.parse(req.body);
    const messageId = id(req.params.messageId);
    const message = await prisma.chatMessage.findUnique({ where: { id: messageId }, include: { conversation: { select: { kind: true } } } });
    if (!message || (message.senderId !== req.auth!.userId && req.auth!.role !== 'ADMIN') || (message.senderId === req.auth!.userId && (!await getMembership(message.conversationId, req.auth!.userId) || Date.now() - message.createdAt.getTime() > editWindowMs))) return fail(res, 'Message cannot be edited', 'FORBIDDEN', 403);
    const updated = await prisma.chatMessage.update({ where: { id: messageId }, data: { body, editedAt: new Date() }, include: { sender: { select: { id: true, role: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } } } });
    await publishToConversation(message.conversationId, { type: 'message-updated', message: updated });
    ok(res, updated);
  } catch (error) { next(error); }
});

router.delete('/messages/:messageId', async (req, res) => {
  const message = await prisma.chatMessage.findUnique({ where: { id: id(req.params.messageId) } });
  if (!message || (message.senderId !== req.auth!.userId && req.auth!.role !== 'ADMIN') || (message.senderId === req.auth!.userId && (!await getMembership(message.conversationId, req.auth!.userId) || Date.now() - message.createdAt.getTime() > editWindowMs))) return fail(res, 'Message cannot be deleted', 'FORBIDDEN', 403);
  const updated = await prisma.chatMessage.update({ where: { id: message.id }, data: { body: '[Message removed]', deletedAt: new Date() } });
  await publishToConversation(message.conversationId, { type: 'message-updated', message: updated });
  ok(res, updated);
});

router.patch('/rooms/:roomId', async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(500).nullable().optional() }).parse(req.body);
    const roomId = id(req.params.roomId);
    const member = await getMembership(roomId, req.auth!.userId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) return fail(res, 'Only group administrators can edit this group', 'FORBIDDEN', 403);
    const updated = await prisma.conversation.update({ where: { id: roomId, kind: 'GROUP' }, data: input });
    const recipients = await prisma.conversationMember.findMany({ where: { conversationId: roomId, userId: { not: req.auth!.userId } }, select: { userId: true } });
    if (recipients.length) await prisma.notification.createMany({ data: recipients.map(({ userId }) => ({ userId, conversationId: roomId, title: 'Group details updated', body: `${updated.name} has updated its group information.` })) });
    await publishToConversation(roomId, { type: 'room', action: 'updated', room: updated });
    ok(res, updated);
  } catch (error) { next(error); }
});

router.get('/rooms/:roomId/image/:filename', async (req, res) => {
  const roomId = id(req.params.roomId), filename = id(req.params.filename);
  const [room, membership] = await Promise.all([prisma.conversation.findUnique({ where: { id: roomId }, select: { kind: true, imageUrl: true } }), getMembership(roomId, req.auth!.userId)]);
  if (!room || room.kind !== 'GROUP' || !membership || path.basename(filename) !== filename || !room.imageUrl?.endsWith(`/${filename}`)) return fail(res, 'Group image not found', 'NOT_FOUND', 404);
  res.sendFile(path.resolve(env.uploadDir, filename), error => { if (error && !res.headersSent) fail(res, 'Group image not found', 'NOT_FOUND', 404); });
});

router.post('/rooms/:roomId/image', profileUpload.single('file'), async (req, res, next) => {
  try {
    const roomId = id(req.params.roomId);
    const member = await getMembership(roomId, req.auth!.userId);
    const room = await prisma.conversation.findUnique({ where: { id: roomId }, select: { kind: true, imageUrl: true } });
    if (!room || room.kind !== 'GROUP' || !member || !['OWNER', 'ADMIN'].includes(member.role)) { if (req.file) await fs.unlink(req.file.path).catch(() => {}); return fail(res, 'Only group administrators can change the group photo', 'FORBIDDEN', 403); }
    if (!req.file) return fail(res, 'Choose a JPG, PNG, or WebP image up to 5 MB', 'INVALID_IMAGE', 422);
    const bytes = await fs.readFile(req.file.path);
    const valid = (req.file.mimetype === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      || (req.file.mimetype === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      || (req.file.mimetype === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
    if (!valid) { await fs.unlink(req.file.path); return fail(res, 'The uploaded file is not a valid supported image', 'INVALID_IMAGE', 422); }
    const stored = await storage.save(req.file);
    const imageUrl = stored.url.startsWith('http') ? stored.url : `/api/chat/rooms/${roomId}/image/${path.basename(stored.url)}`;
    const updated = await prisma.conversation.update({ where: { id: roomId }, data: { imageUrl } });
    if (room.imageUrl) await storage.remove?.(room.imageUrl);
    await publishToConversation(roomId, { type: 'room', action: 'updated', room: updated });
    ok(res, updated);
  } catch (error) { next(error); }
});

router.post('/rooms/:roomId/members', async (req, res, next) => {
  try {
    const { userId } = memberInput.parse(req.body);
    const roomId = id(req.params.roomId);
    const member = await getMembership(roomId, req.auth!.userId);
    const room = await prisma.conversation.findUnique({ where: { id: roomId }, select: { kind: true, name: true } });
    if (!room || room.kind !== 'GROUP' || !member || !['OWNER', 'ADMIN'].includes(member.role)) return fail(res, 'Only group administrators can add members', 'FORBIDDEN', 403);
    const user = await prisma.user.findFirst({ where: { id: userId, status: 'ACTIVE' }, select: { id: true } });
    if (!user) return fail(res, 'User not found', 'NOT_FOUND', 404);
    await prisma.conversationMember.upsert({ where: { conversationId_userId: { conversationId: roomId, userId } }, update: {}, create: { conversationId: roomId, userId } });
    await prisma.notification.create({ data: { userId, conversationId: roomId, title: 'Added to a discussion group', body: `You were added to ${room.name}.` } });
    await publishToConversation(roomId, { type: 'membership', action: 'added', userId });
    ok(res, { message: 'Participant added' }, 201);
  } catch (error) { next(error); }
});

router.delete('/rooms/:roomId/members/:userId', async (req, res) => {
  const roomId = id(req.params.roomId), userId = id(req.params.userId);
  const room = await prisma.conversation.findUnique({ where: { id: roomId }, select: { kind: true, name: true } });
  const [actor, target] = await Promise.all([getMembership(roomId, req.auth!.userId), getMembership(roomId, userId)]);
  if (!room || room.kind !== 'GROUP' || !target || target.role === 'OWNER' || (userId !== req.auth!.userId && (!actor || !['OWNER', 'ADMIN'].includes(actor.role)))) return fail(res, 'You cannot remove this participant', 'FORBIDDEN', 403);
  await prisma.conversationMember.delete({ where: { id: target.id } });
  if (userId !== req.auth!.userId) await prisma.notification.create({ data: { userId, title: 'Removed from a discussion group', body: `You were removed from ${room.name}.` } });
  await publishToConversation(roomId, { type: 'membership', action: 'removed', userId });
  ok(res, { message: 'Participant removed' });
});

router.patch('/rooms/:roomId/members/:userId', async (req, res) => {
  const { role } = z.object({ role: z.enum(['ADMIN', 'MEMBER']) }).parse(req.body);
  const roomId = id(req.params.roomId), userId = id(req.params.userId);
  const [actor, target, room] = await Promise.all([getMembership(roomId, req.auth!.userId), getMembership(roomId, userId), prisma.conversation.findUnique({ where: { id: roomId }, select: { kind: true } })]);
  if (room?.kind !== 'GROUP' || !actor || actor.role !== 'OWNER' || !target || target.role === 'OWNER') return fail(res, 'Only the group owner can change member roles', 'FORBIDDEN', 403);
  await prisma.conversationMember.update({ where: { id: target.id }, data: { role } });
  await prisma.notification.create({ data: { userId, conversationId: roomId, title: 'Group role updated', body: `Your role in a discussion group is now ${role.toLowerCase()}.` } });
  await publishToConversation(roomId, { type: 'membership', action: 'role-changed', userId, role });
  ok(res, { message: 'Member role updated' });
});

router.get('/rooms/:roomId/members', async (req, res) => {
  const roomId = id(req.params.roomId);
  const room = await prisma.conversation.findUnique({ where: { id: roomId }, select: { kind: true } });
  if (!room || (room.kind !== 'COMMUNITY' && !await getMembership(roomId, req.auth!.userId))) return fail(res, 'Conversation not found', 'NOT_FOUND', 404);
  const members = await prisma.conversationMember.findMany({ where: { conversationId: roomId }, include: { user: { select: { id: true, role: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } } }, orderBy: { joinedAt: 'asc' } });
  ok(res, members);
});

export default router;
