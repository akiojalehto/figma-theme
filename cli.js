#!/usr/bin/env node
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const meow = require('meow')
const chalk = require('chalk')
const Figma = require('figma-js')
const parse = require('./index')
JSON.sortify = require('json.sortify');

const config = require('pkg-conf').sync('figma-theme')

const log = (...args) => {
  console.log(
    chalk.cyan('[figma-theme]'),
    ...args
  )
}
log.error = (...args) => {
  console.log(
    chalk.red('[error]'),
    ...args
  )
}

const cli = meow(`
  ${chalk.gray('Usage')}

    $ figma-theme <file-id>

  ${chalk.gray('Options')}

    -d --out-dir         Output directory (default cwd)
    -n --out-name        Output filename without extension (default theme)
    -t --out-type        Output type (default json)
    -f --filter          Comma separated list for filtering outputs
    --metadata           Include metadata from Figma API
    --opacity-as-alpha   Use fill opacity as alpha channel
    --rgb                Use rgb(a) format in all color values
    --rgba               Use rgba format in color values with an alpha channel
    --sort               Sort results

`, {
  flags: {
    outDir: {
      type: 'string',
      alias: 'd'
    },
    outName: {
      type: 'string',
      alias: 'n'
    },
    outType: {
      type: 'string',
      alias: 't'
    },
    filter: {
      type: 'string'
    },
    metadata: {
      type: 'boolean'
    },
    opacityAsAlpha: {
      type: 'boolean'
    },
    rgb: {
      type: 'boolean'
    },
    rgba: {
      type: 'boolean'
    },
    sort: {
      type: 'boolean'
    },
    debug: {
      type: 'boolean'
    }
  }
})

const token = process.env.FIGMA_TOKEN
const [ id ] = cli.input

const opts = Object.assign({
  outDir: '',
  outName: 'theme',
  outType: 'json'
}, config, cli.flags)
opts.filter = (opts.filter !== undefined) ? opts.filter.split(',') : []

if (!token) {
  log.error('FIGMA_TOKEN not found')
  process.exit(1)
}

if (!id) {
  cli.showHelp(0)
}

const allowedTypes = [
  'json'
]

opts.outDir = path.resolve(opts.outDir)
opts.outName = opts.outName.toLowerCase().replace(/[^a-z0-9\-]/gi, '-')
opts.outType = (allowedTypes.indexOf(opts.outType) >= 0) ? opts.outType : 'json'

if (!fs.existsSync(opts.outDir)) {
  fs.mkdirSync(opts.outDir)
}

const outFile = path.join(
  opts.outDir,
  opts.outName + '.' + opts.outType
)

const figma = Figma.Client({
  personalAccessToken: token
})

log('fetching data for:', chalk.gray(id))

figma.file(id)
  .then(res => {
    if (res.status !== 200) {
      log.error(res.status, res.statusText)
      process.exit(1)
      return
    }
    const { data } = res

    log('parsing data...')

    const json = parse(data, opts)
    let outContent = '';

    switch (opts.outType) {
      default:
      case 'json':
        outContent = JSON[opts.sort ? 'sortify' : 'stringify'](json, null, 2)
        break;
    }

    fs.writeFile(outFile, outContent, (err) => {
      if (err) {
        log.error(err)
        process.exit(1)
      }
      log('file saved', chalk.gray(outFile))
    })

    if (opts.debug) {
      fs.writeFile(path.join(opts.outDir, 'data.json'), JSON.stringify(data, null, 2), err => {})
    }
  })
  .catch(err => {
    const { response } = err
    log.error(response.status, response.statusText)
    process.exit(1)
  })

require('update-notifier')({
  pkg: cli.pkg
}).notify()
