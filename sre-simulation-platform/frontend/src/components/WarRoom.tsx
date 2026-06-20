import { useState, useEffect, useRef, useCallback } from 'react'
import { SystemState } from '../types'

interface WarRoomProps {
  isOpen: boolean
  onClose: () => void
  systemState?: SystemState
  scenarioName?: string
  onTranscriptUpdate?: (entries: { speaker: string; text: string; timestamp: string }[]) => void
}

interface TranscriptEntry {
  speaker: 'alex' | 'sarah' | 'you'
  text: string
  timestamp: string
}

// Call stages: opening → 3 SRE turns with AI responses in between → close
type CallStage =
  | 'joining'
  | 'alex_opens'       // Alex hardcoded opener (no API latency on first line)
  | 'sre_turn_1'       // User responds
  | 'sarah_thinking'   // Fetching Sarah's AI response
  | 'sarah_speaks_1'   // Sarah AI response plays
  | 'sre_turn_2'
  | 'alex_thinking'    // Fetching Alex's AI response
  | 'alex_speaks_2'    // Alex AI response plays
  | 'sre_turn_3'
  | 'sarah_thinking_2' // Fetching Sarah's closing
  | 'sarah_closes'     // Sarah AI closing plays
  | 'ended'

const ALEX_OPENER =
  "Hey team, I've just joined. Give me a quick rundown — what's happening, what's the blast radius, and do we have confirmed customer impact?"

function getNow(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function getVoices(): { male: SpeechSynthesisVoice | null; female: SpeechSynthesisVoice | null } {
  const voices = window.speechSynthesis?.getVoices() ?? []
  const female =
    voices.find(v => /female|woman|zira|susan|samantha|victoria|karen|moira|tessa|fiona|veena|allison|ava/i.test(v.name)) ??
    voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('f')) ??
    voices[1] ?? null
  const male =
    voices.find(v => /daniel|david|alex|tom|fred|jorge|diego|luca|rishi/i.test(v.name)) ??
    voices.find(v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('f')) ??
    voices[0] ?? null
  return { male, female }
}

const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
  .replace('wss://', 'https://')
  .replace('ws://', 'http://')

