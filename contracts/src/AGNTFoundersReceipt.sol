// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @title  AGNTFoundersReceipt — soulbound on-chain contribution receipt (USDC)
/// @notice ⚠️ PRE-AUDIT DRAFT (v0.3-USDC, 2026-08-18). Collects USDC on-chain and mints a
///         SOULBOUND (non-transferable) receipt that records the contributor's total amount +
///         X handle. One receipt per wallet; repeat contributions accumulate. USDC accrues in
///         the contract and is swept to the fixed treasury via a permissionless `withdraw()`.
///
///         USDC is an ERC-20 (6 decimals), so contributing is a two-step wallet flow: approve
///         this contract to spend USDC, then `contribute(amount, xName, discord)`. `amount` is
///         in USDC base units (6 decimals) — e.g. $100 = 100_000000.
///
///         ⚠️ FRAMING: "Founder / contribution," not "investment." An on-chain money-collection
///         tied to a project + a promised token/NFT has securities implications — gating +
///         counsel are the caller's responsibility. This contract takes no position on that.
///         X handle + Discord are SELF-ATTESTED (unverified on-chain).
contract AGNTFoundersReceipt is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;
    using SafeERC20 for IERC20;

    IERC20 public immutable USDC; // 6-decimal stablecoin
    uint8  public constant USDC_DECIMALS = 6;

    struct Founder {
        uint256 tokenId;   // 0 = not a founder yet
        uint256 amount;    // cumulative USDC base units (6 dp)
        string  xName;
        string  discord;
        uint64  firstAt;
    }

    mapping(address => Founder) public founders;
    mapping(uint256 => address) public founderOf;
    uint256 public totalRaised; // cumulative USDC base units
    uint256 public founderCount;
    uint256 private _nextId;
    address public treasury;
    bool public open = true;

    /// @notice Access gate. While `allowlistOnly` is true, only `allowed[]` wallets can contribute
    ///         (so the raise can be launched privately — e.g. owner-only test — then opened later).
    bool public allowlistOnly = true;
    mapping(address => bool) public allowed;

    event Contributed(address indexed wallet, uint256 indexed tokenId, uint256 amount, uint256 newTotal, string xName);
    event ProfileUpdated(address indexed wallet, string xName, string discord);
    event Withdrawn(address indexed to, uint256 amount);
    event TreasurySet(address treasury);
    event OpenSet(bool open);
    event AllowedSet(address indexed wallet, bool allowed);
    event AllowlistOnlySet(bool allowlistOnly);

    constructor(address usdc_, address treasury_) ERC721("AGNT Inner Circle", "CIRCLE") Ownable(msg.sender) {
        require(usdc_ != address(0) && treasury_ != address(0), "zero");
        USDC = IERC20(usdc_);
        treasury = treasury_;
        allowed[msg.sender] = true;   // deployer can test
        allowed[treasury_] = true;    // treasury wallet can test
    }

    /// @notice Contribute `amount` USDC (6 dp) and mint/update your soulbound Founder receipt.
    ///         Requires a prior USDC `approve(thisContract, amount)`.
    function contribute(uint256 amount, string calldata xName, string calldata discord) external nonReentrant {
        require(open, "closed");
        require(!allowlistOnly || allowed[msg.sender], "not allowed");
        require(amount > 0, "no value");
        _requireValidX(xName);
        _requireValidDiscord(discord);

        // pull USDC; enforce plain-ERC-20 (reverts fee-on-transfer / non-standard receipts)
        uint256 before = USDC.balanceOf(address(this));
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        require(USDC.balanceOf(address(this)) - before == amount, "non-standard token");

        Founder storage f = founders[msg.sender];
        if (f.tokenId == 0) {
            uint256 id = ++_nextId;
            f.tokenId = id;
            f.firstAt = uint64(block.timestamp);
            founderOf[id] = msg.sender;
            founderCount++;
            _safeMint(msg.sender, id);
        }
        f.amount += amount;
        f.xName = xName;
        f.discord = discord;
        totalRaised += amount;
        // USDC accrues here; anyone can push it to the fixed treasury via withdraw()
        emit Contributed(msg.sender, f.tokenId, amount, f.amount, xName);
    }

    function updateProfile(string calldata xName, string calldata discord) external {
        Founder storage f = founders[msg.sender];
        require(f.tokenId != 0, "not a founder");
        _requireValidX(xName);
        _requireValidDiscord(discord);
        f.xName = xName;
        f.discord = discord;
        emit ProfileUpdated(msg.sender, xName, discord);
    }

    /// @notice Permissionless sweep of accrued USDC to the FIXED treasury (pull payment).
    function withdraw() external nonReentrant {
        uint256 bal = USDC.balanceOf(address(this));
        require(bal > 0, "nothing");
        USDC.safeTransfer(treasury, bal);
        emit Withdrawn(treasury, bal);
    }

    // ------------------------------------------------------------ soulbound
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        require(from == address(0) || to == address(0), "soulbound");
    }
    function approve(address, uint256) public pure override { revert("soulbound"); }
    function setApprovalForAll(address, bool) public pure override { revert("soulbound"); }

    // ------------------------------------------------------------ on-chain receipt art
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        address w = founderOf[tokenId];
        require(w != address(0), "nonexistent");
        Founder memory f = founders[w];
        string memory usd = _usdc(f.amount);
        string memory handle = f.xName; // allowlist guarantees length >= 1

        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">',
            '<rect width="600" height="380" fill="#160a24"/>',
            '<rect x="14" y="14" width="572" height="352" fill="none" stroke="#bfeaf4" stroke-width="3"/>',
            '<text x="40" y="80" fill="#7ea6bd" font-family="monospace" font-size="15" letter-spacing="4">AGNT INNER CIRCLE</text>',
            '<text x="40" y="190" fill="#eef8fc" font-family="Arial,sans-serif" font-weight="bold" font-size="54">@', handle, '</text>',
            '<text x="40" y="270" fill="#bfeaf4" font-family="monospace" font-weight="bold" font-size="40">$', usd, ' USDC</text>',
            '<text x="40" y="330" fill="#57544B" font-family="monospace" font-size="13">SOULBOUND \xC2\xB7 RECEIPT #', tokenId.toString(), '</text>',
            '</svg>'
        ));
        string memory json = string(abi.encodePacked(
            '{"name":"AGNT Inner Circle #', tokenId.toString(),
            '","description":"Soulbound receipt for a contribution to AGNT. Non-transferable.",',
            '"attributes":[{"trait_type":"X","value":"', f.xName,
            '"},{"trait_type":"Contribution (USDC base units)","value":"', f.amount.toString(),
            '"}],"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '"}'
        ));
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    /// @dev USDC base units (6 dp) → "X.YY" dollar string (2 dp), display only.
    function _usdc(uint256 amt) internal pure returns (string memory) {
        uint256 whole = amt / 1e6;
        uint256 cents = (amt % 1e6) / 1e4; // 2 decimals
        bytes memory c = bytes(cents.toString());
        while (c.length < 2) c = abi.encodePacked("0", c);
        return string(abi.encodePacked(whole.toString(), ".", c));
    }

    // ------------------------------------------------------------ input allowlist
    function _requireValidX(string calldata s) internal pure {
        bytes memory b = bytes(s);
        require(b.length >= 1 && b.length <= 32, "x handle length");
        for (uint256 i; i < b.length; i++) {
            bytes1 c = b[i];
            bool ok = (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A) || c == 0x5F;
            require(ok, "x handle chars");
        }
    }
    function _requireValidDiscord(string calldata s) internal pure {
        bytes memory b = bytes(s);
        require(b.length <= 40, "discord length");
        for (uint256 i; i < b.length; i++) {
            bytes1 c = b[i];
            bool ok = (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)
                || c == 0x5F || c == 0x2E || c == 0x23 || c == 0x2D;
            require(ok, "discord chars");
        }
    }

    // ------------------------------------------------------------ admin
    function setTreasury(address t) external onlyOwner { require(t != address(0), "zero"); treasury = t; emit TreasurySet(t); }
    function setOpen(bool o) external onlyOwner { open = o; emit OpenSet(o); }
    function setAllowed(address a, bool v) external onlyOwner { allowed[a] = v; emit AllowedSet(a, v); }
    function setAllowlistOnly(bool v) external onlyOwner { allowlistOnly = v; emit AllowlistOnlySet(v); } // flip false to open publicly

    /// @notice Recover force-sent ETH (contract is non-payable; ETH can only arrive via
    ///         selfdestruct). USDC is handled by withdraw().
    function rescueETH(address payable to) external onlyOwner {
        require(to != address(0), "zero");
        (bool ok, ) = to.call{value: address(this).balance}("");
        require(ok, "eth xfer");
    }
}
