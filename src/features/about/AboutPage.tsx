export function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <p className="text-xs uppercase tracking-[0.24em] text-muted">Policies</p>
      <h1 className="font-display text-5xl leading-tight">Ad Shield is not a YouTube ad blocker.</h1>
      <p className="text-sm leading-7 text-muted">
        MyTube is a distraction-free shell: search any video in the world, no third-party ads in our chrome, and a
        separate player for videos we are allowed to host. YouTube remains YouTube.
      </p>
      <section className="rounded-3xl border border-line bg-panel p-6 text-sm leading-7 text-muted">
        <h2 className="font-display text-2xl text-ink">What we do</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Search any video worldwide through YouTube Data API v3.</li>
          <li>Playback of YouTube videos through the official privacy-enhanced embed.</li>
          <li>Save video ids, titles, and thumbnails you choose — never downloaded streams.</li>
          <li>Play licensed MyTube files in an ad-free HTML5 player.</li>
          <li>Block third-party ads and optional trackers inside MyTube (Ad Shield).</li>
        </ul>
      </section>
      <section className="rounded-3xl border border-line bg-panel p-6 text-sm leading-7 text-muted">
        <h2 className="font-display text-2xl text-ink">What we never do</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Block, skip, or overlay YouTube advertisements.</li>
          <li>Scrape watch pages, extract audio, or play background YouTube audio.</li>
          <li>Offer YouTube downloads or unofficial stream URLs.</li>
          <li>Copy YouTube’s brand, layout, or player chrome.</li>
        </ul>
      </section>
      <p className="text-sm leading-7 text-muted">
        Completely ad-free YouTube playback, where eligible, is provided by{' '}
        <a className="text-tide" href="https://www.youtube.com/premium" target="_blank" rel="noreferrer">
          YouTube Premium
        </a>
        . API use is subject to Google’s quota and{' '}
        <a
          className="text-tide"
          href="https://developers.google.com/youtube/terms/developer-policies"
          target="_blank"
          rel="noreferrer"
        >
          YouTube API Services Terms
        </a>
        .
      </p>
    </article>
  )
}
