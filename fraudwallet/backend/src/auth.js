// Authentication logic
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');
const { validatePhoneNumber } = require('./validation');

// How many times to encrypt the password (higher = more secure but slower)
const SALT_ROUNDS = 10;

/**
 * SIGNUP - Create a new user account
 * Steps:
 * 1. Check if email already exists
 * 2. Hash (encrypt) the password
 * 3. Save user to database
 * 4. Create authentication token
 */
const signup = async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber } = req.body;

    // Validate input
    if (!fullName || !email || !password || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, email, password, and phone number'
      });
    }

    // Validate phone number
    const phoneValidation = validatePhoneNumber(phoneNumber);
    if (!phoneValidation.valid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.message
      });
    }

    // Check if email already exists
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if phone number already exists
    const existingPhone = db.prepare('SELECT * FROM users WHERE phone_number = ?').get(phoneValidation.formatted);

    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    // Hash the password (encrypt it so we don't store plain text)
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new user into database
    const insertUser = db.prepare(`
      INSERT INTO users (full_name, email, password_hash, phone_number, phone_last_changed)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const result = insertUser.run(fullName, email, passwordHash, phoneValidation.formatted);
    const userId = result.lastInsertRowid;

    // Create JWT token (like a digital passport)
    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: '7d' } // Token expires in 7 days
    );

    // Return success with token and user info
    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: userId,
        fullName,
        email,
        phoneNumber: phoneValidation.formatted
      }
    });

    console.log(`✅ New user registered: ${email}`);

  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating account'
    });
  }
};

/**
 * LOGIN - Sign in with existing account
 * Steps:
 * 1. Find user by email
 * 2. Check if password matches
 * 3. Create authentication token
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user in database
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is terminated
    if (user.account_status === 'terminated') {
      return res.status(403).json({
        success: false,
        message: 'This account has been terminated'
      });
    }

    // Check if password matches
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: '7d' }
    );

    // Return success with token and user info
    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phoneNumber: user.phone_number
      }
    });

    console.log(`✅ User logged in: ${email}`);

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in'
    });
  }
};

module.exports = {
  signup,
  login
};
