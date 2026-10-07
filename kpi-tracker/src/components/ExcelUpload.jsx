import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle } from 'lucide-react'
import { Modal, Alert, Badge } from './ui'
import { kpiTarget, deptTarget, teamTarget, isSum } from '../lib/draft'
import { round, fmtValue } from '../lib/utils'

const LEVELS = { department: 'department', dept: 'department', team: 'team', individual: 'individual', person: 'individual', staff: 'individual', employee: 'individual' }

/** Turn spreadsheet rows into allocations on a copy of the draft. Error rows never block valid rows. */
export function planExcel(state, draft, rawRows) {
  const next = structuredClone(draft)
  const norm = (s) => String(s ?? '').trim().toLowerCase()
  const rows = rawRows.map((r, i) => {
    const o = {}
    for (const [k, v] of Object.entries(r)) o[norm(k).replace(/[^a-z]/g, '')] = v
    return {
      line: i + 2,
      level: o.level,
      name: o.unitorperson ?? o.unit ?? o.person ?? o.name,
      kpi: o.kpi,
      value: o.targetorpercentage ?? o.target ?? o.percentage ?? o.value,
    }
  })
  const order = { department: 0, team: 1, individual: 2 }
  rows.sort((a, b) => (order[LEVELS[norm(a.level)]] ?? 9) - (order[LEVELS[norm(b.level)]] ?? 9) || a.line - b.line)

  const preview = []
  for (const r of rows) {
    const out = { ...r, ok: false, msg: '' }
    preview.push(out)
    const level = LEVELS[norm(r.level)]
    if (!level) { out.msg = `Unknown level "${r.level}". Use department, team or individual.`; continue }
    const k = next.kpis.find((x) => norm(x.name) === norm(r.kpi))
    if (!k) { out.msg = `KPI "${r.kpi}" is not part of this goal.`; continue }
    if (!r.name) { out.msg = 'Unit or person is empty.'; continue }

    // resolve value -> percent of parent
    const parse = (parentTarget) => {
      if (!isSum(k)) return { pct: null }
      const raw = r.value
      if (raw === '' || raw === null || raw === undefined) return { err: 'Target or percentage is empty.' }
      if (typeof raw === 'string' && raw.trim().endsWith('%')) {
        const n = Number(raw.trim().slice(0, -1))
        return Number.isFinite(n) && n > 0 ? { pct: n } : { err: `"${raw}" is not a valid percentage.` }
      }
      const n = Number(String(raw).replace(/,/g, ''))
      if (!Number.isFinite(n) || n <= 0) return { err: `"${raw}" is not a number.` }
      if (n <= 1) return { pct: n * 100 }
      if (n <= 100) return { pct: n }
      if (!parentTarget) return { err: 'Parent has no target yet.' }
      return { pct: (n / parentTarget) * 100 }
    }
    const put = (bucket, keyPath, unitId, pct, dates) => {
      let g = bucket
      for (const p of keyPath.slice(0, -1)) g = g[p] ??= {}
      const last = keyPath[keyPath.length - 1]
      g[last] ??= { method: isSum(k) ? 'percent' : 'same', rows: [] }
      const grp = g[last]
      if (isSum(k)) grp.method = 'percent'
      const existing = grp.rows.find((x) => x.unitId === unitId)
      if (existing) existing.percent = pct
      else grp.rows.push({ unitId, percent: pct, startDate: dates.startDate, endDate: dates.endDate })
    }

    if (level === 'department') {
      const d = state.departments.find((x) => norm(x.name) === norm(r.name))
      if (!d) { out.msg = `No department called "${r.name}" in HR.`; continue }
      const v = parse(kpiTarget(k))
      if (v.err) { out.msg = v.err; continue }
      put(next.depts, [k.key], d.id, v.pct, k)
      out.ok = true
      out.msg = isSum(k) ? `${round(v.pct, 2)}% → ${fmtValue(k.unit, (kpiTarget(k) * v.pct) / 100)}` : 'Same target'
    } else if (level === 'team') {
      const t = state.teams.find((x) => norm(x.name) === norm(r.name))
      if (!t) { out.msg = `No team called "${r.name}".`; continue }
      const dRow = next.depts[k.key]?.rows.find((x) => x.unitId === t.departmentId)
      if (!dRow) { out.msg = `${state.departments.find((d) => d.id === t.departmentId)?.name} is not allocated "${k.name}" — add a department row first.`; continue }
      const pt = deptTarget(next, k, t.departmentId)
      const v = parse(pt)
      if (v.err) { out.msg = v.err; continue }
      put(next.teams, [k.key, t.departmentId], t.id, v.pct, { startDate: dRow.startDate || k.startDate, endDate: dRow.endDate || k.endDate })
      out.ok = true
      out.msg = isSum(k) ? `${round(v.pct, 2)}% → ${fmtValue(k.unit, (pt * v.pct) / 100)}` : 'Same target'
    } else {
      const p = state.staff.find((x) => norm(x.name) === norm(r.name))
      if (!p) { out.msg = `"${r.name}" is not in the HR staff list (people can't be created here).`; continue }
      const tRow = p.teamId && next.teams[k.key]?.[p.departmentId]?.rows.find((x) => x.unitId === p.teamId)
      const dRow = next.depts[k.key]?.rows.find((x) => x.unitId === p.departmentId)
      if (!tRow && !dRow) { out.msg = `${p.name}'s department/team is not allocated "${k.name}".`; continue }
      const groupKey = tRow ? `team:${p.teamId}` : `dept:${p.departmentId}`
      const pt = tRow ? teamTarget(next, k, p.departmentId, p.teamId) : deptTarget(next, k, p.departmentId)
      const v = parse(pt)
      if (v.err) { out.msg = v.err; continue }
      const src = tRow || dRow
      put(next.people, [k.key, groupKey], p.id, v.pct, { startDate: src.startDate || k.startDate, endDate: src.endDate || k.endDate })
      out.ok = true
      out.msg = `${tRow ? state.teams.find((t) => t.id === p.teamId)?.name : 'Direct member'} · ${isSum(k) ? `${round(v.pct, 2)}% → ${fmtValue(k.unit, (pt * v.pct) / 100)}` : 'same target'}`
    }
  }
  preview.sort((a, b) => a.line - b.line)
  return { preview, next }
}

