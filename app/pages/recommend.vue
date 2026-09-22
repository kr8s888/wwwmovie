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

const items: Media[] = reactive([])
const fetched = ref(false)
const meta = ref<{ formula: string, m: number, c: number, candidates: number } | null>(null)

let loaded = false

async function fetch(_page: number) {
  // 加权评分需要先取候选池再整体重排，所以一次性返回结果，不分页
  if (!genres.value || loaded)
    return
  loaded = true
  const { results, meta: info } = await getRankedRecommendations(type.value, genres.value, {
    language: locale.value,
  })
  items.push(...results)
  meta.value = info
  fetched.value = true
}
</script>

<template>
  <div>
    <div v-if="!genres" p8>
      <p>{{ t('No genres selected') }}</p>
    </div>
    <MediaAutoLoadGrid
      v-else
      :fetch="fetch"
      :type="type"
      :items="items"
      :count="items.length || undefined"
    >
      {{ t('Recommended for you') }}：{{ genreNames }}
    </MediaAutoLoadGrid>

    <div v-if="meta" px8 pb8 text-sm op60>
      <div>{{ t('Ranked by weighted rating') }}</div>
      <code>{{ meta.formula }}</code>
      <div mt1>
        m = {{ meta.m }} · C = {{ meta.c.toFixed(2) }} · {{ t('Candidates') }} {{ meta.candidates }}
      </div>
    </div>

    <p v-if="fetched && items.length === 0" p8 op60>
      {{ t('No results for these genres') }}
    </p>
  </div>
</template>
