import { describe, it, expect, beforeEach } from "vitest";

interface MockContract {
  admin: string;
  paused: boolean;
  totalSupply: bigint;
  inflationEnabled: boolean;
  balances: Map<string, bigint>;
  staked: Map<string, bigint>;
  allowances: Map<string, bigint>;
  MAX_SUPPLY: bigint;
  BATCH_MAX_SIZE: number;

  isAdmin(caller: string): boolean;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  setInflationEnabled(caller: string, enabled: boolean): { value: boolean } | { error: number };
  mint(caller: string, recipient: string, amount: bigint): { value: boolean } | { error: number };
  burn(caller: string, amount: bigint): { value: boolean } | { error: number };
  transfer(caller: string, amount: bigint, sender: string, recipient: string): { value: boolean } | { error: number };
  approve(caller: string, spender: string, amount: bigint): { value: boolean } | { error: number };
  transferFrom(caller: string, owner: string, recipient: string, amount: bigint): { value: boolean } | { error: number };
  batchTransfer(caller: string, transfers: Array<{ recipient: string; amount: bigint }>): { value: boolean } | { error: number };
  stake(caller: string, amount: bigint): { value: boolean } | { error: number };
  unstake(caller: string, amount: bigint): { value: boolean } | { error: number };
  getBalance(account: string): bigint;
  getStaked(account: string): bigint;
  getAllowance(owner: string, spender: string): bigint;
}

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYUE3VGZJSRTPGZGM",
  paused: false,
  totalSupply: 0n,
  inflationEnabled: false,
  balances: new Map<string, bigint>(),
  staked: new Map<string, bigint>(),
  allowances: new Map<string, bigint>(),
  MAX_SUPPLY: 1_000_000_000_000n,
  BATCH_MAX_SIZE: 10,

  isAdmin(caller: string) {
    return caller === this.admin;
  },

  setPaused(caller: string, pause: boolean) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (pause && this.paused) return { error: 110 };
    if (!pause && !this.paused) return { error: 111 };
    this.paused = pause;
    return { value: pause };
  },

  setInflationEnabled(caller: string, enabled: boolean) {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.inflationEnabled = enabled;
    return { value: enabled };
  },

  mint(caller: string, recipient: string, amount: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount === 0n) return { error: 106 };
    if (!this.inflationEnabled && this.totalSupply + amount > this.MAX_SUPPLY) return { error: 103 };
    this.balances.set(recipient, (this.balances.get(recipient) || 0n) + amount);
    this.totalSupply += amount;
    return { value: true };
  },

  burn(caller: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (amount === 0n) return { error: 106 };
    const bal = this.balances.get(caller) || 0n;
    if (bal < amount) return { error: 101 };
    this.balances.set(caller, bal - amount);
    this.totalSupply -= amount;
    return { value: true };
  },

  transfer(caller: string, amount: bigint, sender: string, recipient: string) {
    if (this.paused) return { error: 104 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount === 0n) return { error: 106 };
    if (caller !== sender) return { error: 100 };
    const bal = this.balances.get(sender) || 0n;
    if (bal < amount) return { error: 101 };
    this.balances.set(sender, bal - amount);
    this.balances.set(recipient, (this.balances.get(recipient) || 0n) + amount);
    return { value: true };
  },

  approve(caller: string, spender: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (spender === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount === 0n) return { error: 106 };
    this.allowances.set(`${caller}_${spender}`, amount);
    return { value: true };
  },

  transferFrom(caller: string, owner: string, recipient: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount === 0n) return { error: 106 };
    const allowance = this.allowances.get(`${owner}_${caller}`) || 0n;
    if (allowance < amount) return { error: 107 };
    const bal = this.balances.get(owner) || 0n;
    if (bal < amount) return { error: 101 };
    this.balances.set(owner, bal - amount);
    this.balances.set(recipient, (this.balances.get(recipient) || 0n) + amount);
    this.allowances.set(`${owner}_${caller}`, allowance - amount);
    return { value: true };
  },

  batchTransfer(caller: string, transfers: Array<{ recipient: string; amount: bigint }>) {
    if (this.paused) return { error: 104 };
    if (transfers.length > this.BATCH_MAX_SIZE) return { error: 108 };
    for (const { recipient, amount } of transfers) {
      const result = this.transfer(caller, amount, caller, recipient);
      if ("error" in result) return result;
    }
    return { value: true };
  },

  stake(caller: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (amount === 0n) return { error: 106 };
    const bal = this.balances.get(caller) || 0n;
    if (bal < amount) return { error: 101 };
    this.balances.set(caller, bal - amount);
    this.staked.set(caller, (this.staked.get(caller) || 0n) + amount);
    return { value: true };
  },

  unstake(caller: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (amount === 0n) return { error: 106 };
    const stakeBal = this.staked.get(caller) || 0n;
    if (stakeBal < amount) return { error: 102 };
    this.staked.set(caller, stakeBal - amount);
    this.balances.set(caller, (this.balances.get(caller) || 0n) + amount);
    return { value: true };
  },

  getBalance(account: string): bigint {
    return this.balances.get(account) || 0n;
  },

  getStaked(account: string): bigint {
    return this.staked.get(account) || 0n;
  },

  getAllowance(owner: string, spender: string): bigint {
    return this.allowances.get(`${owner}_${spender}`) || 0n;
  },
};

