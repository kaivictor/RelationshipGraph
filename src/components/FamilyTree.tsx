import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useFamilyStore } from '../store/useFamilyStore';
import { PersonNodeComponent } from './PersonNode';
import SpouseEdge from './SpouseEdge';
import { toPng, toSvg } from 'html-to-image';
import { Download, Upload, Image as ImageIcon, ChevronDown } from 'lucide-react';

const nodeTypes = {
  person: PersonNodeComponent,
};

const edgeTypes = {
  spouse: SpouseEdge,
};

export default function FamilyTree() {
  const {
    nodes,
    edges,
    selectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodeId,
    layoutGraph,
    exportData,
    importData,
  } = useFamilyStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Initial layout
  useEffect(() => {
    layoutGraph();
    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 100);
  }, [layoutGraph, fitView]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const handleExportImage = useCallback((format: 'png-standard' | 'png-high' | 'svg') => {
    setShowExportMenu(false);
    if (reactFlowWrapper.current === null) {
      return;
    }

    const filter = (node: HTMLElement) => {
      // Exclude UI controls and hints from the image
      if (
        node?.classList?.contains('react-flow__minimap') ||
        node?.classList?.contains('react-flow__controls') ||
        node?.classList?.contains('react-flow__panel') ||
        node?.classList?.contains('export-hide')
      ) {
        return false;
      }
      return true;
    };

    const element = reactFlowWrapper.current;
    const options = { filter, backgroundColor: '#f9fafb' };

    if (format === 'svg') {
      toSvg(element, options)
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = 'family-tree.svg';
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => console.error('Failed to export SVG', err));
    } else {
      const pixelRatio = format === 'png-high' ? 3 : 1;
      toPng(element, { ...options, pixelRatio })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = `family-tree-${format === 'png-high' ? 'high-res' : 'standard'}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => console.error('Failed to export PNG', err));
    }
  }, []);

  const handleExportData = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'family-tree-data.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        importData(content);
        setTimeout(() => {
          fitView({ padding: 0.2 });
        }, 100);
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  return (
    <div className="w-full h-full relative" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ style: { stroke: '#94a3b8', strokeWidth: 2 } }}
        fitView
        minZoom={0.1}
      >
        <Background color="#ccc" gap={16} />
        <Controls />
        <MiniMap zoomable pannable />
        
        <Panel position="top-right" className="flex gap-2">
          <button
            onClick={() => {
              layoutGraph();
              setTimeout(() => fitView({ padding: 0.2 }), 100);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
          >
            整理布局
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
            >
              <ImageIcon className="w-4 h-4" />
              导出图片
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                <button onClick={() => handleExportImage('png-standard')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">PNG (标清)</button>
                <button onClick={() => handleExportImage('png-high')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">PNG (高清)</button>
                <button onClick={() => handleExportImage('svg')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">SVG (矢量图)</button>
              </div>
            )}
          </div>
          <button
            onClick={handleExportData}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
          >
            <Download className="w-4 h-4" />
            导出数据
          </button>
          <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer">
            <Upload className="w-4 h-4" />
            导入数据
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportData}
            />
          </label>
        </Panel>
      </ReactFlow>
      
      {!selectedNodeId && (
        <div className="export-hide absolute top-4 left-4 bg-white/80 backdrop-blur-sm px-4 py-3 rounded-lg border border-gray-200 shadow-sm text-sm text-gray-600 pointer-events-none z-10">
          点击节点查看详情并添加亲属
        </div>
      )}
    </div>
  );
}
