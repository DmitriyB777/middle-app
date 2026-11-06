import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit'
import { ApiError, apiRequest, getErrorMessage } from '../../api/client'
import type { RootState } from '../../app/store'
import type {
  City,
  CityInput,
  CityMutationArguments,
  RegionDetails,
  RegionDetailsResponse,
  RequestStatus,
} from '../../types/api'
import { login, logout, sessionExpired } from '../auth/authSlice'

export interface CitiesState {
  items: City[]
  status: RequestStatus
  mutationStatus: RequestStatus
  error: string | null
  mutationError: string | null
  regionDetails: RegionDetails | null
  detailsRegionId: number | null
  detailsStatus: RequestStatus
  detailsError: string | null
}

const initialState: CitiesState = {
  items: [],
  status: 'idle',
  mutationStatus: 'idle',
  error: null,
  mutationError: null,
  regionDetails: null,
  detailsRegionId: null,
  detailsStatus: 'idle',
  detailsError: null,
}

export const fetchCities = createAsyncThunk<
  City[],
  void,
  { rejectValue: string }
>('cities/fetchCities', async (_, { rejectWithValue }) => {
  try {
    return await apiRequest<City[]>('/cities')
  } catch (error) {
    return rejectWithValue(getErrorMessage(error))
  }
})

const isEmptyRegionDetailsResponse = (error: unknown): boolean => {
  if (!(error instanceof ApiError) || error.status !== 404) {
    return false
  }

  if (!error.body || typeof error.body !== 'object') {
    return false
  }

  const message = (error.body as { message?: unknown }).message

  return (
    typeof message === 'string' &&
    message.toLowerCase().includes('no cities or sub-regions')
  )
}

export const fetchRegionDetails = createAsyncThunk<
  RegionDetailsResponse,
  number,
  { rejectValue: string }
>('cities/fetchRegionDetails', async (regionId, { rejectWithValue }) => {
  try {
    const details = await apiRequest<RegionDetails>(`/cities/${regionId}`)
    return { regionId, ...details }
  } catch (error) {
    if (isEmptyRegionDetailsResponse(error)) {
      return { regionId, cities: [], sub_regions: [] }
    }

    return rejectWithValue(getErrorMessage(error))
  }
})

type CitiesThunkDispatch = ThunkDispatch<
  { cities: CitiesState },
  unknown,
  UnknownAction
>

const refreshCitiesAndDetails = async (
  dispatch: CitiesThunkDispatch,
  getState: () => { cities: CitiesState },
): Promise<void> => {
  await dispatch(fetchCities())

  const detailsRegionId = getState().cities.detailsRegionId
  if (detailsRegionId !== null) {
    await dispatch(fetchRegionDetails(detailsRegionId))
  }
}

export const createCity = createAsyncThunk<
  City,
  CityInput,
  { rejectValue: string; state: { cities: CitiesState } }
>('cities/createCity', async (input, { dispatch, getState, rejectWithValue }) => {
  try {
    const city = await apiRequest<City>('/city', {
      method: 'POST',
      body: input,
    })

    await refreshCitiesAndDetails(dispatch, getState)
    return city
  } catch (error) {
    return rejectWithValue(getErrorMessage(error))
  }
})

export const updateCity = createAsyncThunk<
  City,
  CityMutationArguments,
  { rejectValue: string; state: { cities: CitiesState } }
>('cities/updateCity', async ({ id, input }, { dispatch, getState, rejectWithValue }) => {
  try {
    const city = await apiRequest<City>(`/city/${id}`, {
      method: 'PUT',
      body: input,
    })

    await refreshCitiesAndDetails(dispatch, getState)
    return city
  } catch (error) {
    return rejectWithValue(getErrorMessage(error))
  }
})

export const deleteCity = createAsyncThunk<
  number,
  number,
  { rejectValue: string; state: { cities: CitiesState } }
>('cities/deleteCity', async (id, { dispatch, getState, rejectWithValue }) => {
  try {
    await apiRequest<{ message: string }>(`/city/${id}`, {
      method: 'DELETE',
    })

    await refreshCitiesAndDetails(dispatch, getState)
    return id
  } catch (error) {
    return rejectWithValue(getErrorMessage(error))
  }
})

