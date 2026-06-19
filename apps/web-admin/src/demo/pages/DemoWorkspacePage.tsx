import { Navigate, useParams } from 'react-router-dom'

import { findDemoApp } from '@/demo/apps'
import type { DemoPageId } from '@/demo/catalog'
import { getDemoPage } from '@/demo/catalog'

export function DemoWorkspacePage() {
  const { demoId, pageId } = useParams<{ demoId: string; pageId?: string }>()
  const demo = findDemoApp(demoId)

  if (!demo) {
    return <Navigate replace to="/demos" />
  }

  if (!pageId) {
    return <Navigate replace to={`/demos/${demo.meta.id}/${demo.defaultPage ?? 'dashboard'}`} />
  }

  const page = getDemoPage(pageId as DemoPageId)

  if (page.id !== pageId) {
    return <Navigate replace to={`/demos/${demo.meta.id}/${demo.defaultPage ?? 'dashboard'}`} />
  }

  return <>{demo.renderPage(pageId as DemoPageId)}</>
}
