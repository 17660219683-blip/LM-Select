<script setup>
import PagePlaceholder from '@/components/common/PagePlaceholder.vue'
</script>

<template>
  <PagePlaceholder
    title="日志管理"
    description="记录每一次模型调用，方便回溯问题、核算成本。"
    :points="[
      '每次调用：时间、模型、耗时、token 用量、成功与否',
      '按会话 / 模型 / 时间范围检索',
      '失败请求的错误详情，便于排查是模型问题还是网络问题',
      '按模型汇总用量，为选型提供真实数据',
    ]"
  />
</template>
