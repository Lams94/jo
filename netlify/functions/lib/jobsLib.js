import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import { fetchFeedOrPage, parseRssItems } from '../../utils/scraper.js'
import OpenAI from 'openai'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function findNewJobsAndAnalyze() {
  // Récupérer toutes les recherches
  const { data: searches, error: searchesError } = await supabase
    .from('searches')
    .select('*')
  if (searchesError) throw searchesError

  for (const search of searches) {
    await processSearch(search)
  }
}

async function processSearch(search) {
  const allJobs = []

  // Pour chaque source dans la recherche
  for (const source of search.sources) {
    try {
      const { type, data } = await fetchFeedOrPage(source)
      let jobs = []

      if (type === 'rss') {
        const items = parseRssItems(data)
        jobs = items.map(item => ({
          title: item.title,
          company: item['dc:creator'] || item.author || '',
          location: item.location || '',
          description: item.description || item.summary || '',
          url: item.link,
          published: item.pubDate || item.published,
          salary: item.salary || ''
        }))
      } else if (type === 'jsonfeed') {
        jobs = data.items.map(item => ({
          title: item.title,
          company: item.author?.name || '',
          location: item.location || '',
          description: item.summary || item.content_html || '',
          url: item.url,
          published: item.date_published,
          salary: ''
        }))
      } else if (type === 'html') {
        // Parsing HTML basique - à améliorer selon les sites
        const $ = data
        jobs = $('[class*="job"], [class*="offer"]').map((i, el) => ({
          title: $(el).find('h2, h3, .title').text().trim(),
          company: $(el).find('.company').text().trim(),
          location: $(el).find('.location').text().trim(),
          description: $(el).find('.description, .summary').text().trim(),
          url: $(el).find('a').attr('href'),
          published: '',
          salary: $(el).find('.salary').text().trim()
        })).get()
      }

      allJobs.push(...jobs)
    } catch (err) {
      console.warn(`Erreur avec la source ${source}:`, err.message)
    }
  }

  // Déduplication simple par titre et URL
  const uniqueJobs = allJobs.filter((job, index, self) =>
    index === self.findIndex(j => j.title === job.title && j.url === job.url)
  )

  for (const job of uniqueJobs) {
    // Vérifier si l'offre existe déjà
    const { data: existing } = await supabase
      .from('jobs')
      .select('id')
      .eq('url', job.url)
      .single()

    if (!existing) {
      // Sauvegarder l'offre
      const { data: savedJob, error: saveError } = await supabase
        .from('jobs')
        .insert([job])
        .select()
        .single()
      if (saveError) throw saveError

      // Analyser si elle correspond aux critères de recherche
      const isMatch = await analyzeJobMatch(job, search)
      if (isMatch) {
        // Sauvegarder le match
        const analysis = await analyzeJobWithOpenAI(job, search)
        await supabase
          .from('matches')
          .insert([{
            job_id: savedJob.id,
            search_id: search.id,
            analysis: analysis
          }])
      }
    }
  }
}

async function analyzeJobMatch(job, search) {
  // Vérifications basiques
  if (search.minYears && parseInt(job.description.match(/(\d+)\s*(ans?|years?)/i)?.[1] || 0) < search.minYears) return false
  if (search.minSalary && parseInt(job.salary.match(/(\d+)/)?.[1] || 0) < search.minSalary) return false
  if (search.maxSalary && parseInt(job.salary.match(/(\d+)/)?.[1] || 0) > search.maxSalary) return false
  if (search.keywords && !job.title.toLowerCase().includes(search.keywords.toLowerCase()) &&
      !job.description.toLowerCase().includes(search.keywords.toLowerCase())) return false

  return true
}

async function analyzeJobWithOpenAI(job, search) {
  const prompt = `
Vous êtes un expert en recrutement pour des postes d'ingénieur en génie électrique. Analysez cette offre d'emploi en français et fournissez une analyse complète en français.

Offre d'emploi :
Titre : ${job.title}
Entreprise : ${job.company}
Localisation : ${job.location}
Salaire : ${job.salary}
Description : ${job.description}

Critères de recherche :
Titre : ${search.title}
Mots-clés : ${search.keywords}
Années d'expérience minimum : ${search.min_years}
Salaire minimum : ${search.min_salary}k€
Salaire maximum : ${search.max_salary}k€

Fournissez une réponse structurée avec les sections suivantes :
1. **Résumé** : Résumé court de l'offre (2-3 phrases)
2. **Correspondance** : Évaluation de la correspondance avec les critères (échelle 1-10)
3. **SWOT** : Analyse SWOT de l'offre (Forces, Faiblesses, Opportunités, Menaces)
4. **CV adapté** : Suggestions pour adapter le CV à cette offre spécifique
5. **Lettre de motivation** : Structure suggérée pour la lettre de motivation
6. **Speech** : Discours d'introduction pour un entretien (1-2 minutes)

Répondez uniquement avec le contenu structuré, sans introduction ni conclusion.
`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000
    })

    const content = response.choices[0].message.content

    // Parser la réponse pour extraire les sections
    const sections = content.split(/\d+\.\s*\*\*[^*]+\*\*/)

    return {
      summary: sections[1]?.trim() || '',
      match_score: parseInt(sections[2]?.match(/(\d+)/)?.[1] || 0),
      swot: sections[3]?.trim() || '',
      cv_advice: sections[4]?.trim() || '',
      cover_letter_structure: sections[5]?.trim() || '',
      interview_speech: sections[6]?.trim() || ''
    }
  } catch (err) {
    console.error('Erreur OpenAI:', err)
    return {
      summary: 'Erreur lors de l\'analyse',
      match_score: 0,
      swot: '',
      cv_advice: '',
      cover_letter_structure: '',
      interview_speech: ''
    }
  }
}