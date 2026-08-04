<template>
  <div class="app">
    <Dashboard :user="user" @logout="logout" @login="checkAuth" />
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import Dashboard from "./components/Dashboard.vue";

const user = ref(null);

async function checkAuth() {
  try {
    const res = await fetch("/auth/me");
    if (res.ok) {
      user.value = await res.json();
    }
  } catch {}
}

onMounted(checkAuth);

async function logout() {
  await fetch("/auth/logout", { method: "POST" });
  user.value = null;
}
</script>

<style>
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg: #ffffff;
  --surface: #ffffff;
  --border: #e1dfdd;
  --text: #323130;
  --text-muted: #605e5c;
  --accent: #0078d4;
  --accent-hover: #106ebe;
  --green: #107c10;
  --red: #d13438;
  --azure-blue: #0078d4;
  --azure-dark-blue: #005a9e;
  --azure-header: #0078d4;
}

body {
  font-family:
    "Segoe UI",
    "Segoe UI Web (West European)",
    -apple-system,
    BlinkMacSystemFont,
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  font-size: 14px;
}

.app {
  height: 100dvh;
  overflow: hidden;
}
</style>
