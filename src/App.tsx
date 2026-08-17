/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Relationship from './components/Relationship';
import { PersonDetails } from './components/PersonDetails';
import { SettingsPanel } from './components/SettingsPanel';
import { EdgeDetails } from './components/EdgeDetails';
import { HelpPage } from './components/HelpPage';
import { useRelationshipStore } from './store/useRelationshipStore';
import { ReactFlowProvider } from '@xyflow/react';

export default function App() {
  const selectedNodeId = useRelationshipStore((s) => s.selectedNodeId);
  const selectedEdgeId = useRelationshipStore((s) => s.selectedEdgeId);
  const showHelpPage = useRelationshipStore((s) => s.showHelpPage);

  if (showHelpPage) {
    return <HelpPage />;
  }

  return (
    <div className="w-screen h-screen bg-gray-50 flex overflow-hidden font-sans relative">
      <ReactFlowProvider>
        <Relationship />
        {selectedEdgeId ? <EdgeDetails /> : selectedNodeId ? <PersonDetails /> : <SettingsPanel />}
      </ReactFlowProvider>
    </div>
  );
}
