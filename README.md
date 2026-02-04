# pulse-play

A real-time prediction market platform for play-by-play sports betting with ultra-short outcome windows (10-30 seconds). Built on Yellow Network's ClearNode state channel infrastructure, it enables rapid off-chain bet placement and resolution while batching final settlement on Arc.

The platform uses LMSR (Logarithmic Market Scoring Rule) for automated market making, with a global liquidity pool where LPs hold tokenized shares representing their stake as the distributed counterparty to all bets. LPs can deposit or withdraw outside of active game sessions, and the dynamic b parameter adjusts liquidity depth based on volume.

Data feeds come from Sportsradar for play-by-play information, with Stork or Chainlink providing oracle attestation for on-chain settlement. Circle Wallets enable gasless transactions and easy USDC onboarding, while idle treasury capital earns yield through USYC on Arc.
