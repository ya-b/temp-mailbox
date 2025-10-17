<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { onMounted, onUnmounted, ref } from 'vue'
import type { Mailbox, MessageDetail, MessageSummary } from '../types/mail'

const { t } = useI18n()

// Auto-refresh timer reference
let refreshTimer: number | null = null

const props = defineProps<{
  currentMailbox: Mailbox | null
  messages: MessageSummary[]
  isLoadingMessages: boolean
  messagesError: string
  expandedMessageId: number | null
  detailLoadingId: number | null
  messageDetails: Record<number, MessageDetail>
  formatDate: (value: string | null | undefined) => string
}>()

const emit = defineEmits<{
  (event: 'refresh'): void
  (event: 'close'): void
  (event: 'toggleDetail', message: MessageSummary): void
  (event: 'deleteMessage', message: MessageSummary): void
}>()

function detailButtonLabel(id: number): string {
  if (props.detailLoadingId === id) {
    return t('messages.loading')
  }
  return props.expandedMessageId === id ? t('messages.collapse') : t('messages.view')
}

function handleToggle(message: MessageSummary) {
  emit('toggleDetail', message)
}

function handleDelete(message: MessageSummary) {
  emit('deleteMessage', message)
}

function handleRefresh() {
  emit('refresh')
}

function startAutoRefresh() {
  // Clear any existing timer
  if (refreshTimer !== null) {
    clearInterval(refreshTimer)
  }
  
  // Set up new timer to refresh every 20 seconds (20000 ms)
  refreshTimer = setInterval(() => {
    handleRefresh()
  }, 20000)
}

function stopAutoRefresh() {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// Start auto-refresh when component is mounted
onMounted(() => {
  startAutoRefresh()
})

// Clean up timer when component is unmounted
onUnmounted(() => {
  stopAutoRefresh()
})

function handleClose() {
  emit('close')
}

function getMessageDetail(id: number): MessageDetail | undefined {
  return props.messageDetails[id]
}
</script>

<template>
  <main>
    <section v-if="!props.currentMailbox" id="welcome-section">
      <h2>{{ t('mailbox.title') }}</h2>
      <p>{{ t('messages.no_messages') }}</p>
    </section>

    <section v-else id="messages-section">
      <div class="toolbar">
        <h2 id="messages-title">{{ t('messages.title') }}: {{ props.currentMailbox.address }}</h2>
        <div class="actions">
          <button type="button" @click="handleRefresh" :disabled="props.isLoadingMessages">
            {{ props.isLoadingMessages ? t('messages.loading') : t('mailbox.refresh_mailbox') }}
          </button>
          <button type="button" class="secondary" @click="handleClose">
            {{ t('messages.close') }}
          </button>
        </div>
      </div>
      <div v-if="props.messagesError" class="error">{{ props.messagesError }}</div>
      <table id="messages-table">
        <thead>
          <tr>
            <th>{{ t('messages.sender') }}</th>
            <th>{{ t('messages.subject') }}</th>
            <th>{{ t('messages.time') }}</th>
            <th>{{ t('messages.tools') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="props.isLoadingMessages">
            <td colspan="4">{{ t('messages.loading') }}</td>
          </tr>
          <tr v-else-if="!props.messages.length">
            <td colspan="4">{{ t('messages.no_messages') }}</td>
          </tr>
          <template v-else v-for="message in props.messages" :key="message.id">
            <tr class="message-row" :class="{ expanded: props.expandedMessageId === message.id }">
              <td>{{ message.sender }}</td>
              <td>{{ message.subject || `(${t('messages.no_messages')})` }}</td>
              <td>{{ props.formatDate(message.received_at) }}</td>
              <td class="actions">
                <button
                  type="button"
                  :disabled="props.detailLoadingId === message.id"
                  @click="handleToggle(message)"
                >
                  {{ detailButtonLabel(message.id) }}
                </button>
                <button type="button" class="secondary" @click="handleDelete(message)">
                  {{ t('mailbox.delete_mailbox') }}
                </button>
              </td>
            </tr>
            <tr v-if="props.expandedMessageId === message.id" class="message-detail-row">
              <td colspan="4" class="message-detail-cell">
                <div v-if="getMessageDetail(message.id)" class="message-detail-wrapper">
                  <div class="message-detail-meta">
                    <p>
                      <strong>{{ t('messages.sender') }}:</strong>
                      {{ getMessageDetail(message.id)?.sender }}
                    </p>
                    <p>
                      <strong>{{ t('messages.receiver') }}:</strong>
                      {{ getMessageDetail(message.id)?.mailbox_address }}
                    </p>
                    <p>
                      <strong>{{ t('messages.subject') }}:</strong>
                      {{ getMessageDetail(message.id)?.subject || `(${t('messages.no_messages')})` }}
                    </p>
                    <p>
                      <strong>{{ t('messages.time') }}:</strong>
                      {{ props.formatDate(getMessageDetail(message.id)?.received_at) }}
                    </p>
                    <p v-if="getMessageDetail(message.id)?.message_identifier">
                      <strong>Message-ID:</strong>
                      {{ getMessageDetail(message.id)?.message_identifier }}
                    </p>
                  </div>
                  <div v-if="getMessageDetail(message.id)?.html_body" class="message-body html">
                    <iframe
                      :title="`message-html-${message.id}`"
                      sandbox=""
                      :srcdoc="getMessageDetail(message.id)?.html_body ?? ''"
                    />
                  </div>
                </div>
                <div v-else class="message-detail-loading">{{ t('messages.loading') }}</div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </section>
  </main>
</template>
