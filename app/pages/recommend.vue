<script setup lang="ts">
import type { Media, MediaType } from '#shared/types'

const route = useRoute()
const { t } = useI18n()

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

async function fetch(page: number) {
  if (!genres.value)
    return
  items.push(...(await getMediaByGenre(type.value, genres.value, page, 'vote_count.desc')).results)
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
    >
      {{ t('Recommended for you') }}：{{ genreNames }}
    </MediaAutoLoadGrid>
    <p v-if="fetched && items.length === 0" p8 op60>
      {{ t('No results for these genres') }}
    </p>
  </div>
</template>
