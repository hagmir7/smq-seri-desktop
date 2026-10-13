import React, { useEffect, useState, useCallback, memo } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { Button, Typography } from 'antd';

const {Title} = Typography;

const DRAG_STYLE = { WebkitAppRegion: 'drag' };
const NO_DRAG_STYLE = { WebkitAppRegion: 'no-drag' };

const TitleBar = ({ title = 'SERIEMOBLE' }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const hasElectron = typeof window !== 'undefined' && !!window.electron;

  useEffect(() => {
    if (!hasElectron) return;
    
    // (e.g. restored from a previous session) before this component mounted.
    window.electron.isWindowMaximized?.().then((v) => {
      if (typeof v === 'boolean') setIsMaximized(v);
    });

    // Support both callback-style and unsubscribe-returning APIs so we
    // don't leak a listener every time this component mounts/unmounts.
    const unsubscribe = window.electron.onWindowMaximized?.(setIsMaximized);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      else window.electron.removeWindowMaximizedListener?.(setIsMaximized);
    };
  }, [hasElectron]);

  const handleMinimize = useCallback(() => window.electron.windowMinimize(), []);
  const handleMaximize = useCallback(() => window.electron.windowMaximize(), []);
  const handleClose = useCallback(() => window.electron.windowClose(), []);

  if (!hasElectron) return null; // only render inside Electron

  return (
    <div
      className="flex items-center justify-between h-8 bg-[#0d3b2e] border-b border-white/10 select-none shrink-0"
      style={DRAG_STYLE}
      onDoubleClick={handleMaximize}
    >
      <Title level={5} className="px-3 p-0 m-0 pt-2 text-xs font-medium text-emerald-100/70 truncate text-white">
        <span className='text-gray-300 text-sm '>{title}</span>
      </Title>

      <div className="flex h-full" style={NO_DRAG_STYLE}>
        <Button
          type="button"
          onClick={handleMinimize}
          aria-label="Minimize window"
          title="Minimize"
          className="flex items-center justify-center w-11 h-full text-emerald-100/80 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-emerald-200/60 focus-visible:-outline-offset-2 transition-colors"
        >
          <Minus size={14} />
        </Button>
        <Button
          type="button"
          onClick={handleClose}
          aria-label="Close window"
          title="Close"
          className="flex items-center justify-center w-11 h-full text-emerald-100/80 hover:bg-red-600 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-red-300 focus-visible:-outline-offset-2 transition-colors"
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  );
};

export default memo(TitleBar);