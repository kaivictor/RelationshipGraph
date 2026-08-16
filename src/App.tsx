/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import FamilyTree from './components/FamilyTree';
import { PersonDetails } from './components/PersonDetails';
import { SettingsPanel } from './components/SettingsPanel';
import { EdgeDetails } from './components/EdgeDetails';
import { HelpPage } from './components/HelpPage';
import { useFamilyStore } from './store/useFamilyStore';
import { ReactFlowProvider } from '@xyflow/react';

export default function App() {
  const selectedNodeId = useFamilyStore((s) => s.selectedNodeId);
  const selectedEdgeId = useFamilyStore((s) => s.selectedEdgeId);
  const showHelpPage = useFamilyStore((s) => s.showHelpPage);

  if (showHelpPage) {
    return <HelpPage />;
  }

  return (
    <div className="w-screen h-screen bg-gray-50 flex overflow-hidden font-sans relative">
      <ReactFlowProvider>
        <FamilyTree />
        {selectedEdgeId ? <EdgeDetails /> : selectedNodeId ? <PersonDetails /> : <SettingsPanel />}
      </ReactFlowProvider>
    </div>
  );
}
