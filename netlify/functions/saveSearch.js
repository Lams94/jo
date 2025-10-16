import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export async function handler(event, context) {
  try {
    const body = JSON.parse(event.body || '{}')
    const { title, keywords, minYears, minSalary, maxSalary, sources } = body

    const { data, error } = await supabase
      .from('searches')
      .insert([
        {
          title,
          keywords,
          min_years: minYears,
          min_salary: minSalary,
          max_salary: maxSalary,
          sources: sources.split('\n').filter(s => s.trim())
        }
      ])

    if (error) throw error

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data })
    }
  } catch (err) {
    console.error(err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}