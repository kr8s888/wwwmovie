<script setup>
import '@unocss/reset/tailwind.css'

const { locale } = useI18n()

useHead(() => ({
  htmlAttrs: {
    lang: locale.value,
  },
  charset: 'utf-8',
  title: 'wwwmovie',
  titleTemplate: title => (title !== 'wwwmovie' ? `${title} · wwwmovie` : title),
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'description', content: 'wwwmovie —— 基于 Nuxt 的电影浏览与按类型推荐站点，数据来自 TMDB。' },
    // TODO: 部署后换成你自己的域名，例如 https://wwwmovie.vercel.app/social-card.png
    { property: 'og:image', content: 'https://wwwmovie.vercel.app/social-card.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ],
  link: [
    {
      rel: 'icon',
      type: 'image/webp',
      href: '/movies.webp',
    },
  ],
}))
</script>

<template>
  <div class="app-shell" w-full font-sans grid="~ lt-lg:rows-[minmax(0,1fr)_auto] lg:cols-[max-content_1fr]" of-hidden>
    <div id="app-scroller" min-h-0 of-x-hidden of-y-auto relative>
      <NuxtPage :key="locale" />
    </div>
    <NavBar lg:order-first />
    <IframeModal />
    <PhotoModal />
  </div>
</template>

<style>
.app-shell {
  height: 100vh;
  height: 100svh;
  height: 100dvh;
}

html,
body,
#__nuxt {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: #111;
  color: white;
  color-scheme: dark;
}
</style>
