import { useState } from 'react';
import { Header } from './Header';
import { PreferenceSetup } from './PreferenceSetup';
import { MatchExplorer } from './MatchExplorer';
import '../styles/InterestApp.css';

type Tabs = 'preferences' | 'matches';

export function InterestApp() {
  const [activeTab, setActiveTab] = useState<Tabs>('preferences');

  return (
    <div className="interest-app">
      <Header />
      <main className="interest-main">
        <div className="tab-navigation">
          <nav className="tab-nav">
            <button
              onClick={() => setActiveTab('preferences')}
              className={`tab-button ${activeTab === 'preferences' ? 'active' : 'inactive'}`}
            >
              My Preferences
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`tab-button ${activeTab === 'matches' ? 'active' : 'inactive'}`}
            >
              Find Matches
            </button>
          </nav>
        </div>

        {activeTab === 'preferences' && <PreferenceSetup />}
        {activeTab === 'matches' && <MatchExplorer />}
      </main>
    </div>
  );
}
