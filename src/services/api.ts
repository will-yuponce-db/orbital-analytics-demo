import type {
  Scenario,
  ThreatObject,
  EWThreat,
  C2Alert,
  SSNDataSource,
  UserProfile,
} from '../types'

const API_BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3000/api'

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`)
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`)
  }
  return response.json()
}

export const api = {
  // Scenarios
  getScenarios: () => fetchAPI<Scenario[]>('/scenarios'),
  getScenario: (id: string) => fetchAPI<Scenario>(`/scenarios/${id}`),

  // Threats
  getThreats: () => fetchAPI<ThreatObject[]>('/threats'),

  // EW Threats
  getEWThreats: () => fetchAPI<EWThreat[]>('/ew-threats'),

  // C2 Alerts
  getC2Alerts: () => fetchAPI<C2Alert[]>('/c2-alerts'),

  // SSN Sources
  getSSNSources: () => fetchAPI<SSNDataSource[]>('/ssn-sources'),

  // Users
  getUsers: () => fetchAPI<UserProfile[]>('/users'),
}


