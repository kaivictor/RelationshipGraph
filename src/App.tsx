/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import FamilyTree from './components/FamilyTree';
import { PersonDetails } from './components/PersonDetails';
import { SettingsPanel } from './components/SettingsPanel';
import { useFamilyStore } from './store/useFamilyStore';
import { ReactFlowProvider } from '@xyflow/react';

export default function App() {
  const selectedNodeId = useFamilyStore((s) => s.selectedNodeId);

  return (
    <div className="w-screen h-screen bg-gray-50 flex overflow-hidden font-sans relative">
      <ReactFlowProvider>
        <FamilyTree />
        {selectedNodeId ? <PersonDetails /> : <SettingsPanel />}
      </ReactFlowProvider>
    </div>
  );
}
