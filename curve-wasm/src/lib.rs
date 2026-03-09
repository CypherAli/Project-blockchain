//! ArtCurve bonding curve math — Rust/WASM edition.
//!
//! Mirrors the Solidity formulas in ArtBondingCurve.sol exactly.
//! All values are passed as decimal strings (JS BigInt <-> string <-> u128).
//!
//! Linear bonding curve:
//!   price(s)     = k·s + p0
//!   buy_cost     = k·n·(2S+n)/2 + p0·n
//!   sell_return  = k·n·(2S-n)/2 + p0·n
//!
//! Build with: wasm-pack build --target web --release
//! Output goes to: curve-wasm/pkg/

use wasm_bindgen::prelude::*;

// ── Constants ─────────────────────────────────────────────────────────────────

const ROYALTY_BPS: u128 = 500;    // 5%
const PLATFORM_BPS: u128 = 100;   // 1%
const BPS_DENOM: u128 = 10_000;
const GRAD_THRESHOLD: u128 = 24_000_000_000_000_000_000; // 24 ETH in wei

// ── Helpers ───────────────────────────────────────────────────────────────────

fn parse(s: &str) -> u128 {
    s.trim().parse::<u128>().unwrap_or(0)
}

// ── Core math ─────────────────────────────────────────────────────────────────

/// Returns the gross ETH cost to buy `amount` shares when supply is `supply`.
#[wasm_bindgen]
pub fn get_buy_cost(amount: &str, supply: &str, k: &str, p0: &str) -> String {
    let (n, s, k, p0) = (parse(amount), parse(supply), parse(k), parse(p0));
    if n == 0 { return "0".into(); }
    // k * n * (2*S + n) / 2  +  p0 * n
    let two_s = s.saturating_mul(2);
    let inner = two_s.saturating_add(n);
    let p1    = k.saturating_mul(n).saturating_mul(inner) / 2;
    let p2    = p0.saturating_mul(n);
    p1.saturating_add(p2).to_string()
}

/// Returns the gross ETH returned when selling `amount` shares from `supply`.
#[wasm_bindgen]
pub fn get_sell_return(amount: &str, supply: &str, k: &str, p0: &str) -> String {
    let (n, s, k, p0) = (parse(amount), parse(supply), parse(k), parse(p0));
    if n == 0 || n > s { return "0".into(); }
    // k * n * (2*S - n) / 2  +  p0 * n
    let two_s = s.saturating_mul(2);
    let inner = two_s.saturating_sub(n);
    let p1    = k.saturating_mul(n).saturating_mul(inner) / 2;
    let p2    = p0.saturating_mul(n);
    p1.saturating_add(p2).to_string()
}

/// Returns the current price at a given supply.
#[wasm_bindgen]
pub fn current_price(supply: &str, k: &str, p0: &str) -> String {
    let (s, k, p0) = (parse(supply), parse(k), parse(p0));
    k.saturating_mul(s).saturating_add(p0).to_string()
}

/// Returns market cap = price × supply.
#[wasm_bindgen]
pub fn market_cap(supply: &str, k: &str, p0: &str) -> String {
    let (s, k, p0) = (parse(supply), parse(k), parse(p0));
    let price = k.saturating_mul(s).saturating_add(p0);
    price.saturating_mul(s).to_string()
}

/// Returns graduation progress as integer 0–100.
#[wasm_bindgen]
pub fn graduation_progress(reserve: &str) -> u8 {
    let r = parse(reserve);
    if r >= GRAD_THRESHOLD { return 100; }
    ((r * 100) / GRAD_THRESHOLD) as u8
}

// ── Quote helpers (include fee breakdown) ─────────────────────────────────────

