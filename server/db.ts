import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials. Please check your .env file.')
}

// Create Supabase client with service role key for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// SQLite-like compatibility layer for easier migration
class SupabaseDB {
  /**
   * Prepare a SQL-like query
   * This is a compatibility layer to make migration easier
   */
  prepare(sql: string) {
    return {
      get: async (...params: any[]) => {
        // Parse SQL and execute appropriate Supabase query
        return await this.executeQuery(sql, params, 'single')
      },
      all: async (...params: any[]) => {
        return await this.executeQuery(sql, params, 'multiple')
      },
      run: async (...params: any[]) => {
        return await this.executeQuery(sql, params, 'execute')
      }
    }
  }

  private async executeQuery(sql: string, params: any[], mode: 'single' | 'multiple' | 'execute') {
    // Simple SQL parser for common operations
    // This is a basic implementation - you may need to enhance it

    const sqlLower = sql.toLowerCase().trim()

    // Handle SELECT queries
    if (sqlLower.startsWith('select')) {
      const table = this.extractTableName(sql)
      let query = supabase.from(table).select('*')

      // Handle WHERE conditions
      if (sqlLower.includes('where')) {
        // Simple WHERE parsing (extend as needed)
        const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i)
        if (whereMatch && params.length > 0) {
          const column = whereMatch[1]
          query = query.eq(column, params[0])
        }
      }

      // Handle ORDER BY
      if (sqlLower.includes('order by')) {
        const orderMatch = sql.match(/ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?/i)
        if (orderMatch) {
          const column = orderMatch[1]
          const direction = orderMatch[2]?.toLowerCase() === 'asc' ? true : false
          query = query.order(column, { ascending: direction })
        }
      }

      // Handle LIMIT
      if (sqlLower.includes('limit')) {
        const limitMatch = sql.match(/LIMIT\s+(\d+)/i)
        if (limitMatch) {
          query = query.limit(parseInt(limitMatch[1]))
        }
      }

      const { data, error } = mode === 'single' ? await query.single() : await query

      if (error && mode === 'single' && error.code === 'PGRST116') {
        // No rows found
        return null
      }

      if (error) throw error
      return mode === 'single' ? data : data
    }

    // Handle INSERT queries
    if (sqlLower.startsWith('insert')) {
      const table = this.extractTableName(sql)
      const columns = this.extractColumns(sql)
      const values = params

      const insertData: any = {}
      columns.forEach((col, idx) => {
        insertData[col] = values[idx]
      })

      const { data, error } = await supabase.from(table).insert(insertData).select()

      if (error) throw error

      return {
        lastInsertRowid: data?.[0]?.id,
        changes: data ? 1 : 0
      }
    }

    // Handle UPDATE queries
    if (sqlLower.startsWith('update')) {
      const table = this.extractTableName(sql)
      const setMatch = sql.match(/SET\s+(.+?)(?:WHERE|$)/i)
      const whereMatch = sql.match(/WHERE\s+(.+)$/i)

      if (!setMatch) throw new Error('Invalid UPDATE query')

      // Parse SET clause
      const setPairs = setMatch[1].split(',').map(p => p.trim())
      const updateData: any = {}
      let paramIndex = 0

      setPairs.forEach(pair => {
        const [column] = pair.split('=').map(p => p.trim())
        updateData[column.replace(/['"]/g, '')] = params[paramIndex++]
      })

      let query = supabase.from(table).update(updateData)

      // Parse WHERE clause
      if (whereMatch) {
        const whereClause = whereMatch[1]
        const whereColumn = whereClause.split('=')[0].trim()
        const whereValue = params[paramIndex]
        query = query.eq(whereColumn, whereValue)
      }

      const { error } = await query

      if (error) throw error

      return { changes: 1 }
    }

    // Handle DELETE queries
    if (sqlLower.startsWith('delete')) {
      const table = this.extractTableName(sql)
      const whereMatch = sql.match(/WHERE\s+(.+)$/i)

      let query = supabase.from(table).delete()

      if (whereMatch) {
        const whereClause = whereMatch[1]
        const whereColumn = whereClause.split('=')[0].trim()
        const whereValue = params[0]
        query = query.eq(whereColumn, whereValue)
      }

      const { error } = await query

      if (error) throw error

      return { changes: 1 }
    }

    throw new Error(`Unsupported SQL query: ${sql}`)
  }

  private extractTableName(sql: string): string {
    const fromMatch = sql.match(/FROM\s+(\w+)/i)
    const intoMatch = sql.match(/INTO\s+(\w+)/i)
    const updateMatch = sql.match(/UPDATE\s+(\w+)/i)
    const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i)

    return (fromMatch || intoMatch || updateMatch || deleteMatch)?.[1] || 'unknown'
  }

  private extractColumns(sql: string): string[] {
    const match = sql.match(/\(([^)]+)\)/i)
    if (!match) return []
    return match[1].split(',').map(c => c.trim())
  }

  /**
   * Execute raw SQL (for compatibility)
   * Note: Supabase doesn't support arbitrary SQL execution
   */
  exec(sql: string) {
    console.warn('db.exec() is not supported with Supabase. Use specific methods instead.')
    return this
  }
}

const db = new SupabaseDB()

export default db
