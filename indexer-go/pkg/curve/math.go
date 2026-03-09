// Package curve mirrors the exact bonding curve math from ArtBondingCurve.sol.
// All computations use math/big.Int for 256-bit precision.
//
// Linear bonding curve:
//   price(s) = k·s + p0
//   buy cost   = ∫[S → S+n]  (k·x + p0) dx = k·n·(2S+n)/2 + p0·n
//   sell return = ∫[S-n → S] (k·x + p0) dx = k·n·(2S-n)/2 + p0·n
package curve

import "math/big"

var (
	RoyaltyBPS    = big.NewInt(500)
	PlatformBPS   = big.NewInt(100)
	BPSDenom      = big.NewInt(10_000)
	GradThreshold = mustBigInt("24000000000000000000") // 24 ETH in wei
	MaxSupply     = big.NewInt(1_000_000)

	two = big.NewInt(2)
)

func mustBigInt(s string) *big.Int {
	n, ok := new(big.Int).SetString(s, 10)
	if !ok {
		panic("curve: invalid constant " + s)
	}
	return n
}

// GetBuyCost returns the gross ETH cost to buy `amount` shares from `supply`.
func GetBuyCost(amount, supply, k, p0 *big.Int) *big.Int {
	if amount.Sign() == 0 {
		return new(big.Int)
	}
	// k * n * (2S + n) / 2
	twoS := new(big.Int).Mul(two, supply)
	inner := new(big.Int).Add(twoS, amount)
	p1 := new(big.Int).Mul(k, amount)
	p1.Mul(p1, inner)
	p1.Div(p1, two)
	// p0 * n
	p2 := new(big.Int).Mul(p0, amount)
	return p1.Add(p1, p2)
}

// GetSellReturn returns the gross ETH return for selling `amount` shares from `supply`.
func GetSellReturn(amount, supply, k, p0 *big.Int) *big.Int {
	if amount.Sign() == 0 {
		return new(big.Int)
	}
	// k * n * (2S - n) / 2
	twoS := new(big.Int).Mul(two, supply)
	inner := new(big.Int).Sub(twoS, amount)
	p1 := new(big.Int).Mul(k, amount)
	p1.Mul(p1, inner)
	p1.Div(p1, two)
	// p0 * n
	p2 := new(big.Int).Mul(p0, amount)
	return p1.Add(p1, p2)
}

// CurrentPrice returns k*supply + p0.
func CurrentPrice(supply, k, p0 *big.Int) *big.Int {
	price := new(big.Int).Mul(k, supply)
	return price.Add(price, p0)
}

// MarketCap returns price × supply.
func MarketCap(supply, k, p0 *big.Int) *big.Int {
	return new(big.Int).Mul(CurrentPrice(supply, k, p0), supply)
}

// GraduationProgress returns an integer 0-100.
func GraduationProgress(reserve *big.Int) int {
	if reserve.Cmp(GradThreshold) >= 0 {
		return 100
	}
	pct := new(big.Int).Mul(reserve, big.NewInt(100))
	pct.Div(pct, GradThreshold)
	return int(pct.Int64())
}

// QuoteResult holds the cost/return breakdown including fees.
type QuoteResult struct {
	Gross      *big.Int
	Royalty    *big.Int
	PlatformFee *big.Int
	Net        *big.Int
}

func computeFees(gross *big.Int) (royalty, fee *big.Int) {
	royalty = new(big.Int).Mul(gross, RoyaltyBPS)
	royalty.Div(royalty, BPSDenom)
	fee = new(big.Int).Mul(gross, PlatformBPS)
	fee.Div(fee, BPSDenom)
	return
}

// QuoteBuy returns gross + fees for buying amount shares.
func QuoteBuy(amount, supply, k, p0 *big.Int) QuoteResult {
	gross := GetBuyCost(amount, supply, k, p0)
	royalty, fee := computeFees(gross)
	net := new(big.Int).Add(gross, royalty)
	net.Add(net, fee)
	return QuoteResult{Gross: gross, Royalty: royalty, PlatformFee: fee, Net: net}
}

// QuoteSell returns gross - fees for selling amount shares.
func QuoteSell(amount, supply, k, p0 *big.Int) QuoteResult {
	gross := GetSellReturn(amount, supply, k, p0)
	royalty, fee := computeFees(gross)
	net := new(big.Int).Sub(gross, royalty)
	net.Sub(net, fee)
	return QuoteResult{Gross: gross, Royalty: royalty, PlatformFee: fee, Net: net}
}

// ParseBig parses a decimal string to *big.Int; returns zero on failure.
func ParseBig(s string) *big.Int {
	n, ok := new(big.Int).SetString(s, 10)
	if !ok {
		return new(big.Int)
	}
	return n
}
