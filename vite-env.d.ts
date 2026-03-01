/// <reference types="vite/client" />

declare module '*.wav?url' {
  const src: string;
  export default src;
}
