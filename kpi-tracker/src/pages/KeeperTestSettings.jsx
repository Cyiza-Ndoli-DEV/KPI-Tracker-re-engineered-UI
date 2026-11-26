import { useState } from 'react'
import { PencilLine, Plus, Trash2 } from 'lucide-react'
import { Badge, Field, Modal, useFeedback } from '../components/ui'
import { keeperCriteria, keeperItems, retentionKey } from '../lib/keeperTest'
import { useStore } from '../store'

export default function KeeperTestSettings() {
  const { state, addKeeperTestItem, editKeeperTestItem, deleteKeeperTestItem } = useStore()
  const { toast, confirm } = useFeedback()
  const [editor, setEditor] = useState(null)
  const items = keeperItems(state)
  const name = editor?.label.trim() ?? ''
  const duplicate = items.some(([key, item]) => key !== editor?.id && item.toLowerCase() === name.toLowerCase())

  function submit(event) {
    event.preventDefault()
    if (!editor || !name || duplicate) return
    if (editor.id) editKeeperTestItem(editor.id, name)
    else addKeeperTestItem(name)
    toast(editor.id ? 'Keeper Test item updated.' : 'Keeper Test item added.')
    setEditor(null)
  }

  async function remove(id, item) {
    if (await confirm({
      title: `Delete “${item}”?`,
      message: 'This removes the item from the Keeper Test form. Saved answers and reasons stay in the response history.',
      okLabel: 'Delete item',
      danger: true,
    })) {
      deleteKeeperTestItem(id)
      toast('Keeper Test item deleted.')
    }
  }

  return (
    <section className="card" aria-labelledby="keeper-settings-title">
      <div className="card-head">
        <h3 id="keeper-settings-title">Keeper Test items</h3>
        <div className="spacer" />
        <button type="button" className="btn primary sm" onClick={() => setEditor({ label: '' })}><Plus size={15} /> Add item</button>
      </div>
      <div className="scroll-x">
        <table className="table">
          <thead><tr><th scope="col">Item</th><th scope="col">Type</th><th scope="col">Required response</th><th scope="col" className="right">Actions</th></tr></thead>
          <tbody>
            {items.map(([key, item]) => {
              const core = key === retentionKey || keeperCriteria.some(([id]) => id === key)
              return <tr key={key}>
                <td className="semi">{item}</td>
                <td>{core ? <Badge tone="blue">Core</Badge> : <Badge>Additional</Badge>}</td>
                <td>Yes / Maybe / No and a reason</td>
                <td className="right">
                  <ItemActions item={item} onEdit={() => setEditor({ id: key, label: item })} onDelete={() => remove(key, item)} />
                </td>
              </tr>
            })}
            {!items.length && <tr><td colSpan={4} className="muted">No Keeper Test items</td></tr>}
          </tbody>
        </table>
      </div>
      {editor && (
        <Modal title={editor.id ? 'Edit Keeper Test item' : 'Add Keeper Test item'} onClose={() => setEditor(null)}>
          <form className="col gap-12" onSubmit={submit}>
            <Field label="Item name" required error={duplicate ? 'This item already exists.' : undefined}>
              <input className="input" required autoFocus value={editor.label} onChange={(event) => setEditor({ ...editor, label: event.target.value })} />
            </Field>
            <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn secondary" onClick={() => setEditor(null)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={!name || duplicate}>{editor.id ? 'Save changes' : 'Add item'}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

function ItemActions({ item, onEdit, onDelete }) {
  return (
    <div className="row gap-6" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary icon sm" title="Edit item" aria-label={`Edit ${item}`} onClick={onEdit}><PencilLine size={16} aria-hidden="true" /></button>
          <button type="button" className="btn danger icon sm" title="Delete item" aria-label={`Delete ${item}`} onClick={onDelete}><Trash2 size={16} aria-hidden="true" /></button>
    </div>
  )
}
