// Type declarations for pdfjs-dist legacy build
declare module 'pdfjs-dist/legacy/build/pdf' {
  export * from 'pdfjs-dist';
}

declare module 'pdfjs-dist/legacy/build/pdf.worker' {
  const workerSrc: string;
  export default workerSrc;
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  const workerSrc: string;
  export default workerSrc;
}
