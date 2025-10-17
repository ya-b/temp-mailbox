<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  token: string
  isLoggingIn: boolean
  loginError: string
}>()

const emit = defineEmits<{
  (event: 'update:token', value: string): void
  (event: 'submit'): void
}>()

function handleInput(event: Event) {
  emit('update:token', (event.target as HTMLInputElement).value)
}

function handleSubmit() {
  emit('submit')
}
</script>

<template>
  <div class="login-wrapper">
    <section id="login-section">
      <h2>{{ t('login.title') }}</h2>
      <p>{{ t('login.password') }}</p>
      <form id="login-form" @submit.prevent="handleSubmit">
        <input
          type="password"
          id="login-token"
          :value="props.token"
          :placeholder="t('login.password')"
          required
          :disabled="props.isLoggingIn"
          @input="handleInput"
        />
        <button type="submit" :disabled="props.isLoggingIn">
          {{ props.isLoggingIn ? t('messages.loading') : t('login.login_btn') }}
        </button>
      </form>
      <div v-if="props.loginError" id="login-error" class="error">
        {{ props.loginError }}
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  padding: 2rem;
}
</style>
