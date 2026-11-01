import type { Region } from '../../types/api'

export interface RegionTreeNode {
  region: Region
  children: RegionTreeNode[]
}

export interface FlatRegionOption {
  region: Region
  depth: number
}

export function buildRegionForest(regions: Region[]): RegionTreeNode[] {
  const byId = new Map<number, Region>()
  for (const region of regions) {
    byId.set(region.id, region)
  }

  const childrenByParent = new Map<number, Region[]>()
  const roots: Region[] = []

  for (const region of regions) {
    const parentId = region.parent_id

    if (parentId === null || parentId === region.id || !byId.has(parentId)) {
      roots.push(region)
      continue
    }

    const siblings = childrenByParent.get(parentId)
    if (siblings) {
      siblings.push(region)
    } else {
      childrenByParent.set(parentId, [region])
    }
  }

  const visited = new Set<number>()

  const buildNode = (
    region: Region,
    path: ReadonlySet<number>,
  ): RegionTreeNode => {
    visited.add(region.id)

    const nextPath = new Set(path)
    nextPath.add(region.id)

    const children = (childrenByParent.get(region.id) ?? [])
      .filter((child) => !nextPath.has(child.id))
      .map((child) => buildNode(child, nextPath))

    return { region, children }
  }

  const forest = roots.map((root) => buildNode(root, new Set<number>()))

  // Corrupted data can contain a cycle with no root; still render every region.
  for (const region of regions) {
    if (!visited.has(region.id)) {
      forest.push(buildNode(region, new Set<number>()))
    }
  }

  return forest
}

export function flattenRegionForest(
  forest: RegionTreeNode[],
): FlatRegionOption[] {
  const result: FlatRegionOption[] = []

  const walk = (nodes: RegionTreeNode[], depth: number): void => {
    for (const node of nodes) {
      result.push({ region: node.region, depth })
      walk(node.children, depth + 1)
    }
  }

  walk(forest, 0)
  return result
}

export function collectRegionAndDescendantIds(
  regionId: number,
  regions: Region[],
): Set<number> {
  const childrenByParent = new Map<number, number[]>()

  for (const region of regions) {
    if (region.parent_id === null) {
      continue
    }

    const children = childrenByParent.get(region.parent_id)
    if (children) {
      children.push(region.id)
    } else {
      childrenByParent.set(region.parent_id, [region.id])
    }
  }

  const result = new Set<number>()
  const pending = [regionId]

  while (pending.length > 0) {
    const currentId = pending.pop()
    if (currentId === undefined || result.has(currentId)) {
      continue
    }

    result.add(currentId)

    for (const childId of childrenByParent.get(currentId) ?? []) {
      pending.push(childId)
    }
  }

  return result
}
