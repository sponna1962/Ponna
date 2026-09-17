import type { MetadataRoute } from 'next'

const baseUrl = 'https://www.ponna.in'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/about`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/ask-ponna`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/cutoff-predictor`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/daily-quiz`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/help`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/live-exam`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/mistakes`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/offline-practice`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/plans`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/quiz`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/study-notes`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/test-your-ability`, changeFrequency: 'weekly', priority: 0.8 },
  ]
}
