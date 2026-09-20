import type { MetadataRoute } from 'next'

const baseUrl = 'https://www.ponna.in'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/about`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/ask-ponna`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/current-affairs`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/cutoff-predictor`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/daily-quiz`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/help`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/plans`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/study-notes`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/test-your-ability`, changeFrequency: 'weekly', priority: 0.8 },
    // TNPSC Group 4 & TNTET SEO landing pages (Sept 2026)
    { url: `${baseUrl}/tnpsc-group-4`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/tnpsc-group-4/previous-year-questions`, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/tnpsc-group-4/online-test`, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/tnpsc-group-4/question-bank`, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/tntet`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/tntet/paper-1`, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/tntet/paper-2`, changeFrequency: 'weekly', priority: 0.85 },
  ]
}
