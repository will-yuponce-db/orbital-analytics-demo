import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2196f3', // Blue for primary actions
      light: '#64b5f6',
      dark: '#1976d2',
    },
    secondary: {
      main: '#f50057',
      light: '#ff4081',
      dark: '#c51162',
    },
    background: {
      default: '#0a0e27',
      paper: '#141b2d',
    },
    // Custom colors for data quality
    testing: {
      main: '#2196f3',
      light: '#64b5f6',
      dark: '#1565c0',
    },
    training: {
      main: '#ff9800',
      light: '#ffb74d',
      dark: '#f57c00',
    },
    operational: {
      main: '#4caf50',
      light: '#81c784',
      dark: '#388e3c',
    },
    // Status colors for AI decisions
    status: {
      nominal: '#4caf50',
      warning: '#ff9800',
      critical: '#f44336',
      analyzing: '#9c27b0',
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
})

// Extend theme type for custom colors
declare module '@mui/material/styles' {
  interface Palette {
    testing: Palette['primary']
    training: Palette['primary']
    operational: Palette['primary']
    status: {
      nominal: string
      warning: string
      critical: string
      analyzing: string
    }
  }
  interface PaletteOptions {
    testing?: PaletteOptions['primary']
    training?: PaletteOptions['primary']
    operational?: PaletteOptions['primary']
    status?: {
      nominal: string
      warning: string
      critical: string
      analyzing: string
    }
  }
}

export default theme
