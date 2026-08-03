import { base44 } from '@/api/base44Client';

/**
 * ブラウザ保存版では Web Locks の内側で最新レコードを読み、差分を作る。
 * Base44 接続版では従来APIへフォールバックする。
 */
export async function mutatePublishingProject(projectId, buildUpdates, fallbackProject = null) {
  const entity = base44.entities.PublishingProject;
  if (typeof entity.mutate === 'function') {
    return entity.mutate(projectId, buildUpdates);
  }

  const latest = typeof entity.get === 'function'
    ? (await entity.get(projectId)) || fallbackProject
    : fallbackProject;
  const updates = await buildUpdates(latest);
  return entity.update(projectId, updates);
}
