import { createClient, SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables')
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

// Helper function to convert Supabase results to match SQLite format
class SupabaseDB {
  private client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  // Prepare-like interface for compatibility
  prepare(sql: string) {
    return {
      get: async (...params: any[]) => {
        const result = await this.executeQuery(sql, params, 'single')
        return result
      },
      all: async (...params: any[]) => {
        const result = await this.executeQuery(sql, params, 'multiple')
        return result || []
      },
      run: async (...params: any[]) => {
        const result = await this.executeQuery(sql, params, 'execute')
        return { changes: result?.count || 0, lastInsertRowid: result?.id }
      }
    }
  }

  private async executeQuery(sql: string, params: any[], type: 'single' | 'multiple' | 'execute') {
    // Parse SQL and convert to Supabase query
    // This is a simplified version - you may need to expand this

    const sqlLower = sql.toLowerCase().trim()

    // SELECT queries
    if (sqlLower.startsWith('select')) {
      return this.handleSelect(sql, params, type)
    }

    // INSERT queries
    if (sqlLower.startsWith('insert')) {
      return this.handleInsert(sql, params)
    }

    // UPDATE queries
    if (sqlLower.startsWith('update')) {
      return this.handleUpdate(sql, params)
    }

    // DELETE queries
    if (sqlLower.startsWith('delete')) {
      return this.handleDelete(sql, params)
    }

    throw new Error(`Unsupported SQL query: ${sql}`)
  }

  private async handleSelect(sql: string, params: any[], type: 'single' | 'multiple') {
    // Extract table name
    const tableMatch = sql.match(/from\s+(\w+)/i)
    if (!tableMatch) throw new Error('Could not extract table name')

    const tableName = tableMatch[1]
    let query = this.client.from(tableName).select('*')

    // Handle WHERE clause
    if (sql.includes('WHERE')) {
      const whereMatch = sql.match(/where\s+(.+?)(?:order|limit|$)/i)
      if (whereMatch) {
        const whereClause = whereMatch[1].trim()
        query = this.applyWhereClause(query, whereClause, params)
      }
    }

    // Handle ORDER BY
    if (sql.includes('ORDER BY')) {
      const orderMatch = sql.match(/order by\s+(.+?)(?:limit|$)/i)
      if (orderMatch) {
        const [column, direction] = orderMatch[1].trim().split(/\s+/)
        query = query.order(column, { ascending: direction?.toLowerCase() !== 'desc' })
      }
    }

    // Handle LIMIT
    if (sql.includes('LIMIT')) {
      const limitMatch = sql.match(/limit\s+(\d+)/i)
      if (limitMatch) {
        query = query.limit(parseInt(limitMatch[1]))
      }
    }

    const { data, error } = type === 'single' ? await query.single() : await query

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw error
    }

    return type === 'single' ? data : data || []
  }

  private applyWhereClause(query: any, whereClause: string, params: any[]) {
    // Simple parameter substitution (? -> params)
    let paramIndex = 0
    const conditions = whereClause.split(/\s+and\s+/i)

    conditions.forEach(condition => {
      const eqMatch = condition.match(/(\w+)\s*=\s*\?/)
      if (eqMatch && paramIndex < params.length) {
        query = query.eq(eqMatch[1], params[paramIndex++])
      }

      const gtMatch = condition.match(/(\w+)\s*>\s*\?/)
      if (gtMatch && paramIndex < params.length) {
        query = query.gt(gtMatch[1], params[paramIndex++])
      }

      const ltMatch = condition.match(/(\w+)\s*<\s*\?/)
      if (ltMatch && paramIndex < params.length) {
        query = query.lt(ltMatch[1], params[paramIndex++])
      }

      const isNullMatch = condition.match(/(\w+)\s+is\s+null/i)
      if (isNullMatch) {
        query = query.is(isNullMatch[1], null)
      }

      const isNotNullMatch = condition.match(/(\w+)\s+is\s+not\s+null/i)
      if (isNotNullMatch) {
        query = query.not(isNotNullMatch[1], 'is', null)
      }
    })

    return query
  }

  private async handleInsert(sql: string, params: any[]) {
    const tableMatch = sql.match(/insert into\s+(\w+)/i)
    if (!tableMatch) throw new Error('Could not extract table name')

    const tableName = tableMatch[1]
    const columnsMatch = sql.match(/\(([^)]+)\)\s*values/i)
    const valuesMatch = sql.match(/values\s*\(([^)]+)\)/i)

    if (!columnsMatch || !valuesMatch) {
      throw new Error('Could not parse INSERT statement')
    }

    const columns = columnsMatch[1].split(',').map(c => c.trim())
    const data: any = {}

    columns.forEach((col, i) => {
      data[col] = params[i]
    })

    const { data: result, error } = await this.client
      .from(tableName)
      .insert(data)
      .select()
      .single()

    if (error) throw error

    return { id: result?.id, count: 1 }
  }

  private async handleUpdate(sql: string, params: any[]) {
    const tableMatch = sql.match(/update\s+(\w+)/i)
    if (!tableMatch) throw new Error('Could not extract table name')

    const tableName = tableMatch[1]
    const setMatch = sql.match(/set\s+(.+?)\s+where/i)
    const whereMatch = sql.match(/where\s+(.+)$/i)

    if (!setMatch) throw new Error('Could not parse SET clause')

    const setClause = setMatch[1]
    const updates = setClause.split(',').map(s => s.trim())
    const data: any = {}
    let paramIndex = 0

    updates.forEach(update => {
      const [column] = update.split('=').map(s => s.trim())
      data[column] = params[paramIndex++]
    })

    let query = this.client.from(tableName).update(data)

    if (whereMatch) {
      query = this.applyWhereClause(query, whereMatch[1], params.slice(paramIndex))
    }

    const { data: result, error } = await query

    if (error) throw error

    return { count: result?.length || 0 }
  }

  private async handleDelete(sql: string, params: any[]) {
    const tableMatch = sql.match(/delete from\s+(\w+)/i)
    if (!tableMatch) throw new Error('Could not extract table name')

    const tableName = tableMatch[1]
    const whereMatch = sql.match(/where\s+(.+)$/i)

    let query = this.client.from(tableName).delete()

    if (whereMatch) {
      query = this.applyWhereClause(query, whereMatch[1], params)
    }

    const { data: result, error } = await query

    if (error) throw error

    return { count: result?.length || 0 }
  }

  // Direct Supabase client access for complex queries
  get raw() {
    return this.client
  }
}

// Export a db object with prepare method for backwards compatibility
export const db = new SupabaseDB(supabase)
export { supabase }
export default db
