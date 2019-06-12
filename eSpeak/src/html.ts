
export function createHTMLAudioElement(wav: Buffer) {
  const audio = document.createElement('audio')
  audio.setAttribute('controls', '')
  audio.src = `data:audio/wav;base64,${wav.toString('base64')}`
  return audio
}
