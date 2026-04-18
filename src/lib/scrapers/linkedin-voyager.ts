/**
 * LinkedIn Voyager API client.
 * Uses saved session cookies (from Playwright admin login) to call
 * LinkedIn's internal JSON API — no browser needed for searches.
 */

import { loadCookies, saveCookies, hasSavedCookies } from './linkedin-auth'

export type VoyagerProfile = {
  name: string
  headline?: string
  location?: string
  profileUrl: string
}

export type VoyagerProfileDetails = {
  currentTitle?: string
  currentCompany?: string
  headline?: string
}

function buildHeaders(referer = 'https://www.linkedin.com/') {
  const cookies = loadCookies()
  const cookieHeader = cookies
    .filter(c => c.domain.includes('linkedin.com'))
    .map(c => `${c.name}=${c.value}`)
    .join('; ')
  const csrfToken = cookies.find(c => c.name === 'JSESSIONID')?.value?.replace(/"/g, '') ?? ''

  return {
    'accept': 'application/json',
    'csrf-token': csrfToken,
    'x-restli-protocol-version': '2.0.0',
    'x-li-lang': 'pt_PT',
    'x-li-track': '{"clientVersion":"1.13.17290","mpVersion":"1.13.17290","osName":"web","timezoneOffset":-4,"timezone":"America/Campo_Grande","deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
    'cookie': cookieHeader,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'referer': referer,
  }
}

export async function voyagerSearchPeople(query: string): Promise<VoyagerProfile[]> {
  if (!hasSavedCookies()) return []

  const url = `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true` +
    `&variables=(start:0,origin:GLOBAL_SEARCH_HEADER,query:(keywords:${encodeURIComponent(query)},flagshipSearchIntent:SEARCH_SRP,queryParameters:List((key:resultType,value:List(PEOPLE))),includeFiltersInResponse:false))` +
    `&queryId=voyagerSearchDashClusters.b0928897b71bd00a5a7291755dcd64f0`

  const res = await fetch(url, {
    headers: buildHeaders(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`),
  })

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('linkedin_auth_expired')
    throw new Error(`Voyager search failed: ${res.status}`)
  }

  const data = await res.json()
  const clusters = data?.data?.searchDashClustersByAll?.elements ?? []
  const profiles: VoyagerProfile[] = []

  for (const cluster of clusters) {
    for (const item of (cluster.items ?? [])) {
      const entity = item.item?.entityResult
      if (!entity) continue
      const name = entity.title?.text
      const url = entity.navigationUrl?.split('?')[0]
      if (name && url?.includes('/in/')) {
        profiles.push({
          name,
          headline: entity.primarySubtitle?.text,
          location: entity.secondarySubtitle?.text,
          profileUrl: url,
        })
      }
    }
  }

  return profiles
}

export async function voyagerGetProfileDetails(profileUrl: string): Promise<VoyagerProfileDetails> {
  if (!hasSavedCookies()) return {}

  // Extract slug from URL: https://www.linkedin.com/in/some-slug-123 → some-slug-123
  const slug = profileUrl.replace(/\/$/, '').split('/in/')[1]
  if (!slug) return {}

  const url = `https://www.linkedin.com/voyager/api/identity/dash/profiles` +
    `?q=memberIdentity&memberIdentity=${encodeURIComponent(slug)}` +
    `&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93`

  const res = await fetch(url, {
    headers: buildHeaders(profileUrl),
  })

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('linkedin_auth_expired')
    throw new Error(`Voyager profile fetch failed: ${res.status}`)
  }

  const data = await res.json()
  const profile = data?.elements?.[0]
  if (!profile) return {}

  const position = profile.profilePositionGroups?.elements?.[0]
    ?.profilePositionInPositionGroup?.elements?.[0]

  return {
    headline: profile.headline,
    currentTitle: position?.title,
    currentCompany: position?.companyName,
  }
}
