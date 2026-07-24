declare module 'better-sqlite3' {
  interface Statement {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number }
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
  }

  declare class Database {
    constructor(filename: string, options?: { readonly?: boolean })
    pragma(sql: string): void
    exec(sql: string): void
    prepare(sql: string): Statement
    close(): void
  }

  export default Database
}