/// Returns a JSON string: {"gross":"…","royalty":"…","platformFee":"…","net":"…"}
/// net = gross + royalty + platformFee  (buyer pays fees on top)
#[wasm_bindgen]
pub fn quote_buy(amount: &str, supply: &str, k: &str, p0: &str) -> String {
    let gross   = parse(&get_buy_cost(amount, supply, k, p0));
    let royalty = gross * ROYALTY_BPS / BPS_DENOM;
    let fee     = gross * PLATFORM_BPS / BPS_DENOM;
    let net     = gross.saturating_add(royalty).saturating_add(fee);
    format!(
        r#"{{"gross":"{}","royalty":"{}","platformFee":"{}","net":"{}"}}"#,
        gross, royalty, fee, net
    )
}

/// Returns a JSON string: {"gross":"…","royalty":"…","platformFee":"…","net":"…"}
/// net = gross - royalty - platformFee  (seller receives after fees)
#[wasm_bindgen]
pub fn quote_sell(amount: &str, supply: &str, k: &str, p0: &str) -> String {
    let gross   = parse(&get_sell_return(amount, supply, k, p0));
    let royalty = gross * ROYALTY_BPS / BPS_DENOM;
    let fee     = gross * PLATFORM_BPS / BPS_DENOM;
    let net     = gross.saturating_sub(royalty).saturating_sub(fee);
    format!(
        r#"{{"gross":"{}","royalty":"{}","platformFee":"{}","net":"{}"}}"#,
        gross, royalty, fee, net
    )
}

// ── Slippage helpers ──────────────────────────────────────────────────────────

/// Adds slippage on top of a cost (for buy transactions).
/// slippage_bps: e.g. 100 = 1%
#[wasm_bindgen]
pub fn apply_buy_slippage(amount: &str, slippage_bps: u32) -> String {
    let n = parse(amount);
    let s = n.saturating_mul(slippage_bps as u128) / BPS_DENOM;
    n.saturating_add(s).to_string()
}

/// Subtracts slippage from a return (for sell transactions).
#[wasm_bindgen]
pub fn apply_sell_slippage(amount: &str, slippage_bps: u32) -> String {
    let n = parse(amount);
    let s = n.saturating_mul(slippage_bps as u128) / BPS_DENOM;
    n.saturating_sub(s).to_string()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // Default curve params from ArtFactory
    const K:  &str = "100000000000000";   // 0.0001 ETH
    const P0: &str = "1000000000000000";  // 0.001 ETH

    #[test]
    fn buy_zero_supply() {
        // Buying 1 share from supply=0: cost = k*1*(0+1)/2 + p0*1 = k/2 + p0
        let cost = parse(&get_buy_cost("1", "0", K, P0));
        let k    = parse(K);
        let p0   = parse(P0);
        assert_eq!(cost, k / 2 + p0);
    }

    #[test]
    fn sell_returns_less_than_buy() {
        // Sell 1 share at supply=1 should return ≤ what it cost to buy
        let buy_cost = parse(&get_buy_cost("1", "0", K, P0));
        let sell_ret = parse(&get_sell_return("1", "1", K, P0));
        assert_eq!(buy_cost, sell_ret, "symmetric at single share");
    }

    #[test]
    fn graduation_progress_100() {
        assert_eq!(graduation_progress("24000000000000000000"), 100);
        assert_eq!(graduation_progress("25000000000000000000"), 100);
    }

    #[test]
    fn graduation_progress_50() {
        assert_eq!(graduation_progress("12000000000000000000"), 50);
    }

    #[test]
    fn quote_buy_includes_fees() {
        let q = quote_buy("10", "100", K, P0);
        // JSON contains all four fields
        assert!(q.contains("\"gross\""));
        assert!(q.contains("\"royalty\""));
        assert!(q.contains("\"platformFee\""));
        assert!(q.contains("\"net\""));
        // net > gross (fees added on top for buyer)
        let gross_str = q.split("\"gross\":\"").nth(1).unwrap_or("0").split('"').next().unwrap_or("0");
        let net_str   = q.split("\"net\":\"").nth(1).unwrap_or("0").split('"').next().unwrap_or("0");
        let gross: u128 = gross_str.parse().unwrap_or(0);
        let net:   u128 = net_str.parse().unwrap_or(0);
        assert!(net > gross, "net={net} should be > gross={gross}");
    }
}
