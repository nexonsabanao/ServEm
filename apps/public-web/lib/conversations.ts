import { randomUUID } from 'node:crypto';
import { bookingTitle } from './bookings';
import { feedService } from './servmate-profile';
import {
  query,
  transact,
  type BookingRecord,
  type BookingStatus,
  type Database,
  type MessageRecord,
} from './store';

export type ConversationMessage = {
  id: string;
  /** Which side of the counter wrote it. */
  sender: 'customer' | 'servmate';
  body: string;
  createdAt: string;
};

export type Conversation = {
  bookingId: string;
  reference: string;
  serviceTitle: string;
  providerName: string;
  area?: string;
  /** The booking's full status, so a thread never mislabels a live job. */
  status: BookingStatus;
  lastMessage: string;
  updatedAt: string;
  messages: ConversationMessage[];
};

function toConversation(
  database: Database,
  booking: BookingRecord,
  records: MessageRecord[],
): Conversation {
  const service = booking.serviceId ? feedService(database, booking.serviceId) : undefined;
  const providerName = service?.provider.name ?? 'Your ServMate';
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
    serviceTitle: bookingTitle(database, booking),
    providerName,
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
      .map((booking) => toConversation(database, booking, database.messages))
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
    return booking ? toConversation(database, booking, database.messages) : null;
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
