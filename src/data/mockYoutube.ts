import type { YoutubeVideo } from '@/types'

export const mockYoutubeVideos: YoutubeVideo[] = [
  {
    id: 'aqz-KE-bpKQ',
    source: 'youtube',
    title: 'Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film',
    channelTitle: 'Blender',
    thumbnailUrl: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
    publishedAt: '2014-11-10T00:00:00Z',
    duration: 'PT10M34S',
    embeddable: true,
    description: 'Official Blender Foundation upload on YouTube. Playback uses the official YouTube embed.',
  },
  {
    id: 'eRsGyueVLvQ',
    source: 'youtube',
    title: 'Sintel - Open Movie by Blender Foundation',
    channelTitle: 'Blender',
    thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/hqdefault.jpg',
    publishedAt: '2010-09-29T00:00:00Z',
    duration: 'PT14M48S',
    embeddable: true,
  },
  {
    id: 'M7lc1UVf-VE',
    source: 'youtube',
    title: 'YouTube IFrame Player API demo',
    channelTitle: 'Google for Developers',
    thumbnailUrl: 'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg',
    publishedAt: '2013-04-26T00:00:00Z',
    duration: 'PT1M',
    embeddable: true,
    description: 'Google sample video used by the official IFrame Player API.',
  },
  {
    id: 'jNQXAC9IVRw',
    source: 'youtube',
    title: 'Me at the zoo',
    channelTitle: 'jawed',
    thumbnailUrl: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg',
    publishedAt: '2005-04-24T00:00:00Z',
    duration: 'PT19S',
    embeddable: true,
  },
]

export function mockSearch(query: string): YoutubeVideo[] {
  const q = query.trim().toLowerCase()
  if (!q) return mockYoutubeVideos
  const hits = mockYoutubeVideos.filter(
    (video) =>
      video.title.toLowerCase().includes(q) ||
      video.channelTitle.toLowerCase().includes(q) ||
      (video.description ?? '').toLowerCase().includes(q),
  )
  return hits
}
