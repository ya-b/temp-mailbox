<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import LoginPanel from '../components/LoginPanel.vue'
import MailboxSidebar from '../components/MailboxSidebar.vue'
import MessagesPanel from '../components/MessagesPanel.vue'
import type {
  Mailbox,
  MailboxListResponse,
  MessageDetail,
  MessageDetailResponse,
  MessageListResponse,
  MessageSummary,
  SessionResponse,
} from '../types/mail'

const { t } = useI18n()

const LOCAL_STORAGE_KEY = 'temp-mail-token'

const loginToken = ref('')
const authToken = ref<string>(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '')
const mailDomain = ref<string | null>(null)

const loginError = ref('')
const mailboxError = ref('')
const createError = ref('')
const messagesError = ref('')

const mailboxes = ref<Mailbox[]>([])
const mailboxAddress = ref('')
const currentMailbox = ref<Mailbox | null>(null)
const messages = ref<MessageSummary[]>([])

const expandedMessageId = ref<number | null>(null)
const messageDetails = ref<Record<number, MessageDetail>>({})
const detailLoadingId = ref<number | null>(null)

const isLoadingMailboxes = ref(false)
const isCreatingMailbox = ref(false)
const isLoggingIn = ref(false)
const isLoadingMessages = ref(false)

const isAuthenticated = computed(() => Boolean(authToken.value))
const domainHint = computed(() => mailDomain.value ?? '')

function setAuthToken(token: string) {
  authToken.value = token
  if (token) {
    localStorage.setItem(LOCAL_STORAGE_KEY, token)
  } else {
    localStorage.removeItem(LOCAL_STORAGE_KEY)
    mailDomain.value = null
  }
}

async function verifyToken(token: string): Promise<boolean> {
  if (!token) {
    return false
  }
  try {
    const headers = new Headers()
    headers.set('Authorization', 'Bearer ' + token)
    headers.set('Content-Type', 'application/json')
    const response = await fetch('/api/session', { headers })
    if (response.status === 401 || !response.ok) {
      mailDomain.value = null
      return false
    }
    const data = (await response.json()) as SessionResponse
    mailDomain.value = data.mailDomain ?? null
    return Boolean(data.ok)
  } catch {
    mailDomain.value = null
    return false
  }
}

function formatDate(input: string | null | undefined): string {
  if (!input) {
    return ''
  }
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) {
    return input
  }
  return parsed.toLocaleString()
}

function resetMessageState() {
  messages.value = []
  messagesError.value = ''
  expandedMessageId.value = null
  detailLoadingId.value = null
  messageDetails.value = {}
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (authToken.value) {
    headers.set('Authorization', 'Bearer ' + authToken.value)
  }
  headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...options, headers })
  if (response.status === 401) {
    throw new Error(t('common.auth_failed'))
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || t('common.request_failed'))
  }
  return response.json() as Promise<T>
}

async function loadMailboxes() {
  isLoadingMailboxes.value = true
  mailboxError.value = ''
  try {
    const data = await apiFetch<MailboxListResponse>('/api/mailboxes')
    const activeId = currentMailbox.value?.id ?? null
    mailboxes.value = (data.mailboxes ?? []).map((mailbox) => ({
      id: Number(mailbox.id),
      address: mailbox.address,
      created_at: mailbox.created_at,
    }))
    if (activeId !== null) {
      const match = mailboxes.value.find((item) => item.id === activeId) || null
      if (match) {
        currentMailbox.value = match
      } else {
        currentMailbox.value = null
        resetMessageState()
      }
    }
  } catch (error) {
    mailboxError.value = (error as Error).message
    mailboxes.value = []
  } finally {
    isLoadingMailboxes.value = false
  }
}

async function loadMessagesForMailbox(mailbox: Mailbox) {
  isLoadingMessages.value = true
  messagesError.value = ''
  expandedMessageId.value = null
  detailLoadingId.value = null
  try {
    const data = await apiFetch<MessageListResponse>(`/api/mailboxes/${mailbox.id}/messages`)
    currentMailbox.value = {
      ...mailbox,
      address: data.mailbox.address,
    }
    messages.value = (data.messages ?? []).map((message) => ({
      id: Number(message.id),
      sender: message.sender,
      subject: message.subject ?? null,
      preview: message.preview ?? '',
      received_at: message.received_at,
    }))
    messageDetails.value = {}
  } catch (error) {
    messagesError.value = (error as Error).message
    messages.value = []
  } finally {
    isLoadingMessages.value = false
  }
}

