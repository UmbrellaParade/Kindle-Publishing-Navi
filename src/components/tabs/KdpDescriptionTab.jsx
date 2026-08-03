import React, { useCallback, useEffect, useState } from 'react';
import KdpDescriptionEditor from '@/components/kdp/KdpDescriptionEditor';
import { buildKdpDescriptionUpdates, readKdpDescription } from '@/lib/kdpDescription';
import { mutatePublishingProject } from '@/lib/projectMutation';
import { scheduleCoordinatedSave } from '@/lib/saveCoordinator';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };

export default function KdpDescriptionTab({ project, onProjectUpdate }) {
  const [description, setDescription] = useState(() => readKdpDescription(project));

  useEffect(() => {
    setDescription(readKdpDescription(project));
  }, [project?.id, project?.kdp_description, project?.kdp_meta]);

  const saveDescription = useCallback((value, immediate = false) => {
    if (!project) return;

    const persist = async () => {
      const updated = await mutatePublishingProject(project.id, latest => (
        buildKdpDescriptionUpdates(latest, value)
      ), project);
      onProjectUpdate(updated);
    };

    scheduleCoordinatedSave(`kdp-description:${project.id}`, persist, immediate ? 0 : 1000);
  }, [project, onProjectUpdate]);

  if (!project) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <span className="text-4xl">📄</span>
        <p className="mt-3 text-sm">プロジェクトを選択してください</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4" style={CARD_STYLE}>
      <KdpDescriptionEditor
        description={description}
        onSave={value => {
          setDescription(value);
          saveDescription(value);
        }}
        onFlush={value => {
          setDescription(value);
          saveDescription(value, true);
        }}
      />
    </div>
  );
}
