export default defineNuxtRouteMiddleware((to, from) => {
  const name = useCookieStore().get()

  
  if(!name && to.path !== '/login') {
    return navigateTo('/login')
  }
})