async function handleLogin() {
  loginError.value = ''
  const token = loginToken.value.trim()
  if (!token) {
    return
  }
  isLoggingIn.value = true
  try {
    const valid = await verifyToken(token)
    if (valid) {
      setAuthToken(token)
      loginToken.value = ''
      await loadMailboxes()
    } else {
      loginError.value = t('login.invalid_token')
    }
  } finally {
    isLoggingIn.value = false
  }
}

function handleLogout() {
  setAuthToken('')
  mailboxes.value = []
  currentMailbox.value = null
  resetMessageState()
  loginError.value = ''
}

async function handleCreateMailbox() {
  createError.value = ''
  const address = mailboxAddress.value.trim()
  if (!address) {
    return
  }
  isCreatingMailbox.value = true
  try {
    await apiFetch('/api/mailboxes', {
      method: 'POST',
      body: JSON.stringify({ address }),
    })
    mailboxAddress.value = ''
    await loadMailboxes()
  } catch (error) {
    createError.value = (error as Error).message
  } finally {
    isCreatingMailbox.value = false
  }
}

async function handleSelectMailbox(mailbox: Mailbox) {
  await loadMessagesForMailbox(mailbox)
}

async function handleDeleteMailbox(mailbox: Mailbox) {
  if (!window.confirm(t('common.confirm_delete_mailbox'))) {
    return
  }
  try {
    await apiFetch(`/api/mailboxes/${mailbox.id}`, { method: 'DELETE' })
    if (currentMailbox.value?.id === mailbox.id) {
      currentMailbox.value = null
      resetMessageState()
    }
    await loadMailboxes()
  } catch (error) {
    window.alert((error as Error).message)
  }
}

async function handleToggleMessageDetail(message: MessageSummary) {
  if (detailLoadingId.value && detailLoadingId.value !== message.id) {
    return
  }
  if (expandedMessageId.value === message.id) {
    expandedMessageId.value = null
    return
  }
  expandedMessageId.value = message.id
  if (messageDetails.value[message.id]) {
    return
  }
  detailLoadingId.value = message.id
  try {
    const data = await apiFetch<MessageDetailResponse>(`/api/messages/${message.id}`)
    const detail = data.message
    messageDetails.value = {
      ...messageDetails.value,
      [message.id]: {
        ...detail,
        id: Number(detail.id),
        mailbox_id: Number(detail.mailbox_id),
        subject: detail.subject ?? null,
        preview: detail.preview ?? '',
        text_body: detail.text_body ?? null,
        html_body: detail.html_body ?? null,
        message_identifier: detail.message_identifier ?? null,
      },
    }
  } catch (error) {
    expandedMessageId.value = null
    window.alert((error as Error).message)
  } finally {
    detailLoadingId.value = null
  }
}

async function handleDeleteMessage(message: MessageSummary) {
  if (!currentMailbox.value) {
    return
  }
  if (!window.confirm(t('common.confirm_delete_message'))) {
    return
  }
  try {
    await apiFetch(`/api/messages/${message.id}`, { method: 'DELETE' })
    await loadMessagesForMailbox(currentMailbox.value)
  } catch (error) {
    window.alert((error as Error).message)
  }
}

async function handleRefreshMessages() {
  if (!currentMailbox.value) {
    return
  }
  await loadMessagesForMailbox(currentMailbox.value)
}

function handleCloseMessages() {
  currentMailbox.value = null
  resetMessageState()
}

onMounted(async () => {
  if (authToken.value) {
    const valid = await verifyToken(authToken.value)
    if (valid) {
      await loadMailboxes()
    } else {
      setAuthToken('')
    }
  }
})
</script>

<template>
  <LoginPanel
    v-if="!isAuthenticated"
    :token="loginToken"
    :is-logging-in="isLoggingIn"
    :login-error="loginError"
    @update:token="loginToken = $event"
    @submit="handleLogin"
  />
  <div v-else id="app-container" class="app-container">
    <MailboxSidebar
      :mailboxes="mailboxes"
      :current-mailbox-id="currentMailbox?.id ?? null"
      :is-loading-mailboxes="isLoadingMailboxes"
      :mailbox-error="mailboxError"
      :mailbox-address="mailboxAddress"
      :is-creating-mailbox="isCreatingMailbox"
      :create-error="createError"
      :domain-hint="domainHint"
      :format-date="formatDate"
      @update:mailboxAddress="mailboxAddress = $event"
      @create="handleCreateMailbox"
      @select="handleSelectMailbox"
      @delete="handleDeleteMailbox"
      @logout="handleLogout"
    />
    <MessagesPanel
      :current-mailbox="currentMailbox"
      :messages="messages"
      :is-loading-messages="isLoadingMessages"
      :messages-error="messagesError"
      :expanded-message-id="expandedMessageId"
      :detail-loading-id="detailLoadingId"
      :message-details="messageDetails"
      :format-date="formatDate"
      @refresh="handleRefreshMessages"
      @close="handleCloseMessages"
      @toggle-detail="handleToggleMessageDetail"
      @delete-message="handleDeleteMessage"
    />
  </div>
