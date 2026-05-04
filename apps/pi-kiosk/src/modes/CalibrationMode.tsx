// Calibration Mode - Test pattern, grid, calibration UI

import { useState } from 'react';

type CalibrationStep = 'grid' | 'corners' | 'complete';

export default function CalibrationMode() {
  const [step, setStep] = useState<CalibrationStep>('grid');

  const renderGrid = () => (
    <div className="w-full h-full relative">
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {/* Horizontal lines */}
        {[...Array(11)].map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0"
            y1={`${i * 10}%`}
            x2="100%"
            y2={`${i * 10}%`}
            stroke="#333"
            strokeWidth="1"
          />
        ))}
        {/* Vertical lines */}
        {[...Array(11)].map((_, i) => (
          <line
            key={`v-${i}`}
            x1={`${i * 10}%`}
            y1="0"
            x2={`${i * 10}%`}
            y2="100%"
            stroke="#333"
            strokeWidth="1"
          />
        ))}
        {/* Center crosshair */}
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#666" strokeWidth="2" />
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#666" strokeWidth="2" />
      </svg>
      
      {/* Corner markers */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
        <div
          key={corner}
          className={`absolute w-8 h-8 border-4 border-green-500 ${
            corner === 'top-left' ? 'top-4 left-4 border-t border-l' :
            corner === 'top-right' ? 'top-4 right-4 border-t border-r' :
            corner === 'bottom-left' ? 'bottom-4 left-4 border-b border-l' :
            'bottom-4 right-4 border-b border-r'
          }`}
        />
      ))}
    </div>
  );

  const renderCorners = () => (
    <div className="w-full h-full relative">
      <p className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white text-xl">
        Touch each corner to calibrate
      </p>
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner, i) => (
        <div
          key={corner}
          className={`absolute w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-black text-2xl font-bold ${
            corner === 'top-left' ? 'top-8 left-8' :
            corner === 'top-right' ? 'top-8 right-8' :
            corner === 'bottom-left' ? 'bottom-8 left-8' :
            'bottom-8 right-8'
          }`}
        >
          {i + 1}
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col bg-black">
      {/* Calibration pattern */}
      <div className="flex-1 relative">
        {step === 'grid' && renderGrid()}
        {step === 'corners' && renderCorners()}
        {step === 'complete' && (
          <div className="w-full h-full flex items-center justify-center text-green-500">
            <div className="text-center">
              <div className="text-6xl mb-4">✓</div>
              <p className="text-2xl">Calibration Complete</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="bg-gray-900 p-4 flex justify-center gap-4">
        {step === 'grid' && (
          <button
            onClick={() => setStep('corners')}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded text-white font-medium"
          >
            Next: Calibrate Corners
          </button>
        )}
        {step === 'corners' && (
          <button
            onClick={() => setStep('complete')}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded text-white font-medium"
          >
            Complete Calibration
          </button>
        )}
        {step === 'complete' && (
          <button
            onClick={() => setStep('grid')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
