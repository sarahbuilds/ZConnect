// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Zama-based confidential interest matcher
/// @notice Players store encrypted interests and request encrypted match indicators
contract InterestMatcher is SepoliaConfig {
    struct PlayerPreferences {
        euint32 first;
        euint32 second;
        euint32 third;
        bool registered;
        uint64 updatedAt;
    }

    mapping(address => PlayerPreferences) private _preferences;
    mapping(address => mapping(address => euint32)) private _matchResults;
    mapping(address => mapping(address => bool)) private _hasStoredMatch;
    address[] private _players;

    event PreferencesRegistered(address indexed player, uint64 timestamp);
    event MatchComputed(address indexed seeker, address indexed candidate);

    /// @notice Returns all registered players
    /// @dev Does not reveal interests, only wallet addresses
    function getRegisteredPlayers() external view returns (address[] memory) {
        return _players;
    }

    /// @notice Returns encrypted interests for a player
    /// @param player The address whose interests are requested
    function getEncryptedPreferences(address player) external view returns (euint32, euint32, euint32) {
        PlayerPreferences storage info = _preferences[player];
        require(info.registered, "Preferences missing");
        return (info.first, info.second, info.third);
    }

    /// @notice Checks whether a player has submitted preferences
    /// @param player The address to check
    function hasPreferences(address player) external view returns (bool) {
        return _preferences[player].registered;
    }

    /// @notice Registers or updates encrypted interests for the sender
    /// @param interestOne Encrypted interest identifier (1-10) for the top choice
    /// @param interestTwo Encrypted interest identifier (1-10) for the second choice
    /// @param interestThree Encrypted interest identifier (1-10) for the third choice
    /// @param inputProof Proof generated together with encrypted inputs
    function submitPreferences(
        externalEuint32 interestOne,
        externalEuint32 interestTwo,
        externalEuint32 interestThree,
        bytes calldata inputProof
    ) external {
        euint32 encFirst = FHE.fromExternal(interestOne, inputProof);
        euint32 encSecond = FHE.fromExternal(interestTwo, inputProof);
        euint32 encThird = FHE.fromExternal(interestThree, inputProof);

        PlayerPreferences storage existing = _preferences[msg.sender];
        bool isNewPlayer = !existing.registered;

        existing.first = encFirst;
        existing.second = encSecond;
        existing.third = encThird;
        existing.registered = true;
        existing.updatedAt = uint64(block.timestamp);

        FHE.allowThis(encFirst);
        FHE.allowThis(encSecond);
        FHE.allowThis(encThird);

        FHE.allow(encFirst, msg.sender);
        FHE.allow(encSecond, msg.sender);
        FHE.allow(encThird, msg.sender);

        if (isNewPlayer) {
            _players.push(msg.sender);
        }

        emit PreferencesRegistered(msg.sender, existing.updatedAt);
    }

    /// @notice Computes and stores an encrypted indicator of shared interests between sender and target
    /// @param candidate Address of the player to compare with
    function requestMatch(address candidate) external {
        require(candidate != address(0), "Invalid candidate");
        require(candidate != msg.sender, "Self matching not allowed");

        PlayerPreferences storage seeker = _preferences[msg.sender];
        require(seeker.registered, "Submit preferences first");

        PlayerPreferences storage target = _preferences[candidate];
        require(target.registered, "Candidate missing");

        ebool shared = _comparePreferences(seeker, target);

        euint32 encryptedResult = FHE.select(shared, FHE.asEuint32(1), FHE.asEuint32(0));

        _matchResults[msg.sender][candidate] = encryptedResult;
        _hasStoredMatch[msg.sender][candidate] = true;

        FHE.allowThis(encryptedResult);
        FHE.allow(encryptedResult, msg.sender);

        emit MatchComputed(msg.sender, candidate);
    }

    /// @notice Fetches the encrypted match indicator previously computed via {requestMatch}
    /// @param seeker Address that initiated the match request
    /// @param candidate Address that was compared against
    function getEncryptedMatch(address seeker, address candidate) external view returns (euint32) {
        require(_hasStoredMatch[seeker][candidate], "Match not computed");
        return _matchResults[seeker][candidate];
    }

    function _comparePreferences(
        PlayerPreferences storage seeker,
        PlayerPreferences storage target
    ) private returns (ebool) {
        ebool matchFlag = FHE.asEbool(false);

        matchFlag = FHE.or(matchFlag, FHE.eq(seeker.first, target.first));
        matchFlag = FHE.or(matchFlag, FHE.eq(seeker.first, target.second));
        matchFlag = FHE.or(matchFlag, FHE.eq(seeker.first, target.third));

        matchFlag = FHE.or(matchFlag, FHE.eq(seeker.second, target.first));
        matchFlag = FHE.or(matchFlag, FHE.eq(seeker.second, target.second));
        matchFlag = FHE.or(matchFlag, FHE.eq(seeker.second, target.third));

        matchFlag = FHE.or(matchFlag, FHE.eq(seeker.third, target.first));
        matchFlag = FHE.or(matchFlag, FHE.eq(seeker.third, target.second));
        matchFlag = FHE.or(matchFlag, FHE.eq(seeker.third, target.third));

        return matchFlag;
    }
}
