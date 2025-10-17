export interface Mailbox {
  id: number
  address: string
  created_at: string
}

export interface MessageSummary {
  id: number
  sender: string
  subject: string | null
  preview: string | null
  received_at: string
}

export interface MessageDetail extends MessageSummary {
  mailbox_id: number
  mailbox_address: string
  text_body: string | null
  html_body: string | null
  message_identifier: string | null
}

export interface SessionResponse {
  ok: boolean
  mailDomain: string | null
}

export interface MailboxListResponse {
  mailboxes: Mailbox[]
}

export interface MessageListResponse {
  mailbox: {
    id: number
    address: string
  }
  messages: MessageSummary[]
}

export interface MessageDetailResponse {
  message: MessageDetail
}