</template>

<style>
#app-container {
  display: flex;
  min-height: 100vh;
  background: #f8fafc;
  color: #0f172a;
}

.app-container::after {
  content: '';
  position: fixed;
  top: -20rem;
  right: -20rem;
  width: 40rem;
  height: 40rem;
  background: radial-gradient(circle at center, rgba(59, 130, 246, 0.2), transparent 60%);
  z-index: -1;
}

.sidebar {
  width: 20rem;
  background: #1e293b;
  color: #fff;
  display: flex;
  flex-direction: column;
  padding: 2rem 1.5rem;
  gap: 1.5rem;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.sidebar-header p {
  margin: 0.25rem 0 0;
  color: rgba(255, 255, 255, 0.8);
}

.sidebar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sidebar-footer {
  margin-top: auto;
}

.mailbox-form {
  display: flex;
  gap: 0.75rem;
  flex-direction: column;
}

.mailbox-form input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(15, 23, 42, 0.6);
  color: #fff;
}

.mailbox-form button {
  width: 100%;
}

.mailbox-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  max-height: 24rem;
  padding-right: 0.5rem;
}

.mailbox-placeholder {
  padding: 1rem;
  background: rgba(15, 23, 42, 0.4);
  border-radius: 0.75rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.85);
}

.mailbox-item {
  background: rgba(15, 23, 42, 0.6);
  border-radius: 0.75rem;
  padding: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  transition: background 0.2s ease;
}

.mailbox-item.active {
  background: rgba(59, 130, 246, 0.25);
}

.mailbox-item:hover {
  background: rgba(59, 130, 246, 0.35);
}

.mailbox-meta {
  flex: 1;
  cursor: pointer;
}

.mailbox-address {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.mailbox-time {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.75);
}

.icon-button {
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  border: 0;
  padding: 0.25rem;
  border-radius: 0.5rem;
  cursor: pointer;
}

.icon-button:hover {
  background: rgba(255, 255, 255, 0.15);
}

.icon-button svg {
  width: 1.25rem;
  height: 1.25rem;
  display: block;
}

main {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}

section {
  background: #fff;
  border-radius: 0.75rem;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  padding: 1.5rem;
  margin-bottom: 2rem;
}

h2 {
  margin-top: 0;
}

form {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

input[type='text'],
input[type='password'] {
  flex: 1;
  min-width: 0;
  padding: 0.75rem 1rem;
  border: 1px solid #d2d6dc;
  border-radius: 0.5rem;
  font-size: 1rem;
}

button {
  background: #2563eb;
  color: #fff;
  border: 0;
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s ease;
  white-space: nowrap;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button:hover:enabled {
  background: #1d4ed8;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.badge {
  background: #e0e7ff;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  color: #3730a3;
  font-size: 0.85rem;
  font-weight: 600;
}

.error {
  color: #b91c1c;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.secondary {
  background: #f1f5f9;
  color: #0f172a;
}

.secondary:hover:enabled {
  background: #e2e8f0;
}

.danger {
  background: #dc2626;
}

.danger:hover:enabled {
  background: #b91c1c;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

th,
td {
  padding: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: top;
}

tr:hover {
  background: #f1f5f9;
}

.message-row.expanded {
  background: #e2e8f0;
}

.message-detail-row {
  background: #f8fafc;
}

.message-detail-cell {
  padding: 1.5rem;
}

.message-detail-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.message-detail-meta p {
  margin: 0.25rem 0;
}

.message-body h3 {
  margin: 0 0 0.5rem;
}

.message-body pre {
  background: #0f172a;
  color: #e2e8f0;
  padding: 1rem;
  border-radius: 0.5rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-body iframe {
  width: 100%;
  height: 400px;
  border: 1px solid #cbd5f5;
  border-radius: 0.5rem;
}

.message-detail-loading {
  text-align: center;
  color: #64748b;
}

.message-detail-wrapper iframe {
  background: #fff;
}
</style>
