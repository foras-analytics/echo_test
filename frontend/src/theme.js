// The same accent identities adapt to each surface; archive/filter identity never changes.
export const themes = {
  echoLight: {
    dark: false,
    colors: {
      primary: '#185c87', secondary: '#876322', error: '#a12f40', success: '#23644d',
      background: '#d4dbe4', surface: '#e3e8ef', raised: '#f0f3f7', inset: '#c9d2de',
      'text-primary': '#1e2c3e', 'text-secondary': '#4c5d72', border: '#a5b2c2', 'border-strong': '#657a92',
      hover: '#cbdceb', 'lane-alt': '#d7e0eb', 'viewport-fill': '#b8d6ed', 'viewport-stroke': '#3b779e',
      warning: '#805f1e', 'warning-surface': '#e8dcc4',
      'cloud-0': '#245e85', 'cloud-1': '#665590', 'cloud-2': '#356b68', 'cloud-3': '#7e582e',
    },
  },
  echoDark: {
    dark: true,
    colors: {
      primary: '#6bbcf6', secondary: '#e2af63', error: '#ff8c98', success: '#80cbb0',
      background: '#0d131c', surface: '#151e2b', raised: '#1b2838', inset: '#101925',
      'text-primary': '#e1e9f4', 'text-secondary': '#a4b4c7', border: '#34475e', 'border-strong': '#647d9c',
      hover: '#23394e', 'lane-alt': '#1b293b', 'viewport-fill': '#254765', 'viewport-stroke': '#6bbcf6',
      warning: '#edc47d', 'warning-surface': '#342b1c',
      'cloud-0': '#83c7f4', 'cloud-1': '#c2a5ee', 'cloud-2': '#83cec3', 'cloud-3': '#e4bb7c',
    },
  },
}

export function contrast(a, b) {
  const luminance = hex => {
    const rgb = hex.replace('#', '').match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
  }
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}
export function accentColor(color, dark) {
  const surface = themes[dark ? 'echoDark' : 'echoLight'].colors.raised
  const channels = color.replace('#', '').match(/../g).map(value => parseInt(value, 16))
  const target = dark ? 255 : 0
  for (let step = 0; step <= 25; step++) {
    const mix = step / 25
    const adjusted = '#' + channels.map(value => Math.round(value + (target - value) * mix).toString(16).padStart(2, '0')).join('')
    if (contrast(adjusted, surface) >= 4.5) return adjusted
  }
  return dark ? '#ffffff' : '#000000'
}
