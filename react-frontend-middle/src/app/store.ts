import { configureStore } from '@reduxjs/toolkit'
import { setUnauthorizedHandler } from '../api/client'
import { authReducer, sessionExpired } from '../features/auth/authSlice'
import { citiesReducer } from '../features/cities/citiesSlice'
import { regionsReducer } from '../features/regions/regionsSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    regions: regionsReducer,
    cities: citiesReducer,
  },
})

setUnauthorizedHandler(() => {
  store.dispatch(sessionExpired())
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
