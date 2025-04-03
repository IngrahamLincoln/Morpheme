'use client';

import React from 'react';
import SegmentedDisplayGrid from '../components/segmented/segmentedDisplayGrid';
import SimpleCircleRenderer from '../components/segmented/SimpleCircleRenderer';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Segmented Display Test Area</h1>
      <SimpleCircleRenderer />
    </main>
  );
} 