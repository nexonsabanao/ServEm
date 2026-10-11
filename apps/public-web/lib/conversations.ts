import { randomUUID } from 'node:crypto';
import { feedServices, providerById } from './feed-data';
import {
  query,
  transact,
  type BookingRecord,
  type MessageRecord,
} from './store';

export type ConversationMessage = {
  id: string;
  sender: 'customer';
  body: string;
  createdAt: string;
};

export type Conversation = {
  bookingId: string;
  reference: string;
  serviceTitle: string;
  providerName: string;
  area?: string;
  status: 'requested' | 'cancelled';
  lastMessage: string;
  updatedAt: string;
  messages: ConversationMessage[];
};

function toConversation(
  booking: BookingRecord,
  records: MessageRecord[],
): Conversation {
  const service = feedServices.find((item) => item.id === booking.serviceId);
  const provider = service ? providerById.get(service.providerId) : undefined;
  const messages: ConversationMessage[] = [
    {
      id: `${booking.id}:request`,
      sender: 'customer',
      body: booking.message,
      createdAt: booking.createdAt,
    },
    ...records
      .filter((message) => message.bookingId === booking.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((message) => ({
        id: message.id,
        sender: message.senderRole,
        body: message.body,
        createdAt: message.createdAt,
      })),
  ];
  const latest = messages[messages.length - 1];

  return {
    bookingId: booking.id,
    reference: booking.reference,
    serviceTitle: booking.serviceTitle,
    providerName: provider?.name ?? 'Your ServMate',
    ...(booking.area ? { area: booking.area } : {}),
    status: booking.status,
    lastMessage: latest?.body ?? '',
    updatedAt: latest?.createdAt ?? booking.createdAt,
    messages,
  };
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  return query((database) =>
    database.bookings
      .filter((booking) => booking.userId === userId)
      .map((booking) => toConversation(booking, database.messages))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );
}

export async function getConversation(
  userId: string,
  bookingId: string,
): Promise<Conversation | null> {
  return query((database) => {
    const booking = database.bookings.find(
      (candidate) => candidate.id === bookingId && candidate.userId === userId,
    );
    return booking ? toConversation(booking, database.messages) : null;
  });
}

export type SendMessageResult =
  | { ok: true; message: ConversationMessage }
  | { ok: false; error: 'not_found' | 'closed' };

/** Stores a customer message only in a conversation attached to their booking. */
export async function sendCustomerMessage(
  userId: string,
  bookingId: string,
  body: string,
): Promise<SendMessageResult> {
  const record: MessageRecord = {
    id: randomUUID(),
    bookingId,
    senderUserId: userId,
    senderRole: 'customer',
    body: body.trim(),
    createdAt: new Date().toISOString(),
  };

  return transact((database) => {
    const booking = database.bookings.find(
      (candidate) => candidate.id === bookingId && candidate.userId === userId,
    );
    if (!booking) return { ok: false as const, error: 'not_found' as const };
    if (booking.status === 'cancelled') {
      return { ok: false as const, error: 'closed' as const };
    }
    database.messages.push(record);
    return {
      ok: true as const,
      message: {
        id: record.id,
        sender: record.senderRole,
        body: record.body,
        createdAt: record.createdAt,
      },
    };
  });
}
