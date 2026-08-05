const { app } = require('electron')
const D = require('better-sqlite3')
const path = require('path')

app.whenReady().then(() => {
  const db = new D(path.join(process.cwd(), 'src/main/database/data/app-data.db'))
  const projects = db.prepare('SELECT id, name FROM projects').all()
  for (const p of projects) {
    const phases = db.prepare('SELECT * FROM experiment_phases WHERE project_id=? ORDER BY phase_order, id').all(p.id)
    console.log(`项目 ${p.id}(${p.name}) 阶段数: ${phases.length}`)
    for (const ph of phases) console.log('  ', JSON.stringify(ph))
    const records = db.prepare('SELECT id, phase_id, name, record_type FROM experiment_records WHERE project_id=?').all(p.id)
    console.log(`  记录数: ${records.length}`, records.map((r) => `${r.id}:${r.name}@${r.phase_id}`).join(', '))
  }
  db.close()
  app.quit()
})
