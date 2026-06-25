// Form-instruction video for an exercise. Lightweight facade: shows the YouTube
// thumbnail + a play button, and only loads the (heavy) YouTube iframe once the
// user taps. When an exercise has no curated videoId yet, it degrades to a
// "Watch form demo" button that opens a YouTube search for the movement.
//
// No data fetching, no backend — videoId lives statically on the exercise.

import { useState, useEffect } from 'react'
import Icon from './Icon.jsx'

export default function FormVideo({ exercise }) {
  const videoId = exercise?.videoId
  const [playing, setPlaying] = useState(false)

  // Reset to the facade when the exercise changes (the component is reused across
  // exercises during a session).
  useEffect(() => { setPlaying(false) }, [videoId])

  if (!videoId) {
    const q = encodeURIComponent(`${exercise?.name || ''} form`)
    return (
      <a
        className="btn-ghost w-full text-sm"
        href={`https://www.youtube.com/results?search_query=${q}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon name="play" size={15} /> Watch form demo
      </a>
    )
  }

  if (playing) {
    return (
      <div className="aspect-video overflow-hidden rounded-2xl border border-white/[0.06] bg-black">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`}
          title={`${exercise?.name} form demo`}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${exercise?.name} form demo`}
      className="group relative block aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.06]"
      style={{
        backgroundImage: `url(https://i.ytimg.com/vi/${videoId}/hqdefault.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <span className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/25" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-glow transition-transform group-active:scale-95">
          <Icon name="play" size={26} />
        </span>
      </span>
      <span className="absolute bottom-2 left-3 text-xs font-semibold text-white drop-shadow">Form demo</span>
    </button>
  )
}
