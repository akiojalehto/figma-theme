// transform figma document into theme object
const { get } = require('dot-prop')
const chroma = require('chroma-js')
const { struct } = require('superstruct')

const FILL = 'FILL'
const TEXT = 'TEXT'

const flatten = (arr = []) => arr.reduce((a, b) => {
  return [
    ...a,
    b,
    ...flatten(b.children)
  ]
}, [])

// schema
const Theme = struct({
  colors: 'object?',
  textStyles: struct.dict([
    'string?',
    struct({
      fontFamily: 'string',
      fontSize: 'number',
      fontWeight: 'number',
      lineHeight: 'number',
    })
  ]),
  fonts: 'array?',
  fontSizes: 'array?',
  fontWeights: 'array?',
  lineHeights: 'array?',
  metadata: 'object?'
})

const Data = struct.partial({
  name: 'string',
  lastModified: 'string',
  thumbnailUrl: 'string',
  document: struct.partial({
    children: struct.list([ 'object' ]),
  }),
  styles: struct.dict([
    'string',
    struct.partial({
      name: 'string',
      styleType: 'string',
    })
  ])
})

const unique = arr => [...new Set(arr)]

module.exports = (data, opts = {}) => {
  Data(data)
  const {
    styles = {},
    document: {
      children: tree = []
    }
  } = data
  const children = flatten(tree)

  const styleKeys = Object.keys(styles)
  const stylesArray = styleKeys.map(key => Object.assign({
    id: key
  }, styles[key]))

  // colors
  const colorStyles = stylesArray.filter(style => style.styleType === FILL)
  const colorArray = colorStyles.map(style => {
    const child = children
      .find(child => get(child, 'styles.fill') === style.id)
    if (!child) return

    const [ fill = {} ] = child.fills || []
    const { r, g, b, a } = fill.color
    const alpha = (opts.opacityAsAlpha && fill.opacity !== undefined) ? fill.opacity : a
    const rgba = [ r, g, b ].map(n => n * 255).concat(alpha)
    const color = chroma.rgb(rgba)
    return {
      id: style.id,
      name: style.name,
      value: (opts.rgb || (opts.rgba && alpha < 1)) ? color.css() : color.hex()
    }
  })
  .filter(Boolean)

  const colors = colorArray.reduce((a, color) => Object.assign({}, a, {
    [color.name]: color.value
  }), {})

  // textStyles
  const textStyles = stylesArray.filter(style => style.styleType === TEXT)
  const textArray = textStyles.map(style => {
    const child = children
      .find(child => get(child, 'styles.text') === style.id)
    if (!child) return
    return {
      id: style.id,
      name: style.name,
      value: child.style
    }
  })
    .filter(Boolean)
    .map(style => {
      const {
        fontFamily,
        fontWeight,
        fontSize,
        letterSpacing
      } = style.value
      const lineHeight = style.value.lineHeightPercent / 100
      return Object.assign({}, style, {
        value: {
          fontFamily,
          fontWeight,
          fontSize,
          lineHeight
        }
      })
    })

  const textStylesObject = textArray.reduce((a, style) => Object.assign({}, a, {
    [style.name]: style.value
  }), {})

  let fontSizes = unique(textArray.map(style => style.value.fontSize))
  let fontWeights = unique(textArray.map(style => style.value.fontWeight))
  let fonts = unique(textArray.map(style => style.value.fontFamily))
  let lineHeights = unique(textArray.map(style => style.value.lineHeight))

  if (opts.sort) {
    fontSizes = fontSizes.sort();
    fontWeights = fontWeights.sort();
    fonts = fonts.sort();
    lineHeights = lineHeights.sort();
  }

  let theme = {
    colors,
    textStyles: textStylesObject,
    fonts,
    fontSizes,
    fontWeights,
    lineHeights
  }

  if (opts.filter.length > 0) {
    theme = opts.filter.reduce((obj, key) => ({ ...obj, [key]: theme[key] }), {})
  }

  if (opts.metadata) {
    theme.metadata = {
      name: data.name,
      lastModified: data.lastModified,
      thumbnailUrl: data.thumbnailUrl,
      children,
      styles: stylesArray
    }
  }

  // validate
  Theme(theme)

  return theme
}

module.exports.schemas = {
  Data,
  Theme
}
