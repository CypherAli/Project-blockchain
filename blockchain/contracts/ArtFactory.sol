// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ArtBondingCurve.sol";

/**
 * @title ArtFactory
 * @notice Registry and factory for all ArtBondingCurve contracts.
 *         Anyone can launch a new artwork bonding curve by paying the listing fee.
 *
 * @dev  Platform fees from trading flow directly to the factory owner.
 *       Listing fees accumulate in this contract and can be withdrawn by owner.
 */
contract ArtFactory is Ownable {
    // ─────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────

    /// @notice Fee to list a new artwork (0.01 ETH by default)
    uint256 public listingFee = 0.01 ether;

    /// @notice Default bonding curve slope (0.0001 ETH per share)
    uint256 public constant DEFAULT_K = 0.0001 ether;

    /// @notice Default initial price (0.001 ETH per share)
    uint256 public constant DEFAULT_P0 = 0.001 ether;

    // ─────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────

    /// @notice All deployed artwork addresses in creation order
    address[] public artworks;

    /// @notice Artist address → their artwork contract addresses
    mapping(address => address[]) public artworksByArtist;

    /// @notice Quick lookup: is this address a valid artwork contract?
    mapping(address => bool) public isArtwork;

    /// @notice Artist address → total royalties earned across all their artworks
    mapping(address => uint256) public artistTotalRoyalties;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    event ArtworkCreated(
        address indexed contractAddress,
        address indexed artist,
        string name,
        string ipfsCID,
        uint256 k,
        uint256 p0,
        uint256 timestamp
    );

    event ListingFeeUpdated(uint256 oldFee, uint256 newFee);

    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────────────────────
    // Create artwork
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Launch a new artwork with custom curve parameters.
     * @param name     Artwork title (also the ERC-20 token name)
     * @param ipfsCID  IPFS content ID for the artwork metadata JSON
     * @param k        Bonding curve slope in wei/share
     * @param p0       Initial price floor in wei/share
     * @return addr    Address of the deployed ArtBondingCurve contract
     *
     * @dev  msg.value must be >= listingFee. Any excess is refunded.
     */
    function createArtwork(
        string calldata name,
        string calldata ipfsCID,
        uint256 k,
        uint256 p0
    ) external payable returns (address addr) {
        require(msg.value >= listingFee, "ArtFactory: listing fee required");
        require(bytes(name).length > 0, "ArtFactory: name empty");
        require(bytes(ipfsCID).length > 0, "ArtFactory: CID empty");
        require(k > 0 || p0 > 0, "ArtFactory: invalid curve");

        ArtBondingCurve artwork = new ArtBondingCurve(
            msg.sender,
            payable(owner()),
            name,
            ipfsCID,
            k,
            p0
        );

        addr = address(artwork);
        artworks.push(addr);
        artworksByArtist[msg.sender].push(addr);
        isArtwork[addr] = true;

        // Refund excess
        uint256 excess = msg.value - listingFee;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok, "ArtFactory: refund failed");
        }

        emit ArtworkCreated(
            addr,
            msg.sender,
            name,
            ipfsCID,
            k,
            p0,
            block.timestamp
        );
    }

    /**
     * @notice Launch a new artwork with default curve parameters.
     *         This is the recommended path for most artists.
     */
    function createArtworkDefault(
        string calldata name,
        string calldata ipfsCID
    ) external payable returns (address) {
        require(msg.value >= listingFee, "ArtFactory: listing fee required");
        require(bytes(name).length > 0, "ArtFactory: name empty");
        require(bytes(ipfsCID).length > 0, "ArtFactory: CID empty");

        ArtBondingCurve artwork = new ArtBondingCurve(
            msg.sender,
            payable(owner()),
            name,
            ipfsCID,
            DEFAULT_K,
            DEFAULT_P0
        );

        address addr = address(artwork);
        artworks.push(addr);
        artworksByArtist[msg.sender].push(addr);
        isArtwork[addr] = true;

        uint256 excess = msg.value - listingFee;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok, "ArtFactory: refund failed");
        }

        emit ArtworkCreated(
            addr,
            msg.sender,
            name,
            ipfsCID,
            DEFAULT_K,
            DEFAULT_P0,
            block.timestamp
        );

        return addr;
    }

    // ─────────────────────────────────────────────────────────────
    // Read functions
    // ─────────────────────────────────────────────────────────────

    /// @notice Returns all artwork contract addresses
    function getAllArtworks() external view returns (address[] memory) {
        return artworks;
    }

    /// @notice Returns all artworks by a specific artist
    function getArtworksByArtist(address _artist)
        external
        view
        returns (address[] memory)
    {
        return artworksByArtist[_artist];
    }

    /// @notice Returns total number of artworks listed
    function totalArtworks() external view returns (uint256) {
        return artworks.length;
    }

    /**
     * @notice Returns paginated artwork list (useful for large registries)
     * @param offset Start index
     * @param limit  Max results
     */
    function getArtworksPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory result, uint256 total)
    {
        total = artworks.length;
        if (offset >= total) return (new address[](0), total);

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 len = end - offset;

        result = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            result[i] = artworks[offset + i];
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────

    /// @notice Update the listing fee
    function setListingFee(uint256 newFee) external onlyOwner {
        emit ListingFeeUpdated(listingFee, newFee);
        listingFee = newFee;
    }

    /// @notice Withdraw accumulated listing fees to owner
    function withdrawFees() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "ArtFactory: nothing to withdraw");
        (bool ok, ) = owner().call{value: bal}("");
        require(ok, "ArtFactory: withdraw failed");
    }

    receive() external payable {}
}
