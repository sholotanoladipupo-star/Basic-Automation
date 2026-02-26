import { Font } from '@react-pdf/renderer'

export function registerFonts() {
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: '/fonts/Roboto-Regular.woff', fontWeight: 'normal', fontStyle: 'normal' },
      { src: '/fonts/Roboto-Bold.woff', fontWeight: 'bold', fontStyle: 'normal' },
      { src: '/fonts/Roboto-Italic.woff', fontWeight: 'normal', fontStyle: 'italic' },
    ],
  })

  Font.register({
    family: 'PlayfairDisplay',
    fonts: [
      { src: '/fonts/PlayfairDisplay-Regular.woff', fontWeight: 'normal', fontStyle: 'normal' },
      { src: '/fonts/PlayfairDisplay-Bold.woff', fontWeight: 'bold', fontStyle: 'normal' },
    ],
  })

  Font.register({
    family: 'Montserrat',
    fonts: [
      { src: '/fonts/Montserrat-Regular.woff', fontWeight: 'normal', fontStyle: 'normal' },
      { src: '/fonts/Montserrat-Bold.woff', fontWeight: 'bold', fontStyle: 'normal' },
    ],
  })

  Font.register({
    family: 'SourceCodePro',
    fonts: [
      { src: '/fonts/SourceCodePro-Regular.woff', fontWeight: 'normal', fontStyle: 'normal' },
      { src: '/fonts/SourceCodePro-Bold.woff', fontWeight: 'bold', fontStyle: 'normal' },
    ],
  })

  // Disable hyphenation — prevent word breaking across lines
  Font.registerHyphenationCallback((word) => [word])
}
