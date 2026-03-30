export type Contact = {
  id: number;
  user_id: string;
  name: string;
  identifier: string;
  score: number;
  total_messages: number;
  sent_count: number;
  received_count: number;
  last_texted: string | null;
  has_birthday: boolean;
  birthday_date: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ReminderMethod = "sms" | "imessage";

export type Settings = {
  user_id: string;
  send_time: string;
  threshold: number;
  default_message: string;
  phone_number: string | null;
  reminder_method: ReminderMethod;
  onboarding_complete: boolean;
};

export type Reminder = {
  contactId: number;
  name: string;
  message: string;
};

export type TestReminderInfo = {
  phone: string;
  message: string;
  name: string;
};
