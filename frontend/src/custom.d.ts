/// <reference types="vite/client" />
/// <reference types="react" />
/// <reference types="react-dom" />

declare module '*.svg' {
  import * as React from 'react';
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '@mui/material/*';
declare module '@mui/icons-material/*';
declare module '@mui/material/styles' {
  interface Theme {
    status: {
      danger: string;
    };
  }
  interface ThemeOptions {
    status?: {
      danger?: string;
    };
  }
  export function createTheme(options?: ThemeOptions): Theme;
  export function ThemeProvider(props: { theme: Theme; children: React.ReactNode }): JSX.Element;
}

declare module '@emotion/react' {
  export interface Theme {
    status: {
      danger: string;
    };
  }
}

declare module 'framer-motion';
declare module 'react-router-dom';
declare module 'react/jsx-runtime';

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
} 