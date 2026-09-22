<script setup lang="ts">
import type { Media, MediaType } from '#shared/types'

const route = useRoute()
const { t, locale } = useI18n()

const genres = computed(() => (route.query.genres as string) || '')
const type = computed(() => (route.query.type as MediaType) || 'movie')

const genreList = await getGenreList(type.value)
const genreNames = computed(() =>
  genres.value
    .split(',')
    .map(id => genreList.find(g => g.id === +id)?.name)
    .filter(Boolean)
    .join(' · '),
)

// 在 setup 顶层取数（SSR 与浏览器端都能拿到，算法说明首屏即可见）
const { data } = await useAsyncData(
  () => `ranked-${type.value}-${genres.value}-${locale.value}`,
  () => genres.value
    ? getRankedRecommendations(type.value, genres.value, { language: locale.value })
    : Promise.resolve(null),
)

const items = computed<Media[]>(() => data.value?.results ?? [])
const meta = computed(() => data.value?.meta ?? null)
</script>

<template>
  <div>
    <div v-if="!genres" p8>
      <p>{{ t('No genres selected') }}</p>
    </div>

    <div v-else>
      <h1 flex="~" px8 pt8 gap2 text-3xl>
        {{ t('Recommended for you') }}：{{ genreNames }}
      </h1>

      <MediaGrid>
        <MediaCard
          v-for="(item, index) of items"
          :key="item.id"
          :type="type"
          :item="item"
          :priority="index < 10"
        />
      </MediaGrid>

      <div v-if="meta" px8 pb8 text-sm op60>
        <div>{{ t('Ranked by weighted rating') }}</div>
        <code>{{ meta.formula }}</code>
        <div mt1>
          m = {{ meta.m }} · C = {{ meta.c.toFixed(2) }} · {{ t('Candidates') }} {{ meta.candidates }}
        </div>
      </div>

      <p v-if="!items.length" p8 op60>
        {{ t('No results for these genres') }}
      </p>
    </div>
  </div>
</template>
