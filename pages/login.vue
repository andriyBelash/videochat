<script setup lang="ts">
  const { set, remove } = useCookieStore()

  remove()

  const name = ref('')

  const join = () => {
    set(name.value)
    navigateTo('/')
  }

</script>

<template>
  <div class="login">
    <input v-model="name" placeholder="Введіть ваше імʼя" />
    <button @click="join">Приєднатись</button>
  </div>
</template>

<style lang="scss">
  .login {
    height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px;
    input {
      max-width: 500px;
      width: 100%;
      height: 44px;
      border-radius: 8px;
      outline: none;
      padding: 0 12px;
      border: 1.5px solid rgba(0, 0, 0, 0.1);
      transition: .3s;
      &:hover {
        border: 1.5px solid #6C9FFF;
      }
      &:focus {
        border: 1.5px solid #6C9FFF;
        box-shadow: 0px 0px 8px rgba(39, 110, 246, 0.3);
      }
    }

    button {
      background-color: #276EF6;
      transition: all 0.3s ease;
      color: #FFFFFF;
      font-weight: 500;
      font-size: 16px;
      padding: 12px 24px;
      height: 44px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: .3s;
      &:hover{
        background-color: #6C9FFF;
      }
      &:active {
        background-color: #1042A0;
      }
    }
  }
</style>