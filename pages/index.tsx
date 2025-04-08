import React from 'react';
import dynamic from 'next/dynamic';

// Use dynamic import with SSR disabled for Three.js components
const AppControllerWithNoSSR = dynamic(
  () => import('../components/AppController'),
  { ssr: false }
);

const IndexPage: React.FC = () => {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <AppControllerWithNoSSR />
    </div>
  );
};

export default IndexPage; 