import { useEffect, useMemo, useState } from 'react'
import { emotionOptions, projeto66Missions, projeto66Pillars } from '../data/projeto66-content'
import { useProjeto66Cycle } from '../hooks/useProjeto66Cycle'
import { calculatePillarScore } from '../services/scoring'
import { PROJETO66_ACTIVITY_KEYS } from '../data/projeto66-contract'

const emptyPillars = Object.fromEntries(projeto66Pillars.map((pillar) => [pillar.key, 5]))
const emptyMissions = Object.fromEntries(projeto66Missions.map((mission) => [mission.key, false]))

function recordButtonLabel({ saved, saving, saveError, existing }) {
  if (saved) return 'Registro salvo'
  if (saving) return 'Salvando…'
  if (saveError) return 'Tentar novamente'
  return existing ? 'Salvar missões e conteúdo privado' : 'Concluir registro do dia'
}

export function Projeto66RecordPage() {
  const { durationDays, cycle, currentDay, saveDailyRecord, saveChecklist, loadPrivateResponse, savePrivateResponse } = useProjeto66Cycle()
  const day = currentDay || 1
  const existing = cycle.dailyRecords[day]
  const [pillars, setPillars] = useState(existing?.pillars ?? emptyPillars)
  const [missions, setMissions] = useState({ ...emptyMissions, ...cycle.checklistByDay[day] })
  const [emotion, setEmotion] = useState(null)
  const [gratitude, setGratitude] = useState(['', '', ''])
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const score = useMemo(() => calculatePillarScore(pillars), [pillars])
  const active = cycle.status === 'ACTIVE'

  useEffect(() => {
    let mounted = true
    loadPrivateResponse(PROJETO66_ACTIVITY_KEYS.dailyReflection)
      .then((payload) => {
        if (!mounted || !payload) return
        setEmotion(typeof payload.emotion === 'number' ? payload.emotion : null)
        if (Array.isArray(payload.gratitude) && payload.gratitude.every((item) => typeof item === 'string')) setGratitude(payload.gratitude)
      })
      .catch(() => undefined)
    return () => { mounted = false }
  }, [loadPrivateResponse])

  function updatePillar(key, value) { setPillars((current) => ({ ...current, [key]: Number(value) })) }
  function toggleMission(key) { setMissions((current) => ({ ...current, [key]: !current[key] })) }
  function updateGratitude(index, value) { setGratitude((current) => current.map((item, itemIndex) => itemIndex === index ? value : item)) }

  async function submit(event) {
    event.preventDefault()
    if (!active) return
    setSaving(true)
    setSaveError(null)
    try {
      const recordedAt = new Date().toISOString()
      if (!existing) await saveDailyRecord(day, { programDay: day, pillars, score, recordedAt })
      await saveChecklist(day, missions)
      if (emotion !== null || gratitude.some((reflection) => reflection.trim().length > 0)) {
        await savePrivateResponse(PROJETO66_ACTIVITY_KEYS.dailyReflection, { emotion, gratitude, recordedAt })
      }
      setSaved(true)
    } catch {
      setSaveError('Não foi possível salvar o registro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="p66-record" onSubmit={submit}>
      <header className="p66-page-title"><span>{active ? `Dia ${day} de ${durationDays}` : 'Ciclo ainda não iniciado'}</span><h1>Registrar o dia</h1></header>
      {!active && <section className="p66-callout"><b>🔥</b><p><strong>Inicie seu ciclo primeiro.</strong> Volte à tela Hoje para acender a chama.</p></section>}
      <section className="p66-record-section"><div className="p66-section-head"><div><span>Placar objetivo</span><h2>Seus seis pilares</h2></div><strong>{score}<small>/60</small></strong></div>{projeto66Pillars.map((pillar) => <label className="p66-slider" key={pillar.key} style={{ '--pillar': pillar.color }}><span>{pillar.emoji} {pillar.name}</span><b>{pillars[pillar.key]}</b><input disabled={!active || Boolean(existing)} type="range" min="0" max="10" value={pillars[pillar.key]} onChange={(event) => updatePillar(pillar.key, event.target.value)} /></label>)}</section>
      <section className="p66-record-section"><div className="p66-section-head"><div><span>Execução</span><h2>Missões do dia</h2></div></div>{projeto66Missions.map((mission) => <button disabled={!active || missions[mission.key]} className={`p66-mission ${missions[mission.key] ? 'done' : ''}`} type="button" key={mission.key} onClick={() => toggleMission(mission.key)}><b>{mission.emoji}</b><span><strong>{mission.name}</strong><small>{mission.description}</small></span><i>{missions[mission.key] ? '✓' : ''}</i></button>)}</section>
      <section className="p66-record-section private"><div className="p66-section-head"><div><span>🔒 Somente você</span><h2>Como você se sentiu?</h2></div></div><p className="p66-private-note">Este conteúdo é armazenado separadamente e não aparece em relatórios da empresa.</p><div className="p66-emotions">{emotionOptions.map((option) => <button disabled={!active} className={emotion === option.value ? 'selected' : ''} type="button" key={option.value} onClick={() => setEmotion(option.value)}><b>{option.emoji}</b><span>{option.label}</span></button>)}</div><h3>Gratidão</h3>{['O passado que me formou…', 'O futuro que estou criando…', 'Uma pessoa importante hoje…'].map((placeholder, index) => <label className="p66-textarea-field" htmlFor={`gratitude-${index}`} key={placeholder}>Reflexão {index + 1}<textarea id={`gratitude-${index}`} disabled={!active} value={gratitude[index]} placeholder={placeholder} onChange={(event) => updateGratitude(index, event.target.value)} /></label>)}</section>
      <button className="p66-primary" disabled={!active || saving || saved} type="submit">{recordButtonLabel({ saved, saving, saveError, existing })}</button>
      {saveError && <p className="p66-action-error" role="alert">{saveError}</p>}
      {saved && <output className="p66-saved">✓ Dia {day} salvo. Visão geral e tracker atualizados.</output>}
    </form>
  )
}
