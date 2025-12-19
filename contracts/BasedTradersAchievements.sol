// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BasedTradersAchievements
 * @dev Soulbound NFT contract for Based Traders achievements
 * Each achievement can be minted once per user
 * NFTs are non-transferable (Soulbound)
 */
contract BasedTradersAchievements is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    // Achievement metadata
    struct Achievement {
        string name;
        string description;
        string imageURI;
        string rarity;
    }

    // Achievement ID -> Metadata
    mapping(uint256 => Achievement) public achievements;

    // User -> Achievement ID -> Has Minted
    mapping(address => mapping(uint256 => bool)) public hasMinted;

    // Token ID -> Achievement ID
    mapping(uint256 => uint256) public tokenToAchievement;

    event AchievementMinted(
        address indexed user,
        uint256 indexed achievementId,
        uint256 tokenId
    );

    event AchievementConfigured(
        uint256 indexed achievementId,
        string name,
        string rarity
    );

    constructor() ERC721("Based Traders Achievement", "BTACH") Ownable(msg.sender) {
        _tokenIdCounter = 1; // Start from 1
    }

    /**
     * @dev Set achievement metadata (only owner)
     */
    function setAchievement(
        uint256 achievementId,
        string memory name,
        string memory description,
        string memory imageURI,
        string memory rarity
    ) external onlyOwner {
        achievements[achievementId] = Achievement(
            name,
            description,
            imageURI,
            rarity
        );
        emit AchievementConfigured(achievementId, name, rarity);
    }

    /**
     * @dev Mint achievement NFT to user (only owner)
     */
    function mint(address to, uint256 achievementId)
        external
        onlyOwner
        returns (uint256)
    {
        require(
            bytes(achievements[achievementId].name).length > 0,
            "Achievement not configured"
        );
        require(
            !hasMinted[to][achievementId],
            "Already minted this achievement"
        );

        uint256 newTokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(to, newTokenId);

        // Set token URI (points to backend metadata endpoint)
        string memory uri = string(
            abi.encodePacked(
                "https://basedtraders.fun/api/nft-metadata/",
                _toString(achievementId)
            )
        );
        _setTokenURI(newTokenId, uri);

        hasMinted[to][achievementId] = true;
        tokenToAchievement[newTokenId] = achievementId;

        emit AchievementMinted(to, achievementId, newTokenId);

        return newTokenId;
    }

    /**
     * @dev Check if user has minted specific achievement
     */
    function hasUserMinted(address user, uint256 achievementId)
        external
        view
        returns (bool)
    {
        return hasMinted[user][achievementId];
    }

    /**
     * @dev Get all achievement IDs owned by user
     */
    function getUserAchievements(address user)
        external
        view
        returns (uint256[] memory)
    {
        uint256 balance = balanceOf(user);
        uint256[] memory achievementIds = new uint256[](balance);

        uint256 index = 0;
        for (uint256 i = 1; i < _tokenIdCounter && index < balance; i++) {
            if (_ownerOf(i) == user) {
                achievementIds[index] = tokenToAchievement[i];
                index++;
            }
        }

        return achievementIds;
    }

    /**
     * @dev Get achievement metadata
     */
    function getAchievement(uint256 achievementId)
        external
        view
        returns (Achievement memory)
    {
        return achievements[achievementId];
    }

    /**
     * @dev Get total number of tokens minted
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter - 1;
    }

    /**
     * @dev Override transfer functions to make NFTs Soulbound (non-transferable)
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting (from address(0))
        if (from == address(0)) {
            return super._update(to, tokenId, auth);
        }

        // Block all transfers after minting
        revert("BasedTradersAchievements: Soulbound token - transfers are not allowed");
    }

    /**
     * @dev Override approve to prevent approvals
     */
    function approve(address, uint256) public virtual override {
        revert("BasedTradersAchievements: Soulbound token - approvals are not allowed");
    }

    /**
     * @dev Override setApprovalForAll to prevent approvals
     */
    function setApprovalForAll(address, bool) public virtual override {
        revert("BasedTradersAchievements: Soulbound token - approvals are not allowed");
    }

    /**
     * @dev Convert uint to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
