import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { Badge, Empty, Field, useFeedback } from '../components/ui'
import { currentUserId, useStore } from '../store'
import { keeperItems, keeperQuestion, keeperReports, keeperResponses, validKeeperTest } from '../lib/keeperTest'

export default function KeeperTest() {
  const { state } = useStore()
  const reviewerId = currentUserId(state)
  const people = keeperReports(state, reviewerId)
  const reviews = state.keeperTests?.[state.viewCycleId]?.[reviewerId]
  const [selected, setSelected] = useState('')
  const person = people.find(({ id }) => id === selected) ?? people[0]

  return (
    <div className="col gap-20">
      <div className="page-head" style={{ marginBottom: 0 }}><h1>Keeper Test</h1></div>
      {person ? (
        <div className="card">
          <div className="card-body col gap-16">
            <Field label="Direct report">
              <select className="input" value={person.id} onChange={(event) => setSelected(event.target.value)}>
                {people.map(({ id, name }) => <option key={id} value={id}>{name} · {reviews?.[id] ? 'Submitted' : 'Pending'}</option>)}
              </select>
            </Field>
            <KeeperTestForm key={person.id} person={person} review={reviews?.[person.id]} />
          </div>
        </div>
      ) : <Empty icon={<ClipboardCheck />} title="No direct reports" />}
    </div>
  )
}

function KeeperTestForm({ person, review }) {
  const { state, saveKeeperTest } = useStore()
  const { toast } = useFeedback()
  const [answers, setAnswers] = useState(review?.answers ?? {})
  const [reasons, setReasons] = useState(review?.reasons ?? {})
  const [reason, setReason] = useState(review?.reason ?? '')
  const items = keeperItems(state)
  const valid = validKeeperTest(items, answers, reasons, reason)

  function submit(event) {
    event.preventDefault()
    if (!valid) return
    saveKeeperTest(state.viewCycleId, person.id, answers, reasons, reason)
    toast('Keeper Test saved.')
  }

  return (
    <form className="col gap-16" onSubmit={submit}>
      <div className="row gap-8">
        <h3>{person.name}</h3>
        <Badge tone={review ? 'green' : 'amber'}>{review ? 'Submitted' : 'Pending'}</Badge>
      </div>
      <div className="grid g-2">
        {items.map(([key, label]) => (
          <div key={key} className="card card-pad col gap-8">
            <Field label={label} required>
              <select className="input" required value={answers[key] ?? ''}
                onChange={(event) => setAnswers({ ...answers, [key]: event.target.value })}>
                <option value="" disabled>Select response</option>
                {keeperResponses.map((response) => <option key={response}>{response}</option>)}
              </select>
            </Field>
            <Field label={`Reason for ${label}`} required>
              <textarea className="textarea" rows={2} required value={reasons[key] ?? ''}
                onChange={(event) => setReasons({ ...reasons, [key]: event.target.value })} />
            </Field>
          </div>
        ))}
      </div>
      <Field label={keeperQuestion} required>
        <textarea className="textarea" rows={4} required value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <div><button type="submit" className="btn primary" disabled={!valid}>Save Keeper Test</button></div>
    </form>
  )
}
