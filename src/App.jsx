import { useEffect, useRef, useState } from 'react'

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const getSupportedMimeType = () => {
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
  ]

  return mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [timer, setTimer] = useState(0)
  const [recordingUrl, setRecordingUrl] = useState('')
  const [downloadFileName, setDownloadFileName] = useState('')
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerIntervalRef = useRef(null)

  function clearTimer() {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }

  const startTimer = () => {
    setTimer(0)
    timerIntervalRef.current = setInterval(() => {
      setTimer((prev) => prev + 1)
    }, 1000)
  }

  function stopAllTracks() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl)
      }
      stopAllTracks()
      clearTimer()
    }
  }, [recordingUrl])

  const startRecording = async () => {
    try {
      setError('')
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl)
        setRecordingUrl('')
      }
      setDownloadFileName('')

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      streamRef.current = stream
      chunksRef.current = []

      const preferredMimeType = getSupportedMimeType()
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        clearTimer()
        setIsRecording(false)
        stopAllTracks()

        if (chunksRef.current.length === 0) {
          setError(
            'Recording saved but no video data was captured. Please share a full screen/window and try again.',
          )
          return
        }

        const chunkType = chunksRef.current[0]?.type || recorder.mimeType || 'video/webm'
        const blob = new Blob(chunksRef.current, { type: chunkType })
        if (blob.size === 0) {
          setError('Captured file is empty. Please try recording again.')
          return
        }

        const url = URL.createObjectURL(blob)
        setRecordingUrl(url)
        setDownloadFileName(`quickcast-${new Date().toISOString().replaceAll(':', '-')}.webm`)
      }

      recorder.onerror = () => {
        setError('Recording failed. Please try again.')
        clearTimer()
        setIsRecording(false)
        stopAllTracks()
      }

      const [videoTrack] = stream.getVideoTracks()
      if (videoTrack) {
        videoTrack.onended = () => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop()
          }
        }
      }

      recorder.start(1000)
      setIsRecording(true)
      startTimer()
    } catch (err) {
      const message =
        err?.name === 'NotAllowedError'
          ? 'Screen share permission denied.'
          : err?.name === 'NotFoundError'
            ? 'No screen source found.'
            : 'Screen recording could not be started.'

      setError(message)
      setIsRecording(false)
      clearTimer()
      stopAllTracks()
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.requestData()
      mediaRecorderRef.current.stop()
    }
  }

  const recordAgain = () => {
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl)
      setRecordingUrl('')
    }
    setDownloadFileName('')
    setError('')
    setTimer(0)
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-2xl bg-white p-8 shadow-lg">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">QuickCast</h1>
          <p className="mt-2 text-sm text-slate-500">A minimal Loom-like screen recorder.</p>
        </header>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {!isRecording && !recordingUrl ? (
          <button
            type="button"
            onClick={startRecording}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
          >
            Start Recording
          </button>
        ) : null}

        {isRecording ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-indigo-100 bg-indigo-50 p-6">
            <p className="text-sm font-medium text-indigo-700">Recording... {formatTime(timer)}</p>
            <button
              type="button"
              onClick={stopRecording}
              className="rounded-xl bg-red-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-red-500"
            >
              Stop Recording
            </button>
          </div>
        ) : null}

        {recordingUrl ? (
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4">
            <video src={recordingUrl} controls className="w-full rounded-xl bg-black" />
            <div className="flex flex-wrap gap-3">
              <a
                href={recordingUrl}
                download={downloadFileName || 'quickcast-recording.webm'}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
              >
                Download Video
              </a>
              <button
                type="button"
                onClick={recordAgain}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Record Again
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default App
