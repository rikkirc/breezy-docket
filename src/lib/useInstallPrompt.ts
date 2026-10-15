import { useEffect, useState } from 'react'

/** Chrome's install event; not in TypeScript's DOM types yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * On Android and desktop Chrome/Edge the browser offers to install the app; this keeps that offer so a
 * button can show it. Returns null where the browser has no offer (already installed, iPhone, Firefox).
 */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setEvent(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!event) return null
  return async () => {
    await event.prompt()
    await event.userChoice
    setEvent(null)
  }
}

export function isInstalled(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches ?? false
}
