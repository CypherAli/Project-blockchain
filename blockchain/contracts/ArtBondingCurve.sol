// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ArtBondingCurve
 * @notice Bonding curve contract for a single artwork — fractional ownership + perpetual royalties
 *
 * @dev Linear bonding curve formula:
 *      price(supply) = k * supply + p0
 *
 *      Cost to BUY `n` shares from supply S:
 *        ∫(S → S+n) (k·t + p0) dt = k·n·(2S + n)/2 + p0·n
 *
 *      Return for SELL `n` shares from supply S:
 *        ∫(S-n → S) (k·t + p0) dt = k·n·(2S - n)/2 + p0·n
 *
 *      Shares are whole integers (decimals = 0).
 *      Prices are in wei.
 *
 * @author Art Bonding Curve Platform
 */
contract ArtBondingCurve is ERC20, ReentrancyGuard {
    // ─────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────

    /// @notice Royalty paid to artist on every buy AND sell (500 = 5%)
    uint256 public constant ROYALTY_BPS = 500;

    /// @notice Platform fee on every buy AND sell (100 = 1%)
    uint256 public constant PLATFORM_BPS = 100;

    uint256 public constant BPS_DENOM = 10_000;

    /// @notice Maximum shares that can ever be minted
    uint256 public constant MAX_SUPPLY = 1_000_000;

    /// @notice Reserve threshold at which the artwork "graduates"
    uint256 public constant GRADUATION_THRESHOLD = 24 ether;

    // ─────────────────────────────────────────────────────────────
    // Immutable state
    // ─────────────────────────────────────────────────────────────

    /// @notice The artist who published this artwork
    address public immutable artist;

    /// @notice Platform address that receives platform fees
    address payable public immutable platform;

    /// @notice Slope of the bonding curve (wei per share)
    uint256 public immutable k;

    /// @notice Initial price floor (wei per share at supply = 0)
    uint256 public immutable p0;

    // ─────────────────────────────────────────────────────────────
    // Mutable state
    // ─────────────────────────────────────────────────────────────

    /// @notice IPFS CID for the artwork metadata JSON
    string public ipfsCID;

    /// @notice ETH held by the bonding curve reserve (excludes fees)
    uint256 public reserve;

    /// @notice Whether this artwork has reached GRADUATION_THRESHOLD
    bool public graduated;

    /// @notice Block timestamp when this contract was deployed
    uint256 public createdAt;

    /// @notice Total ETH royalties paid to the artist (for tracking)
    uint256 public totalRoyaltiesPaid;

    /// @notice Total volume traded (gross ETH)
    uint256 public totalVolume;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    event SharesBought(
        address indexed buyer,
        uint256 shares,
        uint256 ethCost,
        uint256 royalty,
        uint256 platformFee,
        uint256 newTotalSupply,
        uint256 newPrice
    );

    event SharesSold(
        address indexed seller,
        uint256 shares,
        uint256 ethReturned,
        uint256 royalty,
        uint256 platformFee,
        uint256 newTotalSupply,
        uint256 newPrice
    );

    event Graduated(
        uint256 reserve,
        uint256 totalSupply,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────

    constructor(
        address _artist,
        address payable _platform,
        string memory _name,
        string memory _ipfsCID,
        uint256 _k,
        uint256 _p0
    ) ERC20(_name, "SHARE") {
        require(_artist != address(0), "ArtBC: artist is zero");
        require(_platform != address(0), "ArtBC: platform is zero");
        require(bytes(_name).length > 0, "ArtBC: name empty");
        require(_k > 0 || _p0 > 0, "ArtBC: flat zero curve");

        artist = _artist;
        platform = _platform;
        ipfsCID = _ipfsCID;
        k = _k;
        p0 = _p0;
        createdAt = block.timestamp;
    }

    // ─────────────────────────────────────────────────────────────
    // ERC-20 overrides
    // ─────────────────────────────────────────────────────────────

    /// @notice Shares are indivisible whole units
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    // ─────────────────────────────────────────────────────────────
    // View: price & cost calculations
    // ─────────────────────────────────────────────────────────────

    /// @notice Marginal price of the next share (wei)
    function currentPrice() public view returns (uint256) {
        return k * totalSupply() + p0;
    }

    /// @notice Market capitalisation (wei) — supply × current price
    function marketCap() public view returns (uint256) {
        return totalSupply() * currentPrice();
    }

    /**
     * @notice Gross ETH cost to buy `amount` shares at current supply
     * @dev Does NOT include royalty or platform fee
     */
    function getBuyCost(uint256 amount) public view returns (uint256) {
        require(amount > 0, "ArtBC: amount is 0");
        uint256 s = totalSupply();
        // Integral: k·n·(2S+n)/2 + p0·n
        return (k * amount * (2 * s + amount)) / 2 + p0 * amount;
    }

    /**
     * @notice Gross ETH returned for selling `amount` shares at current supply
     * @dev Does NOT include royalty or platform fee deductions
     */
    function getSellReturn(uint256 amount) public view returns (uint256) {
        require(amount > 0, "ArtBC: amount is 0");
        uint256 s = totalSupply();
        require(amount <= s, "ArtBC: exceeds supply");
        // Integral: k·n·(2S-n)/2 + p0·n
        return (k * amount * (2 * s - amount)) / 2 + p0 * amount;
    }

    /**
     * @notice Full buy quote: returns all cost components
     * @return totalCost  Amount user must send (with ETH)
     * @return curveCost  Portion added to reserve
     * @return royalty    Portion sent to artist
     * @return platformFee Portion sent to platform
     */
    function quoteBuy(uint256 amount)
        public
        view
        returns (
            uint256 totalCost,
            uint256 curveCost,
            uint256 royalty,
            uint256 platformFee
        )
    {
        curveCost = getBuyCost(amount);
        royalty = (curveCost * ROYALTY_BPS) / BPS_DENOM;
        platformFee = (curveCost * PLATFORM_BPS) / BPS_DENOM;
        totalCost = curveCost + royalty + platformFee;
    }

    /**
     * @notice Full sell quote: returns all return components
     * @return netReturn   ETH the seller receives
     * @return grossReturn ETH removed from reserve
     * @return royalty     ETH sent to artist
     * @return platformFee ETH sent to platform
     */
    function quoteSell(uint256 amount)
        public
        view
        returns (
            uint256 netReturn,
            uint256 grossReturn,
            uint256 royalty,
            uint256 platformFee
        )
    {
        grossReturn = getSellReturn(amount);
        royalty = (grossReturn * ROYALTY_BPS) / BPS_DENOM;
        platformFee = (grossReturn * PLATFORM_BPS) / BPS_DENOM;
        netReturn = grossReturn - royalty - platformFee;
    }

    // ─────────────────────────────────────────────────────────────
    // Trading
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Buy `amount` shares.
     * @param amount    Number of whole shares to purchase
     * @param maxEth    Max ETH the caller is willing to pay (slippage guard)
     *
     * @dev  Send ETH >= totalCost from quoteBuy(amount).
     *       Any excess is refunded.
     */
    function buy(uint256 amount, uint256 maxEth)
        external
        payable
        nonReentrant
    {
        require(amount > 0, "ArtBC: amount is 0");
        require(
            totalSupply() + amount <= MAX_SUPPLY,
            "ArtBC: exceeds max supply"
        );

        (
            uint256 totalCost,
            uint256 curveCost,
            uint256 royalty,
            uint256 platformFee
        ) = quoteBuy(amount);

        require(totalCost <= maxEth, "ArtBC: slippage price moved up");
        require(msg.value >= totalCost, "ArtBC: insufficient ETH");

        // ── Effects ──────────────────────────────────────────────
        reserve += curveCost;
        totalVolume += curveCost;
        _mint(msg.sender, amount);

        // ── Interactions ─────────────────────────────────────────
        _pay(payable(artist), royalty);
        _pay(platform, platformFee);

        uint256 excess = msg.value - totalCost;
        if (excess > 0) _pay(payable(msg.sender), excess);

        // Graduation check
        if (!graduated && reserve >= GRADUATION_THRESHOLD) {
            graduated = true;
            emit Graduated(reserve, totalSupply(), block.timestamp);
        }

        totalRoyaltiesPaid += royalty;

        emit SharesBought(
            msg.sender,
            amount,
            totalCost,
            royalty,
            platformFee,
            totalSupply(),
            currentPrice()
        );
    }

    /**
     * @notice Sell `amount` shares back to the bonding curve.
     * @param amount    Number of whole shares to sell
     * @param minEth    Minimum ETH the caller expects (slippage guard)
     */
    function sell(uint256 amount, uint256 minEth)
        external
        nonReentrant
    {
        require(amount > 0, "ArtBC: amount is 0");
        require(balanceOf(msg.sender) >= amount, "ArtBC: insufficient shares");

        (
            uint256 netReturn,
            uint256 grossReturn,
            uint256 royalty,
            uint256 platformFee
        ) = quoteSell(amount);

        require(netReturn >= minEth, "ArtBC: slippage price moved down");
        require(reserve >= grossReturn, "ArtBC: reserve insufficient");

        // ── Effects ──────────────────────────────────────────────
        reserve -= grossReturn;
        totalVolume += grossReturn;
        _burn(msg.sender, amount);

        // ── Interactions ─────────────────────────────────────────
        _pay(payable(msg.sender), netReturn);
        _pay(payable(artist), royalty);
        _pay(platform, platformFee);

        totalRoyaltiesPaid += royalty;

        emit SharesSold(
            msg.sender,
            amount,
            netReturn,
            royalty,
            platformFee,
            totalSupply(),
            currentPrice()
        );
    }

    // ─────────────────────────────────────────────────────────────
    // Aggregated info
    // ─────────────────────────────────────────────────────────────

    /// @notice Returns a packed struct of all useful artwork info
    function getInfo()
        external
        view
        returns (
            address _artist,
            string memory _ipfsCID,
            uint256 _k,
            uint256 _p0,
            uint256 _supply,
            uint256 _price,
            uint256 _reserve,
            uint256 _marketCap,
            bool _graduated,
            uint256 _createdAt,
            uint256 _totalRoyalties,
            uint256 _totalVolume
        )
    {
        return (
            artist,
            ipfsCID,
            k,
            p0,
            totalSupply(),
            currentPrice(),
            reserve,
            marketCap(),
            graduated,
            createdAt,
            totalRoyaltiesPaid,
            totalVolume
        );
    }

    // ─────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────

    function _pay(address payable to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "ArtBC: ETH transfer failed");
    }

    /// @dev Prevent accidental ETH sends
    receive() external payable {
        revert("ArtBC: use buy()");
    }
}
