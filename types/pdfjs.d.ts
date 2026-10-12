declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export function getDocument(src: {
    data: Uint8Array;
    disableWorker?: boolean;
    isEvalSupported?: boolean;
  }): {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
      }>;
    }>;
  };
}
