import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { getErrorMessage } from '../api/client'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import {
  createCity,
  deleteCity,
  fetchCities,
  fetchRegionDetails,
  selectCities,
  selectCitiesError,
  selectCitiesStatus,
  selectCityMutationStatus,
  selectDetailsError,
  selectDetailsStatus,
  selectRegionDetails,
  updateCity,
} from '../features/cities/citiesSlice'
import { buildRegionForest, flattenRegionForest } from '../features/regions/regionTree'
import {
  fetchRegions,
  selectRegions,
  selectRegionsError,
  selectRegionsStatus,
} from '../features/regions/regionsSlice'
import type { City } from '../types/api'
import { EmptyState, ErrorState, LoadingState } from './StatusMessage'

const regionOptionLabel = (name: string, depth: number): string => {
  return depth > 0 ? `${'— '.repeat(depth)}${name}` : name
}

export const CitiesPage = () => {
  const dispatch = useAppDispatch()

  const cities = useAppSelector(selectCities)
  const citiesStatus = useAppSelector(selectCitiesStatus)
  const citiesError = useAppSelector(selectCitiesError)
  const mutationStatus = useAppSelector(selectCityMutationStatus)

  const regions = useAppSelector(selectRegions)
  const regionsStatus = useAppSelector(selectRegionsStatus)
  const regionsError = useAppSelector(selectRegionsError)

  const regionDetails = useAppSelector(selectRegionDetails)
  const detailsStatus = useAppSelector(selectDetailsStatus)
  const detailsError = useAppSelector(selectDetailsError)

  const [selectedRegionId, setSelectedRegionId] = useState('')
  const [newName, setNewName] = useState('')
  const [newRegionId, setNewRegionId] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editRegionId, setEditRegionId] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const isBusy = mutationStatus === 'loading'
  const selectedRegionNumber =
    selectedRegionId === '' ? null : Number(selectedRegionId)

  useEffect(() => {
    if (citiesStatus === 'idle') {
      void dispatch(fetchCities())
    }
  }, [dispatch, citiesStatus])

  useEffect(() => {
    if (regionsStatus === 'idle') {
      void dispatch(fetchRegions())
    }
  }, [dispatch, regionsStatus])

  const lastDetailsRequestRef = useRef<number | null>(null)

  useEffect(() => {
    if (selectedRegionNumber === null) {
      lastDetailsRequestRef.current = null
      return
    }

    if (lastDetailsRequestRef.current === selectedRegionNumber) {
      return
    }

    lastDetailsRequestRef.current = selectedRegionNumber
    void dispatch(fetchRegionDetails(selectedRegionNumber))
  }, [dispatch, selectedRegionNumber])

  const flatRegions = useMemo(
    () => flattenRegionForest(buildRegionForest(regions)),
    [regions],
  )

  const regionNames = useMemo(
    () => new Map(regions.map((region) => [region.id, region.name])),
    [regions],
  )

  const selectedRegion = useMemo(
    () =>
      selectedRegionNumber === null
        ? null
        : regions.find((region) => region.id === selectedRegionNumber) ?? null,
    [regions, selectedRegionNumber],
  )

  const visibleCities = useMemo(
    () =>
      selectedRegionNumber === null
        ? cities
        : cities.filter((city) => city.region_id === selectedRegionNumber),
    [cities, selectedRegionNumber],
  )

  const handleCreate = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isBusy) {
      return
    }

    const name = newName.trim()
    if (!name) {
      setCreateError('Введите название города.')
      return
    }

    if (newRegionId === '') {
      setCreateError('Выберите регион.')
      return
    }

    setCreateError(null)

    try {
      await dispatch(
        createCity({ name, region_id: Number(newRegionId) }),
      ).unwrap()
      setNewName('')
    } catch (caughtError) {
      setCreateError(getErrorMessage(caughtError))
    }
  }

  const startEdit = (city: City) => {
    setEditingId(city.id)
    setEditName(city.name)
    setEditRegionId(String(city.region_id))
    setEditError(null)
    setConfirmDeleteId(null)
    setDeleteError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditRegionId('')
    setEditError(null)
  }

  const handleSaveEdit = async (
    event: SubmitEvent<HTMLFormElement>,
    cityId: number,
  ) => {
    event.preventDefault()

    if (isBusy) {
      return
    }

    const name = editName.trim()
    if (!name) {
      setEditError('Введите название города.')
      return
    }

    if (editRegionId === '') {
      setEditError('Выберите регион.')
      return
    }

    setEditError(null)

    try {
      await dispatch(
        updateCity({
          id: cityId,
          input: { name, region_id: Number(editRegionId) },
        }),
      ).unwrap()
      cancelEdit()
    } catch (caughtError) {
      setEditError(getErrorMessage(caughtError))
    }
  }

  const requestDelete = (cityId: number) => {
    setConfirmDeleteId(cityId)
    setDeleteError(null)
  }

  const cancelDelete = () => {
    setConfirmDeleteId(null)
    setDeleteError(null)
  }

  const handleDelete = async (city: City) => {
    if (isBusy) {
      return
    }

    setDeleteError(null)

    try {
      await dispatch(deleteCity(city.id)).unwrap()
      setConfirmDeleteId(null)
      if (editingId === city.id) {
        cancelEdit()
      }
    } catch (caughtError) {
      setDeleteError(getErrorMessage(caughtError))
    }
  }

  const retryDetails = () => {
    if (selectedRegionNumber !== null) {
      void dispatch(fetchRegionDetails(selectedRegionNumber))
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Населённые пункты</p>
          <h1>Города</h1>
          <p className="page-subtitle">
            Привязывайте города к регионам, фильтруйте список и управляйте
            записями.
          </p>
        </div>
        <div className="stats" aria-label="Статистика городов">
          <span className="stat">
            Всего городов <strong>{cities.length}</strong>
          </span>
          <span className="stat">
            В выборке <strong>{visibleCities.length}</strong>
          </span>
        </div>
      </header>

      <div className="layout-grid">
        <div className="card">
          <h2>Новый город</h2>
          <form className="form-stack" onSubmit={handleCreate}>
            <label className="field">
              <span>Название</span>
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Например, Казань"
                required
                disabled={isBusy}
              />
            </label>

            <label className="field">
              <span>Регион</span>
              <select
                value={newRegionId}
                onChange={(event) => setNewRegionId(event.target.value)}
                required
                disabled={isBusy || regions.length === 0}
              >
                <option value="">Выберите регион</option>
                {flatRegions.map(({ region, depth }) => (
                  <option key={region.id} value={region.id}>
                    {regionOptionLabel(region.name, depth)}
                  </option>
                ))}
              </select>
            </label>

            {regionsStatus === 'loading' && regions.length === 0 ? (
              <LoadingState text="Загружаем регионы…" />
            ) : null}

            {regionsStatus === 'failed' ? (
              <ErrorState
                message={regionsError ?? 'Не удалось загрузить регионы.'}
                onRetry={() => void dispatch(fetchRegions())}
              />
            ) : null}

            {regionsStatus === 'succeeded' && regions.length === 0 ? (
              <div className="alert alert-info">
                Сначала создайте хотя бы один регион на вкладке «Регионы».
              </div>
            ) : null}

            {createError ? (
              <div className="alert alert-error" role="alert">
                {createError}
              </div>
            ) : null}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isBusy || regions.length === 0}
            >
              {isBusy ? 'Создаём…' : 'Создать город'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Регион</h2>
            {detailsStatus === 'loading' ? (
              <span className="muted-note">Загружаем…</span>
            ) : null}
          </div>

          <label className="field">
            <span>Фильтр по региону</span>
            <select
              value={selectedRegionId}
              onChange={(event) => {
                const nextRegionId = event.target.value
                setSelectedRegionId(nextRegionId)
                if (nextRegionId !== '') {
                  setNewRegionId(nextRegionId)
                }
              }}
            >
              <option value="">Все регионы</option>
              {flatRegions.map(({ region, depth }) => (
                <option key={region.id} value={region.id}>
                  {regionOptionLabel(region.name, depth)}
                </option>
              ))}
            </select>
          </label>

          {selectedRegionNumber === null ? (
            <p className="muted-note">
              Выберите регион, чтобы увидеть его прямые города и подрегионы.
            </p>
          ) : null}

          {selectedRegionNumber !== null && detailsStatus === 'failed' ? (
            <ErrorState
              message={detailsError ?? 'Не удалось загрузить данные региона.'}
              onRetry={retryDetails}
            />
          ) : null}

          {selectedRegionNumber !== null &&
          detailsStatus === 'loading' &&
          regionDetails === null ? (
            <LoadingState text="Загружаем данные региона…" />
          ) : null}

          {selectedRegionNumber !== null &&
          detailsStatus === 'succeeded' &&
          regionDetails ? (
            <div className="details-grid">
              <div>
                <h3>
                  Города <span className="badge">{regionDetails.cities.length}</span>
                </h3>
                {regionDetails.cities.length > 0 ? (
                  <ul className="simple-list">
                    {regionDetails.cities.map((city) => (
                      <li key={city.id}>
                        <span>{city.name}</span>
                        <span className="muted-note">#{city.id}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted-note">В этом регионе пока нет городов.</p>
                )}
              </div>

              <div>
                <h3>
                  Подрегионы{' '}
                  <span className="badge">{regionDetails.sub_regions.length}</span>
                </h3>
                {regionDetails.sub_regions.length > 0 ? (
                  <ul className="simple-list">
                    {regionDetails.sub_regions.map((region) => (
                      <li key={region.id}>
                        <span>{region.name}</span>
                        <span className="muted-note">#{region.id}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted-note">Подрегионов нет.</p>
                )}
              </div>
            </div>
          ) : null}

          {selectedRegion !== null ? (
            <p className="muted-note">
              Выбран: <strong>{selectedRegion.name}</strong> (ID {selectedRegion.id})
            </p>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Список городов</h2>
          <span className="muted-note">
            Показано {visibleCities.length} из {cities.length}
          </span>
        </div>

        {citiesStatus === 'loading' && cities.length === 0 ? (
          <LoadingState text="Загружаем города…" />
        ) : null}

        {citiesStatus === 'failed' ? (
          <ErrorState
            message={citiesError ?? 'Не удалось загрузить города.'}
            onRetry={() => void dispatch(fetchCities())}
          />
        ) : null}

        {citiesStatus === 'succeeded' && cities.length === 0 ? (
          <EmptyState title="Городов пока нет">
            Создайте первый город в форме выше.
          </EmptyState>
        ) : null}

        {cities.length > 0 && visibleCities.length === 0 ? (
          <EmptyState title="В выбранном регионе нет городов">
            Снимите фильтр или добавьте город для этого региона.
          </EmptyState>
        ) : null}

        {visibleCities.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Название</th>
                  <th scope="col">Регион</th>
                  <th scope="col">ID</th>
                  <th scope="col">Действия</th>
                </tr>
              </thead>
              <tbody>
                {visibleCities.map((city) =>
                  editingId === city.id ? (
                    <tr key={city.id}>
                      <td colSpan={4}>
                        <form
                          className="city-edit"
                          onSubmit={(event) => void handleSaveEdit(event, city.id)}
                        >
                          <div className="inline-grid">
                            <label className="field">
                              <span>Название</span>
                              <input
                                type="text"
                                value={editName}
                                onChange={(event) => setEditName(event.target.value)}
                                required
                                disabled={isBusy}
                                autoFocus
                              />
                            </label>

                            <label className="field">
                              <span>Регион</span>
                              <select
                                value={editRegionId}
                                onChange={(event) =>
                                  setEditRegionId(event.target.value)
                                }
                                required
                                disabled={isBusy}
                              >
                                <option value="">Выберите регион</option>
                                {flatRegions.map(({ region, depth }) => (
                                  <option key={region.id} value={region.id}>
                                    {regionOptionLabel(region.name, depth)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          {editError ? (
                            <div className="alert alert-error" role="alert">
                              {editError}
                            </div>
                          ) : null}

                          <div className="row-actions">
                            <button
                              type="submit"
                              className="btn btn-primary btn-sm"
                              disabled={isBusy}
                            >
                              {isBusy ? 'Сохраняем…' : 'Сохранить'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={cancelEdit}
                              disabled={isBusy}
                            >
                              Отмена
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <Fragment key={city.id}>
                      <tr>
                        <td>
                          <strong>{city.name}</strong>
                        </td>
                        <td>
                          {regionNames.get(city.region_id) ??
                            `Регион #${city.region_id}`}
                        </td>
                        <td className="mono">#{city.id}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => startEdit(city)}
                              disabled={isBusy}
                            >
                              Изменить
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger-ghost btn-sm"
                              onClick={() => requestDelete(city.id)}
                              disabled={isBusy}
                            >
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>

                      {confirmDeleteId === city.id ? (
                        <tr>
                          <td colSpan={4}>
                            <div
                              className="confirm-panel"
                              role="group"
                              aria-label="Подтверждение удаления"
                            >
                              <p>
                                Удалить город «{city.name}»? Действие необратимо.
                              </p>
                              {deleteError ? (
                                <div className="alert alert-error" role="alert">
                                  {deleteError}
                                </div>
                              ) : null}
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => void handleDelete(city)}
                                  disabled={isBusy}
                                >
                                  {isBusy ? 'Удаляем…' : 'Удалить'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={cancelDelete}
                                  disabled={isBusy}
                                >
                                  Отмена
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  )
}
