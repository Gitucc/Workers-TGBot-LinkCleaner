import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const templatePath = path.join(__dirname, '..', 'wrangler.toml.template')
const configPath = path.join(__dirname, '..', 'wrangler.toml')
const envPath = path.join(__dirname, '..', '.env')

// Simple .env parser
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      const key = match[1]
      let value = match[2] || ''
      if (
        value.length > 0 &&
        value.charAt(0) === '"' &&
        value.charAt(value.length - 1) === '"'
      ) {
        value = value.replace(/\\n/gm, '\n')
      }
      value = value.replace(/(^['"]|['"]$)/g, '').trim()
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

const dbId = process.env.D1_DATABASE_ID

if (!dbId) {
  console.error('Error: D1_DATABASE_ID environment variable is not set.')
  console.error(
    'Please create a .env file with D1_DATABASE_ID=... or set the environment variable in your system/CI.',
  )
  process.exit(1)
}

if (!fs.existsSync(templatePath)) {
  console.error(`Error: Template file not found at ${templatePath}`)
  process.exit(1)
}

const workersName = process.env.WORKERS_NAME || 'tgbot-link-cleaner'

let template = fs.readFileSync(templatePath, 'utf8')
let config = template.replace(/D1_DATABASE_ID_PLACEHOLDER/g, dbId)
config = config.replace(/WORKERS_NAME_PLACEHOLDER/g, workersName)

fs.writeFileSync(configPath, config)
console.log('Successfully generated wrangler.toml from wrangler.toml.template')
