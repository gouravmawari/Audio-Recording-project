import React, { useCallback, useEffect, useRef, useState } from 'react'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const SUBMISSIONS_PATH = '/api/audio-submissions'

function messageFrom(error) {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

function safeValue(value) {
  return value == null ? '' : String(value)
}

function extensionForMime(mimeType) {
  if (mimeType.split(';', 1)[0] === 'audio/mp4') return 'mp4'
  if (mimeType.split(';', 1)[0] === 'audio/ogg') return 'ogg'
  return 'webm'
}

function App() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordingError, setRecordingError] = useState('')
  const [submitState, setSubmitState] = useState({ loading: false, error: '', success: '' })
  const [listState, setListState] = useState({ loading: true, error: '', items: [] })
  const [refreshing, setRefreshing] = useState(false)
  const inputRef = useRef(null)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const previewUrlRef = useRef('')
  const mountedRef = useRef(true)
  const discardedRecordersRef = useRef(new WeakSet())
  const recordingAttemptRef = useRef(0)
  const listRequestRef = useRef(null)

  const setNewSource = useCallback((next) => {
    if (!mountedRef.current) return
    const nextUrl = next ? URL.createObjectURL(next) : ''
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = nextUrl
    setPreviewUrl(nextUrl)
    setSource(next)
  }, [])

  const loadSubmissions = useCallback(async (manual = false) => {
    listRequestRef.current?.abort()
    const controller = new AbortController()
    listRequestRef.current = controller
    if (manual) setRefreshing(true)
    else setListState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const response = await fetch(`${API_BASE}${SUBMISSIONS_PATH}`, { signal: controller.signal })
      if (!response.ok) throw new Error(`Could not load submissions (${response.status}).`)
      const data = await response.json()
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
      if (mountedRef.current && listRequestRef.current === controller) setListState({ loading: false, error: '', items })
    } catch (error) {
      if (error.name !== 'AbortError' && mountedRef.current && listRequestRef.current === controller) {
        setListState((current) => ({ ...current, loading: false, error: messageFrom(error) }))
      }
    } finally {
      if (mountedRef.current && listRequestRef.current === controller) setRefreshing(false)
    }
  }, [])

  const cancelRecording = useCallback(() => {
    recordingAttemptRef.current += 1
    const recorder = recorderRef.current
    const stream = streamRef.current
    if (recorder) discardedRecordersRef.current.add(recorder)
    if (recorder?.state !== 'inactive') {
      try { recorder.stop() } catch { /* Recorder is already stopping. */ }
    }
    stream?.getTracks().forEach((track) => track.stop())
    if (recorderRef.current === recorder) recorderRef.current = null
    if (streamRef.current === stream) streamRef.current = null
    if (mountedRef.current) setRecording(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    loadSubmissions()
    return () => {
      mountedRef.current = false
      cancelRecording()
      listRequestRef.current?.abort()
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ''
    }
  }, [cancelRecording, loadSubmissions])

  const chooseFile = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      cancelRecording()
      setRecordingError('')
      setNewSource(file)
    }
  }

  const startRecording = async () => {
    const attempt = ++recordingAttemptRef.current
    setRecordingError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('Audio recording is not supported by this browser.')
      return
    }
    let stream
    let recorder
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current || recordingAttemptRef.current !== attempt) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
        .find((type) => MediaRecorder.isTypeSupported(type)) || ''
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      streamRef.current = stream
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data)
      recorder.onerror = () => {
        discardedRecordersRef.current.add(recorder)
        if (recorder.state !== 'inactive') {
          try { recorder.stop() } catch { /* Recorder is already stopping. */ }
        }
        stream.getTracks().forEach((track) => track.stop())
        if (recorderRef.current === recorder) recorderRef.current = null
        if (streamRef.current === stream) streamRef.current = null
        if (mountedRef.current) {
          setRecording(false)
          setRecordingError('Recording failed. Please try again.')
        }
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (!discardedRecordersRef.current.has(recorder) && blob.size) setNewSource(blob)
        stream.getTracks().forEach((track) => track.stop())
        if (streamRef.current === stream) streamRef.current = null
        if (recorderRef.current === recorder) {
          recorderRef.current = null
          if (mountedRef.current) setRecording(false)
        }
      }
      recorder.start()
      setRecording(true)
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop())
      if (recorderRef.current === recorder) recorderRef.current = null
      if (streamRef.current === stream) streamRef.current = null
      if (mountedRef.current) {
        setRecording(false)
        setRecordingError(error?.name === 'NotAllowedError' ? 'Microphone permission was denied.' : 'Could not access the microphone.')
      }
    }
  }

  const stopRecording = () => recorderRef.current?.stop()

  const submit = async (event) => {
    event.preventDefault()
    if (!name.trim() || !phone.trim() || !source) {
      setSubmitState({ loading: false, error: 'Name, phone, and an audio file or recording are required.', success: '' })
      return
    }
    setSubmitState({ loading: true, error: '', success: '' })
    const formData = new FormData()
    formData.append('name', name.trim())
    formData.append('phone', phone.trim())
    formData.append('audio', source, source.name || `recording-${Date.now()}.${extensionForMime(source.type)}`)
    try {
      const response = await fetch(`${API_BASE}${SUBMISSIONS_PATH}`, { method: 'POST', body: formData })
      if (!response.ok) throw new Error(`Submission failed (${response.status}).`)
      if (!mountedRef.current) return
      setName('')
      setPhone('')
      setNewSource(null)
      if (inputRef.current) inputRef.current.value = ''
      setSubmitState({ loading: false, error: '', success: 'Submission sent.' })
      loadSubmissions(true)
    } catch (error) {
      if (mountedRef.current) setSubmitState({ loading: false, error: messageFrom(error), success: '' })
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">ConsultBea</p>
        <h1>Send an audio submission</h1>
        <p className="intro">Share your details and a voice note with the team.</p>
      </section>

      <section className="card" aria-labelledby="form-title">
        <h2 id="form-title">New submission</h2>
        <form onSubmit={submit}>
          <label htmlFor="name">Name</label>
          <input id="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          <label htmlFor="phone">Phone</label>
          <input id="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
          <label htmlFor="audio">Audio file</label>
          <input ref={inputRef} id="audio" type="file" accept="audio/*" onChange={chooseFile} />
          <div className="record-controls">
            {!recording ? <button type="button" onClick={startRecording}>Record</button> : <button type="button" onClick={stopRecording}>Stop</button>}
            <span>{recording ? 'Recording…' : source ? 'Audio selected' : 'No audio selected'}</span>
          </div>
          {previewUrl && <audio className="preview" controls src={previewUrl} aria-label="Selected audio preview" />}
          {recordingError && <p className="error" role="alert">{recordingError}</p>}
          {submitState.error && <p className="error" role="alert">{submitState.error}</p>}
          {submitState.success && <p className="success" role="status">{submitState.success}</p>}
          <button className="submit" type="submit" disabled={submitState.loading || recording}>{submitState.loading ? 'Sending…' : 'Send submission'}</button>
        </form>
      </section>

      <section className="list-section" aria-labelledby="list-title">
        <div className="list-heading"><h2 id="list-title">Recent submissions</h2><button type="button" onClick={() => loadSubmissions(true)} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
        {listState.loading && <p>Loading submissions…</p>}
        {listState.error && <div className="error-row"><p className="error" role="alert">{listState.error}</p><button type="button" onClick={() => loadSubmissions(true)}>Try again</button></div>}
        {!listState.loading && !listState.error && !listState.items.length && <p>No submissions yet.</p>}
        {!listState.loading && !listState.error && listState.items.length > 0 && <ul className="submission-list">{listState.items.map((item, index) => {
          const id = safeValue(item?.id || item?._id)
          return <li key={id || index}><strong>{safeValue(item?.name) || 'Unnamed'}</strong><span>{safeValue(item?.phone)}</span>{id && <audio controls src={`${API_BASE}${SUBMISSIONS_PATH}/${encodeURIComponent(id)}/audio`} aria-label={`Audio from ${safeValue(item?.name) || 'submission'}`} />}</li>
        })}</ul>}
      </section>
    </main>
  )
}

export default App
