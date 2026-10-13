import type { OwnedVideo } from '@/types'

const SAMPLE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample'

export const ownedVideos: OwnedVideo[] = [
  {
    id: 'big-buck-bunny',
    source: 'cleanstream',
    title: 'Big Buck Bunny',
    channelTitle: 'Blender Foundation',
    thumbnailUrl: `${SAMPLE}/images/BigBuckBunny.jpg`,
    poster: `${SAMPLE}/images/BigBuckBunny.jpg`,
    src: `${SAMPLE}/BigBuckBunny.mp4`,
    publishedAt: '2008-04-10',
    duration: 'PT9M56S',
    license: 'Creative Commons Attribution 3.0 — Blender Foundation',
    description:
      'An open movie from the Blender Foundation. MyTube streams this file from a public sample host; it is not a YouTube extract.',
    captions: [
      {
        src: '/captions/big-buck-bunny.en.vtt',
        label: 'English',
        srclang: 'en',
      },
    ],
  },
  {
    id: 'elephants-dream',
    source: 'cleanstream',
    title: "Elephant's Dream",
    channelTitle: 'Blender Foundation',
    thumbnailUrl: `${SAMPLE}/images/ElephantsDream.jpg`,
    poster: `${SAMPLE}/images/ElephantsDream.jpg`,
    src: `${SAMPLE}/ElephantsDream.mp4`,
    publishedAt: '2006-03-24',
    duration: 'PT10M53S',
    license: 'Creative Commons Attribution 2.5 — Blender Foundation / Netherlands Media Art Institute',
    description: 'The first open movie made with Blender, hosted here as a licensed MyTube library title.',
    captions: [
      {
        src: '/api/video-language/media/elephants-dream/en.vtt',
        label: 'English',
        srclang: 'en',
      },
    ],
  },
  {
    id: 'sintel',
    source: 'cleanstream',
    title: 'Sintel',
    channelTitle: 'Blender Foundation',
    thumbnailUrl: `${SAMPLE}/images/Sintel.jpg`,
    poster: `${SAMPLE}/images/Sintel.jpg`,
    src: `${SAMPLE}/Sintel.mp4`,
    publishedAt: '2010-09-27',
    duration: 'PT14M48S',
    license: 'Creative Commons Attribution 3.0 — Blender Foundation',
    description: 'A short fantasy film produced by the Blender Institute, included as a licensed library title.',
    captions: [
      {
        src: '/api/video-language/media/sintel/en.vtt',
        label: 'English',
        srclang: 'en',
      },
    ],
  },
  {
    id: 'tears-of-steel',
    source: 'cleanstream',
    title: 'Tears of Steel',
    channelTitle: 'Blender Foundation',
    thumbnailUrl: `${SAMPLE}/images/TearsOfSteel.jpg`,
    poster: `${SAMPLE}/images/TearsOfSteel.jpg`,
    src: `${SAMPLE}/TearsOfSteel.mp4`,
    publishedAt: '2012-09-26',
    duration: 'PT12M14S',
    license: 'Creative Commons Attribution 3.0 — Blender Foundation',
    description: 'A live-action and CGI short from the Blender Institute. Served as an original MyTube file.',
    captions: [
      {
        src: '/api/video-language/media/tears-of-steel/en.vtt',
        label: 'English',
        srclang: 'en',
      },
    ],
  },
]

export function getOwnedVideo(id: string): OwnedVideo | undefined {
  return ownedVideos.find((video) => video.id === id)
}
