import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { apiRequest, getErrorMessage } from '../../api/client'
import type { RootState } from '../../app/store'
import type {
  Region,
  RegionInput,
  RegionMutationArguments,
  RequestStatus,
} from '../../types/api'
import { login, logout, sessionExpired } from '../auth/authSlice'
import { fetchCities } from '../cities/citiesSlice'

export interface RegionsState {
  items: Region[]
  status: RequestStatus
  mutationStatus: RequestStatus
  error: string | null
  mutationError: string | null
}

const initialState: RegionsState = {
  items: [],
  status: 'idle',
  mutationStatus: 'idle',
  error: null,
  mutationError: null,
}

export const fetchRegions = createAsyncThunk<
  Region[],
  void,
  { rejectValue: string }
>('regions/fetchRegions', async (_, { rejectWithValue }) => {
  try {
    return await apiRequest<Region[]>('/regions')
  } catch (error) {
    return rejectWithValue(getErrorMessage(error))
  }
})

export const createRegion = createAsyncThunk<
  Region,
  RegionInput,
  { rejectValue: string }
>('regions/createRegion', async (input, { dispatch, rejectWithValue }) => {
  try {
    const region = await apiRequest<Region>('/region', {
      method: 'POST',
      body: input,
    })

    await dispatch(fetchRegions())
    return region
  } catch (error) {
    return rejectWithValue(getErrorMessage(error))
  }
})

export const updateRegion = createAsyncThunk<
  Region,
  RegionMutationArguments,
  { rejectValue: string }
>('regions/updateRegion', async ({ id, input }, { dispatch, rejectWithValue }) => {
  try {
    const region = await apiRequest<Region>(`/region/${id}`, {
      method: 'PUT',
      body: input,
    })

    await dispatch(fetchRegions())
    return region
  } catch (error) {
    return rejectWithValue(getErrorMessage(error))
  }
})

export const deleteRegion = createAsyncThunk<
  number,
  number,
  { rejectValue: string }
>('regions/deleteRegion', async (id, { dispatch, rejectWithValue }) => {
  try {
    await apiRequest<{ message: string }>(`/region/${id}`, {
      method: 'DELETE',
    })

    await dispatch(fetchRegions())
    await dispatch(fetchCities())
    return id
  } catch (error) {
    return rejectWithValue(getErrorMessage(error))
  }
})

function resetState(state: RegionsState): void {
  state.items = []
  state.status = 'idle'
  state.mutationStatus = 'idle'
  state.error = null
  state.mutationError = null
}

const regionsSlice = createSlice({
  name: 'regions',
  initialState,
  reducers: {
    clearMutationError(state) {
      state.mutationError = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRegions.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchRegions.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
        state.error = null
      })
      .addCase(fetchRegions.rejected, (state, action) => {
        state.status = 'failed'
        state.error =
          action.payload ?? 'Не удалось загрузить регионы. Попробуйте ещё раз.'
      })
      .addCase(createRegion.pending, (state) => {
        state.mutationStatus = 'loading'
        state.mutationError = null
      })
      .addCase(createRegion.fulfilled, (state) => {
        state.mutationStatus = 'succeeded'
        state.mutationError = null
      })
      .addCase(createRegion.rejected, (state, action) => {
        state.mutationStatus = 'failed'
        state.mutationError =
          action.payload ?? 'Не удалось создать регион.'
      })
      .addCase(updateRegion.pending, (state) => {
        state.mutationStatus = 'loading'
        state.mutationError = null
      })
      .addCase(updateRegion.fulfilled, (state) => {
        state.mutationStatus = 'succeeded'
        state.mutationError = null
      })
      .addCase(updateRegion.rejected, (state, action) => {
        state.mutationStatus = 'failed'
        state.mutationError =
          action.payload ?? 'Не удалось сохранить изменения региона.'
      })
      .addCase(deleteRegion.pending, (state) => {
        state.mutationStatus = 'loading'
        state.mutationError = null
      })
      .addCase(deleteRegion.fulfilled, (state) => {
        state.mutationStatus = 'succeeded'
        state.mutationError = null
      })
      .addCase(deleteRegion.rejected, (state, action) => {
        state.mutationStatus = 'failed'
        state.mutationError = action.payload ?? 'Не удалось удалить регион.'
      })
      .addCase(login.fulfilled, resetState)
      .addCase(logout.fulfilled, resetState)
      .addCase(sessionExpired, resetState)
  },
})

export const { clearMutationError } = regionsSlice.actions

export const selectRegions = (state: RootState) => state.regions.items
export const selectRegionsStatus = (state: RootState) => state.regions.status
export const selectRegionsError = (state: RootState) => state.regions.error
export const selectRegionMutationStatus = (state: RootState) =>
  state.regions.mutationStatus
export const selectRegionMutationError = (state: RootState) =>
  state.regions.mutationError

export const regionsReducer = regionsSlice.reducer