const resetState = (state: CitiesState): void => {
  state.items = []
  state.status = 'idle'
  state.mutationStatus = 'idle'
  state.error = null
  state.mutationError = null
  state.regionDetails = null
  state.detailsRegionId = null
  state.detailsStatus = 'idle'
  state.detailsError = null
}

const citiesSlice = createSlice({
  name: 'cities',
  initialState,
  reducers: {
    clearMutationError: (state) => {
      state.mutationError = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCities.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchCities.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
        state.error = null
      })
      .addCase(fetchCities.rejected, (state, action) => {
        state.status = 'failed'
        state.error =
          action.payload ?? 'Не удалось загрузить города. Попробуйте ещё раз.'
      })
      .addCase(fetchRegionDetails.pending, (state, action) => {
        const requestedRegionId = action.meta.arg

        if (state.detailsRegionId !== requestedRegionId) {
          state.regionDetails = null
        }

        state.detailsRegionId = requestedRegionId
        state.detailsStatus = 'loading'
        state.detailsError = null
      })
      .addCase(fetchRegionDetails.fulfilled, (state, action) => {
        if (state.detailsRegionId !== action.payload.regionId) {
          return
        }

        state.detailsStatus = 'succeeded'
        state.regionDetails = {
          cities: action.payload.cities,
          sub_regions: action.payload.sub_regions,
        }
        state.detailsError = null
      })
      .addCase(fetchRegionDetails.rejected, (state, action) => {
        if (state.detailsRegionId !== action.meta.arg) {
          return
        }

        state.detailsStatus = 'failed'
        state.regionDetails = null
        state.detailsError =
          action.payload ?? 'Не удалось загрузить данные региона.'
      })
      .addCase(createCity.pending, (state) => {
        state.mutationStatus = 'loading'
        state.mutationError = null
      })
      .addCase(createCity.fulfilled, (state) => {
        state.mutationStatus = 'succeeded'
        state.mutationError = null
      })
      .addCase(createCity.rejected, (state, action) => {
        state.mutationStatus = 'failed'
        state.mutationError = action.payload ?? 'Не удалось создать город.'
      })
      .addCase(updateCity.pending, (state) => {
        state.mutationStatus = 'loading'
        state.mutationError = null
      })
      .addCase(updateCity.fulfilled, (state) => {
        state.mutationStatus = 'succeeded'
        state.mutationError = null
      })
      .addCase(updateCity.rejected, (state, action) => {
        state.mutationStatus = 'failed'
        state.mutationError =
          action.payload ?? 'Не удалось сохранить изменения города.'
      })
      .addCase(deleteCity.pending, (state) => {
        state.mutationStatus = 'loading'
        state.mutationError = null
      })
      .addCase(deleteCity.fulfilled, (state) => {
        state.mutationStatus = 'succeeded'
        state.mutationError = null
      })
      .addCase(deleteCity.rejected, (state, action) => {
        state.mutationStatus = 'failed'
        state.mutationError = action.payload ?? 'Не удалось удалить город.'
      })
      .addCase(login.fulfilled, resetState)
      .addCase(logout.fulfilled, resetState)
      .addCase(sessionExpired, resetState)
  },
})

export const { clearMutationError } = citiesSlice.actions

export const selectCities = (state: RootState) => state.cities.items
export const selectCitiesStatus = (state: RootState) => state.cities.status
export const selectCitiesError = (state: RootState) => state.cities.error
export const selectCityMutationStatus = (state: RootState) =>
  state.cities.mutationStatus
export const selectCityMutationError = (state: RootState) =>
  state.cities.mutationError
export const selectRegionDetails = (state: RootState) =>
  state.cities.regionDetails
export const selectDetailsRegionId = (state: RootState) =>
  state.cities.detailsRegionId
export const selectDetailsStatus = (state: RootState) =>
  state.cities.detailsStatus
export const selectDetailsError = (state: RootState) => state.cities.detailsError

export const citiesReducer = citiesSlice.reducer
