import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, Headphones } from 'lucide-react';
import './lecture-player.css';

const STORE = 'kazimi-audio-progress-v1';
function readProgress() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } }
function formatTime(seconds) { const n = Math.max(0, Math.floor(Number(seconds) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; }

// The audio element stays mounted in CloudApp, outside the changing page content.
export default function LecturePlayer({ lecture, onClose }) {
  const audio = useRef(null);
  const lastSaved = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState('');
  const seek = offset => { if (!audio.current) return; audio.current.currentTime = Math.max(0, Math.min(audio.current.duration || Infinity, audio.current.currentTime + offset)); };
  const toggle = () => { if (!audio.current) return; if (audio.current.paused) audio.current.play().catch(() => setError('تعذر تشغيل التسجيل. اضغط تشغيل مرة أخرى.')); else audio.current.pause(); };
  const save = () => { if (!lecture?.id || !audio.current) return; try { const all = readProgress(); all[lecture.id] = audio.current.currentTime; localStorage.setItem(STORE, JSON.stringify(all)); } catch {} };
  useEffect(() => {
    const element = audio.current;
    if (!element || !lecture?.audioUrl) return;
    setError(''); setPlaying(false); setDuration(0); setPosition(0); lastSaved.current = 0;
    element.load();
    element.playbackRate = speed;
    const resume = () => { const old = Number(readProgress()[lecture.id] || 0); if (old > 0 && old < element.duration - 3) element.currentTime = old; };
    element.addEventListener('loadedmetadata', resume);
    // Playback must be initiated by the student's tap, not automatic navigation.
    return () => { element.removeEventListener('loadedmetadata', resume); }; 
  }, [lecture?.id, lecture?.audioUrl]);
  useEffect(() => {
    if (!lecture || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    session.metadata = new MediaMetadata({ title: lecture.title || 'محاضرة', artist: lecture.teacherName || 'مدرسة الشيخ محمد حسين الكاظمي', album: lecture.channelName || 'المحاضرات' });
    const handlers = { play: () => audio.current?.play().catch(() => {}), pause: () => audio.current?.pause(), seekbackward: details => seek(-5), seekforward: details => seek(5), seekto: details => { if (audio.current && Number.isFinite(details.seekTime)) audio.current.currentTime = details.seekTime; } };
    Object.entries(handlers).forEach(([action, handler]) => { try { session.setActionHandler(action, handler); } catch {} });
    return () => { Object.keys(handlers).forEach(action => { try { session.setActionHandler(action, null); } catch {} }); session.metadata = null; };
  }, [lecture?.id]);
  if (!lecture?.audioUrl) return null;
  return <aside className="lecture-player" dir="rtl" aria-label="مشغل المحاضرات">
    <audio ref={audio} src={lecture.audioUrl} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => { setPlaying(false); save(); }} onTimeUpdate={event => { const t = event.currentTarget.currentTime; setPosition(t); if (t - lastSaved.current >= 5 || t < lastSaved.current) { lastSaved.current = t; save(); } }} onDurationChange={event => setDuration(event.currentTarget.duration || 0)} onEnded={() => { setPlaying(false); try { const all = readProgress(); delete all[lecture.id]; localStorage.setItem(STORE, JSON.stringify(all)); } catch {} }} onError={() => setError('تعذر تحميل التسجيل، تأكد من الاتصال والصلاحية.')} />
    <div className="lecture-player-heading"><Headphones size={19} /><div className="lecture-player-label"><strong title={lecture.title}>{lecture.title}</strong><small>{lecture.teacherName || lecture.channelName || 'محاضرة صوتية'}</small></div><button className="lecture-player-close" onClick={() => { save(); audio.current?.pause(); onClose(); }} aria-label="إغلاق المشغل"><X size={19}/></button></div>
    <div className="lecture-player-progress"><span>{formatTime(position)}</span><input aria-label="موضع التسجيل" type="range" min="0" max={duration || 1} step="1" value={Math.min(position, duration || 1)} onChange={e => { if (audio.current) audio.current.currentTime = Number(e.target.value); }} /><span>{formatTime(duration)}</span></div>
    <div className="lecture-player-controls"><button onClick={() => seek(-5)} aria-label="رجوع خمس ثوان"><SkipBack size={19}/><span>5ث</span></button><button className="lecture-player-play" onClick={toggle} aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}>{playing ? <Pause size={23}/> : <Play size={23}/>}</button><button onClick={() => seek(5)} aria-label="تقديم خمس ثوان"><SkipForward size={19}/><span>5ث</span></button><label className="lecture-player-speed">السرعة <select value={speed} onChange={e => { const value = Number(e.target.value); setSpeed(value); if (audio.current) audio.current.playbackRate = value; }} aria-label="سرعة الاستماع">{[0.75,1,1.25,1.5,1.75,2].map(v => <option key={v} value={v}>{v}×</option>)}</select></label></div>
    {error && <small className="lecture-player-error" role="alert">{error}</small>}
  </aside>;
}
