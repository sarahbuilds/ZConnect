import { useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_WRITE_ABI } from '../config/contracts';
import '../styles/MatchExplorer.css';

type MatchStatus = 'idle' | 'checking' | 'ready' | 'error';

interface MatchResult {
  status: MatchStatus;
  indicator?: number;
  error?: string;
}

export function MatchExplorer() {
  const { address } = useAccount();
  const { instance } = useZamaInstance();
  const signerPromise = useEthersSigner();
  const publicClient = usePublicClient();

  const [matches, setMatches] = useState<Record<string, MatchResult>>({});
  const [globalError, setGlobalError] = useState('');

  const { data: hasPreferences } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'hasPreferences',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const { data: registeredPlayers, refetch: refetchPlayers, isFetching } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getRegisteredPlayers',
    query: {
      refetchOnMount: true,
      retry: 2,
    },
  });

  const otherPlayers = useMemo(
    () =>
      (registeredPlayers as string[] | undefined)?.filter(
        (participant) => participant.toLowerCase() !== (address ?? '').toLowerCase(),
      ) ?? [],
    [registeredPlayers, address],
  );

  const handleCheckMatch = async (candidate: string) => {
    setGlobalError('');

    if (!instance || !address || !signerPromise || !publicClient) {
      setGlobalError('Connect your wallet and ensure the encryption runtime is ready.');
      return;
    }

    try {
      setMatches((previous) => ({ ...previous, [candidate]: { status: 'checking' } }));

      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_WRITE_ABI, signer);

      const tx = await contract.requestMatch(candidate);
      await tx.wait();

      const encryptedMatch = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getEncryptedMatch',
        args: [address, candidate],
      })) as string;

      const keypair = instance.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimestamp,
        durationDays,
      );

      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const decryptedMap = await instance.userDecrypt(
        [
          {
            handle: encryptedMatch,
            contractAddress: CONTRACT_ADDRESS,
          },
        ],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimestamp,
        durationDays,
      );

      const decryptedValue = Number(decryptedMap[encryptedMatch] || '0');

      setMatches((previous) => ({
        ...previous,
        [candidate]: {
          status: 'ready',
          indicator: decryptedValue,
        },
      }));

      await refetchPlayers();
    } catch (error) {
      console.error('Failed to request match:', error);
      setMatches((previous) => ({
        ...previous,
        [candidate]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to retrieve match result.',
        },
      }));
    }
  };

  if (!address) {
    return (
      <div className="match-container">
        <section className="card">
          <h2 className="card-title">Connect your wallet</h2>
          <p className="card-subtitle">Log in to discover players who share an interest with you.</p>
        </section>
      </div>
    );
  }

  if (!hasPreferences) {
    return (
      <div className="match-container">
        <section className="card">
          <h2 className="card-title">Set your preferences first</h2>
          <p className="card-subtitle">
            Submit three favourite interests so we can compare them with other encrypted profiles.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="match-container">
      <section className="card">
        <header className="card-header">
          <div>
            <h2 className="card-title">Find overlapping interests</h2>
            <p className="card-subtitle">
              Trigger an encrypted comparison with any player. Only you can decrypt the match indicator.
            </p>
          </div>
        </header>

        {globalError && <p className="error-banner">{globalError}</p>}

        {isFetching && <p className="info-banner">Refreshing player list...</p>}

        {otherPlayers.length === 0 ? (
          <p className="empty-state">No other players have submitted preferences yet.</p>
        ) : (
          <div className="candidate-grid">
            {otherPlayers.map((candidate) => {
              const matchState = matches[candidate] ?? { status: 'idle' as MatchStatus };
              const shortAddress = `${candidate.slice(0, 6)}…${candidate.slice(-4)}`;

              return (
                <div key={candidate} className="candidate-card">
                  <div className="candidate-header">
                    <span className="candidate-badge">Player</span>
                    <span className="candidate-address">{shortAddress}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCheckMatch(candidate)}
                    className="secondary-button"
                    disabled={matchState.status === 'checking'}
                  >
                    {matchState.status === 'checking' ? 'Requesting encrypted match…' : 'Check for shared interest'}
                  </button>

                  {matchState.status === 'ready' && (
                    <p className={`match-result ${matchState.indicator ? 'positive' : 'negative'}`}>
                      {matchState.indicator ? 'You share at least one favourite interest.' : 'No shared interests this time.'}
                    </p>
                  )}

                  {matchState.status === 'error' && <p className="error-banner">{matchState.error}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
