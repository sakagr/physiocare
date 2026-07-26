/* eslint-disable @typescript-eslint/no-require-imports */
const target = process.env.NODE_ENV === 'production' ? 'production' : 'local'
const envFile = `.env.${target}`
require('dotenv').config({path: envFile});
const { readdirSync, readFileSync } = require('fs')
const path = require('path')
const postgres = require('postgres')
console.log(`Seeding ${target} database (${envFile})`)
const sql = postgres(process.env.DATABASE_URL)
async function run() {
    const seedsDir = path.join(process.cwd(), 'supabase', 'seeds')

    const files = readdirSync(seedsDir)
      .filter(file => file.endsWith('.sql'))
      .sort()
  
    for (const file of files) {
      console.log(`Running ${file}...`)
  
      const content = readFileSync(
        path.join(seedsDir, file),
        'utf8'
      )
  
      await sql.unsafe(content)
    }
  
    await sql.end()
  
    console.log('✅ Seeding complete')
  }
  
  run().catch(console.error)