import { useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, useReadContract } from 'wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_WRITE_ABI, INTEREST_OPTIONS } from '../config/contracts';
import '../styles/PreferenceSetup.css';

type SubmissionState = 'idle' | 'encrypting' | 'confirming' | 'success';

export function PreferenceSetup() {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [selectedInterests, setSelectedInterests] = useState<number[]>([]);
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [formError, setFormError] = useState('');

  const { data: hasPreferences } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'hasPreferences',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const orderedSelections = useMemo(
    () =>
      selectedInterests.map((id, index) => ({
        id,
        label: INTEREST_OPTIONS.find((option) => option.id === id)?.label ?? `Interest ${id}`,
        position: index + 1,
      })),
    [selectedInterests],
  );

  const toggleInterest = (interestId: number) => {
    setFormError('');
    setStatusMessage('');
    setSelectedInterests((previous) => {
      if (previous.includes(interestId)) {
        return previous.filter((id) => id !== interestId);
      }

      if (previous.length >= 3) {
        setFormError('Choose at most three interests. Remove one to add a new favourite.');
        return previous;
      }

      return [...previous, interestId];
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setStatusMessage('');

    if (!instance || !address) {
      setFormError('Connect your wallet and wait for the encryption service to initialise.');
      return;
    }

    if (!signerPromise) {
      setFormError('Wallet signer is not ready.');
      return;
    }

    if (selectedInterests.length !== 3) {
      setFormError('Pick exactly three interests to continue.');
      return;
    }

    try {
      setSubmissionState('encrypting');

      const buffer = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      orderedSelections.forEach((selection) => buffer.add32(selection.id));
      const encryptedInput = await buffer.encrypt();

      setSubmissionState('confirming');

      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_WRITE_ABI, signer);

      const tx = await contract.submitPreferences(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.inputProof,
      );

      await tx.wait();

      setSubmissionState('success');
      setStatusMessage('Encrypted preferences saved on-chain. You can update them at any time.');
    } catch (error) {
      console.error('Failed to submit preferences:', error);
      setFormError(error instanceof Error ? error.message : 'Failed to submit preferences.');
      setSubmissionState('idle');
    }
  };

  const isBusy = submissionState === 'encrypting' || submissionState === 'confirming';

  return (
    <div className="preference-container">
      <section className="card">
        <header className="card-header">
          <div>
            <h2 className="card-title">Select Your Top Three Interests</h2>
            <p className="card-subtitle">
              Your choices stay encrypted on-chain. We only use them to find overlapping interests with other players.
            </p>
          </div>
          {hasPreferences ? (
            <span className="status-badge success">Preferences on-chain</span>
          ) : (
            <span className="status-badge neutral">No submission yet</span>
          )}
        </header>

        {zamaLoading && <p className="info-banner">Initialising encryption runtime...</p>}
        {zamaError && <p className="error-banner">{zamaError}</p>}

        <form onSubmit={handleSubmit} className="preference-form">
          <div className="interests-grid">
            {INTEREST_OPTIONS.map((option) => {
              const isSelected = selectedInterests.includes(option.id);
              const position = isSelected ? selectedInterests.indexOf(option.id) + 1 : undefined;

              return (
                <button
                  type="button"
                  key={option.id}
                  className={`interest-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleInterest(option.id)}
                  disabled={isBusy && !isSelected}
                >
                  <span className="interest-id">{option.id.toString().padStart(2, '0')}</span>
                  <span className="interest-label">{option.label}</span>
                  {position && <span className="interest-rank">#{position}</span>}
                </button>
              );
            })}
          </div>

          <div className="selection-summary">
            <h3 className="summary-title">Selected favourites</h3>
            {orderedSelections.length === 0 && <p className="summary-placeholder">Pick exactly three interests.</p>}
            <ol className="selection-list">
              {orderedSelections.map(({ id, label, position }) => (
                <li key={id} className="selection-item">
                  <span className="selection-rank">{position}.</span>
                  <span className="selection-label">{label}</span>
                </li>
              ))}
            </ol>
          </div>

          {formError && <p className="error-banner">{formError}</p>}
          {statusMessage && <p className="success-banner">{statusMessage}</p>}

          <button type="submit" className="primary-button" disabled={isBusy || orderedSelections.length !== 3}>
            {submissionState === 'encrypting' && 'Encrypting preferences...'}
            {submissionState === 'confirming' && 'Waiting for confirmation...'}
            {submissionState === 'success' && 'Preferences saved!'}
            {submissionState === 'idle' && 'Save Preferences'}
          </button>
        </form>
      </section>
    </div>
  );
}