export default function WarRoom({ isOpen, onClose, systemState, scenarioName, onTranscriptUpdate }: WarRoomProps) {
  const [stage, setStage] = useState<CallStage>('joining')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState('')
  const [alexJoined, setAlexJoined] = useState(false)
  const [sarahJoined, setSarahJoined] = useState(false)
  const [textFallback, setTextFallback] = useState('')
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false)
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')

  const transcriptEndRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const stageRef = useRef<CallStage>('joining')
  stageRef.current = stage

  // Collect conversation entries for API context
  const transcriptRef = useRef<TranscriptEntry[]>([])
  transcriptRef.current = transcript

  // Check SpeechRecognition support
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    setHasSpeechRecognition(!!(w.webkitSpeechRecognition ?? w.SpeechRecognition))
  }, [])

  // Load voices
  useEffect(() => {
    if (!isOpen) return
    if (window.speechSynthesis?.getVoices().length > 0) { setVoicesLoaded(true); return }
    const onVoicesChanged = () => setVoicesLoaded(true)
    window.speechSynthesis?.addEventListener('voiceschanged', onVoicesChanged)
    const fallback = setTimeout(() => setVoicesLoaded(true), 3000)
    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', onVoicesChanged)
      clearTimeout(fallback)
    }
  }, [isOpen])

  // Scroll transcript
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [transcript])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
      recognitionRef.current?.abort()
    }
  }, [])

  const addEntry = useCallback((speaker: TranscriptEntry['speaker'], text: string) => {
    setTranscript(prev => {
      const next = [...prev, { speaker, text, timestamp: getNow() }]
      onTranscriptUpdate?.(next)
      return next
    })
  }, [onTranscriptUpdate])

  const speak = useCallback((text: string, speaker: 'alex' | 'sarah', onDone: () => void) => {
    if (!window.speechSynthesis) { onDone(); return }
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    const { male, female } = getVoices()
    if (speaker === 'alex' && male) utter.voice = male
    if (speaker === 'sarah' && female) utter.voice = female
    utter.rate = 0.95
    utter.pitch = speaker === 'sarah' ? 1.1 : 0.9
    setIsSpeaking(true)
    utter.onend = () => { setIsSpeaking(false); onDone() }
    utter.onerror = () => { setIsSpeaking(false); onDone() }
    window.speechSynthesis.speak(utter)
  }, [])

  // Fetch NPC response from Claude via backend
  const fetchNPCResponse = useCallback(async (
    nextSpeaker: 'alex' | 'sarah',
    exchangeIndex: number
  ): Promise<string> => {
    const servicesDown: string[] = []
    const servicesDegraded: string[] = []
    if (systemState) {
      for (const [name, svc] of Object.entries(systemState.services)) {
        if (svc.status === 'down') servicesDown.push(name)
        else if (svc.status === 'degraded') servicesDegraded.push(name)
      }
    }

    const body = {
      scenario_name: scenarioName ?? systemState?.scenario_id ?? 'Production Incident',
      services_down: servicesDown,
      services_degraded: servicesDegraded,
      conversation: transcriptRef.current.map(e => ({ speaker: e.speaker, text: e.text })),
      next_speaker: nextSpeaker,
      exchange_index: exchangeIndex,
    }

    try {
      const res = await fetch(`${API_BASE}/warroom/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { text: string }
      return data.text
    } catch {
      return nextSpeaker === 'alex'
        ? "What's the current status and customer impact?"
        : "Walk me through your investigation so far."
    }
  }, [systemState, scenarioName])

  // Start listening
  const startListening = useCallback((onResult: (text: string) => void) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.webkitSpeechRecognition ?? w.SpeechRecognition
    if (!SR) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR()
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    let finalText = ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interim += result[0].transcript
      }
      setLiveTranscript(finalText + interim)
    }

    recognition.onend = () => {
      setIsRecording(false)
      setLiveTranscript('')
      onResult(finalText || '[no response recorded]')
    }

    recognition.onerror = () => {
      setIsRecording(false)
      setLiveTranscript('')
      onResult(finalText || '[no response recorded]')
    }

    setIsRecording(true)
    recognition.start()
  }, [])

  // Joining sequence
  useEffect(() => {
    if (!isOpen || !voicesLoaded) return

    setStage('joining')
    setTranscript([])
    setAlexJoined(false)
    setSarahJoined(false)
    setIsSpeaking(false)
    setIsRecording(false)
    setIsLoading(false)

    const t1 = setTimeout(() => setAlexJoined(true), 600)
    const t2 = setTimeout(() => setSarahJoined(true), 1200)
    const t3 = setTimeout(() => setStage('alex_opens'), 2000)

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
      window.speechSynthesis?.cancel()
      recognitionRef.current?.abort()
    }
  }, [isOpen, voicesLoaded])

  // Drive conversation — hardcoded opener only, all other NPC lines are AI-generated
  useEffect(() => {
    if (!isOpen) return

    if (stage === 'alex_opens') {
      addEntry('alex', ALEX_OPENER)
      speak(ALEX_OPENER, 'alex', () => setStage('sre_turn_1'))
    }

    if (stage === 'sarah_thinking') {
      setIsLoading(true)
      setLoadingLabel('Sarah is reviewing your update…')
      fetchNPCResponse('sarah', 0).then(text => {
        setIsLoading(false)
        addEntry('sarah', text)
        setStage('sarah_speaks_1')
        speak(text, 'sarah', () => setStage('sre_turn_2'))
      })
    }

    if (stage === 'alex_thinking') {
      setIsLoading(true)
      setLoadingLabel('Alex is formulating questions…')
      fetchNPCResponse('alex', 1).then(text => {
        setIsLoading(false)
        addEntry('alex', text)
        setStage('alex_speaks_2')
        speak(text, 'alex', () => setStage('sre_turn_3'))
      })
    }

    if (stage === 'sarah_thinking_2') {
      setIsLoading(true)
      setLoadingLabel('Sarah is wrapping up…')
      fetchNPCResponse('sarah', 2).then(text => {
        setIsLoading(false)
        addEntry('sarah', text)
        setStage('sarah_closes')
        speak(text, 'sarah', () => setStage('ended'))
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, isOpen])

  function handleSpeak() {
    if (isRecording) return
    startListening(text => {
      addEntry('you', text)
      advanceAfterSRE()
    })
  }

  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = textFallback.trim() || '[no response recorded]'
    setTextFallback('')
    addEntry('you', text)
    advanceAfterSRE()
  }

  function advanceAfterSRE() {
    const cur = stageRef.current
    if (cur === 'sre_turn_1') setStage('sarah_thinking')
    else if (cur === 'sre_turn_2') setStage('alex_thinking')
    else if (cur === 'sre_turn_3') setStage('sarah_thinking_2')
  }

  function handleClose() {
    window.speechSynthesis?.cancel()
    recognitionRef.current?.abort()
    setStage('joining')
    setTranscript([])
    onClose()
  }

  if (!isOpen) return null

  const isSREturn = stage === 'sre_turn_1' || stage === 'sre_turn_2' || stage === 'sre_turn_3'
  const speakDisabled = isSpeaking || isRecording || isLoading || !isSREturn
  const isAlexSpeaking = isSpeaking && (stage === 'alex_opens' || stage === 'alex_speaks_2')
  const isSarahSpeaking = isSpeaking && (stage === 'sarah_speaks_1' || stage === 'sarah_closes')
  const isAlexThinking = stage === 'alex_thinking'
  const isSarahThinking = stage === 'sarah_thinking' || stage === 'sarah_thinking_2'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="relative flex flex-col w-full max-w-3xl h-[580px] bg-[#0d1117] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden"
        style={{ fontFamily: 'ui-monospace, monospace' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#161b22] border-b border-[#30363d]">
          <div className="flex items-center gap-3">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full bg-[#f85149]"
              style={{ animation: 'warPulse 1.2s ease-in-out infinite' }}
            />
            <span className="text-sm font-semibold text-white tracking-wide">
              War Room — Active Incident
            </span>
            {scenarioName && (
              <span className="text-xs text-[#8b949e] hidden sm:block">· {scenarioName}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#8b949e]">{getNow()}</span>
            <button
              onClick={handleClose}
              className="text-[#8b949e] hover:text-white transition-colors text-lg leading-none"
              aria-label="Close war room"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Participant tiles */}
          <div className="flex flex-col w-60 shrink-0 border-r border-[#30363d] bg-[#0d1117] p-3 gap-3">
            <ParticipantTile
              initials="AC"
              name="Alex Chen"
              role="Engineering Manager"
              avatarBg="#0d4a6e"
              avatarColor="#58a6ff"
              joined={alexJoined}
              isSpeaking={isAlexSpeaking}
              isThinking={isAlexThinking}
            />
            <ParticipantTile
              initials="SO"
              name="Sarah O."
              role="Team Lead"
              avatarBg="#2d1d4a"
              avatarColor="#d2a8ff"
              joined={sarahJoined}
              isSpeaking={isSarahSpeaking}
              isThinking={isSarahThinking}
            />
            {/* SRE tile */}
            <div
              className="flex flex-col items-center justify-center bg-[#161b22] border rounded-lg p-3 gap-2 mt-auto"
              style={{ minHeight: 100, borderColor: isRecording ? '#f85149' : isSREturn ? '#3fb950' : '#30363d' }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2"
                style={{ background: '#1a2d1a', borderColor: '#3fb950', color: '#3fb950' }}
              >
                🎙
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-white">You (SRE)</div>
                {isRecording ? (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#f85149]" style={{ animation: 'warPulse 0.7s ease-in-out infinite' }} />
                    <span className="text-[10px] text-[#f85149]">Recording…</span>
                  </div>
                ) : isSREturn ? (
                  <div className="text-[10px] text-[#3fb950] mt-1">Your turn</div>
                ) : isLoading ? (
                  <div className="text-[10px] text-[#8b949e] mt-1">Standby…</div>
                ) : null}
              </div>
            </div>

            {/* Exchange counter */}
            <div className="text-center text-[10px] text-[#484f58]">
              {stage === 'ended' ? '✓ Call ended' :
               stage === 'joining' || stage === 'alex_opens' ? 'Exchange 0 / 3' :
               stage === 'sre_turn_1' || stage === 'sarah_thinking' || stage === 'sarah_speaks_1' ? 'Exchange 1 / 3' :
               stage === 'sre_turn_2' || stage === 'alex_thinking' || stage === 'alex_speaks_2' ? 'Exchange 2 / 3' :
               'Exchange 3 / 3'}
            </div>
          </div>

          {/* Right: Transcript */}
          <div className="flex flex-col flex-1 min-h-0">
            <div className="px-4 py-2 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between">
              <span className="text-[11px] text-[#8b949e] uppercase tracking-widest">Live Transcript</span>
              {isLoading && (
                <span className="text-[10px] text-[#d29922] animate-pulse">{loadingLabel}</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-xs font-mono">
              {stage === 'joining' && transcript.length === 0 && (
                <div className="text-[#8b949e] text-center mt-10 text-xs">
                  Connecting participants…
                </div>
              )}
              {transcript.map((entry, i) => (
                <TranscriptMessage key={i} entry={entry} />
              ))}
              {isLoading && (
                <div className="flex gap-2 items-center opacity-60">
                  <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border" style={{ background: stage === 'alex_thinking' ? '#0d4a6e' : '#2d1d4a', borderColor: stage === 'alex_thinking' ? '#58a6ff55' : '#d2a8ff55', color: stage === 'alex_thinking' ? '#58a6ff' : '#d2a8ff' }}>
                    {stage === 'alex_thinking' ? 'AC' : 'SO'}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="inline-block w-1.5 h-1.5 rounded-full bg-[#8b949e]" style={{ animation: `warPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-[#30363d] px-4 py-3 bg-[#161b22]">
              {stage === 'ended' ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8b949e]">War room closed — good work on the call</span>
                  <button
                    onClick={handleClose}
                    className="px-4 py-1.5 rounded text-xs font-semibold bg-[#f85149]/20 text-[#f85149] border border-[#f85149]/40 hover:bg-[#f85149]/30 transition-colors"
                  >
                    Leave Call
                  </button>
                </div>
              ) : hasSpeechRecognition ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSpeak}
                      disabled={speakDisabled}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-semibold border transition-all ${
                        isRecording
                          ? 'bg-[#f85149]/20 text-[#f85149] border-[#f85149]/60 cursor-not-allowed'
                          : speakDisabled
                          ? 'bg-[#161b22] text-[#484f58] border-[#30363d] cursor-not-allowed'
                          : 'bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/40 hover:bg-[#3fb950]/20 cursor-pointer'
                      }`}
                    >
                      {isRecording ? (
                        <>
                          <span className="inline-block w-2 h-2 rounded-full bg-[#f85149]" style={{ animation: 'warPulse 0.7s ease-in-out infinite' }} />
                          Listening…
                        </>
                      ) : '🎙 Speak'}
                    </button>
                    {isRecording && (
                      <button
                        onClick={() => recognitionRef.current?.stop()}
                        className="px-3 py-1 rounded text-xs bg-[#f85149]/20 text-[#f85149] border border-[#f85149]/40 hover:bg-[#f85149]/30 transition-colors"
                      >
                        ■ Done Speaking
                      </button>
                    )}
                    <span className="text-[10px] text-[#484f58]">
                      {isSREturn ? 'Click to record — speak freely, press Done when finished'
                        : isLoading ? loadingLabel
                        : isSpeaking ? 'Participant is speaking…'
                        : ''}
                    </span>
                  </div>
                  {isRecording && liveTranscript && (
                    <div className="text-[#8b949e] text-[10px] italic mt-1 max-w-xs truncate">"{liveTranscript}"</div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleTextSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={textFallback}
                    onChange={e => setTextFallback(e.target.value)}
                    disabled={speakDisabled}
                    placeholder={
                      isSREturn ? 'Type your response…'
                        : isLoading ? loadingLabel
                        : 'Waiting for participant…'
                    }
                    className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-xs text-white placeholder-[#484f58] outline-none focus:border-[#58a6ff] disabled:opacity-40"
                  />
                  <button
                    type="submit"
                    disabled={speakDisabled}
                    className="px-3 py-1.5 rounded text-xs font-semibold bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/40 hover:bg-[#3fb950]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Send
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes warPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// --- Sub-components ---

interface ParticipantTileProps {
  initials: string
  name: string
  role: string
  avatarBg: string
  avatarColor: string
  joined: boolean
  isSpeaking: boolean
  isThinking: boolean
}

function ParticipantTile({ initials, name, role, avatarBg, avatarColor, joined, isSpeaking, isThinking }: ParticipantTileProps) {
  return (
    <div
      className="flex flex-col items-center justify-center bg-[#161b22] border rounded-lg p-3 gap-2 transition-all duration-500"
      style={{
        minHeight: 100,
        borderColor: isSpeaking ? avatarColor : isThinking ? `${avatarColor}80` : '#30363d',
        boxShadow: isSpeaking ? `0 0 0 2px ${avatarColor}40` : isThinking ? `0 0 0 1px ${avatarColor}25` : 'none',
        opacity: joined ? 1 : 0.35,
        animation: joined ? 'fadeSlideIn 0.4s ease both' : 'none',
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all"
        style={{ background: avatarBg, borderColor: isSpeaking ? avatarColor : `${avatarColor}55`, color: avatarColor }}
      >
        {initials}
      </div>
      <div className="text-center">
        <div className="text-xs font-semibold text-white">{name}</div>
        <div className="text-[10px] text-[#8b949e]">{role}</div>
        {joined && (
          <div className="text-[10px] mt-0.5" style={{ color: isSpeaking ? avatarColor : isThinking ? '#d29922' : '#3fb950' }}>
            {isSpeaking ? '🔊 speaking…' : isThinking ? '💭 thinking…' : '● joined'}
          </div>
        )}
        {!joined && <div className="text-[10px] mt-0.5 text-[#484f58]">connecting…</div>}
      </div>
    </div>
  )
}

function TranscriptMessage({ entry }: { entry: TranscriptEntry }) {
  const isAlex = entry.speaker === 'alex'
  const isSarah = entry.speaker === 'sarah'
  const avatarColor = isAlex ? '#58a6ff' : isSarah ? '#d2a8ff' : '#3fb950'
  const avatarBg = isAlex ? '#0d4a6e' : isSarah ? '#2d1d4a' : '#1a2d1a'
  const initials = isAlex ? 'AC' : isSarah ? 'SO' : '🎙'
  const displayName = isAlex ? 'Alex Chen' : isSarah ? 'Sarah O.' : 'You'

  return (
    <div className="flex gap-2" style={{ animation: 'fadeSlideIn 0.3s ease both' }}>
      <div
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border mt-0.5"
        style={{ background: avatarBg, borderColor: `${avatarColor}55`, color: avatarColor }}
      >
        {entry.speaker === 'you' ? '🎙' : initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold" style={{ color: avatarColor }}>{displayName}</span>
          <span className="text-[10px] text-[#484f58]">{entry.timestamp}</span>
        </div>
        <div className={`text-xs mt-0.5 leading-relaxed break-words ${entry.speaker === 'you' ? 'text-[#e6edf3]' : 'text-[#c9d1d9]'}`}>
          {entry.speaker === 'you' && <span className="text-[#8b949e] mr-1">🎙</span>}
          {entry.text}
        </div>
      </div>
    </div>
  )
}
