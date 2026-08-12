import Desktop from './components/Desktop';
import AbstractProviders from './components/AbstractProviders';

export default function Home() {
  return (
    <AbstractProviders>
      <Desktop />
    </AbstractProviders>
  );
}
