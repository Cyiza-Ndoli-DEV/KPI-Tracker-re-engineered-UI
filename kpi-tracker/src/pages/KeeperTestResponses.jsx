import { useState } from 'react'
import { Avatar, Badge, Empty, Field, Modal } from '../components/ui'
import { byId } from '../lib/calc'
import { keeperItems, keeperQuestion } from '../lib/keeperTest'
import { fmtDateTime } from '../lib/utils'
import { useStore } from '../store'

const answerTone = { Yes: 'green', Maybe: 'amber', No: 'red' }

export default function KeeperTestResponses({ cycle }) {
  const { state } = useStore()
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const labels = Object.fromEntries(keeperItems(state))
  const nameOf = (id) => byId(state.staff, id)?.name ?? id
  const reviews = Object.entries(state.keeperTests?.[cycle.id] ?? {})
    .flatMap(([reviewerId, reports]) => Object.entries(reports).map(([staffId, review]) => ({ ...review, reviewerId, staffId })))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const query = search.trim().toLowerCase()
  const visible = reviews.filter(({ staffId, reviewerId }) =>
    [nameOf(staffId), nameOf(reviewerId)].some((name) => name.toLowerCase().includes(query)))

  return (
    <div className="col gap-16">
      <section className="card" aria-labelledby="keeper-responses-title">
        <div className="card-head row wrap gap-8">
          <h3 id="keeper-responses-title">Keeper Test responses</h3>
          <Badge>{cycle.name}</Badge>
          <div className="spacer" />
          <span className="small muted">{visible.length} {visible.length === 1 ? 'response' : 'responses'}</span>
        </div>
        {reviews.length > 0 && (
          <div className="card-body">
            <Field label="Search by employee or Team Lead" style={{ maxWidth: 360 }}>
              <input type="search" className="input" value={search} onChange={(event) => setSearch(event.target.value)} />
            </Field>
          </div>
        )}
        {visible.length ? (
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th scope="col">Employee</th><th scope="col">Team Lead</th><th scope="col">Last saved</th><th scope="col" className="right">Actions</th></tr></thead>
              <tbody>{visible.map((review) => (
                <tr key={`${review.reviewerId}:${review.staffId}`}>
                  <td><div className="row gap-8 semi"><Avatar name={nameOf(review.staffId)} size="sm" />{nameOf(review.staffId)}{review.sample && <Badge>Sample</Badge>}</div></td>
                  <td>{nameOf(review.reviewerId)}</td>
                  <td>{fmtDateTime(review.updatedAt)}</td>
                  <td className="right"><button type="button" className="btn secondary sm" aria-label={`View response for ${nameOf(review.staffId)} by ${nameOf(review.reviewerId)}`} onClick={() => setSelected(review)}>View response</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty title={reviews.length ? 'No matching responses' : 'No Keeper Test responses in this cycle'} />}
      </section>
      {selected && (
        <Modal title={`Keeper Test for ${nameOf(selected.staffId)}`}
          sub={`Reviewed by ${nameOf(selected.reviewerId)} · ${fmtDateTime(selected.updatedAt)}`} size="lg" onClose={() => setSelected(null)}>
          <div className="col gap-12">
            {Object.entries(selected.answers).map(([key, answer]) => (
              <section className="card card-pad col gap-8" key={key}>
                <h3>{selected.itemLabels?.[key] ?? state.keeperTestPastLabels?.[key] ?? labels[key] ?? key}</h3>
                <dl className="keeper-response-details">
                  <dt>Answer</dt>
                  <dd><Badge tone={answerTone[answer]}>{answer}</Badge></dd>
                  <dt>Reason</dt>
                  <dd>{selected.reasons?.[key] ?? 'No reason recorded'}</dd>
                </dl>
              </section>
            ))}
            <section className="card card-pad col gap-8">
              <h3>{keeperQuestion}</h3>
              <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{selected.reason || 'No response recorded'}</div>
            </section>
          </div>
        </Modal>
      )}
    </div>
  )
}
