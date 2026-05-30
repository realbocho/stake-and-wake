import "@stdlib/ownable";

struct StakeEntry {
    roundId: Int as uint32;
    amount: Int as coins;
    status: Int as uint8; // 0=staked, 1=success, 2=failed
    credited: Bool;
}

message OpenRound {
    queryId: Int as uint64;
    roundId: Int as uint32;
    minStake: Int as coins;
    closesAt: Int as uint32;
}

message CloseRound {
    queryId: Int as uint64;
    roundId: Int as uint32;
}

message MarkParticipant {
    queryId: Int as uint64;
    roundId: Int as uint32;
    participant: Address;
    success: Bool;
}

message FinalizeRound {
    queryId: Int as uint64;
    roundId: Int as uint32;
}

message CreditWinner {
    queryId: Int as uint64;
    roundId: Int as uint32;
    participant: Address;
}

message Withdraw {
    queryId: Int as uint64;
}

message WithdrawFees {
    queryId: Int as uint64;
    amount: Int as coins;
    to: Address;
}

message EmergencyWithdraw {
    queryId: Int as uint64;
    amount: Int as coins;
    to: Address;
}

message WithdrawStake {
    queryId: Int as uint64;
    amount: Int as coins;
    to: Address;
}

message Stake {
    roundId: Int as uint32;
    telegramIdHash: Int as uint256;
}

