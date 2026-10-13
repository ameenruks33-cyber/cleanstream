import { Router } from 'express'
import { validateOwnedVideoId } from '../../src/lib/validation.ts'
import { getOwnedVideo, ownedVideos } from '../services/ownedLibrary.ts'

export function libraryRouter(): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    res.json({ items: ownedVideos })
  })

  router.get('/:id', (req, res) => {
    const id = validateOwnedVideoId(String(req.params.id ?? ''))
    if (!id.ok) {
      res.status(400).json({ error: id.error, code: id.code })
      return
    }
    const video = getOwnedVideo(id.value)
    if (!video) {
      res.status(404).json({ error: 'MyTube title not found.', code: 'VIDEO_NOT_FOUND' })
      return
    }
    res.json({ video })
  })

  return router
}
