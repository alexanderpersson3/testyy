import '@mui/material/styles';
import { Theme as MuiTheme, ThemeOptions as MuiThemeOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Theme extends MuiTheme {
    status: {
      danger: string;
    };
  }

  interface ThemeOptions extends MuiThemeOptions {
    status?: {
      danger?: string;
    };
  }

  interface Palette {
    primary: {
      main: string;
      light: string;
      dark: string;
    };
    background: {
      default: string;
      paper: string;
    };
    text: {
      primary: string;
      secondary: string;
    };
  }

  interface PaletteOptions {
    primary?: {
      main: string;
      light: string;
      dark: string;
    };
    background?: {
      default: string;
      paper: string;
    };
    text?: {
      primary: string;
      secondary: string;
    };
  }
}

declare module '@emotion/react' {
  export interface Theme extends MuiTheme {
    status: {
      danger: string;
    };
  }
} 