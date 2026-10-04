declare module "sql.js" {
  export type SqlValue = string | number | null | Uint8Array;
  export type QueryExecResult = { columns: string[]; values: SqlValue[][] };
  export class Database {
    constructor(data?: ArrayLike<number> | Buffer);
    exec(sql: string): QueryExecResult[];
    close(): void;
  }
  export interface SqlJsStatic {
    Database: typeof Database;
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}

declare module "pdfjs-dist/build/pdf.worker.min.mjs?url" {
  const src: string;
  export default src;
}

declare module "sql.js/dist/sql-wasm.wasm?url" {
  const src: string;
  export default src;
}
