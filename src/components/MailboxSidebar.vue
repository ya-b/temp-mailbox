<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Mailbox } from '../types/mail'

const { t, locale } = useI18n()

const props = defineProps<{
  mailboxes: Mailbox[]
  currentMailboxId: number | null
  isLoadingMailboxes: boolean
  mailboxError: string
  mailboxAddress: string
  isCreatingMailbox: boolean
  createError: string
  domainHint: string
  formatDate: (value: string | null | undefined) => string
}>()

const emit = defineEmits<{
  (event: 'update:mailboxAddress', value: string): void
  (event: 'create'): void
  (event: 'select', mailbox: Mailbox): void
  (event: 'delete', mailbox: Mailbox): void
  (event: 'logout'): void
}>()

function handleAddressInput(event: Event) {
  emit('update:mailboxAddress', (event.target as HTMLInputElement).value)
}

function handleSubmit() {
  emit('create')
}

function handleSelect(mailbox: Mailbox) {
  emit('select', mailbox)
}

function handleDelete(mailbox: Mailbox) {
  emit('delete', mailbox)
}

function handleLogout() {
  emit('logout')
}

const showSettingsMenu = ref(false)

function setLanguage(lang: string) {
  locale.value = lang
  showSettingsMenu.value = false
}

function closeSettingsMenu() {
  showSettingsMenu.value = false
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h2>{{ t('mailbox.title') }}</h2>
      <p>{{ t('mailbox.new_mailbox') }}</p>
      <p v-if="props.domainHint" class="badge">{{ t('common.default_domain') }}：{{ props.domainHint }}</p>
    </div>
    <div class="sidebar-content">
      <form id="create-mailbox-form" class="mailbox-form" @submit.prevent="handleSubmit">
        <input
          type="text"
          id="mailbox-address"
          :value="props.mailboxAddress"
          :placeholder="t('mailbox.mail_addr')"
          required
          :disabled="props.isCreatingMailbox"
          @input="handleAddressInput"
        />
        <button type="submit" :disabled="props.isCreatingMailbox">
          {{ props.isCreatingMailbox ? t('messages.loading') : t('mailbox.new_mailbox') }}
        </button>
      </form>
      <div v-if="props.createError" id="create-error" class="error">
        {{ props.createError }}
      </div>
      <div v-if="props.mailboxError" class="error">
        {{ props.mailboxError }}
      </div>
      <div id="mailbox-list" class="mailbox-list">
        <div v-if="props.isLoadingMailboxes" class="mailbox-placeholder">
          {{ t('messages.loading') }}
        </div>
        <div v-else-if="!props.mailboxes.length" class="mailbox-placeholder">
          {{ t('messages.no_messages') }}
        </div>
        <div
          v-else
          v-for="mailbox in props.mailboxes"
          :key="mailbox.id"
          class="mailbox-item"
          :class="{ active: props.currentMailboxId === mailbox.id }"
        >
          <div class="mailbox-meta" @click="handleSelect(mailbox)">
            <div class="mailbox-address">{{ mailbox.address }}</div>
            <div class="mailbox-time">{{ props.formatDate(mailbox.created_at) }}</div>
          </div>
          <button
            type="button"
            class="icon-button"
            @click.stop="handleDelete(mailbox)"
            :aria-label="t('mailbox.delete_mailbox')"
            :title="t('mailbox.delete_mailbox')"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M7.75 2.5a1 1 0 0 0-.97.757L6.5 4H4.25a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H13.5l-.28-1.094a1 1 0 0 0-.97-.757h-4.5Z"
              />
              <path
                d="M5.75 6.25a.75.75 0 0 0-.75.75v8.25A2.75 2.75 0 0 0 7.75 18h4.5a2.75 2.75 0 0 0 2.75-2.75V7a.75.75 0 0 0-.75-.75h-8.5Zm4 2a.75.75 0 0 1 1.5 0v6a.75.75 0 0 1-1.5 0v-6Zm-2 .75a.75.75 0 0 1 1.5 0v4.5a.75.75 0 0 1-1.5 0v-4.5Zm5.5 0a.75.75 0 0 1 1.5 0v4.5a.75.75 0 0 1-1.5 0v-4.5Z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
    <div class="sidebar-footer">
          <div v-click-outside="closeSettingsMenu" class="settings-menu-container">
            <div v-if="showSettingsMenu" class="settings-menu">
              <button @click="handleLogout">{{ t('mailbox.logout') }}</button>
              <div class="language-menu">
                <button @click="setLanguage('zh')">中文</button>
                <button @click="setLanguage('en')">English</button>
              </div>
            </div>
            <button
              id="settings-btn"
              class="icon-button"
              type="button"
              aria-label="Settings"
              @click="showSettingsMenu = !showSettingsMenu"
            >
              <svg t="1760684764842" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1638" width="40" height="40"><path d="M448.487619 97.52381l130.096762 0.170666c40.399238 0.073143 73.142857 32.792381 73.191619 73.216l0.048762 21.211429a345.283048 345.283048 0 0 1 71.143619 39.960381l17.408-10.044953a73.313524 73.313524 0 0 1 99.961905 26.819048l65.219047 112.566857a73.313524 73.313524 0 0 1-22.893714 97.816381l-3.974095 2.438095-17.481143 10.093715a341.479619 341.479619 0 0 1-1.292191 83.968l12.361143 7.168a73.313524 73.313524 0 0 1 28.867048 96.329142l-2.023619 3.803429-61.098667 105.813333a73.313524 73.313524 0 0 1-96.329143 28.867048l-3.803428-2.048-16.896-9.752381a341.918476 341.918476 0 0 1-68.291048 38.083048l0.024381 29.062095a73.313524 73.313524 0 0 1-68.754286 73.264762l-4.632381 0.146285-130.121142-0.170666a73.313524 73.313524 0 0 1-73.191619-73.216l-0.048762-35.035429a346.599619 346.599619 0 0 1-57.368381-34.035809l-31.158857 17.944381a73.313524 73.313524 0 0 1-99.986286-26.819048l-65.219048-112.566857a73.313524 73.313524 0 0 1 22.918095-97.816381l3.949715-2.438095 31.719619-18.285715c-2.438095-23.161905-2.56-46.665143-0.219429-70.119619l-35.206095-20.333714a73.313524 73.313524 0 0 1-28.891429-96.329143l2.048-3.803428 61.098667-105.813334a73.313524 73.313524 0 0 1 96.329143-28.867047l3.803429 2.048 30.72 17.724952a341.284571 341.284571 0 0 1 64.609523-39.716571l-0.048762-27.89181a73.313524 73.313524 0 0 1 68.754286-73.264762L448.487619 97.52381z m145.798095 283.721142a146.407619 146.407619 0 0 0-200.167619 53.638096 146.773333 146.773333 0 0 0 53.711238 200.362666 146.407619 146.407619 0 0 0 200.167619-53.638095 146.773333 146.773333 0 0 0-53.711238-200.362667z m-136.655238 90.258286a73.118476 73.118476 0 0 1 96.182857-28.842667l3.803429 2.048 3.657143 2.267429a73.508571 73.508571 0 0 1 23.210666 98.011429 73.118476 73.118476 0 0 1-99.961904 26.819047 73.48419 73.48419 0 0 1-26.892191-100.303238z" p-id="1639" fill="currentColor"></path></svg>
            </button>
          </div>
        </div>
  </aside>
</template>

<style scoped>
.sidebar-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.sidebar {
  height: 100vh;
}

.settings-menu-container {
  position: relative;
}

.settings-menu {
  display: block;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: #f9f9f9;
  min-width: 80px;
  box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.2);
  z-index: 1;
  border-radius: 4px;
  padding: 4px 0;
}

.settings-menu button,
.language-menu button {
  color: black;
  padding: 8px 12px;
  text-decoration: none;
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
}

.settings-menu button:hover,
.language-menu button:hover {
  background-color: #f1f1f1;
}

.language-menu {
  border-top: 1px solid #e0e0e0;
  margin-top: 4px;
  padding-top: 4px;
}
</style>
