import { useState } from 'react'
import type { ReactNode } from 'react'
import type { RegionTreeNode } from '../features/regions/regionTree'
import type { Region } from '../types/api'

export interface RegionTreeRowProps {
  region: Region
  depth: number
  hasChildren: boolean
  collapsed: boolean
  onToggle: () => void
}

interface RegionTreeProps {
  nodes: RegionTreeNode[]
  renderRow: (props: RegionTreeRowProps) => ReactNode
}

export const RegionTree = ({ nodes, renderRow }: RegionTreeProps) => {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(
    () => new Set<number>(),
  )

  const toggle = (regionId: number) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(regionId)) {
        next.delete(regionId)
      } else {
        next.add(regionId)
      }
      return next
    })
  }

  const renderNodes = (
    treeNodes: RegionTreeNode[],
    depth: number,
  ): ReactNode[] =>
    treeNodes.map(({ region, children }) => {
      const hasChildren = children.length > 0
      const collapsed = collapsedIds.has(region.id)

      return (
        <li key={region.id} className="region-tree-item">
          {renderRow({
            region,
            depth,
            hasChildren,
            collapsed,
            onToggle: () => toggle(region.id),
          })}
          {hasChildren && !collapsed ? (
            <ul className="region-tree-children">
              {renderNodes(children, depth + 1)}
            </ul>
          ) : null}
        </li>
      )
    })

  return <ul className="region-tree">{renderNodes(nodes, 0)}</ul>
}