describe("CyberShield ThreatIntel Token", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYUE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.totalSupply = 0n;
    mockContract.inflationEnabled = false;
    mockContract.balances = new Map();
    mockContract.staked = new Map();
    mockContract.allowances = new Map();
  });

  it("should mint tokens when called by admin", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 1000n);
    expect(result).toEqual({ value: true });
    expect(mockContract.getBalance("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB")).toBe(1000n);
    expect(mockContract.totalSupply).toBe(1000n);
  });

  it("should prevent minting over max supply without inflation", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 2_000_000_000_000n);
    expect(result).toEqual({ error: 103 });
  });

  it("should allow minting over max supply with inflation enabled", () => {
    mockContract.setInflationEnabled(mockContract.admin, true);
    const result = mockContract.mint(mockContract.admin, "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 2_000_000_000_000n);
    expect(result).toEqual({ value: true });
    expect(mockContract.totalSupply).toBe(2_000_000_000_000n);
  });

  it("should prevent minting with zero amount", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 0n);
    expect(result).toEqual({ error: 106 });
  });

  it("should burn tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 500n);
    const result = mockContract.burn("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 200n);
    expect(result).toEqual({ value: true });
    expect(mockContract.getBalance("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB")).toBe(300n);
    expect(mockContract.totalSupply).toBe(300n);
  });

  it("should prevent burning with insufficient balance", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 100n);
    const result = mockContract.burn("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 200n);
    expect(result).toEqual({ error: 101 });
  });

  it("should transfer tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 500n);
    const result = mockContract.transfer(
      "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB",
      200n,
      "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB",
      "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21X3"
    );
    expect(result).toEqual({ value: true });
    expect(mockContract.getBalance("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB")).toBe(300n);
    expect(mockContract.getBalance("ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21X3")).toBe(200n);
  });

  it("should prevent transfer from unauthorized caller", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 500n);
    const result = mockContract.transfer(
      "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21X3",
      200n,
      "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB",
      "ST4JT845C64A9M8W0752ZP02HR4SM6TPMM2XJQAE"
    );
    expect(result).toEqual({ error: 100 });
  });

  it("should approve and transfer from using allowance", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 500n);
    mockContract.approve("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21X3", 300n);
    expect(mockContract.getAllowance("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21X3")).toBe(300n);
    const result = mockContract.transferFrom(
      "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21X3",
      "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB",
      "ST4JT845C64A9M8W0752ZP02HR4SM6TPMM2XJQAE",
      200n
    );
    expect(result).toEqual({ value: true });
    expect(mockContract.getBalance("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB")).toBe(300n);
    expect(mockContract.getBalance("ST4JT845C64A9M8W0752ZP02HR4SM6TPMM2XJQAE")).toBe(200n);
    expect(mockContract.getAllowance("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21X3")).toBe(100n);
  });

  it("should prevent transfer-from with insufficient allowance", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 500n);
    mockContract.approve("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21X3", 100n);
    const result = mockContract.transferFrom(
      "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21X3",
      "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB",
      "ST4JT845C64A9M8W0752ZP02HR4SM6TPMM2XJQAE",
      200n
    );
    expect(result).toEqual({ error: 107 });
  });

  it("should batch transfer tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 1000n);
    const transfers = [
      { recipient: "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21X3", amount: 200n },
      { recipient: "ST4JT845C64A9M8W0752ZP02HR4SM6TPMM2XJQAE", amount: 300n },
    ];
    const result = mockContract.batchTransfer("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", transfers);
    expect(result).toEqual({ value: true });
    expect(mockContract.getBalance("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB")).toBe(500n);
    expect(mockContract.getBalance("ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21X3")).toBe(200n);
    expect(mockContract.getBalance("ST4JT845C64A9M8W0752ZP02HR4SM6TPMM2XJQAE")).toBe(300n);
  });

  it("should prevent batch transfer over limit", () => {
    const transfers = Array.from({ length: 11 }, (_, i) => ({ recipient: `ST${i + 1}ABC`, amount: 10n }));
    const result = mockContract.batchTransfer("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", transfers);
    expect(result).toEqual({ error: 108 });
  });

  it("should stake tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 500n);
    const result = mockContract.stake("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 200n);
    expect(result).toEqual({ value: true });
    expect(mockContract.getBalance("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB")).toBe(300n);
    expect(mockContract.getStaked("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB")).toBe(200n);
  });

  it("should unstake tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 500n);
    mockContract.stake("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 200n);
    const result = mockContract.unstake("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 100n);
    expect(result).toEqual({ value: true });
    expect(mockContract.getStaked("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB")).toBe(100n);
    expect(mockContract.getBalance("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB")).toBe(400n);
  });

  it("should not allow operations when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    const transferResult = mockContract.transfer(
      "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB",
      10n,
      "ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB",
      "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21X3"
    );
    const burnResult = mockContract.burn("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 10n);
    const stakeResult = mockContract.stake("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", 10n);
    expect(transferResult).toEqual({ error: 104 });
    expect(burnResult).toEqual({ error: 104 });
    expect(stakeResult).toEqual({ error: 104 });
  });

  it("should not allow non-admin to mint or set paused", () => {
    const mintResult = mockContract.mint("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21X3", 100n);
    const pauseResult = mockContract.setPaused("ST2CY5V39NHDPWSXMW9QDT3PX3TM1C6N546PJTGB", true);
    expect(mintResult).toEqual({ error: 100 });
    expect(pauseResult).toEqual({ error: 100 });
  });

  it("should prevent pausing when already paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    const result = mockContract.setPaused(mockContract.admin, true);
    expect(result).toEqual({ error: 110 });
  });

  it("should prevent unpausing when not paused", () => {
    const result = mockContract.setPaused(mockContract.admin, false);
    expect(result).toEqual({ error: 111 });
  });
});