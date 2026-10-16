<script setup>
/**
 * 模型库筛选栏。
 *
 * 自己不保存状态 —— 收到 filters 就显示，用户改动就发一份新对象上去。
 * 这样筛选逻辑只有一处（父级的 reload），不会两边各维护一份而走样。
 */
import VendorLogo from '@/components/models/VendorLogo.vue'
import { STATUS_LABEL, TYPE_LABEL } from '@/utils/modelFormat'

const props = defineProps({
  filters: { type: Object, required: true },
  options: {
    type: Object,
    default: () => ({ vendors: [], types: [], statuses: [] }),
  },
  total: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:filters', 'reset'])

function set(key, value) {
  emit('update:filters', { ...props.filters, [key]: value })
}
</script>

<template>
  <section class="filters">
    <!-- 第一行：搜索 + 下拉 + 排序 -->
    <div class="row">
      <input
        :value="filters.q"
        class="search"
        type="search"
        placeholder="搜索模型名、厂商…"
        @input="set('q', $event.target.value)"
      />

      <label class="field">
        <span class="field-label">状态</span>
        <select :value="filters.status" @change="set('status', $event.target.value)">
          <option value="all">全部</option>
          <option v-for="s in options.statuses" :key="s.code" :value="s.code">
            {{ STATUS_LABEL[s.code] ?? s.code }}（{{ s.count }}）
          </option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">类型</span>
        <select :value="filters.type?.[0] ?? ''" @change="set('type', $event.target.value ? [$event.target.value] : [])">
          <option value="">全部</option>
          <option v-for="t in options.types" :key="t.code" :value="t.code">
            {{ TYPE_LABEL[t.code] ?? t.code }}（{{ t.count }}）
          </option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">排序</span>
        <select :value="filters.sort" @change="set('sort', $event.target.value)">
          <option value="output_usd">输出价</option>
          <option value="input_usd">输入价</option>
          <option value="context">上下文</option>
          <option value="release">发布日期</option>
          <option value="name">名称</option>
        </select>
      </label>

      <button
        type="button"
        class="order-btn"
        :title="filters.order === 'asc' ? '当前升序，点击切降序' : '当前降序，点击切升序'"
        @click="set('order', filters.order === 'asc' ? 'desc' : 'asc')"
      >
        {{ filters.order === 'asc' ? '↑ 升序' : '↓ 降序' }}
      </button>
    </div>

    <!--
      第二行：厂商（单选）
      点已选中的厂商会取消选择，等于回到"全部"，省一个额外的清除操作。
      filters.vendor 是字符串而不是数组 —— 后端 toArray() 两种都接得住。
    -->
    <div class="row wrap">
      <span class="row-label">厂商</span>
      <button
        type="button"
        class="chip"
        :class="{ on: !filters.vendor }"
        @click="set('vendor', '')"
      >
        <span class="chip-text">全部</span>
      </button>
      <button
        v-for="v in options.vendors"
        :key="v.code"
        type="button"
        class="chip"
        :class="{ on: filters.vendor === v.code }"
        @click="set('vendor', filters.vendor === v.code ? '' : v.code)"
      >
        <VendorLogo :code="v.code" :size="16" />
        <span class="chip-text">{{ v.nameZh || v.name }}</span>
        <span class="chip-n">{{ v.count }}</span>
      </button>
    </div>

    <!-- 第三行：能力开关 + 阈值 -->
    <div class="row wrap">
      <label class="toggle">
        <input
          type="checkbox"
          :checked="filters.vision === '1'"
          @change="set('vision', $event.target.checked ? '1' : '')"
        />
        <span>支持视觉</span>
      </label>

      <label class="toggle">
        <input
          type="checkbox"
          :checked="filters.selfHost === '1'"
          @change="set('selfHost', $event.target.checked ? '1' : '')"
        />
        <span>可私有化部署</span>
      </label>

      <label class="toggle">
        <input
          type="checkbox"
          :checked="filters.commercial === '1'"
          @change="set('commercial', $event.target.checked ? '1' : '')"
        />
        <span>许可允许商用</span>
      </label>

      <label class="field inline">
        <span class="field-label">上下文 ≥</span>
        <select :value="filters.minContext" @change="set('minContext', $event.target.value)">
          <option value="">不限</option>
          <option value="128000">128K</option>
          <option value="200000">200K</option>
          <option value="262144">256K</option>
          <option value="1000000">1M</option>
        </select>
      </label>

      <label class="field inline">
        <span class="field-label">输出价 ≤</span>
        <select :value="filters.maxOutputUsd" @change="set('maxOutputUsd', $event.target.value)">
          <option value="">不限</option>
          <option value="1">$1 / 百万 token</option>
          <option value="5">$5</option>
          <option value="15">$15</option>
          <option value="50">$50</option>
        </select>
      </label>

      <span class="spacer"></span>

      <span class="count">
        <template v-if="loading">加载中…</template>
        <template v-else>共 {{ total }} 个模型</template>
      </span>

      <button type="button" class="reset" @click="emit('reset')">重置</button>
    </div>
  </section>
</template>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  border-radius: var(--radius);
  background: #fff;
  box-shadow: var(--shadow);
}

.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.row.wrap {
  flex-wrap: wrap;
}

.row-label {
  color: var(--ink-dim);
  font-size: 0.78rem;
  font-weight: 600;
}

.search {
  flex: 1;
  min-width: 12rem;
  padding: 0.45rem 0.8rem;
  border: 1px solid rgba(27, 20, 37, 0.14);
  border-radius: 10px;
  background: rgba(27, 20, 37, 0.03);
  color: var(--ink);
  font: inherit;
  font-size: 0.86rem;
}

.search:focus,
.field select:focus {
  border-color: var(--accent);
  outline: none;
}

.field {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.35rem;
}

.field-label {
  color: var(--ink-dim);
  font-size: 0.76rem;
  white-space: nowrap;
}

.field select {
  padding: 0.4rem 0.5rem;
  border: 1px solid rgba(27, 20, 37, 0.14);
  border-radius: 9px;
  background: rgba(27, 20, 37, 0.03);
  color: var(--ink);
  font: inherit;
  font-size: 0.82rem;
}

.order-btn,
.reset {
  flex-shrink: 0;
  padding: 0.4rem 0.7rem;
  border: 1px solid rgba(27, 20, 37, 0.14);
  border-radius: 9px;
  background: transparent;
  color: var(--ink-dim);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  transition: background 0.16s var(--ease);
}

.order-btn:hover,
.reset:hover {
  background: rgba(27, 20, 37, 0.05);
  color: var(--ink);
}

/* ---- 厂商单选项 ---- */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.24rem 0.65rem;
  border: 1px solid rgba(27, 20, 37, 0.14);
  border-radius: 999px;
  background: transparent;
  color: var(--ink-dim);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  transition:
    background 0.16s var(--ease),
    color 0.16s var(--ease),
    border-color 0.16s var(--ease);
}

.chip:hover {
  background: rgba(27, 20, 37, 0.05);
  color: var(--ink);
}

.chip.on {
  border-color: var(--accent-ring);
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.chip-text {
  white-space: nowrap;
}

.chip-n {
  opacity: 0.6;
  font-size: 0.72rem;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--ink-dim);
  cursor: pointer;
  font-size: 0.82rem;
  user-select: none;
}

.toggle input {
  accent-color: var(--accent);
  cursor: pointer;
}

.spacer {
  flex: 1;
}

.count {
  color: var(--ink-dim);
  font-size: 0.8rem;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .row {
    flex-wrap: wrap;
  }

  .search {
    min-width: 100%;
  }
}
</style>
