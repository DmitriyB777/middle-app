export interface Credentials {
  username: string
  password: string
}

export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed'

export interface AuthTokens {
  access: string
  refresh: string
}

export interface LoginResponse {
  message: string
  tokens: AuthTokens
}

export interface MessageResponse {
  message: string
}

export interface Region {
  id: number
  name: string
  parent_id: number | null
}

export interface RegionInput {
  name: string
  parent_id: number | null
}

export interface City {
  id: number
  name: string
  region_id: number
}

export interface CityInput {
  name: string
  region_id: number
}

export interface RegionDetails {
  cities: City[]
  sub_regions: Region[]
}

export interface RegionDetailsResponse extends RegionDetails {
  regionId: number
}

export interface RegionMutationArguments {
  id: number
  input: RegionInput
}

export interface CityMutationArguments {
  id: number
  input: CityInput
}

export interface ApiErrorBody {
  error?: string
  message?: string
  msg?: string
}
