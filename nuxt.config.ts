// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  runtimeConfig: {
    public: {
      // signalingUrl: 'ws://0.0.0.0:8080/ws',
      signalingUrl: 'wss://meet.vidnik.xyz/ws',
    },
  },

  modules: ['@pinia/nuxt'],
})
