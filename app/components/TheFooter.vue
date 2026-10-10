<template>
  <footer p="y10 x6 sm:y15 sm:x15" flex="~ col gap4">
    <div flex="~ row gap2" items-center my2>
      <img src="/movies-sm.webp" width="25" height="25" alt="wwwmovie logo">
      <div text-xl>
        wwwmovie
      </div>
    </div>

    <div flex="~ row gap2" items-center>
      <div op50 text-sm>
        {{ $t('Personal project by {author}, built with Nuxt', { author: 'kr8s888' }) }}
      </div>
      <a href="https://nuxt.com/" target="_blank" title="Nuxt" rel="noopener">
        <IconNuxt3 h5 />
      </a>
    </div>

    <div flex="~ row gap2" items-center>
      <p text-true-gray:90 text-sm>
        Data provided by&nbsp;
        <a op100 target="_blank" href="https://www.themoviedb.org/" title="The Movie Database" rel="noopener" n-link-text>
          <IconTMDB inline h4 />
        </a>
      </p>
    </div>

    <div flex="~ row gap2" items-center>
      <p text-true-gray:90 text-sm>
        This project uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </div>

    <div flex="~ row wrap" gap4 items-center>
      <a
        href="https://github.com/kr8s888/wwwmovie"
        target="_blank" rel="noopener"
        flex="~ row gap1" items-center n-link-text
      >
        <div i-simple-icons:github text-base />
        <span text-sm>kr8s888/wwwmovie</span>
      </a>
      <a href="https://www.netlify.com/" target="_blank" rel="noopener" aria-label="Deployed on Netlify" op60 hover:op100>
        <div i-simple-icons:netlify text-base />
      </a>
      <LanguageSwitcher />
    </div>
  </footer>
</template>
