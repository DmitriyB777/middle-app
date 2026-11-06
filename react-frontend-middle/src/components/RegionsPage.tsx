import { useEffect, useMemo, useState } from 'react'
import type { SubmitEvent } from 'react'
import { getErrorMessage } from '../api/client'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import {
  collectRegionAndDescendantIds,
  buildRegionForest,
  flattenRegionForest,
} from '../features/regions/regionTree'
import {
  createRegion,
  deleteRegion,
  fetchRegions,
  selectRegionMutationStatus,
  selectRegions,
  selectRegionsError,
  selectRegionsStatus,
  updateRegion,
} from '../features/regions/regionsSlice'
import type { Region } from '../types/api'
import { RegionTree } from './RegionTree'
import type { RegionTreeRowProps } from './RegionTree'
import { EmptyState, ErrorState, LoadingState } from './StatusMessage'

const parentOptionLabel = (name: string, depth: number): string => {
  return depth > 0 ? `${'— '.repeat(depth)}${name}` : name
}

export const RegionsPage = () => {
  const dispatch = useAppDispatch()

  const regions = useAppSelector(selectRegions)
  const status = useAppSelector(selectRegionsStatus)
  const error = useAppSelector(selectRegionsError)
  const mutationStatus = useAppSelector(selectRegionMutationStatus)

  const [newName, setNewName] = useState('')
  const [newParentId, setNewParentId] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editParentId, setEditParentId] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const isBusy = mutationStatus === 'loading'

  useEffect(() => {
    if (status === 'idle') {
      void dispatch(fetchRegions())
    }
  }, [dispatch, status])

  const forest = useMemo(() => buildRegionForest(regions), [regions])
  const flatOptions = useMemo(() => flattenRegionForest(forest), [forest])

  const childCounts = useMemo(() => {
    const counts = new Map<number, number>()

    for (const region of regions) {
      if (region.parent_id === null) {
        continue
      }

      counts.set(region.parent_id, (counts.get(region.parent_id) ?? 0) + 1)
    }

    return counts
  }, [regions])

  const excludedParentIds = useMemo(
    () =>
      editingId === null
        ? null
        : collectRegionAndDescendantIds(editingId, regions),
    [editingId, regions],
  )

  const handleCreate = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isBusy) {
      return
    }

    const name = newName.trim()
    if (!name) {
      setCreateError('Введите название региона.')
      return
    }

    setCreateError(null)

    try {
      await dispatch(
        createRegion({
          name,
          parent_id: newParentId === '' ? null : Number(newParentId),
        }),
      ).unwrap()
      setNewName('')
    } catch (caughtError) {
      setCreateError(getErrorMessage(caughtError))
    }
  }

  const startEdit = (region: Region) => {
    setEditingId(region.id)
    setEditName(region.name)
    setEditParentId(region.parent_id === null ? '' : String(region.parent_id))
    setEditError(null)
    setConfirmDeleteId(null)
    setDeleteError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditParentId('')
    setEditError(null)
  }

  const handleSaveEdit = async (
    event: SubmitEvent<HTMLFormElement>,
    regionId: number,
  ) => {
    event.preventDefault()

    if (isBusy) {
      return
    }

    const name = editName.trim()
    if (!name) {
      setEditError('Введите название региона.')
      return
    }

    setEditError(null)

    try {
      await dispatch(
        updateRegion({
          id: regionId,
          input: {
            name,
            parent_id: editParentId === '' ? null : Number(editParentId),
          },
        }),
      ).unwrap()
      cancelEdit()
    } catch (caughtError) {
      setEditError(getErrorMessage(caughtError))
    }
  }

  const requestDelete = (regionId: number) => {
    setConfirmDeleteId(regionId)
    setDeleteError(null)
  }

  const cancelDelete = () => {
    setConfirmDeleteId(null)
    setDeleteError(null)
  }

  const handleDelete = async (region: Region) => {
    if (isBusy) {
      return
    }

    setDeleteError(null)

    try {
      await dispatch(deleteRegion(region.id)).unwrap()
      setConfirmDeleteId(null)
      if (editingId === region.id) {
        cancelEdit()
      }
    } catch (caughtError) {
      setDeleteError(getErrorMessage(caughtError))
    }
  }

  const renderRegionRow = ({
    region,
    hasChildren,
    collapsed,
    onToggle,
  }: RegionTreeRowProps) => {
    const childCount = childCounts.get(region.id) ?? 0

    if (editingId === region.id) {
      return (
        <form
          className="region-edit"
          onSubmit={(event) => void handleSaveEdit(event, region.id)}
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
              <span>Родительский регион</span>
              <select
                value={editParentId}
                onChange={(event) => setEditParentId(event.target.value)}
                disabled={isBusy}
              >
                <option value="">Без родителя</option>
                {flatOptions
                  .filter(
                    ({ region: optionRegion }) =>
                      !excludedParentIds?.has(optionRegion.id),
                  )
                  .map(({ region: optionRegion, depth }) => (
                    <option key={optionRegion.id} value={optionRegion.id}>
                      {parentOptionLabel(optionRegion.name, depth)}
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
            <button type="submit" className="btn btn-primary btn-sm" disabled={isBusy}>
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
      )
    }

    return (
      <div className="region-row-wrap">
        <div className="region-row">
          <button
            type="button"
            className="tree-toggle"
            onClick={onToggle}
            aria-expanded={hasChildren ? !collapsed : undefined}
            aria-label={
              hasChildren
                ? `${collapsed ? 'Развернуть' : 'Свернуть'} ${region.name}`
                : undefined
            }
            disabled={!hasChildren}
          >
            {hasChildren ? (collapsed ? '▸' : '▾') : '•'}
          </button>

          <div className="region-main">
            <span className="region-name">{region.name}</span>
            <span className="region-meta">
              ID {region.id}
              {childCount > 0
                ? ` · подрегионов: ${childCount}`
                : ' · без подрегионов'}
            </span>
          </div>

          <span className="badge">
            {region.parent_id === null
              ? 'корневой'
              : `родитель #${region.parent_id}`}
          </span>

          <div className="row-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => startEdit(region)}
              disabled={isBusy}
            >
              Изменить
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost btn-sm"
              onClick={() => requestDelete(region.id)}
              disabled={isBusy}
            >
              Удалить
            </button>
          </div>
        </div>

        {confirmDeleteId === region.id ? (
          <div className="confirm-panel" role="group" aria-label="Подтверждение удаления">
            <p>
              Удалить регион «{region.name}»? Вместе с ним будут удалены все
              дочерние регионы и их города. Действие необратимо.
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
                onClick={() => void handleDelete(region)}
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
        ) : null}
      </div>
    )
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Структура</p>
          <h1>Регионы</h1>
          <p className="page-subtitle">
            Создавайте иерархию регионов, меняйте родителей и удаляйте ветки.
          </p>
        </div>
        <div className="stats" aria-label="Статистика регионов">
          <span className="stat">
            Всего <strong>{regions.length}</strong>
          </span>
          <span className="stat">
            Корневых <strong>{forest.length}</strong>
          </span>
        </div>
      </header>

      <div className="layout-grid">
        <div className="card">
          <h2>Новый регион</h2>
          <form className="form-stack" onSubmit={handleCreate}>
            <label className="field">
              <span>Название</span>
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Например, Московская область"
                required
                disabled={isBusy}
              />
            </label>

            <label className="field">
              <span>Родительский регион</span>
              <select
                value={newParentId}
                onChange={(event) => setNewParentId(event.target.value)}
                disabled={isBusy}
              >
                <option value="">Без родителя</option>
                {flatOptions.map(({ region, depth }) => (
                  <option key={region.id} value={region.id}>
                    {parentOptionLabel(region.name, depth)}
                  </option>
                ))}
              </select>
            </label>

            {createError ? (
              <div className="alert alert-error" role="alert">
                {createError}
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary" disabled={isBusy}>
              {isBusy ? 'Создаём…' : 'Создать регион'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Дерево регионов</h2>
            {status === 'loading' && regions.length > 0 ? (
              <span className="muted-note">Обновляем список…</span>
            ) : null}
          </div>

          {status === 'loading' && regions.length === 0 ? (
            <LoadingState text="Загружаем регионы…" />
          ) : null}

          {status === 'failed' ? (
            <ErrorState
              message={error ?? 'Не удалось загрузить регионы.'}
              onRetry={() => void dispatch(fetchRegions())}
            />
          ) : null}

          {status === 'succeeded' && regions.length === 0 ? (
            <EmptyState title="Регионов пока нет">
              Создайте первый регион в форме слева.
            </EmptyState>
          ) : null}

          {regions.length > 0 ? (
            <RegionTree nodes={forest} renderRow={renderRegionRow} />
          ) : null}
        </div>
      </div>
    </section>
  )
}