contract StakeWakeVault with Ownable {

    owner: Address;
    operator: Address;
    platformFeeBps: Int as uint16;

    currentRoundId: Int as uint32;
    roundOpen: Bool;
    roundFinalized: Bool;

    minStake: Int as coins;
    closesAt: Int as uint32;

    totalStaked: Int as coins;
    failedPool: Int as coins;
    totalSuccessStake: Int as coins;
    distributablePool: Int as coins;

    platformFeesAccrued: Int as coins;

    stakes: map<Address, StakeEntry>;
    pendingWithdraw: map<Address, Int as coins>;

    init(owner: Address, operator: Address, platformFeeBps: Int as uint16) {
        self.owner = owner;
        self.operator = operator;
        self.platformFeeBps = platformFeeBps;
        self.currentRoundId = 0;
        self.roundOpen = false;
        self.roundFinalized = false;
        self.minStake = 0;
        self.closesAt = 0;
        self.totalStaked = 0;
        self.failedPool = 0;
        self.totalSuccessStake = 0;
        self.distributablePool = 0;
        self.platformFeesAccrued = 0;
    }

    receive() {
        self.failedPool += context().value;
    }

    receive(msg: OpenRound) {
        self.requireOwner();
        throwUnless(201, !self.roundOpen);
        throwUnless(202, self.currentRoundId == 0
            || self.roundFinalized
            || now() > self.closesAt + 86400);

        let carryOver: Int = 0;
        if (self.roundFinalized && self.totalSuccessStake == 0) {
            carryOver = self.distributablePool;
        }

        self.currentRoundId = msg.roundId;
        self.roundOpen = true;
        self.roundFinalized = false;
        self.minStake = msg.minStake;
        self.closesAt = msg.closesAt;
        self.totalStaked = 0;
        self.failedPool = carryOver;
        self.totalSuccessStake = 0;
        self.distributablePool = 0;
        self.stakes = emptyMap();
    }

    receive(msg: Stake) {
        throwUnless(203, self.roundOpen);
        throwUnless(204, msg.roundId == self.currentRoundId);
        throwUnless(205, context().value >= self.minStake);
        throwUnless(206, !self.stakes.exists(sender()));

        self.stakes.set(sender(), StakeEntry {
            roundId: msg.roundId,
            amount: context().value,
            status: 0,
            credited: false
        });
        self.totalStaked += context().value;
    }

    receive(msg: CloseRound) {
        self.requireOwner();
        throwUnless(207, self.roundOpen);
        throwUnless(208, msg.roundId == self.currentRoundId);
        self.roundOpen = false;
    }

    receive(msg: MarkParticipant) {
        self.requireOwner();
        throwUnless(209, !self.roundOpen);
        throwUnless(210, msg.roundId == self.currentRoundId);
        throwUnless(211, self.stakes.exists(msg.participant));

        let stake: StakeEntry = self.stakes.get(msg.participant)!!;
        throwUnless(212, stake.roundId == msg.roundId);
        throwUnless(213, stake.status == 0);

        if (msg.success) {
            stake.status = 1;
            self.totalSuccessStake += stake.amount;
        } else {
            stake.status = 2;
            self.failedPool += stake.amount;
        }
        self.stakes.set(msg.participant, stake);
    }

    receive(msg: FinalizeRound) {
        self.requireOwner();
        throwUnless(214, !self.roundOpen);
        throwUnless(215, !self.roundFinalized);
        throwUnless(216, msg.roundId == self.currentRoundId);

        let fee: Int = self.failedPool * self.platformFeeBps / 10000;
        self.distributablePool = self.failedPool - fee;
        self.platformFeesAccrued += fee;
        self.roundFinalized = true;
    }

    receive(msg: CreditWinner) {
        self.requireOwner();
        throwUnless(217, self.roundFinalized);
        throwUnless(218, msg.roundId == self.currentRoundId);
        throwUnless(219, self.stakes.exists(msg.participant));

        let stake: StakeEntry = self.stakes.get(msg.participant)!!;
        throwUnless(220, stake.status == 1);
        throwUnless(221, !stake.credited);

        let reward: Int = 0;
        if (self.totalSuccessStake > 0) {
            reward = self.distributablePool * stake.amount / self.totalSuccessStake;
        }

        let existing: Int = 0;
        if (self.pendingWithdraw.exists(msg.participant)) {
            existing = self.pendingWithdraw.get(msg.participant)!!;
        }
        self.pendingWithdraw.set(msg.participant, existing + stake.amount + reward);

        stake.credited = true;
        self.stakes.set(msg.participant, stake);
    }

    receive(msg: Withdraw) {
        throwUnless(230, self.pendingWithdraw.exists(sender()));
        let amount: Int = self.pendingWithdraw.get(sender())!!;
        throwUnless(231, amount > 0);

        self.pendingWithdraw.set(sender(), 0);

        send(SendParameters {
            to: sender(),
            value: amount,
            bounce: false
        });
    }

    receive(msg: WithdrawFees) {
        self.requireOwner();
        throwUnless(240, msg.amount <= self.platformFeesAccrued);
        self.platformFeesAccrued -= msg.amount;
        send(SendParameters { to: msg.to, value: msg.amount, bounce: false });
    }

    receive(msg: EmergencyWithdraw) {
        self.requireOwner();
        throwUnless(250, msg.amount > 0);
        throwUnless(251, msg.amount <= self.failedPool);
        self.failedPool -= msg.amount;
        send(SendParameters { to: msg.to, value: msg.amount, bounce: false });
    }

    // owner가 totalStaked에서 직접 출금 (긴급 상황용)
    receive(msg: WithdrawStake) {
        self.requireOwner();
        throwUnless(260, msg.amount > 0);
        throwUnless(261, msg.amount <= self.totalStaked);
        self.totalStaked -= msg.amount;
        send(SendParameters { to: msg.to, value: msg.amount, bounce: false });
    }

    get fun getRoundState(): Int {
        return self.currentRoundId;
    }

    get fun getPendingWithdraw(addr: Address): Int {
        if (self.pendingWithdraw.exists(addr)) {
            return self.pendingWithdraw.get(addr)!!;
        }
        return 0;
    }

    get fun getFailedPool(): Int {
        return self.failedPool;
    }

    get fun getDistributablePool(): Int {
        return self.distributablePool;
    }

    get fun getTotalSuccessStake(): Int {
        return self.totalSuccessStake;
    }

    get fun getPlatformFeesAccrued(): Int {
        return self.platformFeesAccrued;
    }

    get fun getTotalStaked(): Int {
        return self.totalStaked;
    }
}
