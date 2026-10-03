// Singleton: un solo elemento Audio per tutta l'app.
export const audio: HTMLAudioElement | null = typeof Audio !== 'undefined' ? new Audio() : null
