// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  runtimeConfig: {
    public: {
      signalingUrl: 'ws://192.168.88.27:8080/ws',
    },
  },

  modules: ['@pinia/nuxt'],
})