export default function ExcelUpload({ state, draft, onApply, onClose }) {
  const fileRef = useRef(null)
  const [plan, setPlan] = useState(null)
  const [fileName, setFileName] = useState('')
  const [err, setErr] = useState('')

  const downloadTemplate = () => {
    const k = draft.kpis[0]
    const name = k?.name || 'KPI name'
    const rows = [
      { level: 'department', unit_or_person: 'Sales', kpi: name, target_or_percentage: '60%' },
      { level: 'team', unit_or_person: 'Team A', kpi: name, target_or_percentage: '50%' },
      { level: 'team', unit_or_person: 'Team B', kpi: name, target_or_percentage: '50%' },
      { level: 'individual', unit_or_person: 'Brian Okello', kpi: name, target_or_percentage: '25%' },
      { level: 'individual', unit_or_person: 'Sarah Nakato', kpi: name, target_or_percentage: '25%' },
    ]
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 28 }, { wch: 22 }]
    const help = XLSX.utils.aoa_to_sheet([
      ['How to fill the template'],
      ['level', 'department, team or individual'],
      ['unit_or_person', 'Exact name from HR (department, team or staff member)'],
      ['kpi', 'Exact KPI name from this goal: ' + draft.kpis.map((x) => x.name).join(', ')],
      ['target_or_percentage', 'Either a percentage of the parent (e.g. 60%) or an amount (e.g. 300000000)'],
      ['note', 'Departments must be listed before their teams and people (any order in the file is fine).'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Allocations')
    XLSX.utils.book_append_sheet(wb, help, 'Help')
    XLSX.writeFile(wb, 'kpi-allocation-template.xlsx')
  }

  const onFile = async (file) => {
    if (!file) return
    setErr('')
    setFileName(file.name)
    try {
      const wb = XLSX.read(await file.arrayBuffer())
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true })
      if (!raw.length) throw new Error('The first sheet is empty.')
      setPlan(planExcel(state, draft, raw))
    } catch (e) {
      setPlan(null)
      setErr(`Could not read this file: ${e.message}`)
    }
  }

  const valid = plan?.preview.filter((r) => r.ok) || []
  const bad = plan?.preview.filter((r) => !r.ok) || []

  return (
    <Modal
      size="lg"
      icon={<FileSpreadsheet size={20} />}
      title="Upload allocations from Excel"
      sub="Download the template, fill it in and upload it. Valid rows are applied; error rows are listed and skipped."
      onClose={onClose}
      footer={
        <>
          <span className="small muted" style={{ marginRight: 'auto' }}>
            {plan ? `${valid.length} valid · ${bad.length} with errors` : 'No file uploaded yet'}
          </span>
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid.length} onClick={() => onApply(plan.next, valid.length)}>
            Apply {valid.length || ''} valid row{valid.length === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <div className="grid g-2">
        <div className="card card-pad">
          <div className="row mb-8"><span className="badge blue">1</span><b>Download the template</b></div>
          <p className="small muted mb-12">Columns: level, unit or person, KPI, target or percentage.</p>
          <button className="btn secondary sm" onClick={downloadTemplate}><Download size={14} /> Download template (.xlsx)</button>
        </div>
        <div className="card card-pad">
          <div className="row mb-8"><span className="badge blue">2</span><b>Upload the completed file</b></div>
          <div className="dropzone" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
            <Upload size={20} color="var(--blue-600)" />
            <div className="semi mt-4">{fileName || 'Click or drop an .xlsx / .csv file'}</div>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => onFile(e.target.files[0])} />
        </div>
      </div>
      {err && <Alert tone="error" style={{ marginTop: 14 }}>{err}</Alert>}
      {plan && (
        <div className="card mt-16">
          <div className="card-head">
            <b>Preview</b>
            <Badge tone="green">{valid.length} valid</Badge>
            {bad.length > 0 && <Badge tone="red">{bad.length} errors</Badge>}
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table className="table compact">
              <thead><tr><th>Row</th><th>Level</th><th>Unit / person</th><th>KPI</th><th>Value</th><th>Result</th></tr></thead>
              <tbody>
                {plan.preview.map((r) => (
                  <tr key={r.line}>
                    <td className="muted">{r.line}</td>
                    <td>{r.level}</td>
                    <td className="semi">{r.name}</td>
                    <td>{r.kpi}</td>
                    <td className="mono">{String(r.value)}</td>
                    <td>
                      <span className="row gap-4 small" style={{ color: r.ok ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                        {r.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {r.msg}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}
