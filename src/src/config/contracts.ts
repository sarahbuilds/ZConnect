import type { Abi } from 'viem';

export const CONTRACT_ADDRESS = (
  import.meta.env.VITE_INTEREST_MATCHER_ADDRESS || '0xc1a6ef590d885830a2FE1e67dF1f9119018CBe4B'
) as `0x${string}`;

const CONTRACT_ABI_DEFINITION = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "seeker",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "candidate",
        "type": "address"
      }
    ],
    "name": "MatchComputed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "timestamp",
        "type": "uint64"
      }
    ],
    "name": "PreferencesRegistered",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "seeker",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "candidate",
        "type": "address"
      }
    ],
    "name": "getEncryptedMatch",
    "outputs": [
      {
        "internalType": "euint32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "getEncryptedPreferences",
    "outputs": [
      {
        "internalType": "euint32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "euint32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "euint32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRegisteredPlayers",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "hasPreferences",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "externalEuint32",
        "name": "interestOne",
        "type": "bytes32"
      },
      {
        "internalType": "externalEuint32",
        "name": "interestTwo",
        "type": "bytes32"
      },
      {
        "internalType": "externalEuint32",
        "name": "interestThree",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "inputProof",
        "type": "bytes"
      }
    ],
    "name": "submitPreferences",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "candidate",
        "type": "address"
      }
    ],
    "name": "requestMatch",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export const CONTRACT_ABI = CONTRACT_ABI_DEFINITION as unknown as Abi;
export const CONTRACT_WRITE_ABI = CONTRACT_ABI_DEFINITION;

export const INTEREST_OPTIONS = [
  { id: 1, label: 'AI Research' },
  { id: 2, label: 'Climate Tech' },
  { id: 3, label: 'Web3 Infrastructure' },
  { id: 4, label: 'Indie Game Design' },
  { id: 5, label: 'Digital Art & NFTs' },
  { id: 6, label: 'Music Production' },
  { id: 7, label: 'Space Exploration' },
  { id: 8, label: 'Sustainable Fashion' },
  { id: 9, label: 'Robotics' },
  { id: 10, label: 'Gourmet Science' },
] as const;
