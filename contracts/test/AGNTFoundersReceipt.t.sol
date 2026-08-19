// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AGNTFoundersReceipt} from "../src/AGNTFoundersReceipt.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 a) external { _mint(to, a); }
}

contract AGNTFoundersReceiptTest is Test {
    AGNTFoundersReceipt r;
    MockUSDC usdc;
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant USD = 1e6; // 1 USDC

    function setUp() public {
        usdc = new MockUSDC();
        r = new AGNTFoundersReceipt(address(usdc), treasury);
        usdc.mint(alice, 1_000_000 * USD);
        usdc.mint(bob, 1_000_000 * USD);
        vm.prank(alice); usdc.approve(address(r), type(uint256).max);
        vm.prank(bob); usdc.approve(address(r), type(uint256).max);
        r.setAllowed(alice, true); // gated allowlist — allow the test wallets
        r.setAllowed(bob, true);
    }

    function test_AllowlistGate() public {
        address stranger = makeAddr("stranger");
        usdc.mint(stranger, 200 * USD);
        vm.prank(stranger); usdc.approve(address(r), type(uint256).max);

        // gated: not allowed → revert
        vm.prank(stranger); vm.expectRevert(bytes("not allowed")); r.contribute(100 * USD, "stranger", "");
        // owner allows → works
        r.setAllowed(stranger, true);
        vm.prank(stranger); r.contribute(100 * USD, "stranger", "");
        assertEq(r.balanceOf(stranger), 1);
        // open publicly → anyone works
        address pub = makeAddr("pub"); usdc.mint(pub, 50 * USD);
        vm.prank(pub); usdc.approve(address(r), type(uint256).max);
        vm.prank(pub); vm.expectRevert(bytes("not allowed")); r.contribute(50 * USD, "pub", "");
        r.setAllowlistOnly(false);
        vm.prank(pub); r.contribute(50 * USD, "pub", "");
        assertEq(r.balanceOf(pub), 1);
    }

    function test_Contribute_PullsUSDC_MintsReceipt_RecordsXName() public {
        vm.prank(alice); r.contribute(250 * USD, "Tuteth_", "tut#1");

        (uint256 id, uint256 amt, string memory x,,) = r.founders(alice);
        assertEq(id, 1);
        assertEq(amt, 250 * USD);
        assertEq(x, "Tuteth_");
        assertEq(r.ownerOf(1), alice);
        assertEq(usdc.balanceOf(address(r)), 250 * USD, "USDC accrues in contract");
        r.withdraw();
        assertEq(usdc.balanceOf(treasury), 250 * USD, "swept to treasury");
        assertEq(r.totalRaised(), 250 * USD);
        assertEq(r.founderCount(), 1);
    }

    function test_RepeatContribution_Accumulates() public {
        vm.prank(alice); r.contribute(100 * USD, "Tuteth_", "");
        vm.prank(alice); r.contribute(400 * USD, "Tuteth_", "");
        (uint256 id, uint256 amt,,,) = r.founders(alice);
        assertEq(id, 1);
        assertEq(amt, 500 * USD);
        assertEq(r.balanceOf(alice), 1);
        r.withdraw();
        assertEq(usdc.balanceOf(treasury), 500 * USD);
    }

    function test_RequiresApproval() public {
        address carol = makeAddr("carol");
        usdc.mint(carol, 100 * USD);
        vm.prank(carol);
        vm.expectRevert(); // no approval → transferFrom reverts
        r.contribute(100 * USD, "carol", "");
    }

    function test_Soulbound_CannotTransferOrApprove() public {
        vm.prank(alice); r.contribute(50 * USD, "Tuteth_", "");
        vm.prank(alice); vm.expectRevert(bytes("soulbound")); r.transferFrom(alice, bob, 1);
        vm.prank(alice); vm.expectRevert(bytes("soulbound")); r.approve(bob, 1);
        vm.prank(alice); vm.expectRevert(bytes("soulbound")); r.setApprovalForAll(bob, true);
    }

    function test_RequiresValue_AndOpen() public {
        vm.prank(alice); vm.expectRevert(bytes("no value")); r.contribute(0, "x", "");
        r.setOpen(false);
        vm.prank(alice); vm.expectRevert(bytes("closed")); r.contribute(100 * USD, "x", "");
    }

    function test_RejectsInjectionHandles() public {
        vm.prank(alice); vm.expectRevert(bytes("x handle chars")); r.contribute(1 * USD, 'x"}],"image":"evil', "");
        vm.prank(alice); vm.expectRevert(bytes("x handle chars")); r.contribute(1 * USD, "</text><a", "");
        vm.prank(alice); vm.expectRevert(bytes("x handle length")); r.contribute(1 * USD, "", "");
    }

    function test_UpdateProfile() public {
        vm.prank(alice); r.contribute(1 * USD, "typo", "");
        vm.prank(alice); r.updateProfile("Tuteth_", "tut#1");
        (,, string memory x, string memory d,) = r.founders(alice);
        assertEq(x, "Tuteth_"); assertEq(d, "tut#1");
    }

    function test_TokenURI_RendersOnChain() public {
        vm.prank(alice); r.contribute(250 * USD, "Tuteth_", "tut#1");
        string memory uri = r.tokenURI(1);
        assertGt(bytes(uri).length, 100);
    }
}
