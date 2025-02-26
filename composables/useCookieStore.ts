export const useCookieStore = () => {
  const name = useCookie('name')

  const set = (value: string) => {
    name.value = value
  }

  const remove = () => {
    name.value = ''
  }

  const get = () => {
    return name.value
  }

  return {
    set,
    remove,
    get
  }
}