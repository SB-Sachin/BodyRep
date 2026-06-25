// Floating camera overlay for AI form critique. Records a short, low-framerate
// clip of the current exercise, sends it to Gemini Vision via formCritique(), and
// shows a structured score + cues. The clip is never persisted — it goes to the
// API only and is discarded. Camera stream is released on unmount.

import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { formCritique } from '../ai/gemini.js'
import { getExercise } from '../data/exercises.js'
import Icon from './Icon.jsx'

const MAX_SECONDS = 10

// Which camera angle best reveals form faults for each movement pattern.
// Side view shows depth, spine angle, hip sag and ROM; front view shows
// symmetry and lateral lean. Falls back to side.
const ANGLE_BY_PATTERN = {
  'horizontal-press': 'side',
  'vertical-press': 'side',
  'vertical-pull': 'side',
  'horizontal-pull': 'side',
  squat: 'side',
  hinge: 'side',
  lunge: 'side',
  'anti-extension': 'side',
  compression: 'side',
  'anti-rotation': 'front',
  'anti-lateral-flexion': 'front',
  'rear-delt': 'front',
  tricep: 'side',
}

const ANGLE_HINT = {
  side: 'Side view · stand sideways, whole body in frame, phone ~2m away at hip height',
  front: 'Front view · face the camera, whole body in frame, phone ~2m away at chest height',
}

function cameraGuide(exercise) {
  const angle = ANGLE_BY_PATTERN[exercise?.pattern] || 'side'
  return { angle, hint: ANGLE_HINT[angle] }
}

// Translucent framing outline the user lines themselves up against. A neutral
// standing figure (profile for side view, facing for front) plus corner
// brackets — its job is distance/framing/orientation, not exact pose.
function PoseOutline({ angle }) {
  const stroke = 'rgba(249,115,22,0.55)' // accent at low opacity
  const figure =
    angle === 'front' ? (
      <>
        <circle cx="80" cy="20" r="7" />
        <path d="M80 27 V54" />
        <path d="M80 33 L67 47" />
        <path d="M80 33 L93 47" />
        <path d="M80 54 L71 80" />
        <path d="M80 54 L89 80" />
      </>
    ) : (
      <>
        <circle cx="82" cy="20" r="7" />
        <path d="M88 21 h4" /> {/* nose: faces right = sideways to camera */}
        <path d="M80 27 V54" />
        <path d="M80 34 L93 46" />
        <path d="M80 54 L90 80" />
        <path d="M80 54 L74 80" />
      </>
    )
  return (
    <svg
      viewBox="0 0 160 90"
      className="pointer-events-none absolute inset-0 h-full w-full"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* corner framing brackets */}
      <path d="M10 20 V10 H22" />
      <path d="M138 10 H150 V20" />
      <path d="M10 70 V80 H22" />
      <path d="M138 80 H150 V70" />
      <g style={{ strokeDasharray: '4 3' }}>{figure}</g>
    </svg>
  )
}

