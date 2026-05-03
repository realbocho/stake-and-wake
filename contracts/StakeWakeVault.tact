import "@stdlib/ownable";

struct StakeEntry {
    roundId: Int as uint32;
    amount: Int as coins;
    status: Int as uint8;
    claimed: Bool;
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

message Claim {
    queryId: Int as uint64;
    roundId: Int as uint32;
}

message WithdrawFees {
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

    successCount: Int as uint32;
    paidSuccessCount: Int as uint32;

    platformFeesAccrued: Int as coins;

    stakes: map<Address, StakeEntry>;

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
        self.successCount = 0;
        self.paidSuccessCount = 0;
        self.platformFeesAccrued = 0;
    }

    receive() {
        cashback(sender());
    }

    receive(msg: OpenRound) {
        self.requireOwner();
        throwUnless(201, !self.roundOpen);
        throwUnless(202, self.currentRoundId == 0 || self.paidSuccessCount == self.successCount);

        self.currentRoundId = msg.roundId;
        self.roundOpen = true;
        self.roundFinalized = false;
        self.minStake = msg.minStake;
        self.closesAt = msg.closesAt;
        self.totalStaked = 0;
        self.failedPool = 0;
        self.totalSuccessStake = 0;
        self.distributablePool = 0;
        self.successCount = 0;
        self.paidSuccessCount = 0;
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
            claimed: false
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

        let stake = self.stakes.get(msg.participant)!!;
        throwUnless(212, stake.roundId == msg.roundId);
        throwUnless(213, stake.status == 0);

        if (msg.success) {
            stake.status = 1;
            self.successCount += 1;
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

        let fee = self.failedPool * self.platformFeeBps / 10000;
        self.distributablePool = self.failedPool - fee;
        self.platformFeesAccrued += fee;
        self.roundFinalized = true;
    }

    receive(msg: Claim) {
        throwUnless(217, self.roundFinalized);
        throwUnless(218, self.stakes.exists(sender()));

        let stake = self.stakes.get(sender())!!;
        throwUnless(219, stake.roundId == msg.roundId);
        throwUnless(220, !stake.claimed);
        throwUnless(221, stake.status == 1);

        stake.claimed = true;
        self.paidSuccessCount += 1;
        self.stakes.set(sender(), stake);

        let reward: Int = 0;
        if (self.totalSuccessStake > 0) {
            reward = self.distributablePool * stake.amount / self.totalSuccessStake;
        }

        send(SendParameters {
            to: sender(),
            value: stake.amount + reward,
            bounce: false
        });
    }

    receive(msg: WithdrawFees) {
        self.requireOwner();
        throwUnless(222, msg.amount <= self.platformFeesAccrued);
        self.platformFeesAccrued -= msg.amount;

        send(SendParameters {
            to: msg.to,
            value: msg.amount,
            bounce: false
        });
    }

    get fun getRoundState(): Int {
        return self.currentRoundId;
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
}
