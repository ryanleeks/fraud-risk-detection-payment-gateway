// Split payment management
const db = require('./database');
const { hasPasscode, verifyPasscode } = require('./passcode');
const fraudDetection = require('./fraud-detection');

/**
 * CREATE SPLIT PAYMENT
 * Create a new split payment request
 */
const createSplitPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, description, totalAmount, participants } = req.body;

    // Validation
    if (!title || !totalAmount || !participants || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, total amount, and participants'
      });
    }

    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total amount must be greater than 0'
      });
    }

    // Calculate number of participants (including creator)
    const numParticipants = participants.length + 1;
    const amountPerPerson = totalAmount / numParticipants;

    // Create split payment record
    const insertSplit = db.prepare(`
      INSERT INTO split_payments (creator_id, title, description, total_amount, num_participants, amount_per_person)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = insertSplit.run(userId, title, description || '', totalAmount, numParticipants, amountPerPerson);
    const splitPaymentId = result.lastInsertRowid;

    // Add creator as accepted participant
    const insertParticipant = db.prepare(`
      INSERT INTO split_participants (split_payment_id, user_id, status, responded_at)
      VALUES (?, ?, 'accepted', CURRENT_TIMESTAMP)
    `);
    insertParticipant.run(splitPaymentId, userId);

    // Add other participants
    const insertPendingParticipant = db.prepare(`
      INSERT INTO split_participants (split_payment_id, user_id, status)
      VALUES (?, ?, 'pending')
    `);

    for (const participantId of participants) {
      // Validate participant exists
      const participantUser = db.prepare("SELECT id FROM users WHERE id = ? AND account_status = 'active'").get(participantId);

      if (!participantUser) {
        // Rollback - delete the split payment
        db.prepare('DELETE FROM split_payments WHERE id = ?').run(splitPaymentId);
        db.prepare('DELETE FROM split_participants WHERE split_payment_id = ?').run(splitPaymentId);

        return res.status(404).json({
          success: false,
          message: `Participant with ID ${participantId} not found`
        });
      }

      insertPendingParticipant.run(splitPaymentId, participantId);
    }

    res.status(201).json({
      success: true,
      message: 'Split payment created successfully',
      splitPayment: {
        id: splitPaymentId,
        title,
        totalAmount,
        numParticipants,
        amountPerPerson
      }
    });

    console.log(`✅ User ${userId} created split payment: ${title}`);

  } catch (error) {
    console.error('❌ Create split payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating split payment'
    });
  }
};

/**
 * GET MY SPLIT PAYMENTS
 * Get all split payments where user is creator or participant
 */
const getMySplitPayments = (req, res) => {
  try {
    const userId = req.user.userId;

    // Get split payments where user is involved
    const splits = db.prepare(`
      SELECT DISTINCT
        sp.id,
        sp.creator_id,
        sp.title,
        sp.description,
        sp.total_amount,
        sp.num_participants,
        sp.amount_per_person,
        sp.status,
        sp.created_at,
        u.full_name as creator_name,
        u.account_id as creator_account_id,
        (SELECT COUNT(*) FROM split_participants WHERE split_payment_id = sp.id AND status = 'accepted') as accepted_count,
        (SELECT status FROM split_participants WHERE split_payment_id = sp.id AND user_id = ?) as my_status
      FROM split_payments sp
      JOIN users u ON sp.creator_id = u.id
      WHERE sp.id IN (
        SELECT split_payment_id FROM split_participants WHERE user_id = ?
      )
      ORDER BY sp.created_at DESC
    `).all(userId, userId);

    // Get participants for each split
    const splitsWithParticipants = splits.map(split => {
      const participants = db.prepare(`
        SELECT
          spt.status,
          spt.paid,
          spt.responded_at,
          spt.paid_at,
          u.id,
          u.full_name,
          u.account_id
        FROM split_participants spt
        JOIN users u ON spt.user_id = u.id
        WHERE spt.split_payment_id = ?
      `).all(split.id);

      return {
        ...split,
        participants
      };
    });

    res.status(200).json({
      success: true,
      splits: splitsWithParticipants
    });

  } catch (error) {
    console.error('❌ Get split payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching split payments'
    });
  }
};

/**
 * RESPOND TO SPLIT PAYMENT
 * Accept or reject a split payment request
 */
const respondToSplitPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { splitPaymentId, action } = req.body;

    if (!splitPaymentId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Please provide splitPaymentId and action'
      });
    }

    if (action !== 'accept' && action !== 'reject') {
      return res.status(400).json({
        success: false,
        message: 'Action must be "accept" or "reject"'
      });
    }

    // Check if user is a participant
    const participant = db.prepare(`
      SELECT * FROM split_participants
      WHERE split_payment_id = ? AND user_id = ?
    `).get(splitPaymentId, userId);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'You are not a participant in this split payment'
      });
    }

    if (participant.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `You have already ${participant.status} this request`
      });
    }

    // Update participant status
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    db.prepare(`
      UPDATE split_participants
      SET status = ?, responded_at = CURRENT_TIMESTAMP
      WHERE split_payment_id = ? AND user_id = ?
    `).run(newStatus, splitPaymentId, userId);

    // Check if all participants have responded
    const allParticipants = db.prepare(`
      SELECT status FROM split_participants
      WHERE split_payment_id = ?
    `).all(splitPaymentId);

    const allResponded = allParticipants.every(p => p.status !== 'pending');
    const anyRejected = allParticipants.some(p => p.status === 'rejected');

    // Update split payment status if all responded
    if (allResponded) {
      const newSplitStatus = anyRejected ? 'cancelled' : 'active';
      db.prepare(`
        UPDATE split_payments
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newSplitStatus, splitPaymentId);
    }

    res.status(200).json({
      success: true,
      message: `Split payment request ${action}ed successfully`
    });

    console.log(`✅ User ${userId} ${action}ed split payment ${splitPaymentId}`);

  } catch (error) {
    console.error('❌ Respond to split payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error responding to split payment'
    });
  }
};