export default function FormCamera({ exerciseId, onClose }) {
  const [phase, setPhase] = useState('idle') // idle | recording | analyzing | result | error
  const [countdown, setCountdown] = useState(MAX_SECONDS)
  const [result, setResult] = useState(null) // { score, issues }
  const [errorMsg, setErrorMsg] = useState('')

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const countdownRef = useRef(null)
  const mimeTypeRef = useRef('video/webm')

  const exercise = getExercise(exerciseId)
  const guide = cameraGuide(exercise)

  useEffect(() => {
    let cancelled = false
    async function startCamera() {
      try {
        // facingMode as ideal (not required) avoids OverconstrainedError on desktops.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' }, frameRate: { ideal: 8, max: 10 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setPhase('idle')
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          setErrorMsg('Camera access denied. Allow camera permission in your browser settings.')
        } else if (err.name === 'NotFoundError') {
          setErrorMsg('No camera found on this device.')
        } else {
          setErrorMsg('Could not start the camera. Close other apps using it and try again.')
        }
        setPhase('error')
      }
    }
    startCamera()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      clearInterval(countdownRef.current)
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    }
  }, [])

  const startRecording = () => {
    if (!window.MediaRecorder) {
      setErrorMsg('Your browser does not support video recording. Try Chrome or Firefox.')
      setPhase('error')
      return
    }
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : ''
    if (!mime || !streamRef.current) {
      setErrorMsg('No supported video format found in this browser.')
      setPhase('error')
      return
    }
    mimeTypeRef.current = mime
    chunksRef.current = []
    const recorder = new MediaRecorder(streamRef.current, { mimeType: mime })
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = handleRecordingStop
    recorder.start(250)
    recorderRef.current = recorder
    setCountdown(MAX_SECONDS)
    setPhase('recording')
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { stopRecording(); return 0 }
        return c - 1
      })
    }, 1000)
  }

  const stopRecording = () => {
    clearInterval(countdownRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const handleRecordingStop = () => {
    const mime = mimeTypeRef.current
    const blob = new Blob(chunksRef.current, { type: mime })
    if (blob.size > 8_000_000) {
      setErrorMsg('Recording is too large. Try stopping earlier (5–7 seconds is enough).')
      setPhase('error')
      return
    }
    setPhase('analyzing')
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = String(e.target.result).split(',')[1]
      const store = useStore.getState()
      if (!store.canCallAi()) {
        setErrorMsg('Daily AI limit reached. It resets at midnight.')
        setPhase('error')
        return
      }
      const res = await formCritique(store, exerciseId, base64, mime, guide.angle)
      if (res.ok) {
        store.recordAiCall()
        setResult({ score: res.score, issues: res.issues })
        setPhase('result')
      } else {
        setErrorMsg(res.error || 'Analysis failed. Try again.')
        setPhase('error')
      }
    }
    reader.onerror = () => {
      setErrorMsg('Could not read the recording. Try again.')
      setPhase('error')
    }
    reader.readAsDataURL(blob)
  }

  const scoreClass = (s) =>
    s >= 8 ? 'bg-green-500/20 text-green-400' : s >= 5 ? 'bg-accent/20 text-accent' : 'bg-danger/20 text-danger'

  return (
    <div className="fixed bottom-24 right-4 z-50 w-72 overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <span className="text-xs font-semibold text-slate-300">Form Check</span>
        <button onClick={onClose} aria-label="Close form check" className="text-slate-400 hover:text-slate-200">
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        {/* Framing guide — visible while lining up and recording, hidden once analyzing */}
        {(phase === 'idle' || phase === 'recording') && <PoseOutline angle={guide.angle} />}
        {(phase === 'idle' || phase === 'recording') && (
          <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            {guide.angle} view
          </div>
        )}
        {phase === 'recording' && (
          <div className="absolute right-2 top-2 rounded-full bg-danger px-2 py-0.5 text-xs font-bold tnum text-white">
            {countdown}s
          </div>
        )}
        {phase === 'analyzing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-sm text-slate-300">Analyzing…</span>
          </div>
        )}
      </div>

      <div className="space-y-3 p-3">
        {phase === 'idle' && (
          <>
            <p className="text-center text-[11px] leading-snug text-slate-400">{guide.hint}</p>
            <button className="btn-accent w-full text-sm" onClick={startRecording}>
              <Icon name="camera" size={16} /> Record (max {MAX_SECONDS}s)
            </button>
          </>
        )}

        {phase === 'recording' && (
          <button className="btn-danger w-full text-sm" onClick={stopRecording}>
            <Icon name="x" size={16} /> Stop &amp; Analyze
          </button>
        )}

        {phase === 'analyzing' && (
          <p className="text-center text-xs text-slate-400">Sending to AI coach…</p>
        )}

        {phase === 'result' && result && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold">Form Score</span>
              <span className={`rounded-full px-3 py-0.5 text-sm font-extrabold tnum ${scoreClass(result.score)}`}>
                {result.score}/10
              </span>
            </div>
            <ul className="space-y-1.5">
              {result.issues.map((issue, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-300">
                  <span className={`mt-0.5 shrink-0 ${issue.tag === 'Good' ? 'text-green-400' : 'text-danger'}`}>
                    <Icon name={issue.tag === 'Good' ? 'check' : 'x'} size={12} strokeWidth={2.5} />
                  </span>
                  {issue.text}
                </li>
              ))}
            </ul>
            <button className="btn-ghost mt-3 w-full text-xs" onClick={() => setPhase('idle')}>
              Try again
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div>
            <p className="mb-2 text-xs text-danger">{errorMsg}</p>
            <button className="btn-ghost w-full text-xs" onClick={() => setPhase('idle')}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
