import Head from 'next/head';
import dynamic from 'next/dynamic';
import styles from '../styles/Home.module.css';

// Dynamically import the WebGLCanvas component to ensure it only runs client-side
const WebGLCanvas = dynamic(() => import('../components/WebGLCanvas'), {
  ssr: false,
  loading: () => <p>Loading WebGL Canvas...</p>, // Optional loading state
});

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>WebGL Dot Grid MVP</title>
        <meta name="description" content="Testing custom connectors with WebGL" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>WebGL Dot Grid Connector Test</h1>
        <div style={{ width: '80vw', height: '70vh', border: '1px solid #ccc' }}>
          <WebGLCanvas />
        </div>
      </main>
    </div>
  );
} 