/**
 * PAY MY SHARE
 * Mark that user has paid their share and transfer money to creator
 */
const payMyShare = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { splitPaymentId, passcode } = req.body;

    // Check if user has passcode setup
    if (!hasPasscode(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You must set up a transaction passcode before paying split bills',
        requiresPasscodeSetup: true
      });
    }

    // Verify passcode
    if (!passcode) {
      return res.status(400).json({
        success: false,
        message: 'Transaction passcode is required'
      });
    }

    const passcodeVerification = await verifyPasscode(userId, passcode);
    if (!passcodeVerification.success) {
      return res.status(passcodeVerification.locked ? 429 : 401).json({
        success: false,
        message: passcodeVerification.message,
        locked: passcodeVerification.locked,
        remainingAttempts: passcodeVerification.remainingAttempts
      });
    }

    if (!splitPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide splitPaymentId'
      });
    }

    // Get split payment details
    const splitPayment = db.prepare(`
      SELECT * FROM split_payments WHERE id = ?
    `).get(splitPaymentId);

    if (!splitPayment) {
      return res.status(404).json({
        success: false,
        message: 'Split payment not found'
      });
    }

    if (splitPayment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This split payment has been cancelled'
      });
    }

    // Check if user is a participant and has accepted
    const participant = db.prepare(`
      SELECT * FROM split_participants
      WHERE split_payment_id = ? AND user_id = ?
    `).get(splitPaymentId, userId);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'You are not a participant in this split payment'
      });
    }

    if (participant.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'You must accept the request before paying'
      });
    }

    if (participant.paid) {
      return res.status(400).json({
        success: false,
        message: 'You have already paid your share'
      });
    }

    // Check if payer has sufficient balance
    const payer = db.prepare('SELECT wallet_balance, full_name FROM users WHERE id = ?').get(userId);
    if (payer.wallet_balance < splitPayment.amount_per_person) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance to pay your share'
      });
    }

    // Get creator info
    const creator = db.prepare('SELECT full_name FROM users WHERE id = ?').get(splitPayment.creator_id);

    // ==========================================
    // FRAUD DETECTION CHECK
    // ==========================================
    const fraudCheck = await fraudDetection.analyzeFraudRisk({
      userId: userId,
      amount: splitPayment.amount_per_person,
      type: 'split_payment_sent',
      recipientId: splitPayment.creator_id,
      ipAddress: req.ip,
      recipientData: {
        id: splitPayment.creator_id,
        name: creator.full_name,
        accountId: null
      }
    }, {
      walletBalance: payer.wallet_balance,
      accountCreated: null
    });

    // Log fraud check result
    console.log(`🔍 Fraud Check (SplitPay) - User ${userId}: Score ${fraudCheck.riskScore}/100 (${fraudCheck.riskLevel}) - Action: ${fraudCheck.action}`);

    // Determine transaction status based on fraud detection
    const isBlocked = fraudCheck.action === 'BLOCK';
    const isReview = fraudCheck.action === 'REVIEW';

    // For blocked/high-risk splitpay transactions, we'll hold the money
    const shouldHoldMoney = isBlocked || isReview;
    const moneyStatus = shouldHoldMoney ? 'held' : 'completed';

    // Calculate hold duration (72 hours for review, 168 hours/7 days for blocked)
    let heldUntil = null;
    if (shouldHoldMoney) {
      heldUntil = new Date();
      heldUntil.setHours(heldUntil.getHours() + (isBlocked ? 168 : 72));
    }

    if (fraudCheck.action === 'REVIEW') {
      console.log(`⚠️  HIGH RISK SPLITPAY TRANSACTION - Flagged for review: User ${userId}, Amount: RM${splitPayment.amount_per_person.toFixed(2)}`);
    }

    if (isBlocked) {
      console.log(`🔒 BLOCKED SPLITPAY TRANSACTION - Money will be held: User ${userId}, Amount: RM${splitPayment.amount_per_person.toFixed(2)}`);
    }

    // Perform payment in a transaction
    const payment = db.transaction(() => {
      // Deduct from participant (always happens)
      db.prepare(`
        UPDATE users
        SET wallet_balance = wallet_balance - ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(splitPayment.amount_per_person, userId);

      // Only add to creator if NOT holding money
      if (!shouldHoldMoney) {
        db.prepare(`
          UPDATE users
          SET wallet_balance = wallet_balance + ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(splitPayment.amount_per_person, splitPayment.creator_id);
      }

      // Mark as paid
      db.prepare(`
        UPDATE split_participants
        SET paid = 1, paid_at = CURRENT_TIMESTAMP
        WHERE split_payment_id = ? AND user_id = ?
      `).run(splitPaymentId, userId);

      // Create transaction records with fraud detection fields
      const description = `Split payment: ${splitPayment.title}`;
      const recipientDescription = `Split payment: ${splitPayment.title} from ${payer.full_name}`;
      const recipientStatus = shouldHoldMoney ? 'pending' : 'completed';

      // Sender transaction record
      db.prepare(`
        INSERT INTO transactions (
          user_id, type, amount, status, description, recipient_id,
          money_status, held_until, fraud_log_id
        )
        VALUES (?, 'split_payment_sent', ?, 'completed', ?, ?, ?, ?, ?)
      `).run(
        userId,
        splitPayment.amount_per_person,
        description,
        splitPayment.creator_id,
        moneyStatus,
        heldUntil ? heldUntil.toISOString() : null,
        fraudCheck.logId || null
      );

      // Recipient transaction record
      db.prepare(`
        INSERT INTO transactions (
          user_id, type, amount, status, description, recipient_id,
          money_status, held_until, fraud_log_id
        )
        VALUES (?, 'split_payment_received', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        splitPayment.creator_id,
        splitPayment.amount_per_person,
        recipientStatus,
        recipientDescription,
        userId,
        moneyStatus,
        heldUntil ? heldUntil.toISOString() : null,
        fraudCheck.logId || null
      );
    });

    // Execute the transaction
    payment();

    // Check if all participants have paid
    const allParticipants = db.prepare(`
      SELECT paid FROM split_participants
      WHERE split_payment_id = ? AND status = 'accepted'
    `).all(splitPaymentId);

    const allPaid = allParticipants.every(p => p.paid === 1);

    // Update split payment status if all paid
    if (allPaid) {
      db.prepare(`
        UPDATE split_payments
        SET status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(splitPaymentId);
    }

    // Prepare response with fraud detection info
    const responseMessage = shouldHoldMoney
      ? `Payment processed but flagged for security review. Money will be held until admin verification.`
      : 'Payment recorded successfully';

    res.status(200).json({
      success: true,
      message: responseMessage,
      amountPaid: splitPayment.amount_per_person,
      fraudDetection: {
        riskScore: fraudCheck.riskScore,
        riskLevel: fraudCheck.riskLevel,
        action: fraudCheck.action,
        moneyHeld: shouldHoldMoney,
        heldUntil: heldUntil ? heldUntil.toISOString() : null
      }
    });

    console.log(`✅ User ${userId} paid RM${splitPayment.amount_per_person.toFixed(2)} for split payment ${splitPaymentId}${shouldHoldMoney ? ' (HELD FOR REVIEW)' : ''}`);

  } catch (error) {
    console.error('❌ Pay share error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording payment'
    });
  }
};

