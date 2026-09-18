<script setup lang="ts">
import type { Genre } from '#shared/types'

const { t } = useI18n()

const genres = ref<Genre[]>([])
const selected = ref<number[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    genres.value = await getGenreList('movie')
  }
  finally {
    loading.value = false
  }
})

function toggle(id: number) {
  const i = selected.value.indexOf(id)
  if (i >= 0) {
    selected.value.splice(i, 1)
  }
  else if (selected.value.length < 3) {
    selected.value.push(id)
  }
}

function start() {
  if (selected.value.length < 2)
    return
  navigateTo({
    path: '/recommend',
    query: { genres: selected.value.join('|'), type: 'movie' },
  })
}
</script>

<template>
  <div p8>
    <h1 text-3xl font-bold>
      {{ t('Recommend') }}
    </h1>
    <p op60 mt2>
      {{ t('Select 2-3 genres to get recommendations') }}
    </p>

    <div v-if="loading" p10 animate-pulse>
      <div i-carbon:circle-dash text-4xl ma animate-spin />
    </div>

    <div v-else grid="~ cols-2 md:cols-3 lg:cols-4" gap3 mt6>
      <button
        v-for="genre of genres"
        :key="genre.id"
        type="button"
        flex="~ col"
        items-center justify-center
        gap1 rounded-xl border p4 text-center text-lg transition
        :class="selected.includes(genre.id) ? 'border-primary text-primary' : 'border-base op70'"
        @click="toggle(genre.id)"
      >
        <span>{{ genre.name }}</span>
      </button>
    </div>

    <button
      mt8 w-full rounded-xl bg-primary p4 text-lg font-bold disabled:op30
      :disabled="selected.length < 2"
      @click="start"
    >
      {{ t('Start') }} ({{ selected.length }}/3)
    </button>
  </div>
</template>
