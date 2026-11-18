import type { Response } from 'express';
import { prisma } from '../utils/prisma.js';

const clients = new Set<{ userId: string; response: Response }>();

export function subscribe(userId: string, response: Response) {
  const client = { userId, response };
  clients.add(client);
  return () => clients.delete(client);
}

export async function publishToConversation(conversationId: string, payload: Record<string, unknown>) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { kind: true, members: { select: { userId: true } } } });
  if (!conversation) return;
  const recipients = new Set(conversation.kind === 'COMMUNITY' ? (await prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } })).map(user => user.id) : conversation.members.map(member => member.userId));
  const event = `data: ${JSON.stringify({ conversationId, ...payload })}\n\n`;
  for (const client of clients) {
    if (!recipients.has(client.userId)) continue;
    try { client.response.write(event); } catch { clients.delete(client); }
  }
}