/**
 * CANCEL SPLIT PAYMENT
 * Creator can cancel the split payment and refund all participants who paid
 */
const cancelSplitPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { splitPaymentId } = req.body;

    if (!splitPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide splitPaymentId'
      });
    }

    // Get split payment details
    const splitPayment = db.prepare(`
      SELECT * FROM split_payments WHERE id = ?
    `).get(splitPaymentId);

    if (!splitPayment) {
      return res.status(404).json({
        success: false,
        message: 'Split payment not found'
      });
    }

    // Check if user is the creator
    if (splitPayment.creator_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can cancel this split payment'
      });
    }

    // Check if already cancelled or completed
    if (splitPayment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Split payment is already cancelled'
      });
    }

    if (splitPayment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed split payment'
      });
    }

    // Get all participants who have paid
    const paidParticipants = db.prepare(`
      SELECT spt.user_id, u.full_name
      FROM split_participants spt
      JOIN users u ON spt.user_id = u.id
      WHERE spt.split_payment_id = ? AND spt.paid = 1 AND spt.user_id != ?
    `).all(splitPaymentId, userId);

    // Get creator info
    const creator = db.prepare('SELECT wallet_balance, full_name FROM users WHERE id = ?').get(userId);

    // Calculate total refund needed
    const totalRefund = paidParticipants.length * splitPayment.amount_per_person;

    // Check if creator has enough balance to refund
    if (paidParticipants.length > 0 && creator.wallet_balance < totalRefund) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance to refund participants. Need RM${totalRefund.toFixed(2)}, have RM${creator.wallet_balance.toFixed(2)}`
      });
    }

    // Perform cancellation and refunds in a transaction
    const cancellation = db.transaction(() => {
      // Refund each participant who paid
      for (const participant of paidParticipants) {
        // Deduct from creator
        db.prepare(`
          UPDATE users
          SET wallet_balance = wallet_balance - ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(splitPayment.amount_per_person, userId);

        // Refund to participant
        db.prepare(`
          UPDATE users
          SET wallet_balance = wallet_balance + ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(splitPayment.amount_per_person, participant.user_id);

        // Create refund transaction records
        db.prepare(`
          INSERT INTO transactions (user_id, type, amount, status, description, recipient_id)
          VALUES (?, 'split_payment_refund_sent', ?, 'completed', ?, ?)
        `).run(userId, splitPayment.amount_per_person, `Refund for cancelled split: ${splitPayment.title}`, participant.user_id);

        db.prepare(`
          INSERT INTO transactions (user_id, type, amount, status, description, recipient_id)
          VALUES (?, 'split_payment_refund_received', ?, 'completed', ?, ?)
        `).run(participant.user_id, splitPayment.amount_per_person, `Refund from ${creator.full_name} for: ${splitPayment.title}`, userId);
      }

      // Mark split payment as cancelled
      db.prepare(`
        UPDATE split_payments
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(splitPaymentId);

      // Reset paid status for all participants (for record keeping)
      db.prepare(`
        UPDATE split_participants
        SET paid = 0
        WHERE split_payment_id = ?
      `).run(splitPaymentId);
    });

    // Execute the transaction
    cancellation();

    res.status(200).json({
      success: true,
      message: 'Split payment cancelled successfully',
      refundedCount: paidParticipants.length,
      totalRefunded: totalRefund
    });

    console.log(`✅ User ${userId} cancelled split payment ${splitPaymentId}, refunded ${paidParticipants.length} participants (RM${totalRefund.toFixed(2)})`);

  } catch (error) {
    console.error('❌ Cancel split payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling split payment'
    });
  }
};

module.exports = {
  createSplitPayment,
  getMySplitPayments,
  respondToSplitPayment,
  payMyShare,
  cancelSplitPayment
};
