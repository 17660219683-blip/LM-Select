<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  /** 这个页面计划要做的功能点，先写在占位卡片里当路线图 */
  points: { type: Array, default: () => [] },
})
</script>

<template>
  <div class="page">
    <div class="card">
      <span class="badge">建设中</span>
      <h1 class="title">{{ title }}</h1>
      <p v-if="description" class="desc">{{ description }}</p>

      <ul v-if="points.length" class="points">
        <li v-for="point in points" :key="point">{{ point }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  box-sizing: border-box;
  place-items: center;
  min-height: calc(100vh - var(--nav-h));
  min-height: calc(100dvh - var(--nav-h));
  padding: 2rem 1.5rem;
}

.card {
  width: 100%;
  max-width: 640px;
  padding: 2rem 2.2rem;
  border-radius: var(--radius);
  background: #fff;
  color: var(--ink);
  box-shadow: var(--shadow);
}

.badge {
  display: inline-block;
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.title {
  margin: 0.7rem 0 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.desc {
  margin: 0.5rem 0 0;
  color: var(--ink-dim);
  font-size: 0.9rem;
}

.points {
  margin: 1.1rem 0 0;
  padding-left: 1.15rem;
  color: var(--ink-dim);
  font-size: 0.86rem;
  line-height: 1.9;
}
</style>
